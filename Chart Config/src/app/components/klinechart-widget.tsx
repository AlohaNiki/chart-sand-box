import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { init, dispose, registerOverlay, type Chart, type KLineData } from "klinecharts";
import { resolveColor } from "./price-line-editor";
import type { PriceLineConfig, TradeOrder } from "./chart-widget";

// ── Helpers ───────────────────────────────────────────────────────────────────

function css(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

// ── Custom overlay registration ───────────────────────────────────────────────

let _overlaysRegistered = false;

function ensureOverlaysRegistered() {
  if (_overlaysRegistered) return;
  _overlaysRegistered = true;

  // ── Labeled price line ──────────────────────────────────────────────────────
  registerOverlay({
    name: "labeledPriceLine",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      const label = typeof overlay.extendData === "string" ? overlay.extendData : "";
      const value = (overlay.points as Array<{ value?: number }>)[0]?.value ?? 0;
      const priceStr = value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      const displayText = label ? `${label}  ${priceStr}` : priceStr;
      const y = coordinates[0]?.y ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return [
        { type: "line", attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] }, ignoreEvent: true },
        { type: "text", attrs: { x: bounding.width - 6, y, text: displayText, align: "right", baseline: "middle" }, ignoreEvent: true },
      ] as any[];
    },
  });

  // ── Buy marker — badge below candle low, tail points UP ────────────────────
  registerOverlay({
    name: "buyMarker",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates }) => {
      const x = coordinates[0]?.x ?? 0;
      const y = coordinates[0]?.y ?? 0;
      const GAP = 4, TAIL = 5, HALF_TW = 4, H = 18, W = 20, R = 3;
      const tipY  = y + GAP;
      const baseY = tipY + TAIL;
      const bg = css("--positive-bg-default");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return [
        {
          type: "rect",
          attrs: { x: x - W / 2, y: baseY, width: W, height: H },
          styles: { style: "fill", color: bg, borderColor: bg, borderRadius: R, borderSize: 0 },
          ignoreEvent: false,
        },
        {
          type: "polygon",
          attrs: { coordinates: [{ x: x - HALF_TW, y: baseY }, { x: x + HALF_TW, y: baseY }, { x, y: tipY }] },
          styles: { style: "fill", color: bg, borderColor: bg },
          ignoreEvent: false,
        },
        {
          type: "text",
          attrs: { x, y: baseY + H / 2, text: "B", align: "center", baseline: "middle" },
          styles: {
            color: "#FFFFFF", size: 10, weight: 500,
            backgroundColor: "transparent", borderColor: "transparent",
            borderSize: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
          },
          ignoreEvent: true,
        },
      ] as any[];
    },
  });

  // ── Sell marker — badge above candle high, tail points DOWN ────────────────
  registerOverlay({
    name: "sellMarker",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ coordinates }) => {
      const x = coordinates[0]?.x ?? 0;
      const y = coordinates[0]?.y ?? 0;
      const GAP = 4, TAIL = 5, HALF_TW = 4, H = 18, W = 20, R = 3;
      const tipY  = y - GAP;
      const baseY = tipY - TAIL;
      const bg = css("--negative-bg-default");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return [
        {
          type: "rect",
          attrs: { x: x - W / 2, y: baseY - H, width: W, height: H },
          styles: { style: "fill", color: bg, borderColor: bg, borderRadius: R, borderSize: 0 },
          ignoreEvent: false,
        },
        {
          type: "polygon",
          attrs: { coordinates: [{ x: x - HALF_TW, y: baseY }, { x: x + HALF_TW, y: baseY }, { x, y: tipY }] },
          styles: { style: "fill", color: bg, borderColor: bg },
          ignoreEvent: false,
        },
        {
          type: "text",
          attrs: { x, y: baseY - H / 2, text: "S", align: "center", baseline: "middle" },
          styles: {
            color: "#FFFFFF", size: 10, weight: 500,
            backgroundColor: "transparent", borderColor: "transparent",
            borderSize: 0, paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
          },
          ignoreEvent: true,
        },
      ] as any[];
    },
  });
}

// ── Interval / Period mapping ─────────────────────────────────────────────────

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];
const INTERVAL_STORAGE_KEY = "chartConfig_interval";

type PeriodType = "minute" | "hour" | "day";
interface Period { type: PeriodType; span: number }

function intervalToPeriod(iv: Interval): Period {
  switch (iv) {
    case "1m":  return { type: "minute", span: 1  };
    case "5m":  return { type: "minute", span: 5  };
    case "15m": return { type: "minute", span: 15 };
    case "1h":  return { type: "hour",   span: 1  };
    case "4h":  return { type: "hour",   span: 4  };
    case "1d":  return { type: "day",    span: 1  };
  }
}

