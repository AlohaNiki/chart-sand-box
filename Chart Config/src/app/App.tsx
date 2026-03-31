import { useState, useCallback, useRef, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChartWidget, type PriceLineConfig, type TradeOrder, type CurrentPriceLineConfig, type CrosshairConfig, type AdvancedToolbarConfig, type AdvancedPriceLinesConfig } from "./components/chart-widget";

import { KlineChartWidget } from "./components/klinechart-widget";
import { AdvancedChartWidget } from "./components/advanced-chart-widget";
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

/** Default price lines for Lightweight & KlineChart */
const DEFAULT_LW_PRICE_LINES: PriceLineConfig[] = [
  { id: "custom-1", label: "Liq. Price",  price: 61502.53, color: "--warning-bg-default",  labelColor: "--warning-bg-default",  labelTextColor: "--warning-over",              lineWidth: 1,   lineStyle: 0, visible: true },
  { id: "custom-2", label: "TP",          price: 98324.98, color: "--positive-bg-default", labelColor: "--positive-bg-default", labelTextColor: "--positive-over",             lineWidth: 1,   lineStyle: 3, visible: true },
  { id: "custom-3", label: "SL",          price: 94597.55, color: "--negative-bg-default", labelColor: "--negative-bg-default", labelTextColor: "--negative-over",             lineWidth: 1,   lineStyle: 3, visible: true },
  { id: "custom-4", label: "AO",          price: 90553,    color: "--contrast-secondary",  labelColor: "--surface-elevation-3", labelTextColor: "--contrast-primary",          lineWidth: 1,   lineStyle: 2, visible: true },
  { id: "custom-5", label: "Open Long",   price: 86895.97, color: "--positive-bg-default", labelColor: "--surface-elevation-3", labelTextColor: "--positive-text-and-icons",   lineWidth: 1,   lineStyle: 2, visible: true },
  { id: "custom-6", label: "Open Short",  price: 82524.48, color: "--negative-bg-default", labelColor: "--surface-elevation-3", labelTextColor: "--negative-text-and-icons",   lineWidth: 1,   lineStyle: 2, visible: true },
  { id: "custom-7", label: "Entry",       price: 78501.54, color: "--contrast-secondary",  labelColor: "--contrast-primary",    labelTextColor: "--surface-canvas",            lineWidth: 0.5, lineStyle: 0, visible: true },
  { id: "custom-8", label: "Close",       price: 74937.98, color: "--contrast-secondary",  labelColor: "--contrast-primary",    labelTextColor: "--surface-canvas",            lineWidth: 0.5, lineStyle: 0, visible: true },
];

/** Default price lines for Advanced (TradingView) */
const DEFAULT_ADV_PRICE_LINES: PriceLineConfig[] = [
  { id: "adv-1", label: "Liq. Price",   price: 64200, color: "--warning-bg-default",  labelColor: "--warning-bg-default",  labelTextColor: "--warning-over",  lineWidth: 1, lineStyle: 0, visible: true },
  { id: "adv-2", label: "Open Long",    price: 78500, color: "--positive-bg-default", labelColor: "--positive-bg-default", labelTextColor: "--positive-over", lineWidth: 1, lineStyle: 0, visible: true, pnlText: "+$1,840 (7.1%)" },
  { id: "adv-3", label: "Open Short",   price: 91800, color: "--negative-bg-default", labelColor: "--negative-bg-default", labelTextColor: "--negative-over", lineWidth: 1, lineStyle: 0, visible: true, pnlText: "-$1,260 (-4.2%)" },
  { id: "adv-4", label: "Limit Long",   price: 74000, color: "--positive-bg-default", labelColor: "--positive-bg-default", labelTextColor: "--positive-over", lineWidth: 1, lineStyle: 2, visible: true },
  { id: "adv-5", label: "Limit Short",  price: 96500, color: "--negative-bg-default", labelColor: "--negative-bg-default", labelTextColor: "--negative-over", lineWidth: 1, lineStyle: 2, visible: true },
];


/** Default trade orders shown on first visit / after Reset */
const DEFAULT_ORDERS: TradeOrder[] = [];

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
  lwPriceLines: "chartConfig_lw_priceLines",
  klinePriceLines: "chartConfig_kline_priceLines",
  advPriceLines: "chartConfig_adv_priceLines",
  chartBg: "chartConfig_chartBg",
  gridColor: "chartConfig_gridColor",
  gridStyle: "chartConfig_gridStyle",
  showGrid: "chartConfig_showGrid",
  showOrders: "chartConfig_showOrders",
  orders: "chartConfig_orders",
  currentPriceLine: "chartConfig_currentPriceLine",
  crosshair: "chartConfig_crosshair",
  sidebarTab: "chartConfig_sidebarTab",
  chartMode: "chartConfig_chartMode",
  historyOrders: "chartConfig_historyOrders",
  advToolbar: "chartConfig_adv_toolbar",
  advPriceLinesConfig: "chartConfig_adv_priceLinesConfig",
} as const;

