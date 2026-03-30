import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface ChangelogEntry {
  version: string;
  date: string;
  title: string;
  items: string[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.21",
    date: "Mar 30, 2026",
    title: "Advanced Chart — TradingView Charting Library",
    items: [
      "Added Advanced tab powered by TradingView Charting Library (self-hosted)",
      "Binance REST + WebSocket datafeed: BTC/USDT live candles on all resolutions",
      "Full TV toolbar: indicators, drawing tools, timeframes, screenshot",
      "Library bundled as local @shared/tradingview npm package for clean imports",
      "Vite alias + CORS headers configured for blob-iframe bundle loading",
      "Default chart interval changed to 1D",
    ],
  },
  {
    version: "0.20",
    date: "Mar 25, 2026",
    title: "Chart tab, settings persistence & UX polish",
    items: [
      "Sidebar restructured into 3 tabs: Chart, Orders, History",
      "Chart tab: background & grid color, grid style picker (Solid/Dot/Dash/Large/Sparse), Show Grid toggle",
      "Chart tab: Current Price Line settings — visible, follow candle color, color, style, width",
      "Chart tab: Crosshair settings — color picker, Normal/Magnet mode, H/V line style pickers",
      "All settings now persisted to localStorage (crosshair, price line config, grid, sidebar tab, chart mode, history orders)",
      "Reset restores all settings including new Chart tab options",
      "Follow candle color: price line color updates live on each WebSocket tick",
      "LineStyle reference cheat-sheet (0–4) added below Add Custom Level in Orders tab",
      "Removed SuperCharts tab",
      "Order entry Short/Long price lines and PnL badges removed from main chart",
      "History tab hides all price lines — only markers shown",
      "Entry/Exit lines in TradeChartModal now match Orders style (Solid 0.5px, contrast palette)",
      "Add Custom Level defaults to live BTC price",
      "Delete All clears both price lines and active orders",
    ],
  },
  {
    version: "0.14",
    date: "Mar 18, 2026",
    title: "History tab & trade chart modal",
    items: [
      "Sidebar now has Active / History segmented toggle",
      "History tab shows trade cards with direction, dates and P&L",
      "Clicking a card opens a full-screen modal: trade details on the left, chart on the right",
      "Chart loads real Binance candles only for the trade's time range (startTime → endTime)",
      "B/S entry and exit markers rendered on the trade chart",
      "Interval selector in the modal: 1m / 15m / 1H / 4H / 1D / 1W / 1M",
      "Add Position form: direction toggle, datetime pickers, entry/close price, leverage",
    ],
  },
  {
    version: "0.13",
    date: "Mar 18, 2026",
    title: "KLineChart indicators",
    items: [
      "EMA 20, EMA 50, RSI 14 toggles added to KLineChart interval bar",
      "EMA lines rendered directly on the main pane via klinecharts built-in indicators",
      "RSI opens in a separate sub-pane below the chart",
      "Changelog bullet points replaced with compact round dots",
    ],
  },
  {
    version: "0.12",
    date: "Mar 18, 2026",
    title: "KLineChart polish & sidebar UX",
    items: [
      "Tab order changed to Lightweight → KLineChart → SuperCharts",
      "SuperCharts sidebar replaced with a 'Settings unavailable' placeholder",
      "KLineChart: {ticker}/period title hidden, OHLCV tooltip moved below interval selector",
      "KLineChart: order marker badge narrower (tighter padding), font weight Medium",
      "KLineChart: order placement from sidebar now works (native click → convertFromPixel)",
    ],
  },
  {
    version: "0.11",
    date: "Mar 18, 2026",
    title: "KLineChart order markers parity",
    items: [
      "Custom buyMarker / sellMarker overlays: badge below low (↑ tail) and above high (↓ tail)",
      "Anchored to candle high/low via candleMap built from historical data",
      "Click on marker opens OrderDetailModal — same as Lightweight Charts",
      "Cursor changes to pointer on marker hover",
      "Sidebar + Buy / + Sell buttons work for KLineChart mode",
    ],
  },
  {
    version: "0.10",
    date: "Mar 18, 2026",
    title: "KLineChart price lines & colors",
    items: [
      "Custom labeledPriceLine overlay shows label + price value on right edge",
      "Line color, label background and text color all match sidebar config",
      "Order annotation markers use green/red instead of default blue",
    ],
  },
  {
    version: "0.9",
    date: "Mar 18, 2026",
    title: "KLineChart — third chart mode",
    items: [
      "KLineChart added as third option in the header toggle",
      "Powered by klinecharts v10 with Binance REST + WebSocket data",
      "All sidebar settings wired: background, grid, price lines, order markers",
      "Same interval selector (1m–1d) and live WS status badge",
    ],
  },
  {
    version: "0.8",
    date: "Mar 18, 2026",
    title: "SuperCharts — TradingView embed",
    items: [
      "SuperCharts added as second chart mode via TradingView Advanced Chart iframe",
      "Centered Lightweight | SuperCharts toggle in header (CSS grid 1fr auto 1fr)",
      "Theme (dark/light) synced to the embed via URL param",
    ],
  },
  {
    version: "0.7",
    date: "Mar 17, 2026",
    title: "Interactive order markers",
    items: [
      "Click on a B/S marker to open a position detail popup",
      "Popup shows Realized P&L, leverage, volume, entry/close prices",
      "Transaction ID, operation type, take profit, stop loss, timestamps",
      "Smooth fade + scale animation on open/close",
    ],
  },
  {
    version: "0.6",
    date: "Mar 17, 2026",
    title: "Order marker polish",
    items: [
      "Font: 10px Medium (500 weight)",
      "Padding: 5px horizontal, 3px vertical",
      "Shorter tail (~1.5× smaller)",
      "Markers positioned relative to candle wick with 4px gap",
    ],
  },
  {
    version: "0.5",
    date: "Mar 17, 2026",
    title: "History Markers on chart",
    items: [
      "Buy (B) and Sell (S) markers rendered directly on chart canvas",
      "Custom tag shape: rounded badge + directional tail",
      "B markers appear below candle wick, S markers above",
      "Click + Buy / + Sell in sidebar to place new markers",
      "4 default demo orders pre-loaded",
    ],
  },
  {
    version: "0.4",
    date: "Mar 17, 2026",
    title: "Chart Console & viewport",
    items: [
      "Renamed header to 'Chart Console'",
      "80px right margin so candles don't overlap the price axis",
      "Per-interval default viewport (readable candle count on load)",
      "1000 candles fetched per interval — scroll/zoom to explore history",
    ],
  },
  {
    version: "0.3",
    date: "Mar 17, 2026",
    title: "Price line editor improvements",
    items: [
      "Line width steps: 0.5 / 1.0 / 1.5 / 2.0",
      "Drag price lines directly on the chart",
      "Removed Line Styles legend block from sidebar",
      "Export / Import price lines as JSON",
    ],
  },
  {
    version: "0.2",
    date: "Mar 16, 2026",
    title: "Chart appearance settings",
    items: [
      "Chart background color picker (default: Surface/Elevation-1)",
      "Grid color picker",
      "Reset restores chart bg, grid color, price lines, and markers",
      "Confirmation dialog before Reset to prevent accidental data loss",
    ],
  },
  {
    version: "0.1",
    date: "Mar 11, 2026",
    title: "Initial release",
    items: [
      "Live BTC/USDT candlestick chart via Binance WebSocket",
      "Price line management: add, edit, delete, duplicate, reorder",
      "Default state loaded from exported JSON config",
      "Dark / light theme toggle",
      "localStorage persistence for all settings",
    ],
  },
];