function periodToBinanceInterval(period: Period): string {
  if (period.type === "minute") return `${period.span}m`;
  if (period.type === "hour")   return `${period.span}h`;
  return "1d";
}

// ── Line style mapping ────────────────────────────────────────────────────────

function lineStyleStr(n: number): "solid" | "dashed" {
  return n === 0 ? "solid" : "dashed";
}

// ── Price-line overlay styles ─────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plStyles(cfg: PriceLineConfig): any {
  const lineColor = resolveColor(cfg.color);
  const labelBg   = resolveColor(cfg.labelColor);
  const labelText = resolveColor(cfg.labelTextColor);
  return {
    line: { color: lineColor, size: cfg.lineWidth, style: lineStyleStr(cfg.lineStyle) },
    text: {
      color: labelText, backgroundColor: labelBg, borderColor: labelBg,
      borderRadius: 3, paddingLeft: 5, paddingRight: 5, paddingTop: 2, paddingBottom: 2,
    },
  };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface KlineChartWidgetProps {
  priceLines: PriceLineConfig[];
  theme?: "dark" | "light";
  chartBg?: string;
  gridColor?: string;
  orders?: TradeOrder[];
  showOrders?: boolean;
  onOrderClick?: (order: TradeOrder) => void;
  pendingOrderType?: "buy" | "sell" | null;
  onOrderPlace?: (order: TradeOrder) => void;
  onCancelPending?: () => void;
}

type WsStatus = "connecting" | "live" | "offline";

// ── Component ─────────────────────────────────────────────────────────────────

