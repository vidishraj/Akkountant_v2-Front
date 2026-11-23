import {useEffect, useMemo, useState} from "react";
import {useKite} from "../../contexts/KiteContext.tsx";
import {fetchKiteMFSips} from "../../services/investmentService.ts";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import type {KiteMFSip} from "../../utils/interfaces.ts";
import style from "./MSNHome.module.scss";

/**
 * ak-ktf4 (FE companion to ak-h1mq BE): Active + completed mutual-fund
 * SIPs tab for the MF asset detail view. Consumer of GET /kite/mf/sips.
 *
 * READ-ONLY per bead scope. SIP pause / edit / cancel actions are
 * deferred to a separate SIP-management bead — no mutation
 * affordances are rendered here even for ACTIVE SIPs.
 *
 * §23 posture:
 *   #1 preserved — new surface, no pre-existing contract changed.
 *   #2 CONSUME — BE emits Kite's native sip shape unmodified;
 *     frequency / amount / next_instalment render verbatim.
 *   #4 N/A, #5 N/A, #6 preserved (en-IN currency, 2-digit precision).
 *
 * LAZY fetch: component-local state (no KiteContext slice). Fires
 * once per mount when Kite is connected; errors fall back to the
 * placeholder without toasting.
 */

const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";

// Classify a Kite SIP status. Mirrors MFOrders' color mapping so the
// two tabs read consistently.
function statusColor(status: string | undefined): string {
    const s = (status || "").toUpperCase();
    if (s === "ACTIVE") return CLR_GAIN;
    if (s === "CANCELLED" || s === "REJECTED") return CLR_LOSS;
    if (s === "PAUSED") return CLR_WARN;
    return "var(--color-neutral-500)";
}

function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function fmtDate(ts: string | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts.includes("T") ? ts : ts.replace(" ", "T"));
    if (Number.isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        day: "2-digit",
        month: "short",
        year: "2-digit",
    }).format(d);
}

// Render a Kite SIP frequency ("monthly" / "weekly" / etc.) with the
// first letter capitalized. Kite emits lowercase; display is cased.
function fmtFreq(f: string | undefined): string {
    if (!f) return "—";
    return f.charAt(0).toUpperCase() + f.slice(1);
}

// "Of N" trailer for pending/total instalments. Kite uses -1 for the
// unbounded "until cancelled" convention — render as ∞.
function fmtInstalments(pending: number | null, total: number | null): string {
    if (pending === null && total === null) return "—";
    const p = pending === null ? "?" : pending.toString();
    if (total === null) return `${p} pending`;
    if (total === -1) return `${p} pending · ∞`;
    return `${p} pending · of ${total}`;
}

const MFSips = () => {
    const {state: kiteState} = useKite();
    const [data, setData] = useState<KiteMFSip[] | null>(null);
    const [loading, setLoading] = useState(false);
    const [errored, setErrored] = useState(false);

    useEffect(() => {
        if (!kiteState.isAuthenticated) return;
        let cancelled = false;
        setLoading(true);
        setErrored(false);
        fetchKiteMFSips()
            .then((res) => {
                if (cancelled) return;
                setData(Array.isArray(res?.sips) ? res.sips : []);
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
    }, [kiteState.isAuthenticated]);

    // Sort active-first, then paused, then the rest. Within each
    // group newest next_instalment first.
    const sorted = useMemo(() => {
        const list = data ?? [];
        const rank = (s: string | undefined): number => {
            const v = (s || "").toUpperCase();
            if (v === "ACTIVE") return 0;
            if (v === "PAUSED") return 1;
            return 2;
        };
        return [...list].sort((a, b) => {
            const ra = rank(a.status);
            const rb = rank(b.status);
            if (ra !== rb) return ra - rb;
            const ta = (a.next_instalment || a.created || "").toString();
            const tb = (b.next_instalment || b.created || "").toString();
            if (ta === tb) return 0;
            return ta < tb ? 1 : -1;
        });
    }, [data]);

    if (!kiteState.isAuthenticated) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>
                    Connect Kite to see active SIPs. Use the reconnect affordance in Investments.
                </div>
            </div>
        );
    }

    if (loading && data === null) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>Loading SIPs…</div>
            </div>
        );
    }

    if (errored) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>
                    Could not load SIPs. The service will retry on next tab visit.
                </div>
            </div>
        );
    }

    if (sorted.length === 0) {
        return (
            <div className={style.mfPanel}>
                <div className={style.mfEmpty}>No SIPs on your account.</div>
            </div>
        );
    }

    const activeCount = sorted.filter((s) => (s.status || "").toUpperCase() === "ACTIVE").length;

    return (
        <div className={style.mfPanel}>
            <div className={style.mfPanelMeta}>
                <span className={style.mfPanelCount}>
                    {activeCount} active · {sorted.length} total
                </span>
                <span className={style.mfPanelHint}>Read-only · pause / edit lives on a future bead</span>
            </div>
            <div className={style.mfSipGrid}>
                {sorted.map((s, i) => {
                    const key = s.sip_id || `mf-sip-idx-${i}`;
                    const status = (s.status || "—").toUpperCase();
                    const sColor = statusColor(s.status);
                    const amount = num(s.instalment_amount);
                    const nextDate = fmtDate(s.next_instalment);
                    const pending = num(s.pending_instalments);
                    const total = num(s.instalments);
                    return (
                        <article key={key} className={style.mfSipCard}>
                            <header className={style.mfSipHeader}>
                                <span className={style.mfFundName}>{s.fund || s.tradingsymbol || "—"}</span>
                                <span
                                    className={style.mfChip}
                                    style={{
                                        color: sColor,
                                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sColor} 35%, transparent)`,
                                    }}
                                >
                                    {status}
                                </span>
                            </header>
                            <div className={style.mfSipRow}>
                                <span className={style.mfSipLabel}>Amount</span>
                                <span className={style.mfSipValue}>
                                    {amount !== null ? `₹${formatCurrency(amount)}` : "—"}
                                </span>
                            </div>
                            <div className={style.mfSipRow}>
                                <span className={style.mfSipLabel}>Frequency</span>
                                <span className={style.mfSipValue}>{fmtFreq(s.frequency)}</span>
                            </div>
                            <div className={style.mfSipRow}>
                                <span className={style.mfSipLabel}>Next debit</span>
                                <span className={style.mfSipValue}>{nextDate}</span>
                            </div>
                            <div className={style.mfSipRow}>
                                <span className={style.mfSipLabel}>Instalments</span>
                                <span className={style.mfSipValue}>{fmtInstalments(pending, total)}</span>
                            </div>
                            {s.tradingsymbol && s.fund && (
                                <div className={style.mfSipFooter}>{s.tradingsymbol}</div>
                            )}
                        </article>
                    );
                })}
            </div>
        </div>
    );
};

export default MFSips;
