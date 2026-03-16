import { useState, useCallback, useRef, useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { DndProvider } from "react-dnd";
import { HTML5Backend } from "react-dnd-html5-backend";
import { ChartWidget, type PriceLineConfig } from "./components/chart-widget";
import { PriceLineEditor } from "./components/price-line-editor";
import {
  RotateCcw,
  Plus,
  Download,
  Upload,
  Sun,
  Moon,
} from "lucide-react";

/** Build default price lines relative to a live BTC price */
function makeDefaultLines(base: number): PriceLineConfig[] {
  const r = (n: number) => Math.round(n);
  return [
    {
      id: "buy-order",
      label: "Buy Order",
      price: r(base),
      color: "--positive-bg-default",
      labelColor: "--positive-bg-default",
      labelTextColor: "--positive-over",
      lineWidth: 2,
      lineStyle: 2,
      visible: true,
    },
    {
      id: "take-profit",
      label: "Take Profit",
      price: r(base * 1.05),   // +5 %
      color: "--chart-lines-line-1",
      labelColor: "--chart-lines-line-1",
      labelTextColor: "--warning-over",
      lineWidth: 1,
      lineStyle: 2,
      visible: true,
    },
    {
      id: "stop-loss",
      label: "Stop Loss",
      price: r(base * 0.97),   // −3 %
      color: "--negative-bg-default",
      labelColor: "--negative-bg-default",
      labelTextColor: "--negative-over",
      lineWidth: 1,
      lineStyle: 2,
      visible: true,
    },
    {
      id: "liquidation",
      label: "Liquidation",
      price: r(base * 0.90),   // −10 %
      color: "--warning-bg-default",
      labelColor: "--warning-bg-default",
      labelTextColor: "--warning-over",
      lineWidth: 0.5,
      lineStyle: 1,
      visible: true,
    },
  ];
}

/** Fetch current BTC/USDT price from Binance */
async function fetchCurrentPrice(): Promise<number> {
  const res = await fetch(
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT"
  );
  const data = await res.json();
  return parseFloat(data.price);
}

// Static fallback used only for localStorage validation shape
const BUILT_IN_IDS = new Set(["buy-order", "take-profit", "stop-loss", "liquidation"]);

const STORAGE_KEYS = {
  theme: "chartConfig_theme",
  priceLines: "chartConfig_priceLines",
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

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.theme, theme); } catch {}
    document.documentElement.classList.toggle("light", theme === "light");
    return () => document.documentElement.classList.remove("light");
  }, [theme]);

  // ── Persist priceLines in localStorage ───────────────────────────────────
  const [priceLines, setPriceLines] = useState<PriceLineConfig[]>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.priceLines);
      if (!stored) return makeDefaultLines(83000); // temp placeholder, overwritten on mount
      const parsed = JSON.parse(stored);
      if (!Array.isArray(parsed)) return makeDefaultLines(83000);
      const validated = parsed.filter(isValidPriceLine);
      return validated.length > 0 ? validated : makeDefaultLines(83000);
    } catch {
      return makeDefaultLines(83000);
    }
  });

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEYS.priceLines, JSON.stringify(priceLines)); } catch {}
  }, [priceLines]);

  // On first visit (no localStorage), snap defaults to live BTC price
  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEYS.priceLines)) return;
    fetchCurrentPrice()
      .then((price) => { if (price > 0) setPriceLines(makeDefaultLines(price)); })
      .catch(() => {});
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
    setImportMessage(null);
    try { localStorage.removeItem(STORAGE_KEYS.priceLines); } catch {}
    fetchCurrentPrice()
      .then((price) => setPriceLines(makeDefaultLines(price > 0 ? price : 83000)))
      .catch(() => setPriceLines(makeDefaultLines(83000)));
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

  const handleMoveLine = useCallback(
    (dragIndex: number, hoverIndex: number) => {
      setPriceLines((prev) => {
        const updated = [...prev];
        const [removed] = updated.splice(dragIndex, 1);
        updated.splice(hoverIndex, 0, removed);
        return updated;
      });
    },
    []
  );

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

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="size-full flex flex-col overflow-hidden"
        style={{ background: "var(--background)" }}
      >
        {/* Header */}
        <header
          className="flex items-center justify-between px-[16px] py-[12px] border-b border-border shrink-0"
          style={{ background: "var(--sidebar)" }}
        >
          <div className="flex items-center gap-[12px]">
            <h3
              style={{
                color: "var(--foreground)",
                fontFamily: "'Inter Display', sans-serif",
              }}
            >
              Chart Widget Debug
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
          <div className="flex items-center gap-[8px]">
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
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
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
              <ChartWidget
                priceLines={priceLines}
                onPriceLineDrag={handleChartDrag}
                theme={theme}
              />
            </div>
          </div>

          {/* Editing panel */}
          <aside
              className="w-full md:w-[320px] shrink-0 border-t md:border-t-0 md:border-l border-border overflow-y-auto"
              style={{ background: "var(--sidebar)" }}
            >
              <div className="p-[16px] flex flex-col gap-[12px]">
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

                {/* Export / Import bar */}
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
                    onMove={handleMoveLine}
                    onDuplicate={handleDuplicateLine}
                    canDelete={!BUILT_IN_IDS.has(config.id)}
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

                {/* Legend */}
                <div
                  className="mt-[8px] p-[12px] rounded-[var(--radius)] border border-border"
                  style={{ background: "var(--muted)" }}
                >
                  <p
                    className="mb-[8px]"
                    style={{
                      color: "var(--muted-foreground)",
                      fontFamily: "'Inter Display', sans-serif",
                      fontSize: "var(--text-label)",
                      fontWeight: "var(--font-weight-medium)",
                    }}
                  >
                    Line Styles
                  </p>
                  <div className="flex flex-col gap-[6px]">
                    {[
                      { style: "solid", label: "0 \u2014 Solid" },
                      { style: "dotted", label: "1 \u2014 Dotted" },
                      { style: "dashed", label: "2 \u2014 Dashed" },
                    ].map((item) => (
                      <div
                        key={item.style}
                        className="flex items-center gap-[8px]"
                      >
                        <div
                          className="w-[40px] h-0"
                          style={{
                            borderTop: `2px ${item.style} var(--muted-foreground)`,
                          }}
                        />
                        <span
                          style={{
                            color: "var(--muted-foreground)",
                            fontFamily: "'Inter Display', sans-serif",
                            fontSize: "var(--text-label)",
                          }}
                        >
                          {item.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </aside>
        </div>
      </div>
      <SpeedInsights />
    </DndProvider>
  );
}