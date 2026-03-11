import { useEffect, useRef, useState } from "react";
import {
  createChart,
  ColorType,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type Time,
  type IPriceLine,
  type CreatePriceLineOptions,
  type PriceLineOptions,
} from "lightweight-charts";

// Generate mock candlestick data
function generateMockData(): CandlestickData<Time>[] {
  const data: CandlestickData<Time>[] = [];
  let basePrice = 42000;
  const startDate = new Date("2025-12-01");

  for (let i = 0; i < 60; i++) {
    const date = new Date(startDate);
    date.setDate(date.getDate() + i);

    const dateStr = date.toISOString().split("T")[0] as unknown as Time;
    const volatility = 800 + Math.random() * 1200;
    const direction = Math.random() > 0.48 ? 1 : -1;
    const change = direction * (Math.random() * volatility);

    const open = basePrice;
    const close = open + change;
    const high = Math.max(open, close) + Math.random() * 500;
    const low = Math.min(open, close) - Math.random() * 500;

    data.push({
      time: dateStr,
      open: Math.round(open * 100) / 100,
      high: Math.round(high * 100) / 100,
      low: Math.round(low * 100) / 100,
      close: Math.round(close * 100) / 100,
    });

    basePrice = close + (Math.random() - 0.5) * 200;
  }

  return data;
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
}

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

export function ChartWidget({
  priceLines,
  onPriceLineDrag,
}: ChartWidgetProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const priceLinesRef = useRef<Map<string, IPriceLine>>(new Map());
  const [mockData] = useState(() => generateMockData());

  // Keep mutable refs for callbacks and config so event listeners always see latest values
  const priceLinesConfigRef = useRef<PriceLineConfig[]>(priceLines);
  const onPriceLineDragRef = useRef(onPriceLineDrag);
  const draggingIdRef = useRef<string | null>(null);

  useEffect(() => {
    priceLinesConfigRef.current = priceLines;
  }, [priceLines]);

  useEffect(() => {
    onPriceLineDragRef.current = onPriceLineDrag;
  }, [onPriceLineDrag]);

  // Initialize chart + drag handling
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const container = chartContainerRef.current;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: css("--contrast-secondary"),           // --contrast-secondary
        fontFamily: "'Inter Display', sans-serif",
        fontSize: 12,
      },
      grid: {
        vertLines: { color: css("--border") },            // --border
        horzLines: { color: css("--border") },            // --border
      },
      crosshair: {
        vertLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),   // --accent-bg-default @ 40%
          labelBackgroundColor: css("--accent-bg-default"), // --accent-bg-default
        },
        horzLine: {
          color: rgba("--accent-bg-default-rgb", 0.4),   // --accent-bg-default @ 40%
          labelBackgroundColor: css("--accent-bg-default"), // --accent-bg-default
        },
      },
      rightPriceScale: {
        borderColor: css("--border"),                     // --border
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: css("--border"),                     // --border
        timeVisible: false,
      },
      width: container.clientWidth,
      height: container.clientHeight,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: css("--positive-bg-default"),              // --positive-bg-default
      downColor: css("--negative-bg-default"),            // --negative-bg-default
      borderUpColor: css("--positive-bg-default"),        // --positive-bg-default
      borderDownColor: css("--negative-bg-default"),      // --negative-bg-default
      wickUpColor: rgba("--positive-bg-default-rgb", 0.6),   // --positive-bg-default @ 60%
      wickDownColor: rgba("--negative-bg-default-rgb", 0.6), // --negative-bg-default @ 60%
    });

    series.setData(mockData);
    chart.timeScale().fitContent();

    chartRef.current = chart;
    seriesRef.current = series;

    // --- Drag-on-chart logic ---

    /** Find the nearest visible price line within SNAP_PX of clientY */
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
      if (e.button !== 0) return; // left click only
      const nearId = findNearestLine(e.clientY);
      if (!nearId) return;

      // Prevent chart from panning / scaling
      e.preventDefault();
      e.stopPropagation();
      draggingIdRef.current = nearId;
      container.setPointerCapture(e.pointerId);
      chart.applyOptions({ handleScroll: false, handleScale: false });
      container.style.cursor = "ns-resize";
    };

    const onPointerMove = (e: PointerEvent) => {
      if (draggingIdRef.current) {
        // Dragging — convert Y to price
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
        // Hover — show resize cursor when near a line
        const nearId = findNearestLine(e.clientY);
        container.style.cursor = nearId ? "ns-resize" : "";
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (draggingIdRef.current) {
        draggingIdRef.current = null;
        try {
          container.releasePointerCapture(e.pointerId);
        } catch {
          /* pointerId might already be released */
        }
        chart.applyOptions({ handleScroll: true, handleScale: true });
        container.style.cursor = "";
      }
    };

    // Use capture phase so we intercept before chart's internal handlers
    container.addEventListener("pointerdown", onPointerDown, {
      capture: true,
    });
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointerup", onPointerUp);

    // Handle resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        chart.applyOptions({ width, height });
      }
    });
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener("pointerdown", onPointerDown, {
        capture: true,
      });
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointerup", onPointerUp);
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      priceLinesRef.current.clear();
    };
  }, []);

  // Update price lines
  useEffect(() => {
    const series = seriesRef.current;
    if (!series) return;

    const existingLines = priceLinesRef.current;
    const currentIds = new Set(priceLines.map((pl) => pl.id));

    // Remove lines that no longer exist
    for (const [id, line] of existingLines) {
      if (!currentIds.has(id)) {
        series.removePriceLine(line);
        existingLines.delete(id);
      }
    }

    // Add or update lines
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
        color: config.color,
        lineWidth: config.lineWidth as PriceLineOptions["lineWidth"],
        lineStyle: config.lineStyle,
        axisLabelVisible: true,
        title: config.label,
        axisLabelColor: config.labelColor,
        axisLabelTextColor: config.labelTextColor,
      };

      const existing = existingLines.get(config.id);
      if (existing) {
        existing.applyOptions(options);
      } else {
        const line = series.createPriceLine(options);
        existingLines.set(config.id, line);
      }
    }
  }, [priceLines]);

  return (
    <div
      ref={chartContainerRef}
      className="w-full h-full min-h-[400px]"
      style={{ fontFamily: "'Inter Display', sans-serif" }}
    />
  );
}