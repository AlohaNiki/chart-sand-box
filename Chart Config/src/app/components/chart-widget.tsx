import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { resolveColor } from "./price-line-editor";
import {
  createChart,
  createSeriesMarkers,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type IPriceLine,
  type CreatePriceLineOptions,
  type PriceLineOptions,
  type MouseEventParams,
} from "lightweight-charts";

// ── Binance data ──────────────────────────────────────────────────────────────

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_STORAGE_KEY = "chartConfig_interval";

async function fetchKlines(
  interval: Interval,
  signal: AbortSignal
): Promise<CandlestickData<Time>[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=200`,
    { signal }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown[][] = await res.json();
  return data.map((k) => ({
    time: Math.floor((k[0] as number) / 1000) as Time,
    open: parseFloat(k[1] as string),
    high: parseFloat(k[2] as string),
    low: parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradeOrder {
  id: string;
  time: number; // UTCTimestamp (seconds)
  price: number;
  type: "buy" | "sell";
}

export interface PriceLineConfig {
  id: string;
  label: string;
  price: number;
  color: string;
  /** Background color of the axis price label badge */
  labelColor: string;
  /** Text color of the font on the axis price label badge */
  labelTextColor: string;
  lineWidth: number;
  lineStyle: number; // 0=solid, 1=dotted, 2=dashed, 3=large dashed, 4=sparse dotted
  visible: boolean;
}

interface ChartWidgetProps {
  priceLines: PriceLineConfig[];
  /** Called when user drags a price line on the chart */
  onPriceLineDrag?: (id: string, newPrice: number) => void;
  theme?: "dark" | "light";
  chartBg?: string;
  gridColor?: string;
  orders?: TradeOrder[];
  showOrders?: boolean;
  pendingOrderType?: "buy" | "sell" | null;
  onOrderPlace?: (order: TradeOrder) => void;
  onCancelPending?: () => void;
}

type WsStatus = "connecting" | "live" | "offline";

/** Snap distance in pixels for detecting price line hover/drag */
const SNAP_PX = 10;

/** Read a resolved CSS variable value from :root */
function css(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

/** Build rgba() string using an RGB CSS variable + custom alpha */
function rgba(rgbVar: string, alpha: number): string {
  return `rgba(${css(rgbVar)}, ${alpha})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartWidget({ priceLines, onPriceLineDrag, theme, chartBg, gridColor, orders, showOrders, pendingOrderType, onOrderPlace, onCancelPending }: ChartWidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersPluginRef = useRef<any>(null);

  // Keep mutable refs for callbacks so event listeners always see latest values
  const priceLinesConfigRef = useRef<PriceLineConfig[]>(priceLines);
  const onPriceLineDragRef = useRef(onPriceLineDrag);
  const onOrderPlaceRef = useRef(onOrderPlace);
  const onCancelPendingRef = useRef(onCancelPending);
  const pendingOrderTypeRef = useRef(pendingOrderType ?? null);
  const draggingIdRef = useRef<string | null>(null);

  // Interval state (persisted in localStorage)
  const [interval, setInterval] = useState<Interval>(() => {
    try {
      const stored = localStorage.getItem(INTERVAL_STORAGE_KEY);
      if (stored && (INTERVALS as readonly string[]).includes(stored)) {
        return stored as Interval;
      }
    } catch {}
    return "1d";
  });

  const [chartReady, setChartReady] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  useEffect(() => { priceLinesConfigRef.current = priceLines; }, [priceLines]);
  useEffect(() => { onPriceLineDragRef.current = onPriceLineDrag; }, [onPriceLineDrag]);
  useEffect(() => { onOrderPlaceRef.current = onOrderPlace; }, [onOrderPlace]);
  useEffect(() => { onCancelPendingRef.current = onCancelPending; }, [onCancelPending]);
  useEffect(() => { pendingOrderTypeRef.current = pendingOrderType ?? null; }, [pendingOrderType]);

  // ── Save interval to localStorage ─────────────────────────────────────────
  useEffect(() => {
    try { localStorage.setItem(INTERVAL_STORAGE_KEY, interval); } catch {}
  }, [interval]);

  // ── Initialize chart + drag handling (runs once) ──────────────────────────
  useEffect(() => {
    if (!chartContainerRef.current) return;
    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: resolveColor(chartBg ?? "--surface-canvas") },
        textColor: css("--contrast-secondary"),
        fontFamily: "'Inter Display', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: resolveColor(gridColor ?? "--border") },
        horzLines: { color: resolveColor(gridColor ?? "--border") },
      },
      crosshair: {
        vertLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),
          labelBackgroundColor: css("--accent-bg-default"),
        },
        horzLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),
          labelBackgroundColor: css("--accent-bg-default"),
        },
      },
      rightPriceScale: {
        borderColor: css("--border"),
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: css("--border"),
        timeVisible: false,
        rightOffset: 10,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: css("--positive-bg-default"),
      downColor: css("--negative-bg-default"),
      borderUpColor: css("--positive-bg-default"),
      borderDownColor: css("--negative-bg-default"),
      wickUpColor: rgba("--positive-bg-default-rgb", 0.6),
      wickDownColor: rgba("--negative-bg-default-rgb", 0.6),
    });

    chartRef.current = chart;
    seriesRef.current = series;
    markersPluginRef.current = createSeriesMarkers(series, []);
    setChartReady(true);

    // --- Drag-on-chart logic ---
    const findNearestLine = (clientY: number): string | null => {
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top;
      let closestId: string | null = null;
      let closestDist = Infinity;
      for (const config of priceLinesConfigRef.current) {
        if (!config.visible) continue;
        const coord = series.priceToCoordinate(config.price);
        if (coord === null) continue;
        const dist = Math.abs(coord - y);
        if (dist < closestDist && dist < SNAP_PX) {
          closestDist = dist;
          closestId = config.id;
        }
      }
      return closestId;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const nearId = findNearestLine(e.clientY);
      if (!nearId) return;
      e.preventDefault();
      e.stopPropagation();
      draggingIdRef.current = nearId;
      container.setPointerCapture(e.pointerId);
      chart.applyOptions({ handleScroll: false, handleScale: false });
      container.style.cursor = "ns-resize";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (draggingIdRef.current) {
        const rect = container.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const price = series.coordinateToPrice(y);
        if (price !== null && onPriceLineDragRef.current) {
          onPriceLineDragRef.current(
            draggingIdRef.current,
            Math.round(Number(price) * 100) / 100
          );
        }
      } else {
        const nearId = findNearestLine(e.clientY);
        container.style.cursor = pendingOrderTypeRef.current ? "crosshair" : nearId ? "ns-resize" : "";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingIdRef.current) {
        draggingIdRef.current = null;
        try { container.releasePointerCapture(e.pointerId); } catch {}
        chart.applyOptions({ handleScroll: true, handleScale: true });
        container.style.cursor = "";
      }
    };

    container.addEventListener("pointerdown", onPointerDown, { capture: true });
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointerup", onPointerUp);

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown, { capture: true });
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerup", onPointerUp);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersPluginRef.current = null;
      priceLinesRef.current.clear();
      setChartReady(false);
    };
  }, []);

  // ── Fetch historical data + open WebSocket (re-runs on interval change) ───
  useEffect(() => {
    if (!chartReady || !seriesRef.current || !chartRef.current) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    setIsLoading(true);
    setWsStatus("connecting");

    // Close previous WebSocket
    wsRef.current?.close();
    wsRef.current = null;

    const controller = new AbortController();
    let cancelled = false;

    // Update time/seconds visibility for this interval
    chart.applyOptions({
      timeScale: {
        timeVisible: interval !== "1d",
        secondsVisible: interval === "1m",
      },
    });

    (async () => {
      try {
        const candles = await fetchKlines(interval, controller.signal);
        if (cancelled) return;

        series.setData(candles);
        chart.timeScale().fitContent();
        setIsLoading(false);

        // Live WebSocket
        const ws = new WebSocket(
          `wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`
        );
        wsRef.current = ws;

        ws.onopen = () => {
          if (!cancelled) setWsStatus("live");
        };

        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(event.data as string);
            const k = msg.k;
            seriesRef.current?.update({
              time: Math.floor((k.t as number) / 1000) as Time,
              open: parseFloat(k.o as string),
              high: parseFloat(k.h as string),
              low: parseFloat(k.l as string),
              close: parseFloat(k.c as string),
            });
          } catch {}
        };

        ws.onerror = () => {
          if (!cancelled) setWsStatus("offline");
        };

        ws.onclose = () => {
          if (!cancelled) setWsStatus("offline");
        };
      } catch {
        if (!cancelled) {
          setIsLoading(false);
          setWsStatus("offline");
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [interval, chartReady]);

  // ── Update chart colors when theme / bg / grid changes ───────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const resolvedGrid = resolveColor(gridColor ?? "--border");

    chart.applyOptions({
      layout: {
        textColor: css("--contrast-secondary"),
        background: { type: ColorType.Solid, color: resolveColor(chartBg ?? "--surface-canvas") },
      },
      grid: {
        vertLines: { color: resolvedGrid },
        horzLines: { color: resolvedGrid },
      },
      crosshair: {
        vertLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),
          labelBackgroundColor: css("--accent-bg-default"),
        },
        horzLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),
          labelBackgroundColor: css("--accent-bg-default"),
        },
      },
      rightPriceScale: { borderColor: css("--border") },
      timeScale: { borderColor: css("--border") },
    });

    series.applyOptions({
      upColor: css("--positive-bg-default"),
      downColor: css("--negative-bg-default"),
      borderUpColor: css("--positive-bg-default"),
      borderDownColor: css("--negative-bg-default"),
      wickUpColor: rgba("--positive-bg-default-rgb", 0.6),
      wickDownColor: rgba("--negative-bg-default-rgb", 0.6),
    });
  }, [theme, chartBg, gridColor]);

  // ── Sync price lines with chart ───────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const existingLines = priceLinesRef.current;
    const currentIds = new Set(priceLines.map((pl) => pl.id));

    for (const [id, line] of existingLines) {
      if (!currentIds.has(id)) {
        series.removePriceLine(line);
        existingLines.delete(id);
      }
    }

    for (const config of priceLines) {
      if (!config.visible) {
        const existing = existingLines.get(config.id);
        if (existing) {
          series.removePriceLine(existing);
          existingLines.delete(config.id);
        }
        continue;
      }

      const options: CreatePriceLineOptions = {
        price: config.price,
        color: resolveColor(config.color),
        lineWidth: config.lineWidth as PriceLineOptions["lineWidth"],
        lineStyle: config.lineStyle,
        axisLabelVisible: true,
        title: config.label,
        axisLabelColor: resolveColor(config.labelColor),
        axisLabelTextColor: resolveColor(config.labelTextColor),
      };

      const existing = existingLines.get(config.id);
      if (existing) {
        existing.applyOptions(options);
      } else {
        const line = series.createPriceLine(options);
        existingLines.set(config.id, line);
      }
    }
  }, [priceLines, theme]);

  // ── Sync trade order markers ──────────────────────────────────────────────
  useEffect(() => {
    const plugin = markersPluginRef.current;
    if (!plugin || !chartReady) return;
    if (!showOrders || !orders?.length) {
      plugin.setMarkers([]);
      return;
    }
    plugin.setMarkers(
      orders.map((o) => ({
        id: o.id,
        time: o.time as Time,
        price: o.price,
        position: "atPriceMiddle" as const,
        shape: "circle" as const,
        color: o.type === "buy" ? css("--positive-bg-default") : css("--negative-bg-default"),
        text: o.type === "buy" ? "B" : "S",
        size: 1.5,
      }))
    );
  }, [orders, showOrders, theme, chartReady]);

  // ── Click-to-place order ───────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series || !pendingOrderType || !chartReady) return;

    const handler = (param: MouseEventParams<Time>) => {
      if (!param.time || !param.point) return;
      if (draggingIdRef.current) return;
      const price = series.coordinateToPrice(param.point.y);
      if (price === null) return;
      onOrderPlaceRef.current?.({
        id: `order-${Date.now()}`,
        time: param.time as unknown as number,
        price: Math.round(Number(price) * 100) / 100,
        type: pendingOrderTypeRef.current!,
      });
    };

    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelPendingRef.current?.();
    };

    chart.subscribeClick(handler);
    window.addEventListener("keydown", onEsc);
    return () => {
      chart.unsubscribeClick(handler);
      window.removeEventListener("keydown", onEsc);
    };
  }, [pendingOrderType, chartReady]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full min-h-[400px]"
      style={{ fontFamily: "'Inter Display', sans-serif" }}
    >
      {/* Chart canvas */}
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Interval selector + reset view — top left */}
      <div className="absolute top-[8px] left-[8px] flex items-center gap-[4px] z-10">
        <div
          className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px]"
          style={{ background: "var(--secondary)" }}
        >
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className="px-[8px] py-[3px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
              style={{
                fontSize: "var(--text-label)",
                background: interval === iv ? "var(--card)" : "transparent",
                color: interval === iv ? "var(--foreground)" : "var(--muted-foreground)",
                fontWeight: interval === iv ? "600" : "400",
              }}
            >
              {iv.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Reset view button */}
        <button
          onClick={() => chartRef.current?.timeScale().fitContent()}
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          title="Reset chart view"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Live status indicator — top right */}
      <div
        className="absolute top-[8px] right-[8px] flex items-center gap-[5px] z-10 px-[8px] py-[3px] rounded-[var(--radius-sm)]"
        style={{
          fontSize: "var(--text-label)",
          background: "var(--secondary)",
          color:
            wsStatus === "live"
              ? "var(--positive-bg-default)"
              : wsStatus === "connecting"
              ? "var(--muted-foreground)"
              : "var(--negative-bg-default)",
        }}
      >
        <span
          className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${wsStatus === "live" ? "animate-pulse" : ""}`}
          style={{
            background:
              wsStatus === "live"
                ? "var(--positive-bg-default)"
                : wsStatus === "connecting"
                ? "var(--muted-foreground)"
                : "var(--negative-bg-default)",
          }}
        />
        {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "..." : "OFFLINE"}
      </div>

      {/* Pending order placement banner */}
      {pendingOrderType && (
        <div
          className="absolute top-[44px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-[8px] px-[12px] py-[6px] rounded-[var(--radius)] pointer-events-none"
          style={{
            background: pendingOrderType === "buy" ? css("--positive-bg-default") : css("--negative-bg-default"),
            color: pendingOrderType === "buy" ? css("--positive-over") : css("--negative-over"),
            fontFamily: "'Inter Display', sans-serif",
            fontSize: "var(--text-label)",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {pendingOrderType === "buy" ? "↑ Click to place Buy order" : "↓ Click to place Sell order"}
          <span style={{ opacity: 0.7, fontWeight: 400 }}>· ESC to cancel</span>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div
          className="absolute inset-0 flex items-center justify-center z-20"
          style={{ background: "rgba(0,0,0,0.12)" }}
        >
          <span
            style={{
              color: "var(--muted-foreground)",
              fontSize: "var(--text-label)",
            }}
          >
            Loading…
          </span>
        </div>
      )}
    </div>
  );
}
