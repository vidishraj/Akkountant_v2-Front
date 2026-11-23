// ak-ue5q (FE companion to ak-l8a7 BE): per-order drill-down modal.
//
// Opened from a Today's Orders row click on InvestmentsLanding (via
// ak-ws2q). On open, fetches TWO Kite-sourced BE endpoints in
// parallel:
//
//   GET /kite/orders/<order_id>/history  — status-transition timeline
//   GET /kite/orders/<order_id>/trades   — per-fill trade breakdown
//
// Both are no-cache drill-downs (BE skips cache, FE mirrors) — the
// user typically opens the modal asking "what actually happened to
// this order?" so fresh data wins over bandwidth.
//
// §23: #1 preserved · #2 CONSUME (Kite shapes rendered verbatim;
//   no re-derivation of qty / price / timestamp) · #4 N/A · #5 N/A
//   (read-only) · #6 preserved (en-IN currency + oklch signed-money).
//
// Accessibility: role="dialog" + aria-modal + useModalA11y for
// focus-trap/restore. Esc + backdrop click both close (standard
// non-destructive dismiss; policy is caller-owned per the useModalA11y
// contract). Mirrors AlertHistoryModal (ak-166j) posture.

import React, {useCallback, useEffect, useRef, useState} from "react";
import useModalA11y from "../../hooks/useModalA11y";
import {
    fetchKiteOrderHistory,
    fetchKiteOrderTrades,
} from "../../services/investmentService.ts";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import type {
    KiteOrder,
    KiteOrderHistoryEntry,
    KiteTrade,
} from "../../utils/interfaces.ts";
import style from "./OrderDrillDownModal.module.scss";

interface OrderDrillDownModalProps {
    open: boolean;
    order: KiteOrder | null;
    onClose: () => void;
}

// Signed-money palette (shared across Investments surfaces).
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";

function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Mirrors InvestmentsLanding's `orderStatusColor` — status chip
// palette consistent between the list row and the drill-in view.
function statusColor(status: string | undefined): string {
    const s = (status || "").toUpperCase();
    if (s === "COMPLETE") return CLR_GAIN;
    if (s === "CANCELLED" || s === "REJECTED") return CLR_LOSS;
    if (
        s === "OPEN" ||
        s === "TRIGGER_PENDING" ||
        s === "AMO_REQ_RECEIVED" ||
        s === "VALIDATED" ||
        s === "PUT ORDER REQ RECEIVED" ||
        s === "RECEIVED"
    ) return CLR_WARN;
    return "var(--color-neutral-500)";
}