const DURATION = 220;

interface Props {
  onClose: () => void;
}

export function ChangelogPanel({ onClose }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, DURATION);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const easing = `transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1), opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40"
        style={{ transition: `opacity ${DURATION}ms ease`, opacity: visible ? 1 : 0, background: "rgba(0,0,0,0.3)" }}
        onClick={handleClose}
      />

      {/* Desktop: right panel */}
      <div
        className="fixed top-0 right-0 h-full z-50 hidden md:flex flex-col"
        style={{
          width: 400,
          background: "var(--sidebar)",
          borderLeft: "1px solid var(--border)",
          transition: easing,
          transform: visible ? "translateX(0)" : "translateX(100%)",
          opacity: visible ? 1 : 0,
        }}
      >
        <PanelContent onClose={handleClose} />
      </div>

      {/* Mobile: bottom sheet */}
      <div
        className="fixed bottom-0 left-0 right-0 z-50 flex flex-col md:hidden rounded-t-[var(--radius-card)]"
        style={{
          maxHeight: "82vh",
          background: "var(--sidebar)",
          borderTop: "1px solid var(--border)",
          transition: easing,
          transform: visible ? "translateY(0)" : "translateY(100%)",
          opacity: visible ? 1 : 0,
        }}
      >
        <PanelContent onClose={handleClose} />
      </div>
    </>
  );
}

function PanelContent({ onClose }: { onClose: () => void }) {
  return (
    <>
      {/* Header */}
      <div
        className="flex items-center justify-between px-[20px] py-[14px] shrink-0 border-b border-border"
      >
        <div>
          <h3 style={{ color: "var(--foreground)", fontFamily: "'Inter Display', sans-serif" }}>
            Changelog
          </h3>
          <p style={{ color: "var(--muted-foreground)", fontSize: "var(--text-label)", fontFamily: "'Inter Display', sans-serif", marginTop: 2 }}>
            What's new in Chart Console
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center w-[28px] h-[28px] rounded-[var(--radius-sm)] cursor-pointer hover:bg-secondary transition-colors"
          style={{ color: "var(--muted-foreground)" }}
        >
          <X size={14} />
        </button>
      </div>

      {/* Entries */}
      <div className="flex-1 overflow-y-auto px-[20px] py-[16px] flex flex-col gap-[24px]">
        {CHANGELOG.map((entry) => (
          <div key={entry.version}>
            {/* Version row */}
            <div className="flex items-center gap-[8px] mb-[10px]">
              <span
                className="px-[7px] py-[2px] rounded-[var(--radius-sm)]"
                style={{
                  background: "var(--accent-bg-default)",
                  color: "var(--accent-over, var(--foreground))",
                  fontSize: "11px",
                  fontWeight: "600",
                  fontFamily: "'Inter Display', sans-serif",
                  letterSpacing: "0.02em",
                }}
              >
                v{entry.version}
              </span>
              <span style={{ color: "var(--muted-foreground)", fontSize: "var(--text-label)", fontFamily: "'Inter Display', sans-serif" }}>
                {entry.date}
              </span>
            </div>

            {/* Title */}
            <p style={{ color: "var(--foreground)", fontWeight: "600", fontFamily: "'Inter Display', sans-serif", marginBottom: 8 }}>
              {entry.title}
            </p>

            {/* Items */}
            <ul className="flex flex-col gap-[5px]">
              {entry.items.map((item, i) => (
                <li key={i} className="flex items-start gap-[8px]">
                  <span style={{ color: "var(--muted-foreground)", marginTop: "5px", flexShrink: 0, fontSize: "6px", lineHeight: 1 }}>●</span>
                  <span style={{ color: "var(--muted-foreground)", fontSize: "13px", fontFamily: "'Inter Display', sans-serif", lineHeight: "1.5" }}>
                    {item}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </>
  );
}
