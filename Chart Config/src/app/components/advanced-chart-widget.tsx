import { useEffect, useRef, useCallback, useState } from "react";
import type {
  IChartingLibraryWidget,
  IOrderLineAdapter,
  IExecutionLineAdapter,
} from "@shared/tradingview";
import type {
  PriceLineConfig,
  TradeOrder,
  CurrentPriceLineConfig,
  CrosshairConfig,
} from "./chart-widget";
import { resolveColor } from "./price-line-editor";

// ── Constants ─────────────────────────────────────────────────────────────────
const LIBRARY_PATH = "/charting_library/";
const SYMBOL = "BINANCE:BTCUSDT";
const BINANCE_REST = "https://api.binance.com/api/v3";

// Map our LineStyle numbers (0–4) → TV OverrideLineStyle (0–2)
// TV only has Solid=0, Dotted=1, Dashed=2
function toTVLineStyle(style: number): number {
  if (style === 0) return 0; // Solid
  if (style === 1) return 1; // Dot
  if (style === 2) return 2; // Dash
  if (style === 3) return 2; // Large Dash → Dashed
  if (style === 4) return 1; // Sparse Dot → Dotted
  return 0;
}

function css(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function resolveTokenColor(token: string): string {
  if (token.startsWith("--")) return css(token);
  return resolveColor(token);
}

// ── Binance Datafeed ──────────────────────────────────────────────────────────
function tvResolutionToBinance(resolution: string): string {
  const map: Record<string, string> = {
    "1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "120": "2h", "240": "4h", "360": "6h", "720": "12h",
    "1D": "1d", "D": "1d", "1W": "1w", "W": "1w", "1M": "1M", "M": "1M",
  };
  return map[resolution] ?? "1d";
}

// LastBars cache: properly merges ticks so high/low/open stay consistent
class LastBars {
  private cache: Map<string, { open: number; high: number; low: number; time: number; volume: number }> = new Map();

  update(key: string, bar: { time: number; open: number; high: number; low: number; close: number; volume?: number }) {
    const existing = this.cache.get(key);
    if (!existing || bar.time > existing.time) {
      this.cache.set(key, { open: bar.open, high: bar.high, low: bar.low, time: bar.time, volume: bar.volume ?? 0 });
      return bar;
    }
    if (bar.time === existing.time) {
      const merged = {
        ...bar,
        open: existing.open,
        high: Math.max(existing.high, bar.high),
        low: Math.min(existing.low, bar.low),
        volume: (existing.volume ?? 0) + (bar.volume ?? 0),
      };
      this.cache.set(key, { ...merged, time: bar.time });
      return merged;
    }
    return bar;
  }
}

function makeDatafeed(onLivePrice?: (p: number) => void) {
  const subscribers = new Map<string, WebSocket>();
  const lastBars = new LastBars();

  return {
    onReady(callback: (config: object) => void) {
      setTimeout(() =>
        callback({
          supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
          supports_time: true,
        })
      , 0);
    },
    searchSymbols(_: string, __: string, ___: string, onResult: (r: object[]) => void) { onResult([]); },
    resolveSymbol(_: string, onResolve: (info: object) => void) {
      setTimeout(() => onResolve({
        name: "BTCUSDT", full_name: "BINANCE:BTCUSDT",
        description: "Bitcoin / Tether", type: "crypto",
        session: "24x7", timezone: "Etc/UTC", exchange: "BINANCE",
        minmov: 1, pricescale: 100,
        has_intraday: true, has_daily: true, has_weekly_and_monthly: true,
        supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
        volume_precision: 8, data_status: "streaming",
      }), 0);
    },
    getBars(
      _symbolInfo: object,
      resolution: string,
      periodParams: { from: number; to: number; countBack: number },
      onResult: (bars: object[], meta: { noData: boolean }) => void,
      onError: (err: string) => void,
    ) {
      const interval = tvResolutionToBinance(resolution);
      const url = `${BINANCE_REST}/klines?symbol=BTCUSDT&interval=${interval}&startTime=${periodParams.from * 1000}&endTime=${periodParams.to * 1000}&limit=1000`;
      fetch(url)
        .then(r => r.json())
        .then((data: [number, string, string, string, string, string][]) => {
          if (!Array.isArray(data) || data.length === 0) { onResult([], { noData: true }); return; }
          onResult(data.map(k => ({
            time: k[0], open: parseFloat(k[1]), high: parseFloat(k[2]),
            low: parseFloat(k[3]), close: parseFloat(k[4]), volume: parseFloat(k[5]),
          })), { noData: false });
        })
        .catch(e => onError(String(e)));
    },
    subscribeBars(
      _symbolInfo: object,
      resolution: string,
      onTick: (bar: object) => void,
      subscriberUID: string,
    ) {
      const interval = tvResolutionToBinance(resolution);
      const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
      ws.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          const k = msg.k;
          if (!k) return;
          const bar = {
            time: k.t, open: parseFloat(k.o), high: parseFloat(k.h),
            low: parseFloat(k.l), close: parseFloat(k.c), volume: parseFloat(k.v),
          };
          const merged = lastBars.update(`${subscriberUID}:${resolution}`, bar);
          onTick(merged);
          onLivePrice?.(bar.close);
        } catch { /* ignore parse errors */ }
      };
      subscribers.set(subscriberUID, ws);
    },
    unsubscribeBars(subscriberUID: string) {
      subscribers.get(subscriberUID)?.close();
      subscribers.delete(subscriberUID);
    },
    dispose() {
      subscribers.forEach(ws => ws.close());
      subscribers.clear();
    },
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface AdvancedChartWidgetProps {
  theme?: "dark" | "light";
  chartBg?: string;
  gridColor?: string;
  gridStyle?: number;
  showGrid?: boolean;
  priceLines?: PriceLineConfig[];
  onPriceLineChange?: (id: string, updates: Partial<PriceLineConfig>) => void;
  orders?: TradeOrder[];
  showOrders?: boolean;
  onOrderClick?: (order: TradeOrder) => void;
  currentPriceLineConfig?: CurrentPriceLineConfig;
  crosshairConfig?: CrosshairConfig;
  onLivePrice?: (price: number) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────
export function AdvancedChartWidget({
  theme = "dark",
  chartBg,
  gridColor,
  gridStyle,
  showGrid,
  priceLines = [],
  onPriceLineChange,
  orders = [],
  showOrders = true,
  onOrderClick,
  currentPriceLineConfig,
  crosshairConfig,
  onLivePrice,
}: AdvancedChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<IChartingLibraryWidget | null>(null);
  const chartReadyRef = useRef(false);
  const datafeedRef = useRef<ReturnType<typeof makeDatafeed> | null>(null);

  // Refs to keep latest props accessible inside TV callbacks without stale closures
  const onOrderClickRef = useRef(onOrderClick);
  const onPriceLineChangeRef = useRef(onPriceLineChange);
  const ordersRef = useRef(orders);
  const showOrdersRef = useRef(showOrders);
  const priceLinesRef = useRef(priceLines);

  useEffect(() => { onOrderClickRef.current = onOrderClick; }, [onOrderClick]);
  useEffect(() => { onPriceLineChangeRef.current = onPriceLineChange; }, [onPriceLineChange]);
  useEffect(() => { ordersRef.current = orders; }, [orders]);
  useEffect(() => { showOrdersRef.current = showOrders; }, [showOrders]);
  useEffect(() => { priceLinesRef.current = priceLines; }, [priceLines]);

  // Selected line — click a main order line on chart to reveal its TP/SL
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  const selectedLineIdRef = useRef<string | null>(null);
  const lastCrosshairPriceRef = useRef<number | null>(null);
  useEffect(() => {
    selectedLineIdRef.current = selectedLineId;
    if (!chartReadyRef.current) return;
    syncPriceLines();
  // syncPriceLines is stable (no deps change); selectedLineId is the real trigger
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLineId]);

  // Track drawn objects
  const orderLinesRef = useRef<Map<string, IOrderLineAdapter>>(new Map());
  const executionShapesRef = useRef<Map<string, IExecutionLineAdapter>>(new Map());

  // ── Helpers ────────────────────────────────────────────────────────────────

  const getChart = useCallback(() => {
    if (!chartReadyRef.current || !widgetRef.current) return null;
    try { return widgetRef.current.activeChart(); } catch { return null; }
  }, []);

  const applyOverrides = useCallback((overrides: Record<string, unknown>) => {
    try { widgetRef.current?.applyOverrides(overrides as Parameters<IChartingLibraryWidget["applyOverrides"]>[0]); }
    catch { /* chart may not be ready */ }
  }, []);

  // ── Initialize widget ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    const container = containerRef.current;

    const containerId = `tv-advanced-${Date.now()}`;
    container.id = containerId;

    // Click detection: find nearest order line to the crosshair price and toggle it selected
    const handleClick = () => {
      const price = lastCrosshairPriceRef.current;
      if (price == null) return;
      const lines = priceLinesRef.current.filter(pl => pl.visible);
      let bestId: string | null = null;
      let bestDiff = Infinity;
      lines.forEach(pl => {
        const diff = Math.abs(pl.price - price);
        if (diff < bestDiff) { bestDiff = diff; bestId = pl.id; }
      });
      const threshold = bestId != null
        ? (priceLinesRef.current.find(p => p.id === bestId)?.price ?? 0) * 0.008
        : Infinity;
      setSelectedLineId(prev => (bestId && bestDiff < threshold) ? (prev === bestId ? null : bestId) : null);
    };
    container.addEventListener("click", handleClick);

    const feed = makeDatafeed(onLivePrice);
    datafeedRef.current = feed;

    import("@shared/tradingview").then((lib) => {
      if (cancelled || !containerRef.current) return;

      const widget = new lib.widget({
        container: containerId,
        datafeed: feed as Parameters<typeof lib.widget>[0]["datafeed"],
        library_path: LIBRARY_PATH,
        locale: "en",
        symbol: SYMBOL,
        interval: "1D" as const,
        fullscreen: false,
        autosize: true,
        theme: theme === "light" ? "light" : "dark",
        disabled_features: [
          "use_localstorage_for_settings",
          "header_symbol_search",
          "header_compare",
          "symbol_search_hot_key",
        ],
        enabled_features: ["study_templates"],
        loading_screen: {
          backgroundColor: chartBg ? resolveTokenColor(chartBg) : (theme === "dark" ? "#131722" : "#ffffff"),
        },
      });

      widgetRef.current = widget;

      widget.onChartReady(() => {
        if (cancelled) return;
        chartReadyRef.current = true;

        // Track crosshair price for click-to-select detection
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (widget.activeChart() as any).crossHairMoved((params: { price: number }) => {
            if (typeof params?.price === "number") lastCrosshairPriceRef.current = params.price;
          });
        } catch { /* ignore if API not available */ }

        // Apply initial appearance
        applyAppearance();
        syncPriceLines();
        syncOrderMarkers();
      });
    }).catch(console.error);

    return () => {
      cancelled = true;
      container.removeEventListener("click", handleClick);
      chartReadyRef.current = false;
      orderLinesRef.current.clear();
      executionShapesRef.current.clear();
      datafeedRef.current?.dispose();
      datafeedRef.current = null;
      try { widgetRef.current?.remove(); } catch { /* already removed */ }
      widgetRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount once

  // ── Appearance: background, grid, crosshair, current price line ───────────

  const applyAppearance = useCallback(() => {
    const bg = chartBg ? resolveTokenColor(chartBg) : css("--surface-elevation-1");
    const grid = gridColor ? resolveTokenColor(gridColor) : css("--contrast-quaternary");
    const gridStyleTV = toTVLineStyle(gridStyle ?? 0);
    const crossColor = crosshairConfig?.color ? resolveTokenColor(crosshairConfig.color) : css("--accent-bg-default");

    const overrides: Record<string, unknown> = {
      // Background
      "paneProperties.background": bg,
      "paneProperties.backgroundType": "solid",

      // Grid
      "paneProperties.vertGridProperties.color": showGrid === false ? "rgba(0,0,0,0)" : grid,
      "paneProperties.vertGridProperties.style": gridStyleTV,
      "paneProperties.horzGridProperties.color": showGrid === false ? "rgba(0,0,0,0)" : grid,
      "paneProperties.horzGridProperties.style": gridStyleTV,

      // Crosshair
      "crossHairProperties.color": crossColor,
      "crossHairProperties.style": toTVLineStyle(crosshairConfig?.hStyle ?? 0),
      "crossHairProperties.width": 1,

      // Scale text colors (follow theme)
      "scalesProperties.textColor": css("--contrast-secondary"),
      "scalesProperties.lineColor": css("--border"),
    };

    // Current price line
    if (currentPriceLineConfig) {
      const priceLineColor = currentPriceLineConfig.followCandleColor
        ? css("--positive-bg-default") // will be updated live via theme
        : resolveTokenColor(currentPriceLineConfig.color);

      overrides["mainSeriesProperties.showPriceLine"] = currentPriceLineConfig.visible;
      overrides["mainSeriesProperties.priceLineWidth"] = currentPriceLineConfig.lineWidth;
      overrides["mainSeriesProperties.priceLineColor"] = priceLineColor;
    }

    applyOverrides(overrides);
  }, [chartBg, gridColor, gridStyle, showGrid, crosshairConfig, currentPriceLineConfig, applyOverrides]);

  // Re-apply when appearance props change
  useEffect(() => {
    if (!chartReadyRef.current) return;
    applyAppearance();
  }, [applyAppearance]);

  // ── Price Lines (Orders tab) ───────────────────────────────────────────────

  const syncPriceLines = useCallback(() => {
    const chart = getChart();
    if (!chart) return;

    const current = priceLinesRef.current;

    const selectedId = selectedLineIdRef.current;

    // Build the full set of IDs we want (main + TP/SL only for selected line)
    const desiredIds = new Set<string>();
    current.forEach(pl => {
      if (!pl.visible) return;
      desiredIds.add(pl.id);
      if (pl.id === selectedId) {
        if (pl.takeProfit != null) desiredIds.add(`${pl.id}-tp`);
        if (pl.stopLoss != null) desiredIds.add(`${pl.id}-sl`);
      }
    });

    // Remove stale lines
    Array.from(orderLinesRef.current.entries()).forEach(([id, line]) => {
      if (!desiredIds.has(id)) {
        try { line.remove(); } catch { /* ignore */ }
        orderLinesRef.current.delete(id);
      }
    });

    // Add / update
    current.forEach(pl => {
      if (!pl.visible) {
        // Also purge any children that may remain
        [`${pl.id}-tp`, `${pl.id}-sl`].forEach(childId => {
          if (orderLinesRef.current.has(childId)) {
            try { orderLinesRef.current.get(childId)?.remove(); } catch { /* ignore */ }
            orderLinesRef.current.delete(childId);
          }
        });
        return;
      }

      const lineColor = resolveTokenColor(pl.color);
      const labelBg = resolveTokenColor(pl.labelColor);
      const labelText = resolveTokenColor(pl.labelTextColor);

      // ── Main order line ────────────────────────────────────────────────────
      const existingMain = orderLinesRef.current.get(pl.id);
      if (existingMain) {
        try {
          existingMain
            .setPrice(pl.price)
            .setText(pl.pnlText ? `${pl.label}   ${pl.pnlText}` : pl.label)
            .setLineColor(lineColor)
            .setLineStyle(toTVLineStyle(pl.lineStyle))
            .setLineWidth(pl.lineWidth)
            .setBodyBackgroundColor(labelBg)
            .setBodyBorderColor(labelBg)
            .setBodyTextColor(labelText)
            .setCancelButtonBackgroundColor(labelBg)
            .setCancelButtonBorderColor(labelBg)
            .setCancelButtonIconColor(labelText);
        } catch { /* ignore if removed */ }
      } else {
        try {
          const plId = pl.id;
          const mainLine = chart.createOrderLine({ disableUndo: true })
            .setPrice(pl.price)
            .setText(pl.pnlText ? `${pl.label}   ${pl.pnlText}` : pl.label)
            .setLineColor(lineColor)
            .setLineStyle(toTVLineStyle(pl.lineStyle))
            .setLineWidth(pl.lineWidth)
            .setBodyFont("bold 11px 'Inter Display', sans-serif")
            .setBodyBackgroundColor(labelBg)
            .setBodyBorderColor(labelBg)
            .setBodyTextColor(labelText)
            .setQuantity("")
            .setQuantityBackgroundColor("rgba(0,0,0,0)")
            .setQuantityBorderColor("rgba(0,0,0,0)")
            .setEditable(false)
            .setExtendLeft(true)
            .setCancellable(true)
            .setCancelButtonBackgroundColor(labelBg)
            .setCancelButtonBorderColor(labelBg)
            .setCancelButtonIconColor(labelText)
            .onCancel(() => {
              onPriceLineChangeRef.current?.(plId, { visible: false });
            });
          orderLinesRef.current.set(pl.id, mainLine);
        } catch { /* ignore */ }
      }

      // ── Take Profit / Stop Loss — only visible when this line is selected ─
      if (pl.id !== selectedId) return;

      // ── Take Profit child line ─────────────────────────────────────────────
      const tpId = `${pl.id}-tp`;
      const tpColor = resolveTokenColor("--positive-bg-default");
      const tpTextColor = resolveTokenColor("--positive-over");

      if (pl.takeProfit != null) {
        const existingTp = orderLinesRef.current.get(tpId);
        if (existingTp) {
          try {
            existingTp
              .setPrice(pl.takeProfit)
              .setLineColor(tpColor)
              .setBodyBackgroundColor(tpColor)
              .setBodyBorderColor(tpColor)
              .setBodyTextColor(tpTextColor)
              .setCancelButtonBackgroundColor(tpColor)
              .setCancelButtonBorderColor(tpColor)
              .setCancelButtonIconColor(tpTextColor);
          } catch { /* ignore */ }
        } else {
          try {
            const plId = pl.id;
            let tpLine: IOrderLineAdapter;
            tpLine = chart.createOrderLine({ disableUndo: true })
              .setPrice(pl.takeProfit)
              .setText("TP")
              .setLineColor(tpColor)
              .setLineStyle(2) // Dashed
              .setLineWidth(1)
              .setBodyFont("bold 11px 'Inter Display', sans-serif")
              .setBodyBackgroundColor(tpColor)
              .setBodyBorderColor(tpColor)
              .setBodyTextColor(tpTextColor)
              .setQuantity("")
              .setQuantityBackgroundColor("rgba(0,0,0,0)")
              .setQuantityBorderColor("rgba(0,0,0,0)")
              .setEditable(true)
              .setExtendLeft(true)
              .setCancellable(true)
              .setCancelButtonBackgroundColor(tpColor)
              .setCancelButtonBorderColor(tpColor)
              .setCancelButtonIconColor(tpTextColor)
              .onMove(() => {
                onPriceLineChangeRef.current?.(plId, { takeProfit: tpLine.getPrice() });
              })
              .onCancel(() => {
                onPriceLineChangeRef.current?.(plId, { takeProfit: undefined });
              });
            orderLinesRef.current.set(tpId, tpLine);
          } catch { /* ignore */ }
        }
      } else {
        if (orderLinesRef.current.has(tpId)) {
          try { orderLinesRef.current.get(tpId)?.remove(); } catch { /* ignore */ }
          orderLinesRef.current.delete(tpId);
        }
      }

      // ── Stop Loss child line ───────────────────────────────────────────────
      const slId = `${pl.id}-sl`;
      const slColor = resolveTokenColor("--negative-bg-default");
      const slTextColor = resolveTokenColor("--negative-over");

      if (pl.stopLoss != null) {
        const existingSl = orderLinesRef.current.get(slId);
        if (existingSl) {
          try {
            existingSl
              .setPrice(pl.stopLoss)
              .setLineColor(slColor)
              .setBodyBackgroundColor(slColor)
              .setBodyBorderColor(slColor)
              .setBodyTextColor(slTextColor)
              .setCancelButtonBackgroundColor(slColor)
              .setCancelButtonBorderColor(slColor)
              .setCancelButtonIconColor(slTextColor);
          } catch { /* ignore */ }
        } else {
          try {
            const plId = pl.id;
            let slLine: IOrderLineAdapter;
            slLine = chart.createOrderLine({ disableUndo: true })
              .setPrice(pl.stopLoss)
              .setText("SL")
              .setLineColor(slColor)
              .setLineStyle(2) // Dashed
              .setLineWidth(1)
              .setBodyFont("bold 11px 'Inter Display', sans-serif")
              .setBodyBackgroundColor(slColor)
              .setBodyBorderColor(slColor)
              .setBodyTextColor(slTextColor)
              .setQuantity("")
              .setQuantityBackgroundColor("rgba(0,0,0,0)")
              .setQuantityBorderColor("rgba(0,0,0,0)")
              .setEditable(true)
              .setExtendLeft(true)
              .setCancellable(true)
              .setCancelButtonBackgroundColor(slColor)
              .setCancelButtonBorderColor(slColor)
              .setCancelButtonIconColor(slTextColor)
              .onMove(() => {
                onPriceLineChangeRef.current?.(plId, { stopLoss: slLine.getPrice() });
              })
              .onCancel(() => {
                onPriceLineChangeRef.current?.(plId, { stopLoss: undefined });
              });
            orderLinesRef.current.set(slId, slLine);
          } catch { /* ignore */ }
        }
      } else {
        if (orderLinesRef.current.has(slId)) {
          try { orderLinesRef.current.get(slId)?.remove(); } catch { /* ignore */ }
          orderLinesRef.current.delete(slId);
        }
      }
    });
  }, [getChart]);

  useEffect(() => {
    if (!chartReadyRef.current) return;
    syncPriceLines();
  }, [priceLines, syncPriceLines]);

  // ── Order Markers (History B/S markers) ───────────────────────────────────

  const syncOrderMarkers = useCallback(() => {
    const chart = getChart();
    if (!chart) return;

    const activeOrders = showOrdersRef.current ? ordersRef.current : [];
    const existingIds = new Set(executionShapesRef.current.keys());
    const newIds = new Set(activeOrders.map(o => o.id));

    // Remove stale
    existingIds.forEach(id => {
      if (!newIds.has(id)) {
        try { executionShapesRef.current.get(id)?.remove(); } catch { /* ignore */ }
        executionShapesRef.current.delete(id);
      }
    });

    // Add new
    activeOrders.forEach(order => {
      if (executionShapesRef.current.has(order.id)) return;

      const isBuy = order.type === "buy";
      const arrowColor = isBuy ? css("--positive-bg-default") : css("--negative-bg-default");
      const textColor = isBuy ? css("--positive-over") : css("--negative-over");

      try {
        const shape = chart.createExecutionShape({ disableUndo: true })
          .setTime(order.time)
          .setPrice(order.price)
          .setDirection(isBuy ? "buy" : "sell")
          .setText(isBuy ? "B" : "S")
          .setFont("bold 10px 'Inter Display', sans-serif")
          .setTextColor(textColor)
          .setArrowColor(arrowColor)
          .setArrowHeight(8)
          .setArrowSpacing(4);

        // Clicking the shape — TV doesn't have native click on exec shapes,
        // but we attach to the widget's mouse events as a fallback.
        executionShapesRef.current.set(order.id, shape);
      } catch { /* ignore */ }
    });
  }, [getChart]);

  useEffect(() => {
    if (!chartReadyRef.current) return;
    syncOrderMarkers();
  }, [orders, showOrders, syncOrderMarkers]);

  // ── Theme change: reinitialize widget ────────────────────────────────────
  // TV doesn't properly support full theme switch without remount — we destroy + recreate
  const prevThemeRef = useRef(theme);
  useEffect(() => {
    if (prevThemeRef.current === theme) return;
    prevThemeRef.current = theme;

    if (!widgetRef.current) return;
    try { widgetRef.current.changeTheme(theme === "light" ? "light" : "dark"); }
    catch { /* ignore */ }

    // Re-apply color overrides after theme change (colors are resolved from CSS vars)
    setTimeout(() => {
      if (chartReadyRef.current) applyAppearance();
    }, 300);
  }, [theme, applyAppearance]);

  return <div ref={containerRef} className="w-full h-full" />;
}
