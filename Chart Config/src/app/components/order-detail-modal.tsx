import { useEffect, useState } from "react";
import { X, Copy, TrendingUp, TrendingDown } from "lucide-react";
import type { TradeOrder } from "./chart-widget";

interface Props {
  order: TradeOrder;
  onClose: () => void;
}

const DURATION = 180; // ms

function fmtPrice(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
  });
}

function Row({ label, value, copy }: { label: string; value: string; copy?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--muted-foreground)", fontSize: "13px", fontFamily: "'Inter Display', sans-serif" }}>
        {label}
      </span>
      <div className="flex items-center gap-[4px]">
        <span style={{ color: "var(--foreground)", fontSize: "13px", fontWeight: "500", fontFamily: "'Inter Display', sans-serif" }}>
          {value}
        </span>
        {copy && (
          <button
            onClick={() => navigator.clipboard.writeText(value)}
            className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Copy size={11} />
          </button>
        )}
      </div>
    </div>
  );
}

export function OrderDetailModal({ order, onClose }: Props) {
  const [visible, setVisible] = useState(false);

  // Fade in on mount
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Fade out, then unmount
  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, DURATION);
  };

  const isBuy = order.type === "buy";
  const isProfit = (order.pnl ?? 0) >= 0;
  const operation = order.operation ?? (isBuy ? "Long" : "Short");
  const pnlColor = isProfit ? "var(--positive-bg-default)" : "var(--negative-bg-default)";
  const pnlOver  = isProfit ? "var(--positive-over)"       : "var(--negative-over)";

  const easing = `opacity ${DURATION}ms cubic-bezier(0.4,0,0.2,1), transform ${DURATION}ms cubic-bezier(0.4,0,0.2,1)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={handleClose}
      style={{ transition: `opacity ${DURATION}ms ease`, opacity: visible ? 1 : 0 }}
    >
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.45)" }} />

      <div
        className="relative w-[360px] rounded-[var(--radius-card)] overflow-hidden shadow-xl"
        style={{
          background: "var(--surface-elevation-1)",
          border: "1px solid var(--border)",
          transition: easing,
          opacity: visible ? 1 : 0,
          transform: visible ? "translateY(0) scale(1)" : "translateY(8px) scale(0.97)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-[16px] py-[14px]">
          <div className="flex items-center gap-[8px]">
            {/* BTC icon */}
            <div
              className="w-[32px] h-[32px] rounded-full flex items-center justify-center shrink-0"
              style={{ background: "var(--warning-bg-default)" }}
            >
              <span style={{ color: "var(--warning-over)", fontSize: "14px", fontWeight: "700", fontFamily: "'Inter Display', sans-serif" }}>₿</span>
            </div>

            <span style={{ color: "var(--foreground)", fontWeight: "600", fontFamily: "'Inter Display', sans-serif" }}>
              BTC <span style={{ color: "var(--muted-foreground)", fontWeight: "400" }}>USDT</span>
            </span>

            <span
              className="px-[6px] py-[2px] rounded-[var(--radius-sm)]"
              style={{ background: "var(--secondary)", color: "var(--muted-foreground)", fontSize: "11px", fontFamily: "'Inter Display', sans-serif" }}
            >
              Cross
            </span>

            {/* Direction icon */}
            <div
              className="w-[24px] h-[24px] rounded-[var(--radius-sm)] flex items-center justify-center"
              style={{ background: isBuy ? "var(--positive-bg-default)" : "var(--negative-bg-default)" }}
            >
              {isBuy
                ? <TrendingUp  size={13} color="var(--positive-over)" />
                : <TrendingDown size={13} color="var(--negative-over)" />
              }
            </div>
          </div>

          <button onClick={handleClose} className="cursor-pointer opacity-50 hover:opacity-100 transition-opacity" style={{ color: "var(--foreground)" }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Realized P&L ───────────────────────────────────── */}
        {order.pnl !== undefined && (
          <div
            className="mx-[16px] mb-[14px] px-[14px] py-[12px] rounded-[var(--radius)]"
            style={{ background: "var(--secondary)" }}
          >
            <div style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>
              Realized P&amp;L
            </div>
            <div className="flex items-center gap-[8px] mt-[6px]">
              <span style={{ color: pnlColor, fontSize: "20px", fontWeight: "600", fontFamily: "'Inter Display', sans-serif" }}>
                {isProfit ? "+" : ""}{order.pnl.toFixed(5)} USDT
              </span>
              {order.pnlPercent !== undefined && (
                <span
                  className="px-[6px] py-[2px] rounded-[var(--radius-sm)]"
                  style={{ background: pnlColor, color: pnlOver, fontSize: "12px", fontWeight: "500", fontFamily: "'Inter Display', sans-serif" }}
                >
                  {isProfit ? "+" : ""}{order.pnlPercent.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        )}

        {/* ── Stats grid ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-x-[16px] gap-y-[12px] px-[16px] pb-[14px]">
          {(order.amount !== undefined || order.leverage !== undefined) && (
            <div>
              <div style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>Amount / Leverage</div>
              <div style={{ color: "var(--foreground)", fontWeight: "500", marginTop: "2px", fontFamily: "'Inter Display', sans-serif" }}>
                {order.amount ?? "—"} ×{order.leverage ?? "—"}
              </div>
            </div>
          )}
          {order.volume !== undefined && (
            <div>
              <div style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>Volume</div>
              <div style={{ color: "var(--foreground)", fontWeight: "500", marginTop: "2px", fontFamily: "'Inter Display', sans-serif" }}>
                {order.volume.toFixed(2)}
              </div>
            </div>
          )}
          <div>
            <div style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>Avg. entry price</div>
            <div style={{ color: "var(--foreground)", fontWeight: "500", marginTop: "2px", fontFamily: "'Inter Display', sans-serif" }}>
              {fmtPrice(order.price)}
            </div>
          </div>
          {order.closePrice !== undefined && (
            <div>
              <div style={{ color: "var(--muted-foreground)", fontSize: "12px", fontFamily: "'Inter Display', sans-serif" }}>Avg. close price</div>
              <div style={{ color: "var(--foreground)", fontWeight: "500", marginTop: "2px", fontFamily: "'Inter Display', sans-serif" }}>
                {fmtPrice(order.closePrice)}
              </div>
            </div>
          )}
        </div>

        {/* ── Divider ────────────────────────────────────────── */}
        <div style={{ height: "1px", background: "var(--border)" }} />

        {/* ── Detail rows ────────────────────────────────────── */}
        <div className="px-[16px] py-[14px] flex flex-col gap-[10px]">
          {order.transactionId && <Row label="Transaction ID" value={order.transactionId} copy />}
          <Row label="Operation" value={operation} />
          <Row label="Take Profit" value={order.takeProfit ? fmtPrice(order.takeProfit) : "—"} />
          <Row label="Stop Loss"   value={order.stopLoss   ? fmtPrice(order.stopLoss)   : "—"} />
          <Row label="Avg. entry price" value={fmtPrice(order.price)} />
          {order.openTime  && <Row label="Opening Time" value={fmtDate(order.openTime)}  />}
          {order.closePrice !== undefined && <Row label="Avg. close price" value={fmtPrice(order.closePrice)} />}
          {order.closeTime && <Row label="Closing Time" value={fmtDate(order.closeTime)} />}
        </div>
      </div>
    </div>
  );
}