export function KlineChartWidget({
  priceLines, theme, chartBg, gridColor,
  orders, showOrders, onOrderClick,
  pendingOrderType, onOrderPlace, onCancelPending,
}: KlineChartWidgetProps) {
  const containerRef      = useRef<HTMLDivElement>(null);
  const chartRef          = useRef<Chart | null>(null);
  const wsRef             = useRef<WebSocket | null>(null);

  // Stable callback refs
  const onOrderClickRef   = useRef(onOrderClick);
  const onOrderPlaceRef   = useRef(onOrderPlace);
  const onCancelRef       = useRef(onCancelPending);
  const pendingTypeRef    = useRef(pendingOrderType ?? null);
  useEffect(() => { onOrderClickRef.current  = onOrderClick;    }, [onOrderClick]);
  useEffect(() => { onOrderPlaceRef.current  = onOrderPlace;    }, [onOrderPlace]);
  useEffect(() => { onCancelRef.current      = onCancelPending; }, [onCancelPending]);
  useEffect(() => { pendingTypeRef.current   = pendingOrderType ?? null; }, [pendingOrderType]);

  // Candle high/low map keyed by seconds
  const candleMapRef      = useRef<Map<number, { high: number; low: number }>>(new Map());
  const [candleMapVersion, setCandleMapVersion] = useState(0);

  const [interval, setIntervalState] = useState<Interval>(() => {
    try {
      const s = localStorage.getItem(INTERVAL_STORAGE_KEY);
      if (s && (INTERVALS as readonly string[]).includes(s)) return s as Interval;
    } catch {}
    return "1d";
  });

  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  const plIds        = useRef<Set<string>>(new Set());
  const orderIds     = useRef<Set<string>>(new Set());
  const orderDataMap = useRef<Map<string, TradeOrder>>(new Map());

  // ── Init chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;

    ensureOverlaysRegistered();

    const chart = init(container);
    if (!chart) return;
    chartRef.current = chart;

    applyStyles(chart, theme, chartBg, gridColor);

    // ── DataLoader ────────────────────────────────────────────────────────────
    chart.setDataLoader({
      getBars: ({ period, callback }) => {
        const binanceIv = periodToBinanceInterval(period as Period);
        setWsStatus("connecting");
        fetch(`https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${binanceIv}&limit=1000`)
          .then((r) => r.json())
          .then((data: unknown[][]) => {
            const bars: KLineData[] = data.map((k) => ({
              timestamp: k[0] as number,
              open:   parseFloat(k[1] as string),
              high:   parseFloat(k[2] as string),
              low:    parseFloat(k[3] as string),
              close:  parseFloat(k[4] as string),
              volume: parseFloat(k[5] as string),
            }));
            const map = new Map<number, { high: number; low: number }>();
            for (const b of bars) map.set(Math.floor(b.timestamp / 1000), { high: b.high, low: b.low });
            candleMapRef.current = map;
            setCandleMapVersion((v) => v + 1);
            callback(bars, false);
          })
          .catch(() => callback([], true));
      },

      subscribeBar: ({ period, callback }) => {
        const binanceIv = periodToBinanceInterval(period as Period);
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${binanceIv}`);
        wsRef.current = ws;
        ws.onopen  = () => setWsStatus("live");
        ws.onerror = () => setWsStatus("offline");
        ws.onclose = () => setWsStatus("offline");
        ws.onmessage = (e) => {
          try {
            const { k } = JSON.parse(e.data as string);
            const bar: KLineData = {
              timestamp: k.t as number,
              open:   parseFloat(k.o), high: parseFloat(k.h),
              low:    parseFloat(k.l), close: parseFloat(k.c),
              volume: parseFloat(k.v),
            };
            candleMapRef.current.set(Math.floor((k.t as number) / 1000), { high: bar.high, low: bar.low });
            callback(bar);
          } catch {}
        };
      },

      unsubscribeBar: () => { wsRef.current?.close(); wsRef.current = null; },
    });

    chart.setSymbol({ shortName: "BTC/USDT", pricePrecision: 2 });
    chart.setPeriod(intervalToPeriod(interval));

    // ── Click-to-place order ──────────────────────────────────────────────────
    const onCandleClick = (data: unknown) => {
      if (!pendingTypeRef.current) return;
      const ch = data as { x?: number; y?: number; timestamp?: number };
      if (ch.x === undefined || ch.y === undefined) return;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pts = chart.convertFromPixel([{ x: ch.x, y: ch.y }]) as any;
      const pt  = Array.isArray(pts) ? pts[0] : pts;
      if (!pt || pt.value === undefined) return;

      const ts = ch.timestamp ?? pt.timestamp;
      if (!ts) return;

      onOrderPlaceRef.current?.({
        id:    `order-${Date.now()}`,
        time:  Math.floor(ts / 1000),
        price: Math.round(Number(pt.value) * 100) / 100,
        type:  pendingTypeRef.current,
      });
    };

    chart.subscribeAction("onCandleBarClick", onCandleClick);

    // ── Cursor ────────────────────────────────────────────────────────────────
    const onPointerMove = () => {
      if (pendingTypeRef.current) container.style.cursor = "crosshair";
    };
    container.addEventListener("pointermove", onPointerMove);

    // ── ESC to cancel ─────────────────────────────────────────────────────────
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancelRef.current?.();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      chart.unsubscribeAction("onCandleBarClick", onCandleClick);
      container.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("keydown", onKeyDown);
      wsRef.current?.close();
      wsRef.current = null;
      dispose(chart);
      chartRef.current = null;
      plIds.current.clear();
      orderIds.current.clear();
      orderDataMap.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Interval change ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!chartRef.current) return;
    setWsStatus("connecting");
    chartRef.current.setPeriod(intervalToPeriod(interval));
    try { localStorage.setItem(INTERVAL_STORAGE_KEY, interval); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval]);

  // ── Theme / colors ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (chartRef.current) applyStyles(chartRef.current, theme, chartBg, gridColor);
  }, [theme, chartBg, gridColor]);

  // ── Price lines sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const visible = new Set(priceLines.filter((p) => p.visible).map((p) => p.id));

    for (const id of plIds.current) {
      if (!visible.has(id)) { chart.removeOverlay({ id: `pl-${id}` }); plIds.current.delete(id); }
    }

    for (const cfg of priceLines) {
      if (!cfg.visible) continue;
      const overlayId = `pl-${cfg.id}`;
      const styles = plStyles(cfg);
      if (plIds.current.has(cfg.id)) {
        chart.overrideOverlay({ id: overlayId, points: [{ value: cfg.price }], extendData: cfg.label, styles });
      } else {
        chart.createOverlay({ name: "labeledPriceLine", id: overlayId, points: [{ value: cfg.price }], styles, extendData: cfg.label, lock: true });
        plIds.current.add(cfg.id);
      }
    }
  }, [priceLines, theme]);

  // ── Order markers sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    for (const id of orderIds.current) chart.removeOverlay({ id });
    orderIds.current.clear();
    orderDataMap.current.clear();

    if (!showOrders || !orders?.length) return;

    const cmap      = candleMapRef.current;
    const container = containerRef.current;

    for (const order of orders) {
      const isBuy  = order.type === "buy";
      const id     = `order-${order.id}`;
      const candle = cmap.get(order.time);
      const anchorPrice = isBuy ? (candle?.low ?? order.price) : (candle?.high ?? order.price);

      chart.createOverlay({
        name: isBuy ? "buyMarker" : "sellMarker",
        id,
        points: [{ timestamp: order.time * 1000, value: anchorPrice }],
        onClick: () => { onOrderClickRef.current?.(order); },
        onMouseEnter: () => { if (container && !pendingTypeRef.current) container.style.cursor = "pointer"; },
        onMouseLeave: () => { if (container && !pendingTypeRef.current) container.style.cursor = ""; },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      orderIds.current.add(id);
      orderDataMap.current.set(id, order);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, showOrders, theme, candleMapVersion]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full min-h-[400px]"
      style={{ fontFamily: "'Inter Display', sans-serif" }}
    >
      <div
        ref={containerRef}
        className="w-full h-full"
        style={{ background: resolveColor(chartBg ?? "--surface-elevation-1") }}
      />

      {/* Interval selector — top left */}
      <div className="absolute top-[8px] left-[8px] flex items-center gap-[4px] z-10">
        <div
          className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px]"
          style={{ background: "var(--secondary)" }}
        >
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setIntervalState(iv)}
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
        <button
          onClick={() => chartRef.current?.scrollToRealTime?.()}
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          title="Go to latest"
        >
          <RefreshCw size={12} />
        </button>
      </div>

      {/* Live status — top right */}
      <div
        className="absolute top-[8px] right-[8px] flex items-center gap-[5px] z-10 px-[8px] py-[3px] rounded-[var(--radius-sm)]"
        style={{
          fontSize: "var(--text-label)",
          background: "var(--secondary)",
          color: wsStatus === "live" ? "var(--positive-bg-default)" : wsStatus === "connecting" ? "var(--muted-foreground)" : "var(--negative-bg-default)",
        }}
      >
        <span
          className={`inline-block w-[6px] h-[6px] rounded-full shrink-0 ${wsStatus === "live" ? "animate-pulse" : ""}`}
          style={{
            background: wsStatus === "live" ? "var(--positive-bg-default)" : wsStatus === "connecting" ? "var(--muted-foreground)" : "var(--negative-bg-default)",
          }}
        />
        {wsStatus === "live" ? "LIVE" : wsStatus === "connecting" ? "..." : "OFFLINE"}
      </div>

      {/* Pending order banner */}
      {pendingOrderType && (
        <div
          className="absolute top-[44px] left-1/2 -translate-x-1/2 z-20 flex items-center gap-[8px] px-[12px] py-[6px] rounded-[var(--radius)] pointer-events-none"
          style={{
            background: pendingOrderType === "buy" ? css("--positive-bg-default") : css("--negative-bg-default"),
            color: pendingOrderType === "buy" ? css("--positive-over") : css("--negative-over"),
            fontSize: "var(--text-label)",
            fontWeight: "600",
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}
        >
          {pendingOrderType === "buy" ? "↑ Click to place Buy order" : "↓ Click to place Sell order"}
          <span style={{ opacity: 0.7, fontWeight: 400 }}>· ESC to cancel</span>
        </div>
      )}
    </div>
  );
}

// ── Style builder ──────────────────────────────────────────────────────────────

function applyStyles(
  chart: Chart,
  _theme: string | undefined,
  chartBg: string | undefined,
  gridColor: string | undefined
) {
  const gridClr   = resolveColor(gridColor ?? "--contrast-quaternary");
  const upColor   = css("--positive-bg-default");
  const downColor = css("--negative-bg-default");
  const textColor = css("--contrast-secondary");

  chart.setStyles({
    grid: {
      horizontal: { color: gridClr, style: "dashed" },
      vertical:   { color: gridClr, style: "dashed" },
    },
    candle: {
      bar: {
        upColor, downColor,
        noChangeColor:       css("--muted-foreground"),
        upBorderColor:       upColor,   downBorderColor:     downColor,
        noChangeBorderColor: css("--muted-foreground"),
        upWickColor:         upColor,   downWickColor:       downColor,
        noChangeWickColor:   css("--muted-foreground"),
      },
    },
    xAxis: { tickText: { color: textColor }, tickLine: { color: gridClr }, axisLine: { color: gridClr } },
    yAxis: { tickText: { color: textColor }, tickLine: { color: gridClr }, axisLine: { color: gridClr } },
    crosshair: {
      horizontal: {
        line: { color: css("--accent-bg-default") },
        text: { backgroundColor: css("--accent-bg-default"), color: css("--accent-over") },
      },
      vertical: {
        line: { color: css("--accent-bg-default") },
        text: { backgroundColor: css("--accent-bg-default"), color: css("--accent-over") },
      },
    },
  } as Parameters<Chart["setStyles"]>[0]);

  const el = (chart as unknown as { getDom: () => HTMLElement }).getDom?.();
  if (el) el.style.background = resolveColor(chartBg ?? "--surface-elevation-1");
}
