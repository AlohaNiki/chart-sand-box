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
// The built-in "priceLine" overlay ignores extendData and uses blue defaults.
// We register "labeledPriceLine" once — draws a colored line + label badge on
// the right edge, both styled via the overlay's own styles.line / styles.text.

let _overlaysRegistered = false;

function ensureOverlaysRegistered() {
  if (_overlaysRegistered) return;
  _overlaysRegistered = true;

  registerOverlay({
    name: "labeledPriceLine",
    totalStep: 2,
    needDefaultPointFigure: false,
    needDefaultXAxisFigure: false,
    needDefaultYAxisFigure: false,
    createPointFigures: ({ overlay, coordinates, bounding }) => {
      const label = typeof overlay.extendData === "string" ? overlay.extendData : "";
      const y = coordinates[0]?.y ?? 0;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const figs: any[] = [
        {
          type: "line",
          attrs: { coordinates: [{ x: 0, y }, { x: bounding.width, y }] },
          ignoreEvent: true,
        },
      ];
      if (label) {
        figs.push({
          type: "text",
          attrs: { x: bounding.width - 6, y, text: label, align: "right", baseline: "middle" },
          ignoreEvent: true,
        });
      }
      return figs;
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

// ── Build price-line overlay styles ──────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function plStyles(cfg: PriceLineConfig): any {
  const lineColor  = resolveColor(cfg.color);
  const labelBg    = resolveColor(cfg.labelColor);
  const labelText  = resolveColor(cfg.labelTextColor);
  return {
    line: {
      color: lineColor,
      size: cfg.lineWidth,
      style: lineStyleStr(cfg.lineStyle),
    },
    text: {
      color: labelText,
      backgroundColor: labelBg,
      borderColor: labelBg,
      borderRadius: 3,
      paddingLeft: 5,
      paddingRight: 5,
      paddingTop: 2,
      paddingBottom: 2,
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
}

type WsStatus = "connecting" | "live" | "offline";

// ── Component ─────────────────────────────────────────────────────────────────

export function KlineChartWidget({
  priceLines, theme, chartBg, gridColor, orders, showOrders,
}: KlineChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [interval, setIntervalState] = useState<Interval>(() => {
    try {
      const s = localStorage.getItem(INTERVAL_STORAGE_KEY);
      if (s && (INTERVALS as readonly string[]).includes(s)) return s as Interval;
    } catch {}
    return "1d";
  });

  const [wsStatus, setWsStatus] = useState<WsStatus>("connecting");

  // Track which overlay IDs we've created so we can diff
  const plIds = useRef<Set<string>>(new Set());
  const orderIds = useRef<Set<string>>(new Set());

  // ── Init chart ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    ensureOverlaysRegistered();

    const chart = init(containerRef.current);
    if (!chart) return;
    chartRef.current = chart;

    // Apply initial styles (colors etc.)
    applyStyles(chart, theme, chartBg, gridColor);

    // DataLoader: getBars + subscribeBar / unsubscribeBar
    chart.setDataLoader({
      getBars: ({ period, callback }) => {
        const binanceIv = periodToBinanceInterval(period as Period);
        setWsStatus("connecting");
        fetch(
          `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${binanceIv}&limit=1000`
        )
          .then((r) => r.json())
          .then((data: unknown[][]) => {
            const bars: KLineData[] = data.map((k) => ({
              timestamp: k[0] as number,
              open:  parseFloat(k[1] as string),
              high:  parseFloat(k[2] as string),
              low:   parseFloat(k[3] as string),
              close: parseFloat(k[4] as string),
              volume: parseFloat(k[5] as string),
            }));
            callback(bars, false);
          })
          .catch(() => callback([], true));
      },

      subscribeBar: ({ period, callback }) => {
        const binanceIv = periodToBinanceInterval(period as Period);
        const ws = new WebSocket(
          `wss://stream.binance.com:9443/ws/btcusdt@kline_${binanceIv}`
        );
        wsRef.current = ws;
        ws.onopen  = () => setWsStatus("live");
        ws.onerror = () => setWsStatus("offline");
        ws.onclose = () => setWsStatus("offline");
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data as string);
            const k = msg.k;
            callback({
              timestamp: k.t as number,
              open:   parseFloat(k.o as string),
              high:   parseFloat(k.h as string),
              low:    parseFloat(k.l as string),
              close:  parseFloat(k.c as string),
              volume: parseFloat(k.v as string),
            });
          } catch {}
        };
      },

      unsubscribeBar: () => {
        wsRef.current?.close();
        wsRef.current = null;
      },
    });

    chart.setSymbol({ shortName: "BTC/USDT", pricePrecision: 2 });
    chart.setPeriod(intervalToPeriod(interval));

    return () => {
      wsRef.current?.close();
      wsRef.current = null;
      dispose(chart);
      chartRef.current = null;
      plIds.current.clear();
      orderIds.current.clear();
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

    // Remove overlays that were deleted or hidden
    for (const id of plIds.current) {
      if (!visible.has(id)) {
        chart.removeOverlay({ id: `pl-${id}` });
        plIds.current.delete(id);
      }
    }

    // Add / update visible ones
    for (const cfg of priceLines) {
      if (!cfg.visible) continue;
      const overlayId = `pl-${cfg.id}`;
      const styles = plStyles(cfg);

      if (plIds.current.has(cfg.id)) {
        chart.overrideOverlay({
          id: overlayId,
          points: [{ value: cfg.price }],
          extendData: cfg.label,
          styles,
        });
      } else {
        chart.createOverlay({
          name: "labeledPriceLine",
          id: overlayId,
          points: [{ value: cfg.price }],
          styles,
          extendData: cfg.label,
          lock: true,
        });
        plIds.current.add(cfg.id);
      }
    }
  }, [priceLines, theme]);

  // ── Order markers sync ─────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    // Remove all old markers
    for (const id of orderIds.current) {
      chart.removeOverlay({ id });
    }
    orderIds.current.clear();

    if (!showOrders || !orders?.length) return;

    for (const order of orders) {
      const id = `order-${order.id}`;
      const isBuy = order.type === "buy";
      const color = isBuy ? css("--positive-bg-default") : css("--negative-bg-default");
      const label = isBuy ? "Buy" : "Sell";

      chart.createOverlay({
        name: "simpleAnnotation",
        id,
        points: [{ timestamp: order.time * 1000, value: order.price }],
        extendData: label,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        styles: {
          line:    { color },
          polygon: { color, borderColor: color },
          text: {
            color: "#FFFFFF",
            backgroundColor: color,
            borderColor: color,
            borderRadius: 3,
            paddingLeft: 4,
            paddingRight: 4,
            paddingTop: 2,
            paddingBottom: 2,
          },
        } as any,
      });
      orderIds.current.add(id);
    }
  }, [orders, showOrders, theme]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="relative w-full h-full min-h-[400px]"
      style={{ fontFamily: "'Inter Display', sans-serif" }}
    >
      {/* Chart canvas — background set via CSS so klinecharts renders on top */}
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
  const gridClr = resolveColor(gridColor ?? "--contrast-quaternary");
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
        upColor,
        downColor,
        noChangeColor: css("--muted-foreground"),
        upBorderColor:    upColor,
        downBorderColor:  downColor,
        noChangeBorderColor: css("--muted-foreground"),
        upWickColor:    upColor,
        downWickColor:  downColor,
        noChangeWickColor: css("--muted-foreground"),
      },
    },
    xAxis: {
      tickText:  { color: textColor },
      tickLine:  { color: gridClr },
      axisLine:  { color: gridClr },
    },
    yAxis: {
      tickText:  { color: textColor },
      tickLine:  { color: gridClr },
      axisLine:  { color: gridClr },
    },
    crosshair: {
      horizontal: {
        line:  { color: css("--accent-bg-default") },
        text:  { backgroundColor: css("--accent-bg-default"), color: css("--accent-over") },
      },
      vertical: {
        line:  { color: css("--accent-bg-default") },
        text:  { backgroundColor: css("--accent-bg-default"), color: css("--accent-over") },
      },
    },
  } as Parameters<Chart["setStyles"]>[0]);

  // Sync container background via DOM (klinecharts renders on canvas, so we set it on the wrapper)
  const el = (chart as unknown as { getDom: () => HTMLElement }).getDom?.();
  if (el) el.style.background = resolveColor(chartBg ?? "--surface-elevation-1");
}
