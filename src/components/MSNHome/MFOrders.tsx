import {useEffect, useMemo, useState} from "react";
import {useKite} from "../../contexts/KiteContext.tsx";
import {fetchKiteMFOrders} from "../../services/investmentService.ts";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import type {KiteMFOrder} from "../../utils/interfaces.ts";
import style from "./MSNHome.module.scss";

/**
 * ak-ktf4 (FE companion to ak-h1mq BE): Mutual-fund orders tab for the
 * MF asset detail view. Consumer of GET /kite/mf/orders (7-day window
 * per Kite's mf_orders() API).
 *
 * §23 posture:
 *   #1 preserved — this is new surface, no pre-existing contract changed.
 *   #2 CONSUME — BE forwards Kite's native shape unmodified; this
 *     component renders field-by-field without re-deriving money/dates.
 *   #4 N/A, #5 N/A, #6 preserved (en-IN currency formatting, Indian
 *     lakh/crore compaction via shared formatters).
 *
 * LAZY fetch: component-local state (no KiteContext slice for this
 * bead's small payload). Fires once on first mount when Kite is
 * connected; re-fires if the user reconnects and the tab is remounted.
 * Disconnected state short-circuits to a placeholder — no request is
 * issued without an authenticated Kite session.
 */

// Signed-money palette (shared across all investment surfaces).
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";

// Classify a Kite MF order status into a chip color. Status strings
// are raw Kite output — compared case-insensitively since Kite has
// shipped mixed casing across SDK versions.
function statusColor(status: string | undefined): string {
    const s = (status || "").toUpperCase();
    if (s === "COMPLETE") return CLR_GAIN;
    if (s === "CANCELLED" || s === "REJECTED") return CLR_LOSS;
    if (s === "OPEN" || s === "RECEIVED" || s === "VALIDATED" || s === "AMO_REQ_RECEIVED") return CLR_WARN;
    return "var(--color-neutral-500)";
}

// Defensive numeric reader — returns null for non-finite / missing.
function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Render a Kite order timestamp (ISO-ish or "YYYY-MM-DD HH:MM:SS")
// as an IST-local short date. Returns "—" for missing / unparseable.
function fmtDate(ts: string | undefined): string {
    if (!ts) return "—";
    // Kite often emits bare "YYYY-MM-DD HH:MM:SS" (no tz). Treat as
    // IST wall-clock: parse directly, let Date() interpret as local
    // (BE runs IST, FE renders for IST user — single-user app).
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
    }).format(d);
}

const MFOrders = () => {
    const {state: kiteState} = useKite();
    const [data, setData] = useState<KiteMFOrder[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        if (!kiteState.isAuthenticated) {
            // Don't attempt to fetch while disconnected — the reconnect
            // affordance in the Investments shell handles the prompt.
            return;
        }
        let cancelled = false;
        setLoading(true);
        setErrored(false);
        fetchKiteMFOrders()
            .then((res) => {
                if (cancelled) return;
                setData(Array.isArray(res?.orders) ? res.orders : []);
            })
            .catch(() => {
                if (cancelled) return;
                setErrored(true);
                setData(null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // Re-fire if the user reconnects while this tab is mounted.
    }, [kiteState.isAuthenticated]);

    // Sort newest-first by order_timestamp (fall back to
    // exchange_timestamp when order_timestamp missing, then preserve
    // input order for the leftovers). Stable within the same ts.
    const sorted = useMemo(() => {
        const list = data ?? [];
        return [...list].sort((a, b) => {
            const ta = (a.order_timestamp || a.exchange_timestamp || "").toString();
            const tb = (b.order_timestamp || b.exchange_timestamp || "").toString();
            if (ta === tb) return 0;
            return ta < tb ? 1 : -1;
        });
    }, [data]);

    if (!kiteState.isAuthenticated) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>
                    Connect Kite to see MF orders. Use the reconnect affordance in Investments.
                </div>
            </div>
        );
    }

    if (loading && data === null) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>Loading orders…</div>
            </div>
        );
    }

    if (errored) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>
                    Could not load MF orders. The service will retry on next tab visit.
                </div>
            </div>
        );
    }

    if (sorted.length === 0) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>
                    No MF orders in the last 7 days. Kite's mf_orders() API is scoped to a rolling week.
                </div>
            </div>
        );
    }

    return (
        <div className={style.mfPanel}>
            <div className={style.mfPanelMeta}>
                <span className={style.mfPanelCount}>{sorted.length} order{sorted.length === 1 ? "" : "s"}</span>
                <span className={style.mfPanelHint}>Kite's 7-day order window</span>
            </div>
            <div className={style.mfTableWrap}>
                <table className={style.mfTable}>
                    <thead>
                        <tr>
                            <th>Fund</th>
                            <th>Type</th>
                            <th>Status</th>
                            <th className={style.mfNumCol}>Amount</th>
                            <th className={style.mfNumCol}>Units</th>
                            <th className={style.mfNumCol}>NAV</th>
                            <th>Placed</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sorted.map((o, i) => {
                            const key = o.order_id || `mf-order-idx-${i}`;
                            const fund = o.fund || o.tradingsymbol || "—";
                            const tsym = o.tradingsymbol && o.fund ? o.tradingsymbol : null;
                            const txnType = (o.transaction_type || "").toUpperCase();
                            const txnColor = txnType === "BUY" ? CLR_GAIN : txnType === "SELL" ? CLR_LOSS : "var(--color-neutral-500)";
                            const status = (o.status || "—").toUpperCase();
                            const sColor = statusColor(o.status);
                            const amount = num(o.amount);
                            const quantity = num(o.quantity);
                            const nav = num(o.average_price) ?? num(o.last_price);
                            return (
                                <tr key={key}>
                                    <td>
                                        <span className={style.mfFundName}>{fund}</span>
                                        {tsym && (
                                            <span className={style.mfFundSymbol}>{" · "}{tsym}</span>
                                        )}
                                    </td>
                                    <td>
                                        <span className={style.mfChip} style={{color: txnColor}}>
                                            {txnType || "—"}
                                        </span>
                                    </td>
                                    <td>
                                        <span
                                            className={style.mfChip}
                                            style={{
                                                color: sColor,
                                                boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sColor} 35%, transparent)`,
                                            }}
                                            title={o.status_message || undefined}
                                        >
                                            {status}
                                        </span>
                                    </td>
                                    <td className={style.mfNumCol}>
                                        {amount !== null ? `₹${formatCurrency(amount)}` : "—"}
                                    </td>
                                    <td className={style.mfNumCol}>
                                        {quantity !== null ? quantity.toFixed(3) : "—"}
                                    </td>
                                    <td className={style.mfNumCol}>
                                        {nav !== null ? `₹${formatCurrency(nav)}` : "—"}
                                    </td>
                                    <td className={style.mfDateCell}>{fmtDate(o.order_timestamp || o.exchange_timestamp)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default MFOrders;