const DEFAULT_ADV_TOOLBAR: AdvancedToolbarConfig = {
  showSymbolSearch: false,
  showCompare: false,
  showUndoRedo: true,
  showScreenshot: true,
  showChartType: true,
  showFullscreen: true,
};

const DEFAULT_ADV_PRICE_LINES_CONFIG: AdvancedPriceLinesConfig = {
  extendLeft: true,
  showCancelButton: true,
};

function lsGet<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    if (v === null) return fallback;
    return JSON.parse(v) as T;
  } catch { return fallback; }
}
function lsSet(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

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

  // ── Per-chart price lines (each chart has its own list) ──────────────────
  function loadPriceLines(key: string, defaults: PriceLineConfig[]): PriceLineConfig[] {
    try {
      const stored = localStorage.getItem(key);
      if (!stored) return defaults;
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return defaults;
      const validated = parsed.filter(isValidPriceLine);
      return validated.length > 0 ? validated : defaults;
    } catch { return defaults; }
  }

  const [lwPriceLines, setLwPriceLines] = useState<PriceLineConfig[]>(() => loadPriceLines(STORAGE_KEYS.lwPriceLines, DEFAULT_LW_PRICE_LINES));
  const [klinePriceLines, setKlinePriceLines] = useState<PriceLineConfig[]>(() => loadPriceLines(STORAGE_KEYS.klinePriceLines, DEFAULT_LW_PRICE_LINES));
  const [advPriceLines, setAdvPriceLines] = useState<PriceLineConfig[]>(() => loadPriceLines(STORAGE_KEYS.advPriceLines, DEFAULT_ADV_PRICE_LINES));

  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.lwPriceLines, JSON.stringify(lwPriceLines)); } catch {} }, [lwPriceLines]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.klinePriceLines, JSON.stringify(klinePriceLines)); } catch {} }, [klinePriceLines]);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEYS.advPriceLines, JSON.stringify(advPriceLines)); } catch {} }, [advPriceLines]);

  // ── Chart appearance settings ─────────────────────────────────────────────
  const [chartBg, setChartBg] = useState<string>(() => lsGet(STORAGE_KEYS.chartBg, "--surface-elevation-1"));
  const [gridColor, setGridColor] = useState<string>(() => lsGet(STORAGE_KEYS.gridColor, "--contrast-quaternary"));

  useEffect(() => { lsSet(STORAGE_KEYS.chartBg, chartBg); }, [chartBg]);
  useEffect(() => { lsSet(STORAGE_KEYS.gridColor, gridColor); }, [gridColor]);

  // ── Trade orders ──────────────────────────────────────────────────────────
  const [showOrders, setShowOrders] = useState<boolean>(() => lsGet(STORAGE_KEYS.showOrders, true));
  const [orders, setOrders] = useState<TradeOrder[]>(() => {
    const stored = lsGet<TradeOrder[]>(STORAGE_KEYS.orders, []);
    return stored.length > 0 ? stored : DEFAULT_ORDERS;
  });
  const [pendingOrderType, setPendingOrderType] = useState<"buy" | "sell" | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<TradeOrder | null>(null);
  const [showChangelog, setShowChangelog] = useState(false);
  const [chartMode, setChartMode] = useState<"lightweight" | "klinechart" | "advanced">(() => lsGet(STORAGE_KEYS.chartMode, "lightweight"));

  // Active chart's price lines — each chart manages its own list
  const activePriceLines =
    chartMode === "lightweight" ? lwPriceLines :
    chartMode === "klinechart" ? klinePriceLines :
    advPriceLines;

  const setActivePriceLines = useCallback(
    (updater: PriceLineConfig[] | ((prev: PriceLineConfig[]) => PriceLineConfig[])) => {
      if (chartMode === "lightweight") setLwPriceLines(updater as (prev: PriceLineConfig[]) => PriceLineConfig[]);
      else if (chartMode === "klinechart") setKlinePriceLines(updater as (prev: PriceLineConfig[]) => PriceLineConfig[]);
      else setAdvPriceLines(updater as (prev: PriceLineConfig[]) => PriceLineConfig[]);
    },
    [chartMode],
  );

  // ── History tab ───────────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<"chart" | "orders" | "history">(() => lsGet(STORAGE_KEYS.sidebarTab, "orders"));
  const [currentPriceLineConfig, setCurrentPriceLineConfig] = useState<CurrentPriceLineConfig>(() =>
    lsGet(STORAGE_KEYS.currentPriceLine, { visible: true, color: "--accent-bg-default", lineWidth: 0.5, lineStyle: 0, followCandleColor: true })
  );
  const [crosshairConfig, setCrosshairConfig] = useState<CrosshairConfig>(() =>
    lsGet(STORAGE_KEYS.crosshair, { mode: 0, hStyle: 0, vStyle: 0, color: "--accent-transparent" })
  );
  const [gridStyle, setGridStyle] = useState<number>(() => lsGet(STORAGE_KEYS.gridStyle, 4));
  const [showGrid, setShowGrid] = useState<boolean>(() => lsGet(STORAGE_KEYS.showGrid, true));
  const [advToolbarConfig, setAdvToolbarConfig] = useState<AdvancedToolbarConfig>(() => lsGet(STORAGE_KEYS.advToolbar, DEFAULT_ADV_TOOLBAR));
  const [advPriceLinesConfig, setAdvPriceLinesConfig] = useState<AdvancedPriceLinesConfig>(() => lsGet(STORAGE_KEYS.advPriceLinesConfig, DEFAULT_ADV_PRICE_LINES_CONFIG));
  // Incremented to force remount of AdvancedChartWidget when toolbar config changes
  const [advWidgetKey, setAdvWidgetKey] = useState(0);
  const [historyOrders, setHistoryOrders] = useState<TradeOrder[]>(() => {
    const stored = lsGet<TradeOrder[]>(STORAGE_KEYS.historyOrders, []);
    return stored.length > 0 ? stored : DEFAULT_HISTORY_ORDERS;
  });
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

  useEffect(() => { lsSet(STORAGE_KEYS.showOrders, showOrders); }, [showOrders]);
  useEffect(() => { lsSet(STORAGE_KEYS.orders, orders); }, [orders]);
  useEffect(() => { lsSet(STORAGE_KEYS.currentPriceLine, currentPriceLineConfig); }, [currentPriceLineConfig]);
  useEffect(() => { lsSet(STORAGE_KEYS.crosshair, crosshairConfig); }, [crosshairConfig]);
  useEffect(() => { lsSet(STORAGE_KEYS.gridStyle, gridStyle); }, [gridStyle]);
  useEffect(() => { lsSet(STORAGE_KEYS.showGrid, showGrid); }, [showGrid]);
  useEffect(() => { lsSet(STORAGE_KEYS.advToolbar, advToolbarConfig); }, [advToolbarConfig]);
  useEffect(() => { lsSet(STORAGE_KEYS.advPriceLinesConfig, advPriceLinesConfig); }, [advPriceLinesConfig]);
  useEffect(() => { lsSet(STORAGE_KEYS.sidebarTab, sidebarTab); }, [sidebarTab]);
  useEffect(() => { lsSet(STORAGE_KEYS.chartMode, chartMode); }, [chartMode]);
  useEffect(() => { lsSet(STORAGE_KEYS.historyOrders, historyOrders); }, [historyOrders]);

  const handleOrderPlace = useCallback((order: TradeOrder) => {
    setOrders((prev) => [...prev, order]);
    setPendingOrderType(null);
  }, []);

  const handleOrderPriceChange = useCallback((id: string, newPrice: number) => {
    setOrders((prev) => prev.map((o) => o.id === id ? { ...o, price: newPrice } : o));
  }, []);

  const livePriceRef = useRef(0);

  const [importMessage, setImportMessage] = useState<{
    text: string;
    type: "success" | "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleLineChange = useCallback((updated: PriceLineConfig) => {
    setActivePriceLines((prev) =>
      prev.map((pl) => (pl.id === updated.id ? updated : pl))
    );
  }, [setActivePriceLines]);

  const handleReset = () => {
    if (!window.confirm("Reset all price lines and chart settings to defaults? This cannot be undone.")) return;
    setImportMessage(null);
    setActivePriceLines(isAdvanced ? DEFAULT_ADV_PRICE_LINES : DEFAULT_LW_PRICE_LINES);
    setOrders(DEFAULT_ORDERS);
    setShowOrders(true);
    setChartBg("--surface-elevation-1");
    setGridColor("--contrast-quaternary");
    setGridStyle(4);
    setShowGrid(true);
    setCurrentPriceLineConfig({ visible: true, color: "--accent-bg-default", lineWidth: 0.5, lineStyle: 0, followCandleColor: true });
    setCrosshairConfig({ mode: 0, hStyle: 0, vStyle: 0, color: "--accent-transparent" });
    setAdvToolbarConfig(DEFAULT_ADV_TOOLBAR);
    setAdvPriceLinesConfig(DEFAULT_ADV_PRICE_LINES_CONFIG);
    setAdvWidgetKey(k => k + 1);
  };

  const handleAddLevel = () => {
    const id = `custom-${nextCustomId++}`;
    const basePrice = livePriceRef.current || activePriceLines[activePriceLines.length - 1]?.price || 43000;
    const newLine: PriceLineConfig = {
      id,
      label: `Level ${nextCustomId - 1}`,
      price: Math.round(basePrice),
      color: "--accent-text-and-icons",
      labelColor: "--accent-text-and-icons",
      labelTextColor: "--accent-over",
      lineWidth: 1,
      lineStyle: 2,
      visible: true,
    };
    setActivePriceLines((prev) => [...prev, newLine]);
  };

  const handleDeleteLine = useCallback((id: string) => {
    setActivePriceLines((prev) => prev.filter((pl) => pl.id !== id));
  }, [setActivePriceLines]);

  const handleMoveLine = useCallback((dragIndex: number, hoverIndex: number) => {
    setActivePriceLines((prev) => {
      const updated = [...prev];
      const [removed] = updated.splice(dragIndex, 1);
      updated.splice(hoverIndex, 0, removed);
      return updated;
    });
  }, [setActivePriceLines]);

  const handleDuplicateLine = useCallback((source: PriceLineConfig) => {
    const id = `custom-${nextCustomId++}`;
    const duplicate: PriceLineConfig = {
      ...source,
      id,
      label: `${source.label} (copy)`,
      price: source.price + 200,
    };
    setActivePriceLines((prev) => {
      const sourceIndex = prev.findIndex((pl) => pl.id === source.id);
      const updated = [...prev];
      updated.splice(sourceIndex + 1, 0, duplicate);
      return updated;
    });
  }, [setActivePriceLines]);

  /** Called when user drags a price line directly on the chart (Lightweight only) */
  const handleChartDrag = useCallback((id: string, newPrice: number) => {
    setLwPriceLines((prev) =>
      prev.map((pl) => (pl.id === id ? { ...pl, price: newPrice } : pl))
    );
  }, []);

  // Export config as JSON file
  const handleExport = () => {
    const payload = {
      version: 1,
      exportedAt: new Date().toISOString(),
      priceLines: activePriceLines,
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

        setActivePriceLines(finalLines);
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

  // ── Price lines per chart ─────────────────────────────────────────────────
  const isAdvanced = chartMode === "advanced";

  // Lightweight & KlineChart expand TP/SL into virtual child lines
  function expandWithTpSl(lines: PriceLineConfig[]): PriceLineConfig[] {
    return lines.flatMap((pl) => {
      const result: PriceLineConfig[] = [pl];
      if (pl.takeProfit != null && pl.visible) {
        result.push({ id: `${pl.id}-tp`, label: "TP", price: pl.takeProfit, color: "--positive-bg-default", labelColor: "--positive-bg-default", labelTextColor: "--positive-over", lineWidth: 1, lineStyle: 2, visible: true });
      }
      if (pl.stopLoss != null && pl.visible) {
        result.push({ id: `${pl.id}-sl`, label: "SL", price: pl.stopLoss, color: "--negative-bg-default", labelColor: "--negative-bg-default", labelTextColor: "--negative-over", lineWidth: 1, lineStyle: 2, visible: true });
      }
      return result;
    });
  }

  const lwEffectiveLines = sidebarTab === "history" ? [] : expandWithTpSl(lwPriceLines);
  const klineEffectiveLines = sidebarTab === "history" ? [] : expandWithTpSl(klinePriceLines);
  // Advanced: TV manages TP/SL natively — pass raw lines
  const advEffectiveLines = sidebarTab === "history" ? [] : advPriceLines;

  const LINE_STYLE_SVG = [
    { value: 0, label: "Solid",  dash: undefined as string | undefined },
    { value: 1, label: "Dot",    dash: "2,2" },
    { value: 2, label: "Dash",   dash: "5,3" },
    { value: 3, label: "Large",  dash: "7,3" },
    { value: 4, label: "Sparse", dash: "2,6" },
  ];
  // Advanced tab only supports 3 line styles (TV library limitation)
  const displayLineStyles = isAdvanced ? LINE_STYLE_SVG.slice(0, 3) : LINE_STYLE_SVG;

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
            {(["lightweight", "klinechart", "advanced"] as const).map((mode) => (
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
                {mode === "lightweight" ? "Lightweight" : mode === "klinechart" ? "KLineChart" : "Advanced"}
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
                  priceLines={lwEffectiveLines}
                  onPriceLineDrag={sidebarTab !== "history" ? handleChartDrag : undefined}
                  theme={theme}
                  chartBg={chartBg}
                  gridColor={gridColor}
                  orders={orders}
                  showOrders={showOrders}
                  pendingOrderType={sidebarTab === "history" ? pendingOrderType : null}
                  onOrderPlace={handleOrderPlace}
                  onCancelPending={() => setPendingOrderType(null)}
                  onOrderClick={setSelectedOrder}
                  onOrderPriceChange={handleOrderPriceChange}
                  onLivePrice={(p) => { livePriceRef.current = p; }}
                  currentPriceLineConfig={currentPriceLineConfig}
                  crosshairConfig={crosshairConfig}
                  gridStyle={gridStyle}
                  showGrid={showGrid}
                />
              ) : chartMode === "klinechart" ? (
                <KlineChartWidget
                  priceLines={klineEffectiveLines}
                  theme={theme}
                  chartBg={chartBg}
                  gridColor={gridColor}
                  orders={orders}
                  showOrders={showOrders}
                  onOrderClick={setSelectedOrder}
                  pendingOrderType={pendingOrderType}
                  onOrderPlace={handleOrderPlace}
                  onCancelPending={() => setPendingOrderType(null)}
                />
              ) : (
                <AdvancedChartWidget
                  key={advWidgetKey}
                  theme={theme}
                  chartBg={chartBg}
                  gridColor={gridColor}
                  gridStyle={gridStyle}
                  showGrid={showGrid}
                  priceLines={advEffectiveLines}
                  onPriceLineChange={(id, updates) => {
                    const pl = advPriceLines.find(p => p.id === id);
                    if (pl) handleLineChange({ ...pl, ...updates });
                  }}
                  orders={orders}
                  showOrders={showOrders}
                  onOrderClick={setSelectedOrder}
                  currentPriceLineConfig={currentPriceLineConfig}
                  crosshairConfig={crosshairConfig}
                  onLivePrice={(p) => { livePriceRef.current = p; }}
                  toolbarConfig={advToolbarConfig}
                  priceLinesConfig={advPriceLinesConfig}
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

                {/* ── Tab toggle ─────────────────────────────────────────── */}
                <div
                  className="flex items-center gap-[2px] rounded-[var(--radius-sm)] p-[2px] shrink-0"
                  style={{ background: "var(--secondary)" }}
                >
                  {(["chart", "orders", "history"] as const).map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setSidebarTab(tab)}
                      className="flex-1 py-[4px] rounded-[var(--radius-sm)] transition-colors cursor-pointer capitalize"
                      style={{
                        fontFamily: "'Inter Display', sans-serif",
                        fontSize: "var(--text-label)",
                        background: sidebarTab === tab ? "var(--card)" : "transparent",
                        color: sidebarTab === tab ? "var(--foreground)" : "var(--muted-foreground)",
                        fontWeight: sidebarTab === tab ? "600" : "400",
                      }}
                    >
                      {tab === "orders" ? "Orders" : tab === "chart" ? "Chart" : "History"}
                    </button>
                  ))}
                </div>

                {/* ── CHART TAB ──────────────────────────────────────────── */}
                {sidebarTab === "chart" && (
                  <>
                  {/* Background + Grid */}
                  <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Chart</h4>
                  <div className="flex flex-col gap-[8px]">
                    <div className="flex flex-col gap-[4px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Background</span>
                      <ColorTokenPicker value={chartBg} onChange={setChartBg} />
                    </div>
                    <div className="flex flex-col gap-[4px]">
                      <div className="flex items-center justify-between">
                        <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Grid</span>
                        <label className="flex items-center gap-[6px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                          <input type="checkbox" checked={showGrid} onChange={(e) => setShowGrid(e.target.checked)} className="cursor-pointer" />
                          Show
                        </label>
                      </div>
                      <div style={{ opacity: showGrid ? 1 : 0.4, pointerEvents: showGrid ? "auto" : "none" }}>
                        <ColorTokenPicker value={gridColor} onChange={setGridColor} />
                      </div>
                      <div className="flex gap-[4px]" style={{ opacity: showGrid ? 1 : 0.4, pointerEvents: showGrid ? "auto" : "none" }}>
                        {displayLineStyles.map((s) => {
                          const active = gridStyle === s.value;
                          return (
                            <button key={s.value} onClick={() => setGridStyle(s.value)} title={s.label}
                              className="flex-1 flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded cursor-pointer transition-colors"
                              style={{ background: active ? "var(--secondary)" : "transparent", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}` }}>
                              <svg width="28" height="8" viewBox="0 0 28 8"><line x1="2" y1="4" x2="26" y2="4" stroke={active ? "var(--foreground)" : "var(--muted-foreground)"} strokeWidth="1.5" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                              <span style={{ fontSize: "9px", color: active ? "var(--foreground)" : "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif" }}>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="h-px" style={{ background: "var(--border)" }} />

                  {/* Current Price Line */}
                  <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Current Price Line</h4>
                  <div className="flex flex-col gap-[8px]">
                    {/* Visible */}
                    <label className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      <input type="checkbox" checked={currentPriceLineConfig.visible} onChange={(e) => setCurrentPriceLineConfig(c => ({ ...c, visible: e.target.checked }))} className="cursor-pointer" />
                      Visible
                    </label>
                    {/* Follow candle color */}
                    <label className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      <input type="checkbox" checked={currentPriceLineConfig.followCandleColor ?? false} onChange={(e) => setCurrentPriceLineConfig(c => ({ ...c, followCandleColor: e.target.checked }))} className="cursor-pointer" />
                      Follow candle color
                    </label>
                    {/* Color (disabled when followCandleColor) */}
                    <div style={{ opacity: currentPriceLineConfig.followCandleColor ? 0.4 : 1, pointerEvents: currentPriceLineConfig.followCandleColor ? "none" : "auto" }}>
                      <ColorTokenPicker label="Color" value={currentPriceLineConfig.color} onChange={(c) => setCurrentPriceLineConfig(cfg => ({ ...cfg, color: c }))} />
                    </div>
                    {/* Style */}
                    <div className="flex flex-col gap-[6px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Style</span>
                      <div className="flex gap-[4px]">
                        {displayLineStyles.map((s) => {
                          const active = currentPriceLineConfig.lineStyle === s.value;
                          return (
                            <button key={s.value} onClick={() => setCurrentPriceLineConfig(c => ({ ...c, lineStyle: s.value }))} title={s.label}
                              className="flex-1 flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded cursor-pointer transition-colors"
                              style={{ background: active ? "var(--secondary)" : "transparent", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}` }}>
                              <svg width="28" height="8" viewBox="0 0 28 8"><line x1="2" y1="4" x2="26" y2="4" stroke={active ? "var(--foreground)" : "var(--muted-foreground)"} strokeWidth="1.5" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                              <span style={{ fontSize: "9px", color: active ? "var(--foreground)" : "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif" }}>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* Width */}
                    <div className="flex items-center gap-[8px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", width: 40, flexShrink: 0 }}>Width</span>
                      <input type="range" min={0} max={3} step={1}
                        value={[0.5,1,1.5,2].indexOf(currentPriceLineConfig.lineWidth) === -1 ? 1 : [0.5,1,1.5,2].indexOf(currentPriceLineConfig.lineWidth)}
                        onChange={(e) => setCurrentPriceLineConfig(c => ({ ...c, lineWidth: [0.5,1,1.5,2][parseInt(e.target.value)] }))}
                        className="flex-1 cursor-pointer" />
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", width: 32, textAlign: "right", flexShrink: 0 }}>{currentPriceLineConfig.lineWidth}px</span>
                    </div>
                  </div>

                  <div className="h-px" style={{ background: "var(--border)" }} />

                  {/* Crosshair */}
                  <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Crosshair</h4>
                  <div className="flex flex-col gap-[8px]">
                    {/* Color */}
                    <ColorTokenPicker label="Color" value={crosshairConfig.color ?? "--accent-bg-default"} onChange={(c) => setCrosshairConfig(cfg => ({ ...cfg, color: c }))} />
                    {/* Mode */}
                    <div className="flex flex-col gap-[6px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Mode</span>
                      <div className="flex gap-[4px] rounded-[var(--radius-sm)] p-[2px]" style={{ background: "var(--secondary)" }}>
                        {([{ v: 0, label: "Normal" }, { v: 1, label: "Magnet" }] as const).map(({ v, label }) => (
                          <button key={v} onClick={() => setCrosshairConfig(c => ({ ...c, mode: v }))}
                            className="flex-1 py-[4px] px-[8px] rounded-[var(--radius-sm)] transition-colors cursor-pointer"
                            style={{ fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", background: crosshairConfig.mode === v ? "var(--card)" : "transparent", color: crosshairConfig.mode === v ? "var(--foreground)" : "var(--muted-foreground)", fontWeight: crosshairConfig.mode === v ? "600" : "400" }}>
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {/* H-line style */}
                    <div className="flex flex-col gap-[6px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Horizontal Line</span>
                      <div className="flex gap-[4px]">
                        {displayLineStyles.map((s) => {
                          const active = crosshairConfig.hStyle === s.value;
                          return (
                            <button key={s.value} onClick={() => setCrosshairConfig(c => ({ ...c, hStyle: s.value }))} title={s.label}
                              className="flex-1 flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded cursor-pointer transition-colors"
                              style={{ background: active ? "var(--secondary)" : "transparent", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}` }}>
                              <svg width="28" height="8" viewBox="0 0 28 8"><line x1="2" y1="4" x2="26" y2="4" stroke={active ? "var(--foreground)" : "var(--muted-foreground)"} strokeWidth="1.5" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                              <span style={{ fontSize: "9px", color: active ? "var(--foreground)" : "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif" }}>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    {/* V-line style */}
                    <div className="flex flex-col gap-[6px]">
                      <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>Vertical Line</span>
                      <div className="flex gap-[4px]">
                        {displayLineStyles.map((s) => {
                          const active = crosshairConfig.vStyle === s.value;
                          return (
                            <button key={s.value} onClick={() => setCrosshairConfig(c => ({ ...c, vStyle: s.value }))} title={s.label}
                              className="flex-1 flex flex-col items-center gap-[4px] py-[6px] px-[2px] rounded cursor-pointer transition-colors"
                              style={{ background: active ? "var(--secondary)" : "transparent", border: `1px solid ${active ? "var(--primary)" : "var(--border)"}` }}>
                              <svg width="28" height="8" viewBox="0 0 28 8"><line x1="2" y1="4" x2="26" y2="4" stroke={active ? "var(--foreground)" : "var(--muted-foreground)"} strokeWidth="1.5" strokeDasharray={s.dash} strokeLinecap="round" /></svg>
                              <span style={{ fontSize: "9px", color: active ? "var(--foreground)" : "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif" }}>{s.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── Advanced-only sections ──────────────────────────── */}
                  {isAdvanced && (
                    <>
                    <div className="h-px" style={{ background: "var(--border)" }} />

                    {/* Price Lines (Advanced) */}
                    <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Price Lines</h4>
                    <div className="flex flex-col gap-[8px]">
                      <label className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                        <input type="checkbox" checked={advPriceLinesConfig.extendLeft} onChange={(e) => setAdvPriceLinesConfig(c => ({ ...c, extendLeft: e.target.checked }))} className="cursor-pointer" />
                        Extend lines left
                      </label>
                      <label className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                        <input type="checkbox" checked={advPriceLinesConfig.showCancelButton} onChange={(e) => setAdvPriceLinesConfig(c => ({ ...c, showCancelButton: e.target.checked }))} className="cursor-pointer" />
                        Show hide button (×)
                      </label>
                    </div>

                    <div className="h-px" style={{ background: "var(--border)" }} />

                    {/* Toolbar (Advanced) */}
                    <div className="flex items-center justify-between">
                      <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Toolbar</h4>
                      <button
                        onClick={() => setAdvWidgetKey(k => k + 1)}
                        className="px-[10px] py-[4px] rounded-[var(--radius-sm)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                        style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                        title="Reload chart to apply toolbar changes"
                      >
                        Apply
                      </button>
                    </div>
                    <div className="flex flex-col gap-[8px]">
                      {([
                        { key: "showUndoRedo",     label: "Undo / Redo" },
                        { key: "showChartType",    label: "Chart type" },
                        { key: "showScreenshot",   label: "Screenshot" },
                        { key: "showFullscreen",   label: "Fullscreen" },
                        { key: "showSymbolSearch", label: "Symbol search" },
                        { key: "showCompare",      label: "Compare" },
                      ] as { key: keyof AdvancedToolbarConfig; label: string }[]).map(({ key, label }) => (
                        <label key={key} className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                          <input
                            type="checkbox"
                            checked={advToolbarConfig[key]}
                            onChange={(e) => setAdvToolbarConfig(c => ({ ...c, [key]: e.target.checked }))}
                            className="cursor-pointer"
                          />
                          {label}
                        </label>
                      ))}
                      <p style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", opacity: 0.6, marginTop: "2px" }}>
                        Changes take effect after Apply
                      </p>
                    </div>
                    </>
                  )}
                  </>
                )}

                {/* ── ORDERS TAB ─────────────────────────────────────────── */}
                {sidebarTab === "orders" && (
                  <>
                  {/* Panel header */}
                  <div className="flex items-center justify-between">
                    <h4 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>Price Lines</h4>
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      {activePriceLines.filter((p) => p.visible).length}/{activePriceLines.length} visible
                    </span>
                  </div>

                  {/* Export / Import / Clear bar */}
                  <div className="flex items-center gap-[8px]">
                    <button onClick={handleExport}
                      className="flex-1 flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                      style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                      title="Export price lines as JSON">
                      <Upload size={13} style={{ color: "var(--muted-foreground)" }} />Export
                    </button>
                    <label
                      className="flex-1 flex items-center justify-center gap-[6px] px-[10px] py-[6px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                      style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                      title="Import price lines from JSON">
                      <Download size={13} style={{ color: "var(--muted-foreground)" }} />Import
                      <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImport} className="hidden" />
                    </label>
                    <button
                      onClick={() => { if (window.confirm("Delete all price lines and active orders? This cannot be undone.")) { setActivePriceLines([]); setOrders([]); } }}
                      className="flex items-center justify-center w-[32px] h-[32px] shrink-0 rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer"
                      title="Delete all price lines">
                      <Trash2 size={13} style={{ color: "var(--muted-foreground)" }} />
                    </button>
                  </div>

                  {/* Import toast */}
                  {importMessage && (
                    <div className="px-[10px] py-[6px] rounded-[var(--radius-sm)] text-center"
                      style={{ background: importMessage.type === "success" ? "var(--success)" : "var(--destructive)", color: importMessage.type === "success" ? "var(--success-foreground)" : "var(--destructive-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      {importMessage.text}
                    </div>
                  )}

                  {/* Draggable list */}
                  {activePriceLines.map((config, index) => (
                    <PriceLineEditor key={config.id} index={index} config={config} onChange={handleLineChange} onDelete={handleDeleteLine} onDuplicate={handleDuplicateLine} onMove={handleMoveLine} canDelete={true} maxStyles={isAdvanced ? 3 : undefined} />
                  ))}

                  {/* Add Level button */}
                  <button onClick={handleAddLevel}
                    className="flex items-center justify-center gap-[6px] px-[12px] py-[10px] rounded-[var(--radius)] border border-dashed border-border hover:bg-secondary transition-colors cursor-pointer"
                    style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-base)" }}>
                    <Plus size={16} style={{ color: "var(--muted-foreground)" }} />
                    Add Custom Level
                  </button>

                  {/* LineStyle reference */}
                  <div className="flex flex-col gap-[6px] px-[2px]">
                    <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", opacity: 0.6 }}>Line styles</span>
                    {displayLineStyles.map((s) => (
                      <div key={s.value} className="flex items-center gap-[10px]">
                        <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Mono', ui-monospace, monospace", fontSize: "var(--text-label)", width: 12, flexShrink: 0, opacity: 0.6 }}>{s.value}</span>
                        <svg width="100%" height="8" viewBox="0 0 160 8" preserveAspectRatio="none">
                          <line x1="0" y1="4" x2="160" y2="4" stroke="var(--muted-foreground)" strokeWidth="1.5" strokeDasharray={s.dash} strokeLinecap="round" opacity="0.5" />
                        </svg>
                        <span style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", opacity: 0.6, width: 40, textAlign: "right", flexShrink: 0 }}>{s.label}</span>
                      </div>
                    ))}
                  </div>
                  </>
                )}

                {/* ── HISTORY TAB ────────────────────────────────────────── */}
                {sidebarTab === "history" && (
                  <div className="flex flex-col gap-[10px]">
                    {/* History Markers toggle + add buttons */}
                    <div className="flex flex-col gap-[8px]">
                      <label className="flex items-center gap-[8px] cursor-pointer" style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                        <input type="checkbox" checked={showOrders} onChange={(e) => setShowOrders(e.target.checked)} className="cursor-pointer" />
                        History Markers
                      </label>
                      {showOrders && (
                        <div className="flex items-center gap-[6px]">
                          <button onClick={() => setPendingOrderType(pendingOrderType === "buy" ? null : "buy")}
                            className="flex-1 flex items-center justify-center gap-[4px] px-[8px] py-[5px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer"
                            style={{ borderColor: "var(--positive-bg-default)", background: pendingOrderType === "buy" ? "var(--positive-bg-default)" : "transparent", color: pendingOrderType === "buy" ? "var(--positive-over)" : "var(--positive-bg-default)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", fontWeight: "600" }}>
                            + Buy
                          </button>
                          <button onClick={() => setPendingOrderType(pendingOrderType === "sell" ? null : "sell")}
                            className="flex-1 flex items-center justify-center gap-[4px] px-[8px] py-[5px] rounded-[var(--radius-sm)] border transition-colors cursor-pointer"
                            style={{ borderColor: "var(--negative-bg-default)", background: pendingOrderType === "sell" ? "var(--negative-bg-default)" : "transparent", color: pendingOrderType === "sell" ? "var(--negative-over)" : "var(--negative-bg-default)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)", fontWeight: "600" }}>
                            + Sell
                          </button>
                          {orders.length > 0 && (
                            <button onClick={() => setOrders([])}
                              className="px-[8px] py-[5px] rounded-[var(--radius-sm)] border border-border transition-colors cursor-pointer"
                              style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}
                              title="Clear all orders">
                              Clear
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="h-px" style={{ background: "var(--border)" }} />

                    {/* Add Position */}
                    <button onClick={() => setShowAddPosition(true)}
                      className="flex items-center justify-center gap-[6px] px-[12px] py-[9px] rounded-[var(--radius)] border border-dashed border-border hover:bg-secondary transition-colors cursor-pointer"
                      style={{ color: "var(--muted-foreground)", fontFamily: "'Inter Display', sans-serif", fontSize: "var(--text-label)" }}>
                      <Plus size={14} />Add Position
                    </button>

                    {/* History orders list */}
                    {historyOrders.map((order) => {
                      const isBuy    = order.type === "buy";
                      const isProfit = (order.pnl ?? 0) >= 0;
                      const op       = order.operation ?? (isBuy ? "Long" : "Short");
                      return (
                        <button key={order.id} onClick={() => setSelectedHistoryOrder(order)}
                          className="w-full flex items-center gap-[10px] px-[12px] py-[10px] rounded-[var(--radius)] border border-border hover:bg-secondary transition-colors cursor-pointer text-left"
                          style={{ background: "var(--card)" }}>
                          <div className="w-[28px] h-[28px] rounded-[var(--radius-sm)] flex items-center justify-center shrink-0"
                            style={{ background: isBuy ? "var(--positive-bg-default)" : "var(--negative-bg-default)" }}>
                            {isBuy ? <TrendingUp size={13} color="var(--positive-over)" /> : <TrendingDown size={13} color="var(--negative-over)" />}
                          </div>
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
                              {order.openTime ? new Date(order.openTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                              {order.closeTime ? ` → ${new Date(order.closeTime * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : ""}
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