import { useEffect, useRef } from "react";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
} from "lightweight-charts";
import type { TradeOrder } from "./chart-widget";

// ── Helpers ───────────────────────────────────────────────────────────────────

function css(v: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(v).trim();
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

// ── Trade marker primitive (reuses same drawing logic as main chart) ───────────

interface TradeMarker { time: number; type: "buy" | "sell"; price: number }

class TradeMarkersRenderer {
  markers: TradeMarker[] = [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  series: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: any = null;
  candleMap: Map<number, { high: number; low: number }> = new Map();

  draw(target: CanvasRenderingTarget2D): void {
    const { series, chart } = this;
    if (!series || !chart) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      const FONT_SIZE = 10 * hpr;
      ctx.font = `500 ${FONT_SIZE}px "Inter Display", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const PAD_H = 5 * hpr, PAD_V = 3 * vpr;
      const W = ctx.measureText("B").width + PAD_H * 2;
      const H = FONT_SIZE + PAD_V * 2;
      const TAIL = 5 * vpr, R = 3 * hpr, GAP = 4 * vpr, HALF_TW = 3 * hpr;

      for (const m of this.markers) {
        const cx = chart.timeScale().timeToCoordinate(m.time as Time);
        if (cx === null) continue;

        const isBuy = m.type === "buy";
        const candle = this.candleMap.get(m.time);
        const refPrice = isBuy ? (candle?.low ?? m.price) : (candle?.high ?? m.price);
        const cy = series.priceToCoordinate(refPrice);
        if (cy === null) continue;

        const x = cx * hpr, ry = cy * vpr;
        const bgColor  = isBuy ? css("--positive-bg-default") : css("--negative-bg-default");
        const txtColor = isBuy ? css("--positive-over")       : css("--negative-over");

        ctx.save();
        ctx.fillStyle = bgColor;

        if (isBuy) {
          const tipY = ry + GAP, baseY = tipY + TAIL;
          drawRoundedRect(ctx, x - W / 2, baseY, W, H, R);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - HALF_TW, baseY); ctx.lineTo(x + HALF_TW, baseY); ctx.lineTo(x, tipY);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = txtColor;
          ctx.fillText("B", x, baseY + H / 2);
        } else {
          const tipY = ry - GAP, baseY = tipY - TAIL;
          drawRoundedRect(ctx, x - W / 2, baseY - H, W, H, R);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - HALF_TW, baseY); ctx.lineTo(x + HALF_TW, baseY); ctx.lineTo(x, tipY);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = txtColor;
          ctx.fillText("S", x, baseY - H / 2);
        }

        ctx.restore();
      }
    });
  }
}

class TradeMarkersPrimitive {
  private _markers: TradeMarker[] = [];
  private _renderer = new TradeMarkersRenderer();
  private _views = [{ renderer: () => this._renderer, zOrder: () => "top" as const }];
  private _requestUpdate?: () => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attached(param: any) {
    this._renderer.series = param.series;
    this._renderer.chart  = param.chart;
    this._requestUpdate   = param.requestUpdate;
  }
  detached() {
    this._renderer.series = null;
    this._renderer.chart  = null;
    this._requestUpdate   = undefined;
  }
  updateAllViews() { this._renderer.markers = this._markers; }
  paneViews()      { return this._views; }

  setMarkers(markers: TradeMarker[]) {
    this._markers = markers;
    this._renderer.markers = markers;
    this._requestUpdate?.();
  }
  setCandleMap(map: Map<number, { high: number; low: number }>) {
    this._renderer.candleMap = map;
    this._requestUpdate?.();
  }
}

// ── Binance fetcher for a specific time range ─────────────────────────────────

async function fetchRangeKlines(
  binanceInterval: string,
  startMs: number,
  endMs: number,
  signal: AbortSignal
): Promise<CandlestickData<Time>[]> {
  const url = `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${binanceInterval}&startTime=${startMs}&endTime=${endMs}&limit=1500`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data: unknown[][] = await res.json();
  return data.map((k) => ({
    time:  Math.floor((k[0] as number) / 1000) as Time,
    open:  parseFloat(k[1] as string),
    high:  parseFloat(k[2] as string),
    low:   parseFloat(k[3] as string),
    close: parseFloat(k[4] as string),
  }));
}

function nearestCandleTime(candles: CandlestickData<Time>[], targetSec: number): number {
  let best = candles[0].time as number;
  let bestDiff = Math.abs(targetSec - best);
  for (const c of candles) {
    const d = Math.abs(targetSec - (c.time as number));
    if (d < bestDiff) { bestDiff = d; best = c.time as number; }
  }
  return best;
}

// ── Public API ────────────────────────────────────────────────────────────────

export const TRADE_INTERVALS = ["1m", "15m", "1H", "4H", "1D", "1W", "1M"] as const;
export type TradeInterval = (typeof TRADE_INTERVALS)[number];

const TO_BINANCE: Record<TradeInterval, string> = {
  "1m": "1m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d", "1W": "1w", "1M": "1M",
};

interface Props {
  order: TradeOrder;
  interval: TradeInterval;
  onIntervalChange: (i: TradeInterval) => void;
  theme?: "dark" | "light";
}

export function TradeChartWidget({ order, interval, onIntervalChange, theme }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef     = useRef<IChartApi | null>(null);
  const seriesRef    = useRef<ISeriesApi<"Candlestick"> | null>(null);

  // Create chart once
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: css("--muted-foreground"),
        fontFamily: "'Inter Display', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: css("--contrast-quaternary") },
        horzLines: { color: css("--contrast-quaternary") },
      },
      crosshair: { mode: 1 },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false, timeVisible: true, secondsVisible: false },
      width: container.clientWidth,
      height: container.clientHeight,
    });
    chartRef.current = chart;

    const ro = new ResizeObserver(() => {
      chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
    });
    ro.observe(container);

    return () => { ro.disconnect(); chart.remove(); chartRef.current = null; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Theme changes — update colors without recreating chart
  useEffect(() => {
    chartRef.current?.applyOptions({
      layout: { textColor: css("--muted-foreground") },
      grid: {
        vertLines: { color: css("--contrast-quaternary") },
        horzLines: { color: css("--contrast-quaternary") },
      },
    });
  }, [theme]);

  // Load candles whenever interval or order changes
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove previous series
    if (seriesRef.current) {
      try { chart.removeSeries(seriesRef.current); } catch {}
      seriesRef.current = null;
    }

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderUpColor: "#22c55e", borderDownColor: "#ef4444",
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
    });
    seriesRef.current = series;

    const primitive = new TradeMarkersPrimitive();
    series.attachPrimitive(primitive as never);

    const openMs  = (order.openTime  ?? order.time) * 1000;
    const closeMs = (order.closeTime ?? order.time + 86400) * 1000;
    const duration = closeMs - openMs;
    const padding  = Math.max(duration * 0.2, 4 * 3600 * 1000); // ≥4h padding

    const startMs = openMs  - padding;
    const endMs   = closeMs + padding;

    const ctrl = new AbortController();

    fetchRangeKlines(TO_BINANCE[interval], startMs, endMs, ctrl.signal)
      .then((candles) => {
        if (!candles.length) return;
        series.setData(candles);

        const candleMap = new Map<number, { high: number; low: number }>();
        for (const c of candles) candleMap.set(c.time as number, { high: c.high, low: c.low });
        primitive.setCandleMap(candleMap);

        const openCt  = nearestCandleTime(candles, Math.floor(openMs  / 1000));
        const closeCt = nearestCandleTime(candles, Math.floor(closeMs / 1000));
        const isLong  = order.type === "buy";

        const markers: TradeMarker[] = [
          { time: openCt,  type: isLong ? "buy"  : "sell", price: order.price },
          ...(order.closePrice !== undefined
            ? [{ time: closeCt, type: isLong ? "sell" : "buy", price: order.closePrice }]
            : []),
        ];
        primitive.setMarkers(markers);

        chart.timeScale().setVisibleRange({
          from: Math.floor(startMs / 1000) as Time,
          to:   Math.floor(endMs   / 1000) as Time,
        });
      })
      .catch(() => {});

    return () => { ctrl.abort(); };
  }, [interval, order]);

  return (
    <div className="flex flex-col h-full">
      {/* Interval selector */}
      <div
        className="flex items-center gap-[2px] px-[12px] py-[8px] shrink-0 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {TRADE_INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => onIntervalChange(iv)}
            className="px-[10px] py-[4px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
            style={{
              fontFamily: "'Inter Display', sans-serif",
              fontSize: "12px",
              fontWeight: interval === iv ? "600" : "400",
              color: interval === iv ? "var(--foreground)" : "var(--muted-foreground)",
              background: interval === iv ? "var(--secondary)" : "transparent",
            }}
          >
            {iv}
          </button>
        ))}
      </div>
      <div ref={containerRef} className="flex-1 min-h-0" />
    </div>
  );
}
