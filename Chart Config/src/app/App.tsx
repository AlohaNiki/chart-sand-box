import { useState, useCallback, useRef, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChartWidget, type PriceLineConfig, type TradeOrder } from "./components/chart-widget";

import { KlineChartWidget } from "./components/klinechart-widget";
import { OrderDetailModal } from "./components/order-detail-modal";
import { TradeChartModal } from "./components/trade-chart-modal";
import { ChangelogPanel } from "./components/changelog-panel";
import { PriceLineEditor, ColorTokenPicker } from "./components/price-line-editor";
import {
  RotateCcw,
  Plus,
  Download,
  Upload,
  Trash2,
  Sun,
  Moon,
  ScrollText,
  TrendingUp,
  TrendingDown,
  ChevronRight,
} from "lucide-react";

/** Default price lines (used on first visit and on Reset) */
const DEFAULT_PRICE_LINES: PriceLineConfig[] = [
  {
    id: "buy-order",
    label: "Buy Order",
    price: 63861.97,
    color: "--positive-bg-default",
    labelColor: "--surface-elevation-3",
    labelTextColor: "--positive-text-and-icons",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
  {
    id: "take-profit",
    label: "Take Profit",
    price: 74804.57,
    color: "--positive-bg-default",
    labelColor: "--positive-bg-default",
    labelTextColor: "--positive-over",
    lineWidth: 1,
    lineStyle: 2,
    visible: true,
  },
  {
    id: "stop-loss",
    label: "Stop Loss",
    price: 63079.93,
    color: "--negative-bg-default",
    labelColor: "--negative-bg-default",
    labelTextColor: "--negative-over",
    lineWidth: 1,
    lineStyle: 2,
    visible: true,
  },
  {
    id: "custom-1",
    label: "Sell Order",
    price: 73806.21,
    color: "--negative-bg-default",
    labelColor: "--surface-elevation-3",
    labelTextColor: "--negative-text-and-icons",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
  {
    id: "custom-2",
    label: "AO 1",
    price: 66351.41,
    color: "--contrast-tertiary",
    labelColor: "--surface-elevation-3",
    labelTextColor: "--contrast-primary",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
  {
    id: "custom-3",
    label: "AO 2",
    price: 65778.66,
    color: "--contrast-tertiary",
    labelColor: "--surface-elevation-3",
    labelTextColor: "--contrast-primary",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
  {
    id: "custom-5",
    label: "AO 3",
    price: 65188.31,
    color: "--contrast-tertiary",
    labelColor: "--surface-elevation-3",
    labelTextColor: "--contrast-primary",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
  {
    id: "liquidation",
    label: "Liquidation",
    price: 62356.52,
    color: "--warning-bg-default",
    labelColor: "--warning-bg-default",
    labelTextColor: "--warning-over",
    lineWidth: 1,
    lineStyle: 0,
    visible: true,
  },
];


/** Default trade orders shown on first visit / after Reset */
const DEFAULT_ORDERS: TradeOrder[] = [
  {
    id: "order-1", time: 1761004800, price: 62500, type: "buy",
    closePrice: 74800, leverage: 10, amount: 0.1, volume: 625,
    pnl: 1230, pnlPercent: 19.7, transactionId: "10234521",
    operation: "Long", takeProfit: 78000, stopLoss: 59000,
    openTime: 1761004800, closeTime: 1761264000,
  },
  {
    id: "order-2", time: 1763942400, price: 96000, type: "sell",
    closePrice: 87500, leverage: 5, amount: 0.1, volume: 960,
    pnl: 850, pnlPercent: 8.9, transactionId: "10456783",
    operation: "Short", takeProfit: 85000, stopLoss: 101000,
    openTime: 1763942400, closeTime: 1764115200,
  },
  {
    id: "order-3", time: 1766534400, price: 101000, type: "sell",
    closePrice: 95200, leverage: 5, amount: 0.05, volume: 505,
    pnl: 290, pnlPercent: 5.7, transactionId: "10589341",
    operation: "Short", takeProfit: 93000, stopLoss: 106000,
    openTime: 1766534400, closeTime: 1767225600,
  },
  {
    id: "order-4", time: 1770076800, price: 97500, type: "buy",
    closePrice: 84000, leverage: 10, amount: 0.1, volume: 975,
    pnl: -1350, pnlPercent: -13.8, transactionId: "10712984",
    operation: "Long", takeProfit: 110000, stopLoss: 90000,
    openTime: 1770076800, closeTime: 1771286400,
  },
];

/** Historical trades shown in the History tab (not on the main chart) */
const DEFAULT_HISTORY_ORDERS: TradeOrder[] = [
  {
    id: "hist-1",
    time: 1709884800,
    openTime:  1709884800, // Mar 8, 2024 08:00 UTC — BTC ~69 800
    closeTime: 1710158400, // Mar 11, 2024 12:00 UTC — BTC ~72 400
    price: 69800, closePrice: 72400,
    type: "buy", operation: "Long",
    leverage: 10, amount: 100, volume: 1000,
    pnl: 260, pnlPercent: 26.0,
    transactionId: "20240308001",
    takeProfit: 74000, stopLoss: 67000,
  },
  {
    id: "hist-2",
    time: 1710403200,
    openTime:  1710403200, // Mar 14, 2024 08:00 UTC — BTC ~73 500
    closeTime: 1710921600, // Mar 20, 2024 08:00 UTC — BTC ~68 800
    price: 73500, closePrice: 68800,
    type: "sell", operation: "Short",
    leverage: 5, amount: 50, volume: 500,
    pnl: 160, pnlPercent: 32.0,
    transactionId: "20240314002",
    takeProfit: 68000, stopLoss: 76000,
  },
  {
    id: "hist-3",
    time: 1709596800,
    openTime:  1709596800, // Mar 5, 2024 00:00 UTC — BTC ~67 000 (before flash crash)
    closeTime: 1709769600, // Mar 7, 2024 00:00 UTC — BTC ~63 000
    price: 67000, closePrice: 62500,
    type: "buy", operation: "Long",
    leverage: 10, amount: 75, volume: 750,
    pnl: -338, pnlPercent: -45.0,
    transactionId: "20240305003",
    takeProfit: 71000, stopLoss: 64000,
  },
  {
    id: "hist-4",
    time: 1710115200,
    openTime:  1710115200, // Mar 11, 2024 00:00 UTC — BTC ~72 000
    closeTime: 1710374400, // Mar 14, 2024 00:00 UTC — BTC ~73 800 ATH
    price: 72000, closePrice: 73800,
    type: "sell", operation: "Short",
    leverage: 5, amount: 40, volume: 400,
    pnl: -72, pnlPercent: -18.0,
    transactionId: "20240311004",
    takeProfit: 69000, stopLoss: 74500,
  },
];

const STORAGE_KEYS = {
  theme: "chartConfig_theme",
  priceLines: "chartConfig_priceLines",
  chartBg: "chartConfig_chartBg",
  gridColor: "chartConfig_gridColor",
  showOrders: "chartConfig_showOrders",
  orders: "chartConfig_orders",
} as const;

let nextCustomId = 1;

function isValidPriceLine(obj: unknown): obj is PriceLineConfig {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.label === "string" &&
    typeof o.price === "number" &&
    typeof o.color === "string" &&
    typeof o.labelColor === "string" &&
    typeof o.lineWidth === "number" &&
    typeof o.lineStyle === "number" &&
    typeof o.visible === "boolean"
  );
}

export default function App() {
  // ── Persist theme in localStorage ────────────────────────────────────────
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.theme);
      return stored === "light" ? "light" : "dark";
    } catch {
      return "dark";
    }
  });

  // Save theme to localStorage (class is applied synchronously in toggleTheme)
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.theme, theme); } catch {}
  }, [theme]);

  // Cleanup on unmount
  useEffect(() => {
    return () => document.documentElement.classList.remove("light");
  }, []);

  // Toggle theme — apply CSS class synchronously BEFORE setTheme so that
  // resolveVar() calls during the upcoming re-render see the correct values
  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.classList.toggle("light", next === "light");
    setTheme(next);
  }, [theme]);

  // ── Persist priceLines in localStorage ───────────────────────────────────
  const [priceLines, setPriceLines] = useState<PriceLineConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.priceLines);
      if (!stored) return DEFAULT_PRICE_LINES;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return DEFAULT_PRICE_LINES;
      const validated = parsed.filter(isValidPriceLine);
      return validated.length > 0 ? validated : DEFAULT_PRICE_LINES;
    } catch {
      return DEFAULT_PRICE_LINES;
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.priceLines, JSON.stringify(priceLines)); } catch {}
  }, [priceLines]);

  // ── Chart appearance settings ─────────────────────────────────────────────
  const [chartBg, setChartBg] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEYS.chartBg) || "--surface-elevation-1"; } catch { return "--surface-elevation-1"; }
  });
  const [gridColor, setGridColor] = useState<string>(() => {
    try { return localStorage.getItem(STORAGE_KEYS.gridColor) || "--contrast-quaternary"; } catch { return "--contrast-quaternary"; }
  });

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.chartBg, chartBg); } catch {} }, [chartBg]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.gridColor, gridColor); } catch {} }, [gridColor]);

  // ── Trade orders ──────────────────────────────────────────────────────────
  const [showOrders, setShowOrders] = useState<boolean>(() => {
    try { return localStorage.getItem(STORAGE_KEYS.showOrders) !== "false"; } catch { return true; }
  });
  const [orders, setOrders] = useState<TradeOrder[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.orders);
      if (!stored) return DEFAULT_ORDERS;
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_ORDERS;
    } catch { return DEFAULT_ORDERS; }
  });
  const [pendingOrderType, setPendingOrderType] = useState<"buy" | "sell" | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<TradeOrder | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [chartMode, setChartMode] = useState<"lightweight" | "klinechart">("lightweight");

  // ── History tab ───────────────────────────────────────────────────────────
  const [sidebarMode, setSidebarMode] = useState<"active" | "history">("active");
  const [historyOrders, setHistoryOrders] = useState<TradeOrder[]>(DEFAULT_HISTORY_ORDERS);
  const [selectedHistoryOrder, setSelectedHistoryOrder] = useState<TradeOrder | null>(null);
  const [showAddPosition, setShowAddPosition] = useState(false);

  // Add position form state
  const [addType, setAddType] = useState<"buy" | "sell">("buy");
  const [addOpenTime, setAddOpenTime]   = useState("");
  const [addCloseTime, setAddCloseTime] = useState("");
  const [addEntryPrice, setAddEntryPrice]   = useState("");
  const [addClosePrice, setAddClosePrice]   = useState("");
  const [addLeverage, setAddLeverage]   = useState("");

  const handleAddPosition = () => {
    if (!addOpenTime || !addEntryPrice) return;
    const openTs  = Math.floor(new Date(addOpenTime).getTime()  / 1000);
    const closeTs = addCloseTime ? Math.floor(new Date(addCloseTime).getTime() / 1000) : undefined;
    const entry   = parseFloat(addEntryPrice);
    const close   = addClosePrice ? parseFloat(addClosePrice) : undefined;
    const lev     = addLeverage ? parseInt(addLeverage) : undefined;
    const isLong  = addType === "buy";
    const pnl     = close !== undefined ? Math.round((isLong ? close - entry : entry - close) * 100) / 100 : undefined;
    const pnlPct  = pnl !== undefined ? Math.round((pnl / entry) * (lev ?? 1) * 10000) / 100 : undefined;

    const newOrder: TradeOrder = {
      id: `hist-${Date.now()}`,
      time: openTs,
      openTime: openTs,
      closeTime: closeTs,
      price: entry,
      closePrice: close,
      type: addType,
      operation: isLong ? "Long" : "Short",
      leverage: lev,
      pnl,
      pnlPercent: pnlPct,
    };
    setHistoryOrders((prev) => [newOrder, ...prev]);
    setShowAddPosition(false);
    setAddOpenTime(""); setAddCloseTime(""); setAddEntryPrice(""); setAddClosePrice(""); setAddLeverage("");
  };

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.showOrders, String(showOrders)); } catch {} }, [showOrders]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.orders, JSON.stringify(orders)); } catch {} }, [orders]);

  const handleOrderPlace = useCallback((order: TradeOrder) => {
    setOrders((prev) => [...prev, order]);
    setPendingOrderType(null);
  }, []);

  const handleOrderPriceChange = useCallback((id: string, newPrice: number) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, price: newPrice } : o));
  }, []);

  const [importMessage, setImportMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLineChange = useCallback((updated: PriceLineConfig) => {
    setPriceLines((prev) =>
      prev.map((pl) => (pl.id === updated.id ? updated : pl))
    );
  }, []);

  const handleReset = () => {
    if (!window.confirm("Reset all price lines and chart settings to defaults? This cannot be undone.")) return;
    setImportMessage(null);
    setPriceLines(DEFAULT_PRICE_LINES);
    setChartBg("--surface-elevation-1");
    setGridColor("--contrast-quaternary");
    setOrders(DEFAULT_ORDERS);
    setShowOrders(true);
  };

  const handleAddLevel = () => {
    const id = `custom-${nextCustomId++}`;
    const lastPrice = priceLines[priceLines.length - 1]?.price ?? 43000;
    const newLine: PriceLineConfig = {
      id,
      label: `Level ${nextCustomId - 1}`,
      price: Math.round(lastPrice + (Math.random() - 0.5) * 2000),
      color: "--accent-text-and-icons",
      labelColor: "--accent-text-and-icons",
      labelTextColor: "--accent-over",
      lineWidth: 1,
      lineStyle: 2,
      visible: true,
    };
    setPriceLines((prev) => [...prev, newLine]);
  };

  const handleDeleteLine = useCallback((id: string) => {
    setPriceLines((prev) => prev.filter((pl) => pl.id !== id));
  }, []);

  const handleMoveLine = useCallback((dragIndex: number, hoverIndex: number) => {
    setPriceLines((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);
      return updated;
    });
  }, []);

  const handleDuplicateLine = useCallback((source: PriceLineConfig) => {
    const id = `custom-${nextCustomId++}`;
    const duplicate: PriceLineConfig = {
      ...source,
      id,
      label: `${source.label} (copy)`,
      price: source.price + 200,
    };
    setPriceLines((prev) => {
      const sourceIndex = prev.findIndex((pl) => pl.id === source.id);
      const updated = [...prev];
      updated.splice(sourceIndex + 1, 0, duplicate);
      return updated;
    });
  }, []);

  /** Called when user drags a price line directly on the chart */
  const handleChartDrag = useCallback((id: string, newPrice: number) => {
    setPriceLines((prev) =>
      prev.map((pl) => (pl.id === id ? { ...pl, price: newPrice } : pl))
    );
  }, []);

  // Export config as JSON file
  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      priceLines,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `price-lines-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setImportMessage({ text: "Exported successfully", type: "success" });
    setTimeout(() => setImportMessage(null), 3000);
  };

  // Import config from JSON file
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result;
        if (typeof text !== "string") throw new Error("Failed to read file");
        const parsed = JSON.parse(text);

        let lines: unknown[];
        if (Array.isArray(parsed)) {
          lines = parsed;
        } else if (parsed && Array.isArray(parsed.priceLines)) {
          lines = parsed.priceLines;
        } else {
          throw new Error("Invalid format: expected array or { priceLines: [] }");
        }

        const validated = lines.filter(isValidPriceLine);
        if (validated.length === 0) {
          throw new Error("No valid price lines found in file");
        }

        // Ensure unique IDs; remap custom IDs if needed
        const seenIds = new Set<string>();
        const finalLines = validated.map((line) => {
          let id = line.id;
          if (seenIds.has(id)) {
            id = `imported-${nextCustomId++}`;
          }
          seenIds.add(id);
          return {
            ...line,
            id,
            // Backfill labelTextColor for imports missing it
            labelTextColor: (line as any).labelTextColor || "#FFFFFF",
          };
        });

        setPriceLines(finalLines);
        setImportMessage({
          text: `Imported ${finalLines.length} line${finalLines.length > 1 ? "s" : ""}`,
          type: "success",
        });
        setTimeout(() => setImportMessage(null), 3000);
      } catch (err) {
        setImportMessage({
          text: err instanceof Error ? err.message : "Import failed",
          type: "error",
        });
        setTimeout(() => setImportMessage(null), 5000);
      }
    };
    reader.readAsText(file);

    // Reset input so the same file can be re-imported
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Price lines shown on chart depend on active sidebar tab ───────────────
  const historyPriceLines: PriceLineConfig[] = historyOrders.flatMap((order) => {
    const isBuy = order.type === "buy";
    const entryColor  = isBuy ? "--positive-bg-default"      : "--negative-bg-default";
    const entryText   = isBuy ? "--positive-over"            : "--negative-over";
    const exitColor   = isBuy ? "--positive-transparent"     : "--negative-transparent";
    const op = order.operation ?? (isBuy ? "Long" : "Short");
    const lines: PriceLineConfig[] = [
      {
        id: `${order.id}-entry`,
        label: `${op} Entry`,
        price: order.price,
        color: entryColor,
        labelColor: entryColor,
        labelTextColor: entryText,
        lineWidth: 1,
        lineStyle: 2,
        visible: true,
      },
    ];
    if (order.closePrice !== undefined) {
      lines.push({
        id: `${order.id}-exit`,
        label: `${op} Exit`,
        price: order.closePrice,
        color: exitColor,
        labelColor: exitColor,
        labelTextColor: entryText,
        lineWidth: 1,
        lineStyle: 3,
        visible: true,
      });
    }
    return lines;
  });

  const effectivePriceLines = sidebarMode === "history" ? historyPriceLines : priceLines;

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="size-full flex flex-col overflow-hidden"
        style={{ background: "var(--background)" }}
      >
        {/* Header */}
        <header
          className="grid items-center px-[16px] py-[12px] border-b border-border shrink-0"
          style={{ background: "var(--sidebar)", gridTemplateColumns: "1fr auto 1fr" }}
        >
          {/* Left: logo */}
          <div className="flex items-center gap-[12px]">
            <h3 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>
              Chart Console
            </h3>
            <span
              className="px-[8px] py-[2px] rounded-[var(--radius-sm)]"
              style={{
                background: "var(--secondary)",
                color: "var(--muted-foreground)",
                fontFamily: "'Inter Display', sans-serif",
                fontSize: "var(--text-label)",
              }}
            >
              BTC/USDT
            </span>
          </div>

          {/* Center: chart mode toggle */}
          <div
            className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px]"
            style={{ background: "var(--secondary)" }}
          >
            {(["lightweight", "klinechart"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setChartMode(mode)}
                className="px-[12px] py-[4px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                style={{
                  fontFamily: "'Inter Display', sans-serif",
                  fontSize: "var(--text-label)",
                  background: chartMode === mode ? "var(--card)" : "transparent",
                  color: chartMode === mode ? "var(--foreground)" : "var(--muted-foreground)",
                  fontWeight: chartMode === mode ? "600" : "400",
                }}
              >
                {mode === "lightweight" ? "Lightweight" : "KLineChart"}
              </button>
            ))}
          </div>

          {/* Right: action buttons */}
          <div className="flex items-center gap-[8px] justify-end">
            <button
              onClick={handleReset}
              className="flex items-center gap-[6px] px-[12px] py-[6px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
              style={{
                color: "var(--foreground)",
                fontFamily: "'Inter Display', sans-serif",
                fontSize: "var(--text-label)",
              }}
              title="Reset all lines"
            >
              <RotateCcw size={14} style={{ color: "var(--muted-foreground)" }} />
              Reset
            </button>
            <button
              onClick={() => setShowChangelog(true)}
              className="flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
              style={{ color: "var(--muted-foreground)" }}
              title="What's new"
            >
              <ScrollText size={14} />
            </button>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center w-[32px] h-[32px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
              style={{ color: "var(--muted-foreground)" }}
              title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            >
              {theme === "dark"
                ? <Sun size={14} />
                : <Moon size={14} />
              }
            </button>
          </div>
        </header>

        {/* Main content */}
        <div className="flex flex-col md:flex-row flex-1 min-h-0 md:overflow-hidden overflow-y-auto">
          {/* Chart area */}
          <div className="md:flex-1 min-w-0 min-h-0 p-[8px] shrink-0">
            <div
              className="w-full h-[400px] md:h-full rounded-[var(--radius-card)] overflow-hidden border border-border"
              style={{ background: "var(--card)" }}
            >
              {chartMode === "lightweight" ? (
                <ChartWidget
                  priceLines={effectivePriceLines}
                  onPriceLineDrag={sidebarMode === "active" ? handleChartDrag : undefined}
                  theme={theme}
                  chartBg={chartBg}
                  gridColor={gridColor}
                  orders={orders}
                  showOrders={sidebarMode === "active" ? showOrders : false}
                  pendingOrderType={sidebarMode === "active" ? pendingOrderType : null}
                  onOrderPlace={handleOrderPlace}
                  onCancelPending={() => setPendingOrderType(null)}
                  onOrderClick={setSelectedOrder}
                  onOrderPriceChange={handleOrderPriceChange}
                />
              ) : (
                <KlineChartWidget
                  priceLines={effectivePriceLines}
                  theme={theme}
                  chartBg={chartBg}
                  gridColor={gridColor}
                  orders={orders}
                  showOrders={sidebarMode === "active" ? showOrders : false}
                  onOrderClick={setSelectedOrder}
                  pendingOrderType={pendingOrderType}
                  onOrderPlace={handleOrderPlace}
                  onCancelPending={() => setPendingOrderType(null)}
                />
              )}
            </div>
          </div>

          {/* Editing panel */}
          <aside
              className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-border overflow-y-auto"
              style={{ background: "var(--sidebar)" }}
            >
              <div className="p-[16px] flex flex-col gap-[12px]">
                {/* Active / History toggle */}
                <div
                  className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px] shrink-0"
                  style={{ background: "var(--secondary)" }}
                >
                  {(["active", "history"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSidebarMode(mode)}
                      className="flex-1 py-[4px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                      style={{
                        fontFamily: "'Inter Display', sans-serif",
                        fontSize: "var(--text-label)",
                        background: sidebarMode === mode ? "var(--card)" : "transparent",
                        color: sidebarMode === mode ? "var(--foreground)" : "var(--muted-foreground)",
                        fontWeight: sidebarMode === mode ? "600" : "400",
                      }}
                    >
                      {mode === "active" ? "Active" : "History"}
                    </button>
                  ))}
                </div>

                {sidebarMode === "history" ? (
                  /* ── History tab ───────────────────────────────────────── */
                  <div className="flex flex-col gap-[10px]">
                    <button
                      onClick={() => setShowAddPosition(true)}
                      className="flex items-center justify-center gap-[6px] px-[12px] py-[9px] rounded-[var(--radius)] border border-dashed border-border hover:bg-secondary transition-colors cursor-pointer"
                      style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                    >
                      <Plus size={14} />
                      Add Position
                    </button>

                    {historyOrders.map((order) => {
                      const isBuy    = order.type === "buy";
                      const isProfit = (order.pnl ?? 0) >= 0;
                      const op       = order.operation ?? (isBuy ? "Long" : "Short");
                      return (
                        <button
                          key={order.id}
                          onClick={() => setSelectedHistoryOrder(order)}
                          className="w-full flex items-center gap-[10px] px-[12px] py-[10px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer text-left"
                          style={{ background: "var(--card)" }}
                        >
                          {/* Direction icon */}
                          <div
                            className="w-[28px] h-[28px] rounded-[var(--radius-sm)] flex items-center justify-center shrink-0"
                            style={{ background: isBuy ? "var(--positive-bg-default)" : "var(--negative-bg-default)" }}
                          >
                            {isBuy
                              ? <TrendingUp  size={13} color="var(--positive-over)" />
                              : <TrendingDown size={13} color="var(--negative-over)" />
                            }
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-[6px]">
                              <span style={{ color: "var(--foreground)", fontSize: "13px", fontWeight: "600", fontFamily: "'Inter Display', sans-serif" }}>
                                {op}{order.leverage ? ` ×${order.leverage}` : ""}
                              </span>
                              {order.pnl !== undefined && (
                                <span style={{ color: isProfit ? "var(--positive-bg-default)" : "var(--negative-bg-default)", fontSize: "12px", fontWeight: "500", fontFamily: "'Inter Display', sans-serif" }}>
                                  {isProfit ? "+" : ""}{order.pnl.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <div style={{ color: "var(--muted-foreground)", fontSize: "11px", fontFamily: "'Inter Display', sans-serif", marginTop: "2px" }}>
                              {order.openTime
                                ? new Date(order.openTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                : "—"}
                              {order.closeTime
                                ? ` → ${new Date(order.closeTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
                                : ""}
                            </div>
                          </div>

                          <ChevronRight size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                        </button>
                      );
                    })}

                    {historyOrders.length === 0 && (
                      <p style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", textAlign: "center", padding: "24px 0" }}>
                        No history yet. Add a position to get started.
                      </p>
                    )}
                  </div>
                ) : (
                /* ── Active tab ─────────────────────────────────────────── */
                <>
                {/* Chart Settings */}
                <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>
                  Chart
                </h4>
                <div className="flex flex-col gap-[8px]">
                  <div className="flex flex-col gap-[4px]">
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      Background
                    </span>
                    <ColorTokenPicker value={chartBg} onChange={setChartBg} />
                  </div>
                  <div className="flex flex-col gap-[4px]">
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      Grid
                    </span>
                    <ColorTokenPicker value={gridColor} onChange={setGridColor} />
                  </div>

                  {/* Show history orders toggle + add buttons */}
                  <div className="flex items-center justify-between">
                    <label
                      className="flex items-center gap-[8px] cursor-pointer"
                      style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                    >
                      <input
                        type="checkbox"
                        checked={showOrders}
                        onChange={(e) => setShowOrders(e.target.checked)}
                        className="cursor-pointer"
                      />
                      History Markers
                    </label>
                  </div>

                  {showOrders && (
                    <div className="flex items-center gap-[6px]">
                      <button
                        onClick={() => setPendingOrderType(pendingOrderType === "buy" ? null : "buy")}
                        className="flex-1 flex items-center justify-center gap-[4px] px-[8px] py-[5px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer"
                        style={{
                          borderColor: "var(--positive-bg-default)",
                          background: pendingOrderType === "buy" ? "var(--positive-bg-default)" : "transparent",
                          color: pendingOrderType === "buy" ? "var(--positive-over)" : "var(--positive-bg-default)",
                          fontFamily: "'Inter Display', sans-serif",
                          fontSize: "var(--text-label)",
                          fontWeight: "600",
                        }}
                      >
                        + Buy
                      </button>
                      <button
                        onClick={() => setPendingOrderType(pendingOrderType === "sell" ? null : "sell")}
                        className="flex-1 flex items-center justify-center gap-[4px] px-[8px] py-[5px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer"
                        style={{
                          borderColor: "var(--negative-bg-default)",
                          background: pendingOrderType === "sell" ? "var(--negative-bg-default)" : "transparent",
                          color: pendingOrderType === "sell" ? "var(--negative-over)" : "var(--negative-bg-default)",
                          fontFamily: "'Inter Display', sans-serif",
                          fontSize: "var(--text-label)",
                          fontWeight: "600",
                        }}
                      >
                        + Sell
                      </button>
                      {orders.length > 0 && (
                        <button
                          onClick={() => setOrders([])}
                          className="px-[8px] py-[5px] rounded-[var(--radius-sm)] border border-border transition-colors cursor-pointer"
                          style={{
                            color: "var(--muted-foreground)",
                            fontFamily: "'Inter Display', sans-serif",
                            fontSize: "var(--text-label)",
                          }}
                          title="Clear all orders"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="h-px" style={{ background: "var(--border)" }} />

                {/* Panel header */}
                <div className="flex items-center justify-between">
                  <h4
                    style={{
                      color: "var(--foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                    }}
                  >
                    Price Lines
                  </h4>
                  <span
                    style={{
                      color: "var(--muted-foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                      fontSize: "var(--text-label)",
                    }}
                  >
                    {priceLines.filter((p) => p.visible).length}/
                    {priceLines.length} visible
                  </span>
                </div>

                {/* Export / Import / Clear bar */}
                <div className="flex items-center gap-[8px]">
                  <button
                    onClick={handleExport}
                    className="flex-1 flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                    style={{
                      color: "var(--foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                      fontSize: "var(--text-label)",
                    }}
                    title="Export price lines as JSON"
                  >
                    <Upload size={13} style={{ color: "var(--muted-foreground)" }} />
                    Export
                  </button>
                  <label
                    className="flex-1 flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                    style={{
                      color: "var(--foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                      fontSize: "var(--text-label)",
                    }}
                    title="Import price lines from JSON"
                  >
                    <Download size={13} style={{ color: "var(--muted-foreground)" }} />
                    Import
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".json,application/json"
                      onChange={handleImport}
                      className="hidden"
                    />
                  </label>
                  <button
                    onClick={() => {
                      if (window.confirm("Delete all price lines and active orders? This cannot be undone.")) {
                        setPriceLines([]);
                        setOrders([]);
                      }
                    }}
                    className="flex items-center justify-center w-[32px] h-[32px] shrink-0 rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                    title="Delete all price lines"
                  >
                    <Trash2 size={13} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                </div>

                {/* Import message toast */}
                {importMessage && (
                  <div
                    className="px-[10px] py-[6px] rounded-[var(--radius-sm)] text-center transition-all"
                    style={{
                      background:
                        importMessage.type === "success"
                          ? "var(--success)"
                          : "var(--destructive)",
                      color:
                        importMessage.type === "success"
                          ? "var(--success-foreground)"
                          : "var(--destructive-foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                      fontSize: "var(--text-label)",
                      fontWeight: "var(--font-weight-medium)",
                    }}
                  >
                    {importMessage.text}
                  </div>
                )}

                {/* Draggable list */}
                {priceLines.map((config, index) => (
                  <PriceLineEditor
                    key={config.id}
                    index={index}
                    config={config}
                    onChange={handleLineChange}
                    onDelete={handleDeleteLine}
                    onDuplicate={handleDuplicateLine}
                    onMove={handleMoveLine}
                    canDelete={true}
                  />
                ))}

                {/* Add Level button */}
                <button
                  onClick={handleAddLevel}
                  className="flex items-center justify-center gap-[6px] px-[12px] py-[10px] rounded-[var(--radius)] border border-dashed border-border hover:bg-secondary transition-colors cursor-pointer"
                  style={{
                    color: "var(--muted-foreground)",
                    fontFamily: "'Inter Display', sans-serif",
                    fontSize: "var(--text-base)",
                  }}
                >
                  <Plus size={16} style={{ color: "var(--muted-foreground)" }} />
                  Add Custom Level
                </button>
                </>
                )}
              </div>
            </aside>
        </div>
      </div>
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
      {selectedHistoryOrder && (
        <TradeChartModal
          order={selectedHistoryOrder}
          onClose={() => setSelectedHistoryOrder(null)}
          theme={theme}
        />
      )}
      {showChangelog && (
        <ChangelogPanel onClose={() => setShowChangelog(false)} />
      )}

      {/* ── Add Position modal ─────────────────────────────────────────────── */}
      {showAddPosition && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-[24px]"
          onClick={() => setShowAddPosition(false)}
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <div
            className="relative flex flex-col gap-[16px] rounded-[var(--radius-card)] overflow-hidden shadow-xl p-[24px]"
            style={{ background: "var(--surface-elevation-1)", border: "1px solid var(--border)", width: "min(400px, 100%)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Add Position</h4>
              <button onClick={() => setShowAddPosition(false)} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--foreground)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            {/* Direction toggle */}
            <div className="flex gap-[8px]">
              {(["buy", "sell"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setAddType(t)}
                  className="flex-1 py-[7px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer"
                  style={{
                    fontFamily: "'Inter Display', sans-serif", fontSize: "13px", fontWeight: "600",
                    borderColor: t === "buy" ? "var(--positive-bg-default)" : "var(--negative-bg-default)",
                    background: addType === t ? (t === "buy" ? "var(--positive-bg-default)" : "var(--negative-bg-default)") : "transparent",
                    color: addType === t ? (t === "buy" ? "var(--positive-over)" : "var(--negative-over)") : (t === "buy" ? "var(--positive-bg-default)" : "var(--negative-bg-default)"),
                  }}
                >
                  {t === "buy" ? "Long" : "Short"}
                </button>
              ))}
            </div>

            {/* Fields */}
            {[
              { label: "Entry time",   value: addOpenTime,    setter: setAddOpenTime,    type: "datetime-local", required: true },
              { label: "Close time",   value: addCloseTime,   setter: setAddCloseTime,   type: "datetime-local", required: false },
              { label: "Entry price",  value: addEntryPrice,  setter: setAddEntryPrice,  type: "number",         required: true },
              { label: "Close price",  value: addClosePrice,  setter: setAddClosePrice,  type: "number",         required: false },
              { label: "Leverage (×)", value: addLeverage,    setter: setAddLeverage,    type: "number",         required: false },
            ].map(({ label, value, setter, type, required }) => (
              <div key={label} className="flex flex-col gap-[4px]">
                <span style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>
                  {label}{required && <span style={{ color: "var(--negative-bg-default)" }}> *</span>}
                </span>
                <input
                  type={type}
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  className="w-full px-[10px] py-[7px] rounded-[var(--radius-sm)] border border-border outline-none"
                  style={{ background: "var(--secondary)", color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "13px", colorScheme: "dark" }}
                  step={type === "number" ? "any" : undefined}
                />
              </div>
            ))}

            <button
              onClick={handleAddPosition}
              disabled={!addOpenTime || !addEntryPrice}
              className="w-full py-[9px] rounded-[var(--radius)] transition-colors cursor-pointer"
              style={{
                background: "var(--accent-text-and-icons)", color: "#fff",
                fontFamily: "'Inter Display', sans-serif", fontSize: "13px", fontWeight: "600",
                opacity: (!addOpenTime || !addEntryPrice) ? 0.4 : 1,
              }}
            >
              Add Position
            </button>
          </div>
        </div>
      )}

      <SpeedInsights />
    </DndProvider>
  );
}