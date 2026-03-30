import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { resolveColor } from "./price-line-editor";
import type { CanvasRenderingTarget2D } from "fancy-canvas";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type LineData,
  type Time,
  type IPriceLine,
  type CreatePriceLineOptions,
  type PriceLineOptions,
  type MouseEventParams,
} from "lightweight-charts";
import { EMA, RSI } from "technicalindicators";

// ── Custom Order Markers Primitive ────────────────────────────────────────────

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

interface MarkerHitBox {
  orderId: string;
  x: number; y: number; w: number; h: number; // CSS px
}

class OrderMarkersRenderer {
  orders: TradeOrder[] = [];
  series: ISeriesApi<"Candlestick"> | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: any = null;
  candleMap: Map<number, { high: number; low: number }> = new Map();
  hitBoxes: MarkerHitBox[] = [];

  draw(target: CanvasRenderingTarget2D): void {
    const { series, chart } = this;
    if (!series || !chart) return;

    this.hitBoxes = [];
    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      // Font: 10px Medium
      const FONT_SIZE = 10 * hpr;
      ctx.font = `500 ${FONT_SIZE}px "Inter Display", sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      // Badge dimensions: padding 5px left/right, 3px top/bottom
      const PAD_H = 5 * hpr;
      const PAD_V = 3 * vpr;
      const charW = ctx.measureText("B").width;
      const W = charW + PAD_H * 2;
      const H = FONT_SIZE + PAD_V * 2;

      const TAIL = 5 * vpr, R = 3 * hpr;
      const GAP = 4 * vpr;
      const HALF_TW = 3 * hpr;

      for (const order of this.orders) {
        const cx = chart.timeScale().timeToCoordinate(order.time as Time);
        if (cx === null) continue;

        const isBuy = order.type === "buy";

        const candle = this.candleMap.get(order.time);
        const refPrice = isBuy
          ? (candle?.low  ?? order.price)
          : (candle?.high ?? order.price);

        const cy = series.priceToCoordinate(refPrice);
        if (cy === null) continue;

        const x  = cx * hpr;
        const ry = cy * vpr;

        const bgColor  = isBuy ? css("--positive-bg-default") : css("--negative-bg-default");
        const txtColor = isBuy ? css("--positive-over")       : css("--negative-over");

        // Expanded hit box (min 32×32)
        const boxW = W / hpr, boxH = H / vpr, tailPx = TAIL / vpr, gapPx = GAP / vpr;
        const HIT_MIN = 32;
        const rawHitW = boxW, rawHitH = tailPx + boxH;
        const hitW = Math.max(rawHitW, HIT_MIN);
        const hitH = Math.max(rawHitH, HIT_MIN);
        const dw = (hitW - rawHitW) / 2;
        const dh = (hitH - rawHitH) / 2;
        if (isBuy) {
          this.hitBoxes.push({ orderId: order.id, x: cx - hitW / 2, y: cy + gapPx - dh,                    w: hitW, h: hitH });
        } else {
          this.hitBoxes.push({ orderId: order.id, x: cx - hitW / 2, y: cy - gapPx - tailPx - boxH - dh,    w: hitW, h: hitH });
        }

        ctx.save();
        ctx.fillStyle = bgColor;

        if (isBuy) {
          const tipY  = ry + GAP;
          const baseY = tipY + TAIL;
          drawRoundedRect(ctx, x - W / 2, baseY, W, H, R);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - HALF_TW, baseY);
          ctx.lineTo(x + HALF_TW, baseY);
          ctx.lineTo(x, tipY);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = txtColor;
          ctx.fillText("B", x, baseY + H / 2);
        } else {
          const tipY  = ry - GAP;
          const baseY = tipY - TAIL;
          drawRoundedRect(ctx, x - W / 2, baseY - H, W, H, R);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x - HALF_TW, baseY);
          ctx.lineTo(x + HALF_TW, baseY);
          ctx.lineTo(x, tipY);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = txtColor;
          ctx.fillText("S", x, baseY - H / 2);
        }

        ctx.restore();
      }
    });
  }
}

class OrderMarkersPrimitive {
  private _orders: TradeOrder[] = [];
  private _showOrders = true;
  private _renderer = new OrderMarkersRenderer();
  private _views = [{ renderer: () => this._renderer, zOrder: () => "top" as const }];
  private _requestUpdate?: () => void;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attached(param: any) {
    this._renderer.series = param.series;
    this._renderer.chart = param.chart;
    this._requestUpdate = param.requestUpdate;
  }

  detached() {
    this._renderer.series = null;
    this._renderer.chart = null;
    this._requestUpdate = undefined;
  }

  updateAllViews() {
    this._renderer.orders = this._showOrders ? this._orders : [];
  }

  paneViews() { return this._views; }

  setOrders(orders: TradeOrder[], show: boolean) {
    this._orders = orders;
    this._showOrders = show;
    this._renderer.orders = show ? orders : [];
    this._requestUpdate?.();
  }

  setCandleMap(map: Map<number, { high: number; low: number }>) {
    this._renderer.candleMap = map;
    this._requestUpdate?.();
  }

  getHitBoxes() { return this._renderer.hitBoxes; }
  getOrders()   { return this._orders; }
}

// ── PnL badges primitive ──────────────────────────────────────────────────────

class PnLBadgesRenderer {
  orders: TradeOrder[] = [];
  priceLevelBadges: PriceLineConfig[] = [];
  currentPrice = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  series: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  chart: any = null;

  draw(target: CanvasRenderingTarget2D): void {
    if (!this.series || !this.currentPrice) return;
    if (!this.orders.length && !this.priceLevelBadges.length) return;

    target.useBitmapCoordinateSpace(({ context: ctx, horizontalPixelRatio: hpr, verticalPixelRatio: vpr }) => {
      const fontSize = 12 * hpr;
      ctx.font = `${fontSize}px "Inter Mono", ui-monospace, monospace`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";

      const PAD_H = 7 * hpr, PAD_V = 3 * vpr, R = 3 * hpr, LEFT = 8 * hpr;

      for (const order of this.orders) {
        const cy = this.series.priceToCoordinate(order.price);
        if (cy === null) continue;
        const ry = cy * vpr;

        const isBuy  = order.type === "buy";
        const rawPct = (this.currentPrice - order.price) / order.price;
        const dirPct = rawPct * (isBuy ? 1 : -1);
        const levPct = dirPct * (order.leverage ?? 1) * 100;
        const pnlUsdt = order.volume !== undefined ? dirPct * order.volume : null;

        const isProfit = levPct >= 0;
        const sign = isProfit ? "+" : "";
        const text = pnlUsdt !== null
          ? `${sign}${pnlUsdt.toFixed(2)} USDT`
          : `${sign}${levPct.toFixed(2)}%`;

        const bg  = isProfit ? css("--positive-bg-default") : css("--negative-bg-default");
        const fg  = isProfit ? css("--positive-over")       : css("--negative-over");

        const W = ctx.measureText(text).width + PAD_H * 2;
        const H = fontSize + PAD_V * 2;

        ctx.save();
        ctx.fillStyle = bg;
        drawRoundedRect(ctx, LEFT, ry - H / 2, W, H, R);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.fillText(text, LEFT + PAD_H, ry);
        ctx.restore();
      }

      for (const level of this.priceLevelBadges) {
        const cy = this.series.priceToCoordinate(level.price);
        if (cy === null) continue;
        const ry = cy * vpr;

        const pct = ((this.currentPrice - level.price) / level.price) * 100;
        const isAbove = pct >= 0;
        const sign = isAbove ? "+" : "";
        const text = `${sign}${pct.toFixed(2)}%`;

        const bg = isAbove ? css("--positive-bg-default") : css("--negative-bg-default");
        const fg = isAbove ? css("--positive-over") : css("--negative-over");

        const W = ctx.measureText(text).width + PAD_H * 2;
        const H = fontSize + PAD_V * 2;

        ctx.save();
        ctx.fillStyle = bg;
        drawRoundedRect(ctx, LEFT, ry - H / 2, W, H, R);
        ctx.fill();
        ctx.fillStyle = fg;
        ctx.fillText(text, LEFT + PAD_H, ry);
        ctx.restore();
      }
    });
  }
}

class PnLBadgesPrimitive {
  private _renderer = new PnLBadgesRenderer();
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
  updateAllViews() {}
  paneViews() { return this._views; }

  setOrders(orders: TradeOrder[], show: boolean) {
    this._renderer.orders = show ? orders : [];
    this._requestUpdate?.();
  }
  setCurrentPrice(price: number) {
    this._renderer.currentPrice = price;
    this._requestUpdate?.();
  }
  setPriceLevelBadges(levels: PriceLineConfig[]) {
    this._renderer.priceLevelBadges = levels;
    this._requestUpdate?.();
  }
}

// ── Indicator helpers ─────────────────────────────────────────────────────────

function calcEMA(candles: CandlestickData<Time>[], period: number): LineData<Time>[] {
  if (candles.length < period) return [];
  const values = EMA.calculate({ period, values: candles.map((c) => c.close) });
  const offset = candles.length - values.length;
  return values.map((value, i) => ({ time: candles[offset + i].time, value: Math.round(value * 100) / 100 }));
}

function calcRSI(candles: CandlestickData<Time>[], period: number): LineData<Time>[] {
  if (candles.length < period + 1) return [];
  const values = RSI.calculate({ period, values: candles.map((c) => c.close) });
  const offset = candles.length - values.length;
  return values.map((value, i) => ({ time: candles[offset + i].time, value: Math.round(value * 100) / 100 }));
}

// ── Binance data ──────────────────────────────────────────────────────────────

const INTERVALS = ["1m", "5m", "15m", "1h", "4h", "1d"] as const;
type Interval = (typeof INTERVALS)[number];

const INTERVAL_STORAGE_KEY = "chartConfig_interval";

const INTERVAL_DEFAULT_VISIBLE: Record<Interval, number> = {
  "1d":  100,
  "4h":  90,
  "1h":  120,
  "15m": 128,
  "5m":  144,
  "1m":  120,
};

async function fetchKlines(
  interval: Interval,
  signal: AbortSignal
): Promise<CandlestickData<Time>[]> {
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=1000`,
    { signal }
  );
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

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TradeOrder {
  id: string;
  time: number;
  price: number;
  type: "buy" | "sell";
  closePrice?: number;
  leverage?: number;
  amount?: number;
  volume?: number;
  pnl?: number;
  pnlPercent?: number;
  transactionId?: string;
  operation?: "Long" | "Short";
  takeProfit?: number;
  stopLoss?: number;
  openTime?: number;
  closeTime?: number;
}

export interface PriceLineConfig {
  id: string;
  label: string;
  price: number;
  color: string;
  labelColor: string;
  labelTextColor: string;
  lineWidth: number;
  lineStyle: number;
  visible: boolean;
  showPnl?: boolean;
  pnlText?: string;
  takeProfit?: number;
  stopLoss?: number;
}

interface IndicatorState {
  ema20: boolean;
  ema50: boolean;
  rsi: boolean;
}

const INDICATOR_DEFS = [
  { key: "ema20" as const, label: "EMA 20", color: "#F59E0B" },
  { key: "ema50" as const, label: "EMA 50", color: "#8B5CF6" },
  { key: "rsi"   as const, label: "RSI 14", color: "#3B82F6" },
];

export interface CurrentPriceLineConfig {
  visible: boolean;
  color: string;
  lineWidth: number;
  lineStyle: number;
  followCandleColor?: boolean;
}

export interface CrosshairConfig {
  mode: number; // 0 = Normal, 1 = Magnet
  hStyle: number;
  vStyle: number;
  color?: string; // CSS token, e.g. "--accent-bg-default"
}

interface ChartWidgetProps {
  priceLines: PriceLineConfig[];
  onPriceLineDrag?: (id: string, newPrice: number) => void;
  theme?: "dark" | "light";
  chartBg?: string;
  gridColor?: string;
  orders?: TradeOrder[];
  showOrders?: boolean;
  pendingOrderType?: "buy" | "sell" | null;
  onOrderPlace?: (order: TradeOrder) => void;
  onCancelPending?: () => void;
  onOrderClick?: (order: TradeOrder) => void;
  onOrderPriceChange?: (id: string, newPrice: number) => void;
  onLivePrice?: (price: number) => void;
  currentPriceLineConfig?: CurrentPriceLineConfig;
  crosshairConfig?: CrosshairConfig;
  gridStyle?: number;
  showGrid?: boolean;
}

type WsStatus = "connecting" | "live" | "offline";

const SNAP_PX = 10;

function css(varName: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
}

function rgba(rgbVar: string, alpha: number): string {
  return `rgba(${css(rgbVar)}, ${alpha})`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartWidget({
  priceLines, onPriceLineDrag, theme, chartBg, gridColor,
  orders, showOrders, pendingOrderType, onOrderPlace, onCancelPending, onOrderClick, onOrderPriceChange,
  onLivePrice, currentPriceLineConfig, crosshairConfig, gridStyle, showGrid,
}: ChartWidgetProps) {
  const [indicators, setIndicators] = useState<IndicatorState>({ ema20: false, ema50: false, rsi: false });
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersPluginRef = useRef<any>(null);
  const pnlPluginRef    = useRef<PnLBadgesPrimitive | null>(null);
  const currentPriceRef = useRef(0);
  const lastCandleBullishRef = useRef(true);
  const currentPriceLineConfigRef = useRef(currentPriceLineConfig);
  useEffect(() => { currentPriceLineConfigRef.current = currentPriceLineConfig; }, [currentPriceLineConfig]);
  const candleMapRef = useRef<Map<number, { high: number; low: number }>>(new Map());

  // Candle data stored for indicator recalculation
  const candleDataRef = useRef<CandlestickData<Time>[]>([]);

  // Indicator series refs
  const ema20Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const ema50Ref = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiRef   = useRef<ISeriesApi<"Line"> | null>(null);

  // Callback refs
  const priceLinesConfigRef = useRef<PriceLineConfig[]>(priceLines);
  const onPriceLineDragRef = useRef(onPriceLineDrag);
  const onOrderPlaceRef = useRef(onOrderPlace);
  const onCancelPendingRef = useRef(onCancelPending);
  const onOrderClickRef = useRef(onOrderClick);
  const onOrderPriceChangeRef = useRef(onOrderPriceChange);
  const ordersRef = useRef(orders ?? []);
  const pendingOrderTypeRef = useRef(pendingOrderType ?? null);
  const draggingIdRef = useRef<string | null>(null);
  const draggingOrderIdRef = useRef<string | null>(null);

  const [interval, setInterval] = useState<Interval>(() => {
    try {
      const stored = localStorage.getItem(INTERVAL_STORAGE_KEY);
      if (stored && (INTERVALS as readonly string[]).includes(stored)) return stored as Interval;
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
  useEffect(() => { onOrderClickRef.current = onOrderClick; }, [onOrderClick]);
  useEffect(() => { onOrderPriceChangeRef.current = onOrderPriceChange; }, [onOrderPriceChange]);
  useEffect(() => { ordersRef.current = orders ?? []; }, [orders]);
  useEffect(() => { pendingOrderTypeRef.current = pendingOrderType ?? null; }, [pendingOrderType]);

  useEffect(() => {
    try { localStorage.setItem(INTERVAL_STORAGE_KEY, interval); } catch {}
  }, [interval]);

  // ── Initialize chart ──────────────────────────────────────────────────────
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
        vertLines: { color: resolveColor(gridColor ?? "--border"), style: gridStyle ?? LineStyle.Solid, visible: showGrid !== false },
        horzLines: { color: resolveColor(gridColor ?? "--border"), style: gridStyle ?? LineStyle.Solid, visible: showGrid !== false },
      },
      crosshair: {
        vertLine: { color: rgba("--accent-bg-default-rgb", 0.4), labelBackgroundColor: css("--accent-bg-default") },
        horzLine: { color: rgba("--accent-bg-default-rgb", 0.4), labelBackgroundColor: css("--accent-bg-default") },
      },
      rightPriceScale: { borderColor: css("--border"), scaleMargins: { top: 0.1, bottom: 0.1 } },
      timeScale: { borderColor: css("--border"), timeVisible: false, rightOffset: 10 },
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
    const orderPrimitive = new OrderMarkersPrimitive();
    series.attachPrimitive(orderPrimitive);
    markersPluginRef.current = orderPrimitive;
    const pnlPrimitive = new PnLBadgesPrimitive();
    series.attachPrimitive(pnlPrimitive as never);
    pnlPluginRef.current = pnlPrimitive;
    setChartReady(true);

    // Drag handling
    const findNearestLine = (clientY: number): string | null => {
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top;
      let closestId: string | null = null, closestDist = Infinity;
      for (const config of priceLinesConfigRef.current) {
        if (!config.visible) continue;
        const coord = series.priceToCoordinate(config.price);
        if (coord === null) continue;
        const dist = Math.abs(coord - y);
        if (dist < closestDist && dist < SNAP_PX) { closestDist = dist; closestId = config.id; }
      }
      return closestId;
    };

    const findNearestOrderLine = (clientY: number): string | null => {
      const rect = container.getBoundingClientRect();
      const y = clientY - rect.top;
      let closestId: string | null = null, closestDist = Infinity;
      for (const order of ordersRef.current) {
        const coord = series.priceToCoordinate(order.price);
        if (coord === null) continue;
        const dist = Math.abs(coord - y);
        if (dist < closestDist && dist < SNAP_PX) { closestDist = dist; closestId = order.id; }
      }
      return closestId;
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      const nearOrderId = findNearestOrderLine(e.clientY);
      if (nearOrderId) {
        e.preventDefault(); e.stopPropagation();
        draggingOrderIdRef.current = nearOrderId;
        container.setPointerCapture(e.pointerId);
        chart.applyOptions({ handleScroll: false, handleScale: false });
        container.style.cursor = "ns-resize";
        return;
      }
      const nearId = findNearestLine(e.clientY);
      if (!nearId) return;
      e.preventDefault(); e.stopPropagation();
      draggingIdRef.current = nearId;
      container.setPointerCapture(e.pointerId);
      chart.applyOptions({ handleScroll: false, handleScale: false });
      container.style.cursor = "ns-resize";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (draggingOrderIdRef.current) {
        const rect = container.getBoundingClientRect();
        const price = series.coordinateToPrice(e.clientY - rect.top);
        if (price !== null) {
          onOrderPriceChangeRef.current?.(draggingOrderIdRef.current, Math.round(Number(price) * 100) / 100);
        }
      } else if (draggingIdRef.current) {
        const rect = container.getBoundingClientRect();
        const price = series.coordinateToPrice(e.clientY - rect.top);
        if (price !== null && onPriceLineDragRef.current) {
          onPriceLineDragRef.current(draggingIdRef.current, Math.round(Number(price) * 100) / 100);
        }
      } else {
        const rect = container.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        const plugin = markersPluginRef.current as OrderMarkersPrimitive | null;
        const onMarker = plugin?.getHitBoxes().some((hb) => mx >= hb.x && mx <= hb.x + hb.w && my >= hb.y && my <= hb.y + hb.h) ?? false;
        const nearId = findNearestLine(e.clientY);
        const nearOrderId = findNearestOrderLine(e.clientY);
        container.style.cursor = pendingOrderTypeRef.current ? "crosshair" : onMarker ? "pointer" : (nearId || nearOrderId) ? "ns-resize" : "";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingOrderIdRef.current) {
        draggingOrderIdRef.current = null;
        try { container.releasePointerCapture(e.pointerId); } catch {}
        chart.applyOptions({ handleScroll: true, handleScale: true });
        container.style.cursor = "";
      } else if (draggingIdRef.current) {
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
      ema20Ref.current = null;
      ema50Ref.current = null;
      rsiRef.current = null;
      priceLinesRef.current.clear();
      setChartReady(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Sync indicators helper (called after data load + on indicator toggle) ─
  const syncIndicators = (candles: CandlestickData<Time>[], ind: IndicatorState | undefined) => {
    const chart = chartRef.current;
    if (!chart || candles.length === 0) return;

    // ── EMA 20 ────────────────────────────────────────────────────────────
    if (ind?.ema20) {
      if (!ema20Ref.current) {
        ema20Ref.current = chart.addSeries(LineSeries, {
          color: "#F59E0B",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: "EMA 20",
        }, 0);
      }
      ema20Ref.current.setData(calcEMA(candles, 20));
    } else if (ema20Ref.current) {
      chart.removeSeries(ema20Ref.current);
      ema20Ref.current = null;
    }

    // ── EMA 50 ────────────────────────────────────────────────────────────
    if (ind?.ema50) {
      if (!ema50Ref.current) {
        ema50Ref.current = chart.addSeries(LineSeries, {
          color: "#8B5CF6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: false,
          title: "EMA 50",
        }, 0);
      }
      ema50Ref.current.setData(calcEMA(candles, 50));
    } else if (ema50Ref.current) {
      chart.removeSeries(ema50Ref.current);
      ema50Ref.current = null;
    }

    // ── RSI ───────────────────────────────────────────────────────────────
    if (ind?.rsi) {
      if (!rsiRef.current) {
        rsiRef.current = chart.addSeries(LineSeries, {
          color: "#3B82F6",
          lineWidth: 1,
          priceLineVisible: false,
          lastValueVisible: true,
          crosshairMarkerVisible: true,
          title: "RSI 14",
          priceFormat: { type: "price", precision: 1, minMove: 0.1 },
          autoscaleInfoProvider: () => ({
            priceRange: { minValue: 0, maxValue: 100 },
          }),
        }, 1);

        // Level lines at 70 and 30
        rsiRef.current.createPriceLine({ price: 70, color: "rgba(239,68,68,0.4)", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "70" });
        rsiRef.current.createPriceLine({ price: 30, color: "rgba(34,197,94,0.4)",  lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "30" });

        // Make RSI pane shorter (1/4 of total height)
        const panes = chart.panes();
        if (panes.length >= 2) {
          panes[0].setStretchFactor(3);
          panes[1].setStretchFactor(1);
        }
      }
      rsiRef.current.setData(calcRSI(candles, 14));
    } else if (rsiRef.current) {
      chart.removeSeries(rsiRef.current);
      rsiRef.current = null;
      // Restore single pane
      const panes = chart.panes();
      if (panes.length >= 1) panes[0].setStretchFactor(1);
    }
  };

  // ── Fetch historical data + WebSocket ─────────────────────────────────────
  useEffect(() => {
    if (!chartReady || !seriesRef.current || !chartRef.current) return;

    const chart = chartRef.current;
    const series = seriesRef.current;

    setIsLoading(true);
    setWsStatus("connecting");
    wsRef.current?.close();
    wsRef.current = null;

    const controller = new AbortController();
    let cancelled = false;

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
        candleDataRef.current = candles;

        const visible = INTERVAL_DEFAULT_VISIBLE[interval];
        chart.timeScale().setVisibleLogicalRange({
          from: candles.length - visible,
          to:   candles.length - 1 + 10,
        });
        setIsLoading(false);

        // Build candle map
        const map = new Map<number, { high: number; low: number }>();
        for (const c of candles) map.set(c.time as number, { high: c.high, low: c.low });
        candleMapRef.current = map;
        (markersPluginRef.current as OrderMarkersPrimitive | null)?.setCandleMap(map);

        // Seed current price from last candle
        if (candles.length > 0) {
          const last = candles[candles.length - 1];
          currentPriceRef.current = last.close;
          lastCandleBullishRef.current = last.close >= last.open;
          pnlPluginRef.current?.setCurrentPrice(currentPriceRef.current);
          onLivePrice?.(currentPriceRef.current);
        }

        // Sync indicators with fresh data
        syncIndicators(candles, indicators);

        // WebSocket
        const ws = new WebSocket(`wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`);
        wsRef.current = ws;
        ws.onopen  = () => { if (!cancelled) setWsStatus("live"); };
        ws.onmessage = (event) => {
          if (cancelled) return;
          try {
            const msg = JSON.parse(event.data as string);
            const k = msg.k;
            const t = Math.floor((k.t as number) / 1000);
            const hi = parseFloat(k.h as string);
            const lo = parseFloat(k.l as string);
            const updated: CandlestickData<Time> = {
              time: t as Time,
              open: parseFloat(k.o as string),
              high: hi, low: lo,
              close: parseFloat(k.c as string),
            };
            seriesRef.current?.update(updated);
            candleMapRef.current.set(t, { high: hi, low: lo });
            const close = parseFloat(k.c as string);
            const open  = parseFloat(k.o as string);
            currentPriceRef.current = close;
            lastCandleBullishRef.current = close >= open;
            pnlPluginRef.current?.setCurrentPrice(close);
            onLivePrice?.(close);
            if (currentPriceLineConfigRef.current?.followCandleColor) {
              seriesRef.current?.applyOptions({
                priceLineColor: close >= open ? css("--positive-bg-default") : css("--negative-bg-default"),
              });
            }

            // Update last candle in stored data and refresh indicator last point
            const data = candleDataRef.current;
            if (data.length > 0) {
              const last = data[data.length - 1];
              if ((last.time as number) === t) {
                data[data.length - 1] = { ...last, high: hi, low: lo, close: updated.close };
              } else {
                data.push(updated);
              }
            }
          } catch {}
        };
        ws.onerror = () => { if (!cancelled) setWsStatus("offline"); };
        ws.onclose = () => { if (!cancelled) setWsStatus("offline"); };
      } catch {
        if (!cancelled) { setIsLoading(false); setWsStatus("offline"); }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
      wsRef.current?.close();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [interval, chartReady]);

  // ── Sync indicators on toggle ─────────────────────────────────────────────
  useEffect(() => {
    if (!chartReady) return;
    syncIndicators(candleDataRef.current, indicators);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [indicators?.ema20, indicators?.ema50, indicators?.rsi, chartReady]);

  // ── Update chart colors on theme change ──────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    const series = seriesRef.current;
    if (!chart || !series) return;

    const resolvedGrid = resolveColor(gridColor ?? "--border");
    const gridVisible = showGrid !== false;
    chart.applyOptions({
      layout: {
        textColor: css("--contrast-secondary"),
        background: { type: ColorType.Solid, color: resolveColor(chartBg ?? "--surface-canvas") },
      },
      grid: {
        vertLines: { color: resolvedGrid, style: gridStyle ?? LineStyle.Solid, visible: gridVisible },
        horzLines: { color: resolvedGrid, style: gridStyle ?? LineStyle.Solid, visible: gridVisible },
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
  }, [theme, chartBg, gridColor, gridStyle, showGrid]);

  // ── Current price line ────────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !chartReady) return;
    const cfg = currentPriceLineConfig;
    const candleColor = lastCandleBullishRef.current ? css("--positive-bg-default") : css("--negative-bg-default");
    series.applyOptions({
      priceLineVisible: cfg?.visible ?? true,
      priceLineColor: cfg?.followCandleColor ? candleColor : (cfg ? resolveColor(cfg.color) : css("--accent-bg-default")),
      priceLineWidth: (cfg?.lineWidth ?? 1) as 1 | 2 | 3 | 4,
      priceLineStyle: cfg?.lineStyle ?? LineStyle.Dashed,
    });
  }, [currentPriceLineConfig, chartReady, theme]);

  // ── Crosshair ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;
    const baseColor = crosshairConfig?.color ? resolveColor(crosshairConfig.color) : css("--accent-bg-default");
    const lineColor = crosshairConfig?.color ? resolveColor(crosshairConfig.color) : rgba("--accent-bg-default-rgb", 0.4);
    chart.applyOptions({
      crosshair: {
        mode: crosshairConfig?.mode === 1 ? CrosshairMode.Magnet : CrosshairMode.Normal,
        vertLine: { color: lineColor, labelBackgroundColor: baseColor, style: crosshairConfig?.vStyle ?? LineStyle.Solid },
        horzLine: { color: lineColor, labelBackgroundColor: baseColor, style: crosshairConfig?.hStyle ?? LineStyle.Solid },
      },
    });
  }, [crosshairConfig, chartReady, theme]);

  // ── Sync price lines ──────────────────────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const existingLines = priceLinesRef.current;
    const currentIds = new Set(priceLines.map((pl) => pl.id));

    for (const [id, line] of existingLines) {
      if (!currentIds.has(id)) { series.removePriceLine(line); existingLines.delete(id); }
    }

    for (const config of priceLines) {
      if (!config.visible) {
        const existing = existingLines.get(config.id);
        if (existing) { series.removePriceLine(existing); existingLines.delete(config.id); }
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
      if (existing) { existing.applyOptions(options); }
      else { existingLines.set(config.id, series.createPriceLine(options)); }
    }
  }, [priceLines, theme]);

  // ── Sync order markers ────────────────────────────────────────────────────
  useEffect(() => {
    const plugin = markersPluginRef.current as OrderMarkersPrimitive | null;
    if (!plugin || !chartReady) return;
    plugin.setOrders(orders ?? [], showOrders ?? true);
  }, [orders, showOrders, theme, chartReady]);

  // ── PnL badges + entry price lines ───────────────────────────────────────
  useEffect(() => {
    const series = seriesRef.current;
    if (!series || !chartReady) return;

    const levelBadges = priceLines.filter((pl) => pl.showPnl && pl.visible);
    pnlPluginRef.current?.setPriceLevelBadges(levelBadges);

    if (currentPriceRef.current) pnlPluginRef.current?.setCurrentPrice(currentPriceRef.current);
  }, [theme, chartReady, priceLines]);

  // ── Click-to-place order ──────────────────────────────────────────────────
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
    const onEsc = (e: KeyboardEvent) => { if (e.key === "Escape") onCancelPendingRef.current?.(); };

    chart.subscribeClick(handler);
    window.addEventListener("keydown", onEsc);
    return () => {
      chart.unsubscribeClick(handler);
      window.removeEventListener("keydown", onEsc);
    };
  }, [pendingOrderType, chartReady]);

  // ── Click on order marker ─────────────────────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !chartReady) return;

    const handler = (param: MouseEventParams<Time>) => {
      if (!param.point || pendingOrderTypeRef.current) return;
      const plugin = markersPluginRef.current as OrderMarkersPrimitive | null;
      if (!plugin) return;
      const { x, y } = param.point;
      const hit = plugin.getHitBoxes().find((hb) => x >= hb.x && x <= hb.x + hb.w && y >= hb.y && y <= hb.y + hb.h);
      if (hit) {
        const order = plugin.getOrders().find((o) => o.id === hit.orderId);
        if (order) onOrderClickRef.current?.(order);
      }
    };

    chart.subscribeClick(handler);
    return () => chart.unsubscribeClick(handler);
  }, [chartReady]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full h-full min-h-[400px]" style={{ fontFamily: "'Inter Display', sans-serif" }}>
      <div ref={chartContainerRef} className="w-full h-full" />

      {/* Interval selector + reset + indicators — top left */}
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
        <button
          onClick={() => chartRef.current?.timeScale().fitContent()}
          className="flex items-center justify-center w-[26px] h-[26px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
          style={{ background: "var(--secondary)", color: "var(--muted-foreground)" }}
          title="Reset chart view"
        >
          <RefreshCw size={12} />
        </button>

        {/* Separator */}
        <div className="w-px h-[16px] mx-[2px]" style={{ background: "var(--border)" }} />

        {/* Indicator toggles */}
        <div
          className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px]"
          style={{ background: "var(--secondary)" }}
        >
          {INDICATOR_DEFS.map(({ key, label, color }) => {
            const active = indicators[key];
            return (
              <button
                key={key}
                onClick={() => setIndicators((prev) => ({ ...prev, [key]: !prev[key] }))}
                className="flex items-center gap-[5px] px-[8px] py-[3px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                style={{
                  fontSize: "var(--text-label)",
                  background: active ? "var(--card)" : "transparent",
                  color: active ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: active ? "600" : "400",
                }}
              >
                <span
                  className="inline-block w-[10px] h-[2px] rounded-full shrink-0 transition-opacity"
                  style={{ background: color, opacity: active ? 1 : 0.35 }}
                />
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Live status */}
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
        <div className="absolute inset-0 flex items-center justify-center z-20" style={{ background: "rgba(0,0,0,0.12)" }}>
          <span style={{ color: "var(--muted-foreground)", fontSize: "var(--text-label)" }}>Loading…</span>
        </div>
      )}
    </div>
  );
}