// IST-local short datetime label (day + month + HH:MM) for timeline
// rows + fill timestamps. Kite emits ISO-ish OR "YYYY-MM-DD HH:MM:SS"
// without TZ — `new Date()` parses both; invalid falls back to "—".
function fmtTs(ts: string | null | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

// Pick the authoritative price for a history snapshot. Avg (realised
// against the filled quantity so far) is the most informative;
// otherwise fall back to limit, trigger, or null.
function snapshotPrice(h: KiteOrderHistoryEntry): number | null {
    return (
        num(h.average_price) ??
        num(h.price) ??
        num(h.trigger_price) ??
        null
    );
}

const OrderDrillDownModal: React.FC<OrderDrillDownModalProps> = ({
    open,
    order,
    onClose,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    const [history, setHistory] = useState<KiteOrderHistoryEntry[] | null>(null);
    const [trades, setTrades] = useState<KiteTrade[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [historyFailed, setHistoryFailed] = useState<boolean>(false);
    const [tradesFailed, setTradesFailed] = useState<boolean>(false);

    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
        firstFocusableRef: closeBtnRef as React.RefObject<HTMLElement>,
    });

    // Esc-to-close (caller-owned per useModalA11y contract).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Fetch both on open — parallel; one failing doesn't abort the
    // other. Local state, scoped to the modal lifetime. Fresh on
    // every open (no cache); BE-side matches.
    useEffect(() => {
        if (!open || !order?.order_id) {
            setHistory(null);
            setTrades(null);
            setHistoryFailed(false);
            setTradesFailed(false);
            setLoading(false);
            return;
        }
        let cancelled = false;
        const orderId = order.order_id;
        setLoading(true);
        setHistoryFailed(false);
        setTradesFailed(false);
        setHistory(null);
        setTrades(null);

        const histP = fetchKiteOrderHistory(orderId)
            .then((res) => {
                if (cancelled) return;
                setHistory(Array.isArray(res?.history) ? res.history : []);
            })
            .catch(() => {
                if (!cancelled) setHistoryFailed(true);
            });
        const tradesP = fetchKiteOrderTrades(orderId)
            .then((res) => {
                if (cancelled) return;
                setTrades(Array.isArray(res?.trades) ? res.trades : []);
            })
            .catch(() => {
                if (!cancelled) setTradesFailed(true);
            });

        Promise.all([histP, tradesP]).finally(() => {
            if (!cancelled) setLoading(false);
        });
        return () => {
            cancelled = true;
        };
    }, [open, order?.order_id]);

    const onBackdropClick = useCallback(
        (e: React.MouseEvent<HTMLDivElement>) => {
            if (e.target === e.currentTarget) onClose();
        },
        [onClose],
    );

    if (!open || !order) return null;

    const side = (order.transaction_type || "").toUpperCase();
    const sideColor = side === "BUY" ? CLR_GAIN : side === "SELL" ? CLR_LOSS : "var(--color-neutral-400)";
    const status = (order.status || "—").toUpperCase();
    const sColor = statusColor(order.status);

    const tradeCount = trades?.length ?? 0;
    const totalFilled = (trades ?? []).reduce((acc, t) => {
        const q = num(t.quantity);
        return q !== null ? acc + q : acc;
    }, 0);
    const tradedValue = (trades ?? []).reduce((acc, t) => {
        const q = num(t.quantity);
        const p = num(t.price) ?? num(t.average_price);
        return q !== null && p !== null ? acc + q * p : acc;
    }, 0);
    const vwap = totalFilled > 0 ? tradedValue / totalFilled : null;

    return (
        <div
            className={style.modalBackdrop}
            onClick={onBackdropClick}
            role="presentation"
        >
            <div
                ref={panelRef}
                tabIndex={-1}
                role="dialog"
                aria-modal="true"
                aria-labelledby="akue5q-order-drill-title"
                className={style.modalPanel}
            >
                {/* ── Header ─────────────────────────────────────── */}
                <div className={style.modalHeader}>
                    <div className={style.headerLeft}>
                        <div className={style.modalKicker}>Order drill-down</div>
                        <h4 id="akue5q-order-drill-title" className={style.modalTitle}>
                            {order.tradingsymbol ?? "—"}
                            {order.exchange && (
                                <span className={style.titleExch}>{" · "}{order.exchange}</span>
                            )}
                        </h4>
                        <div className={style.headerChips}>
                            <span
                                className={style.chip}
                                style={{
                                    color: sideColor,
                                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sideColor} 35%, transparent)`,
                                }}
                            >
                                {side || "—"}
                            </span>
                            <span
                                className={style.chip}
                                style={{
                                    color: sColor,
                                    boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sColor} 35%, transparent)`,
                                }}
                                title={order.status_message || undefined}
                            >
                                {status}
                            </span>
                            {order.order_type && (
                                <span className={style.chipGhost}>{order.order_type}</span>
                            )}
                            {order.product && (
                                <span className={style.chipGhost}>{order.product}</span>
                            )}
                        </div>
                        <div className={style.headerMeta}>
                            <span>Order ID {order.order_id ?? "—"}</span>
                            {order.quantity !== undefined && (
                                <span>Qty {order.quantity}</span>
                            )}
                            {num(order.price) !== null && num(order.price) !== 0 && (
                                <span>Limit ₹{formatCurrency(num(order.price) as number)}</span>
                            )}
                            {num(order.trigger_price) !== null && (num(order.trigger_price) as number) !== 0 && (
                                <span>Trigger ₹{formatCurrency(num(order.trigger_price) as number)}</span>
                            )}
                        </div>
                    </div>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={onClose}
                        className={`btn btn-icon ${style.modalCloseBtn}`}
                        aria-label="Close order drill-down"
                    >
                        <i className="ph ph-x" aria-hidden="true"/>
                    </button>
                </div>

                {/* ── Body ───────────────────────────────────────── */}
                <div className={style.modalBody}>
                    {/* Status transitions timeline */}
                    <section className={style.sectionBlock}>
                        <h5 className={style.sectionHeading}>Status transitions</h5>
                        {loading && history === null ? (
                            <div className={style.empty}>Loading timeline…</div>
                        ) : historyFailed ? (
                            <div className={style.empty}>
                                Could not fetch status transitions — close and retry.
                            </div>
                        ) : !history || history.length === 0 ? (
                            <div className={style.empty}>No status transitions recorded.</div>
                        ) : (
                            <ol className={style.timeline}>
                                {history.map((h, i) => {
                                    const key = `${h.status ?? "state"}-${h.order_timestamp ?? i}-${i}`;
                                    const ts = h.order_timestamp
                                        || h.exchange_timestamp
                                        || h.exchange_update_timestamp
                                        || "";
                                    const sc = statusColor(h.status);
                                    const px = snapshotPrice(h);
                                    const filled = num(h.filled_quantity);
                                    const pending = num(h.pending_quantity);
                                    return (
                                        <li key={key} className={style.timelineRow}>
                                            <div className={style.timelineDotCol}>
                                                <span
                                                    className={style.timelineDot}
                                                    style={{background: sc}}
                                                />
                                            </div>
                                            <div className={style.timelineContent}>
                                                <div className={style.timelineTopLine}>
                                                    <span
                                                        className={style.chip}
                                                        style={{
                                                            color: sc,
                                                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sc} 35%, transparent)`,
                                                        }}
                                                    >
                                                        {(h.status || "—").toUpperCase()}
                                                    </span>
                                                    <span className={style.timelineTs}>{fmtTs(ts)}</span>
                                                </div>
                                                <div className={style.timelineMeta}>
                                                    {filled !== null && (
                                                        <span>Filled {filled}{pending !== null ? ` · Pending ${pending}` : ""}</span>
                                                    )}
                                                    {px !== null && (
                                                        <span>₹{formatCurrency(px)}</span>
                                                    )}
                                                    {h.status_message && (
                                                        <span className={style.timelineMsg} title={h.status_message}>
                                                            {h.status_message}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </section>

                    {/* Per-fill breakdown */}
                    <section className={style.sectionBlock}>
                        <div className={style.fillsHeader}>
                            <h5 className={style.sectionHeading}>Fills breakdown</h5>
                            {tradeCount > 0 && vwap !== null && (
                                <span className={style.fillsSummary}>
                                    {tradeCount} fill{tradeCount === 1 ? "" : "s"} · VWAP ₹{formatCurrency(vwap)}
                                </span>
                            )}
                        </div>
                        {loading && trades === null ? (
                            <div className={style.empty}>Loading fills…</div>
                        ) : tradesFailed ? (
                            <div className={style.empty}>
                                Could not fetch fills — close and retry.
                            </div>
                        ) : !trades || trades.length === 0 ? (
                            <div className={style.empty}>
                                No fills recorded. Pending / cancelled orders never traded.
                            </div>
                        ) : (
                            <div className={style.tableWrap}>
                                <table className={style.table}>
                                    <thead>
                                        <tr>
                                            <th>Time</th>
                                            <th>Trade ID</th>
                                            <th className={style.numCol}>Qty</th>
                                            <th className={style.numCol}>Price</th>
                                            <th className={style.numCol}>Value</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {trades.map((t, i) => {
                                            const key = t.trade_id ?? `fill-${i}`;
                                            const ts = t.fill_timestamp
                                                || t.exchange_timestamp
                                                || t.order_timestamp
                                                || "";
                                            const q = num(t.quantity);
                                            const p = num(t.price) ?? num(t.average_price);
                                            const v = q !== null && p !== null ? q * p : null;
                                            return (
                                                <tr key={key}>
                                                    <td>{fmtTs(ts)}</td>
                                                    <td className={style.tradeId}>{t.trade_id ?? "—"}</td>
                                                    <td className={style.numCol}>{q ?? "—"}</td>
                                                    <td className={style.numCol}>
                                                        {p !== null ? `₹${formatCurrency(p)}` : "—"}
                                                    </td>
                                                    <td className={style.numCol}>
                                                        {v !== null ? `₹${formatCurrency(v)}` : "—"}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
};

export default OrderDrillDownModal;
