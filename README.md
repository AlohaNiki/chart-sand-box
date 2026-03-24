# Chart Console

A cryptocurrency trading chart tool for configuring and visualizing price levels, active positions, and trade history.

**Live:** [zerox-chart.gay](https://www.zerox-chart.gay)

---

## Repository Structure

```
chart-sand-box/
├── Chart Config/    # React app (source code)
└── wrangler.jsonc   # Cloudflare Workers deployment config
```

The app lives in `Chart Config/`. The root of this repo is the Cloudflare Workers project that serves it as a static site.

---

## Development

```bash
cd "Chart Config"
npm install
npm run dev          # dev server at http://localhost:5173
npm run build        # production build → dist/
```

No environment variables required. The app uses public Binance endpoints.

---

## Deployment

### Cloudflare Workers (production)

```bash
# From repo root
npm install -g wrangler
wrangler deploy
```

`wrangler.jsonc` points `assets.directory` at `Chart Config/` — deploy serves the built static files directly via Cloudflare's global CDN.

### Vercel (alternative)

`Chart Config/vercel.json` is also configured if you prefer Vercel:

```bash
cd "Chart Config"
vercel deploy
```

---

## App Features

- **Three chart engines** — Lightweight Charts (TradingView), KLineChart, TradingView SuperCharts
- **Price lines** — Buy Order, Take Profit, Stop Loss, Sell Order, custom levels, Liquidation — add, edit, reorder, toggle
- **Active positions** — Long/Short orders with live P&L badges and entry price axis labels
- **Trade history** — full-screen chart modal per trade with entry/exit markers and zone fill
- **Technical indicators** — EMA 20, EMA 50, RSI 14
- **Live data** — Binance REST + WebSocket (public endpoints, no API key needed)
- **Dark / Light theme** — all settings persisted in localStorage

See `Chart Config/README.md` for full technical details.
