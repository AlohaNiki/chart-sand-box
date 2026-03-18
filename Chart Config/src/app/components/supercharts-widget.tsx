import { useMemo } from "react";

interface SuperChartsWidgetProps {
  theme?: "dark" | "light";
}

export function SuperChartsWidget({ theme = "dark" }: SuperChartsWidgetProps) {
  const src = useMemo(() => {
    const params = JSON.stringify({
      symbol: "BINANCE:BTCUSDT",
      timezone: "Etc/UTC",
      theme: theme === "light" ? "light" : "dark",
      style: "1",           // candlestick
      locale: "en",
      withdateranges: true,
      range: "12M",
      allow_symbol_change: false,
      hide_side_toolbar: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });
    return `https://s.tradingview.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(params)}`;
  }, [theme]);

  return (
    <div className="w-full h-full relative">
      <iframe
        key={src} // remount when theme changes
        src={src}
        className="w-full h-full border-0 block"
        allowFullScreen
        referrerPolicy="no-referrer-when-downgrade"
        title="TradingView SuperCharts"
      />
    </div>
  );
}
