import { useEffect, useRef } from "react";

const LIBRARY_PATH = "/charting_library/";
const SYMBOL = "BINANCE:BTCUSDT";
const BINANCE_REST = "https://api.binance.com/api/v3";

// Map TV resolution → Binance interval
function tvResolutionToBinance(resolution: string): string {
  const map: Record<string, string> = {
    "1": "1m", "3": "3m", "5": "5m", "15": "15m", "30": "30m",
    "60": "1h", "120": "2h", "240": "4h", "360": "6h", "720": "12h",
    "1D": "1d", "D": "1d", "1W": "1w", "W": "1w", "1M": "1M", "M": "1M",
  };
  return map[resolution] ?? "1d";
}

function makeBinanceDatafeed() {
  const subscribers: Record<string, { ws: WebSocket; timer?: ReturnType<typeof setInterval> }> = {};

  return {
    onReady(callback: (config: object) => void) {
      setTimeout(() =>
        callback({
          supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
          supports_time: true,
        })
      , 0);
    },

    searchSymbols(
      _userInput: string,
      _exchange: string,
      _type: string,
      onResult: (results: object[]) => void
    ) {
      onResult([]);
    },

    resolveSymbol(
      _symbolName: string,
      onResolve: (info: object) => void,
      onError: (err: string) => void
    ) {
      fetch(`${BINANCE_REST}/exchangeInfo?symbol=BTCUSDT`)
        .then((r) => r.json())
        .then(() => {
          onResolve({
            name: "BTCUSDT",
            full_name: "BINANCE:BTCUSDT",
            description: "Bitcoin / Tether",
            type: "crypto",
            session: "24x7",
            timezone: "Etc/UTC",
            exchange: "BINANCE",
            minmov: 1,
            pricescale: 100,
            has_intraday: true,
            has_daily: true,
            has_weekly_and_monthly: true,
            supported_resolutions: ["1", "5", "15", "30", "60", "240", "1D", "1W"],
            volume_precision: 8,
            data_status: "streaming",
          });
        })
        .catch(() => onError("Symbol not found"));
    },

    getBars(
      _symbolInfo: object,
      resolution: string,
      periodParams: { from: number; to: number; firstDataRequest: boolean },
      onResult: (bars: object[], meta: { noData: boolean }) => void,
      onError: (err: string) => void
    ) {
      const interval = tvResolutionToBinance(resolution);
      const { from, to } = periodParams;
      const url = `${BINANCE_REST}/klines?symbol=BTCUSDT&interval=${interval}&startTime=${from * 1000}&endTime=${to * 1000}&limit=1000`;

      fetch(url)
        .then((r) => r.json())
        .then((data: [number, string, string, string, string, string][]) => {
          if (!Array.isArray(data) || data.length === 0) {
            onResult([], { noData: true });
            return;
          }
          const bars = data.map((k) => ({
            time: k[0],
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4]),
            volume: parseFloat(k[5]),
          }));
          onResult(bars, { noData: false });
        })
        .catch((e) => onError(String(e)));
    },

    subscribeBars(
      _symbolInfo: object,
      resolution: string,
      onTick: (bar: object) => void,
      subscriberUID: string
    ) {
      const interval = tvResolutionToBinance(resolution);
      const ws = new WebSocket(
        `wss://stream.binance.com:9443/ws/btcusdt@kline_${interval}`
      );

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        const k = msg.k;
        if (!k) return;
        onTick({
          time: k.t,
          open: parseFloat(k.o),
          high: parseFloat(k.h),
          low: parseFloat(k.l),
          close: parseFloat(k.c),
          volume: parseFloat(k.v),
        });
      };

      subscribers[subscriberUID] = { ws };
    },

    unsubscribeBars(subscriberUID: string) {
      const sub = subscribers[subscriberUID];
      if (sub) {
        sub.ws.close();
        if (sub.timer) clearInterval(sub.timer);
        delete subscribers[subscriberUID];
      }
    },
  };
}

interface AdvancedChartWidgetProps {
  theme?: "dark" | "light";
}

export function AdvancedChartWidget({ theme = "dark" }: AdvancedChartWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<{ remove: () => void; changeTheme: (t: string) => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    let cancelled = false;

    import("@shared/tradingview").then((lib) => {
      if (cancelled || !containerRef.current) return;

      const containerId = "tv-advanced-chart";
      containerRef.current.id = containerId;

      widgetRef.current = new lib.widget({
        container: containerId,
        datafeed: makeBinanceDatafeed(),
        library_path: LIBRARY_PATH,
        locale: "en",
        symbol: SYMBOL,
        interval: "1D" as const,
        fullscreen: false,
        autosize: true,
        theme: theme === "light" ? "light" : "dark",
        disabled_features: [
          "use_localstorage_for_settings",
          "header_symbol_search",
          "header_compare",
          "symbol_search_hot_key",
        ],
        enabled_features: ["study_templates"],
        overrides: {
          "mainSeriesProperties.candleStyle.upColor": "#26a69a",
          "mainSeriesProperties.candleStyle.downColor": "#ef5350",
          "mainSeriesProperties.candleStyle.borderUpColor": "#26a69a",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef5350",
          "mainSeriesProperties.candleStyle.wickUpColor": "#26a69a",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef5350",
        },
      });
    }).catch(console.error);

    return () => {
      cancelled = true;
      widgetRef.current?.remove();
      widgetRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync theme without full remount
  useEffect(() => {
    widgetRef.current?.changeTheme(theme === "light" ? "light" : "Dark");
  }, [theme]);

  return <div ref={containerRef} className="w-full h-full" />;
}
