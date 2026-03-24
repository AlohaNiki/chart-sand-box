# Chart Console

A cryptocurrency trading chart tool for configuring and visualizing price levels, active positions, and trade history. Built with React + Vite, powered by live Binance data.

**Live demo:** [zerox-chart.gay](https://www.zerox-chart.gay)

---

## Features

- **Three chart engines** — switch between Lightweight Charts (TradingView), KLineChart, and TradingView SuperCharts
- **Price lines** — add, edit, reorder, and toggle Buy Order, Take Profit, Stop Loss, Sell Order, custom levels, Liquidation
- **Active positions** — visualize Long/Short orders on the chart with live P&L badges and entry price axis labels
- **Trade history** — browse past trades, open a full-screen chart modal showing the exact trade window with entry/exit markers and zone fill
- **Add Position** — manually log closed trades with calculated P&L
- **Technical indicators** — EMA 20, EMA 50, RSI 14
- **Live data** — Binance REST API for candles + WebSocket for real-time price updates
- **Dark / Light theme** — persisted in localStorage
- **All settings persisted** — price lines, orders, theme survive page reload

---

## Getting Started

```bash
npm install
npm run dev       # dev server at http://localhost:5173
npm run build     # production build → dist/
```

No environment variables required. The app uses public Binance endpoints.

---

## Project Structure

```
src/
├── app/
│   ├── App.tsx                    # Root component, global state, sidebar
│   └── components/
│       ├── chart-widget.tsx       # Lightweight Charts (default mode)
│       ├── klinechart-widget.tsx  # KLineChart mode
│       ├── supercharts-widget.tsx # TradingView embed
│       ├── price-line-editor.tsx  # Sidebar panel — price line config
│       ├── trade-chart-modal.tsx  # Full-screen historical trade modal
│       ├── trade-chart-widget.tsx # Chart inside trade modal
│       ├── order-detail-modal.tsx # Active order detail popup
│       ├── changelog-panel.tsx    # Version history
│       └── ui/                    # shadcn/ui + Radix UI primitives
├── styles/
│   ├── theme.css                  # Design tokens (CSS custom properties)
│   ├── index.css                  # Global styles
│   └── fonts.css                  # Font imports
└── main.tsx                       # React entry point
```

---

## Key Dependencies

| Package | Purpose |
|---|---|
| `lightweight-charts` v5 | Main charting library (TradingView) |
| `klinecharts` v10 | Alternative chart engine |
| `technicalindicators` | EMA, RSI calculations |
| `react-dnd` | Drag-and-drop for price line reordering |
| `tailwindcss` v4 | Styling |
| `lucide-react` | Icons |
| `motion` | Animations |

---

## Data

The app connects to public Binance endpoints — no API key needed:

- **REST:** `https://api.binance.com/api/v3/klines` — historical candles
- **WebSocket:** `wss://stream.binance.com:9443/ws` — live price feed

Default symbol is `BTCUSDT`. Candle intervals: 1m, 5m, 15m, 30m, 1h, 4h, 1d.

---

## Deployment

Configured for Vercel out of the box:

```json
// vercel.json
{
  "installCommand": "npm install --include=dev",
  "buildCommand": "npm run build",
  "outputDirectory": "dist"
}
```

---

## localStorage Keys

| Key | Value |
|---|---|
| `chartConfig_theme` | `"dark"` or `"light"` |
| `chartConfig_priceLines` | JSON array of price line configs |
| `chartConfig_orders` | JSON array of active trade orders |
| `chartConfig_showOrders` | Boolean — show/hide order markers |
| `chartConfig_chartBg` | Chart background color token |
| `chartConfig_gridColor` | Grid color token |
