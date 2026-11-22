// ak-166j / ak-dx98 Bundle 3 FE: Kite monitoring card.
//
// Consumer of the three Bundle-3 BE endpoints:
//   GET /kite/gtts                       — active GTT monitors with LTP overlay
//   GET /kite/alerts                     — price alerts
//   GET /kite/alerts/<uuid>/history      — per-alert trigger history (drill-down)
//
// Surface shape: one card slotted into the Investments landing page,
// between the Market-linked grid and the Fixed-return grid. Hidden
// entirely when !kite.isAuthenticated — per bead rule "Disconnected
// state hides the whole section".
//
// Two sub-tabs (GTTs / Alerts) with lazy fetches: switching tabs
// triggers the respective /kite/* endpoint once per session (checked
// + loading guard). Alert rows are clickable → opens AlertHistoryModal
// which fetches /kite/alerts/<uuid>/history on open with its own
// loading state.
//
// GTT distance-pct color coding:
//   - status "triggered"                  → CLR_LOSS (red / fired)
//   - status "active" && |dist| <= THRESH → CLR_WARN (amber / close)
//   - status "active" && further          → CLR_GAIN (green / safe)
//   - status "cancelled" / "expired"      → neutral-500
// (bead flags ak-g88e as the follow-up for direction-hint accuracy —
//  the signed distance is shown verbatim here; future polish tightens
//  the "close in which direction?" affordance.)

import React, {useCallback, useEffect, useMemo, useState} from "react";
import {useKite} from "../../contexts/KiteContext.tsx";
import type {KiteAlert, KiteGtt, KiteGttMonitorSuccess} from "../../utils/interfaces.ts";
import {formatCurrency} from "../../components/WealthDigest/formatters.ts";
import AlertHistoryModal from "./AlertHistoryModal.tsx";
import style from "./KiteMonitoring.module.scss";

// OKLCH triples from the shared signed-money palette used across
// Investments pages (gain / loss / warning). Sanctioned by FE scope.
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";

// A GTT is considered "close to trigger" when the absolute distance to
// any leg is below this threshold %. Chosen conservatively (2%) so the
// amber chip reads as a meaningful "watch this" signal rather than
// perpetual alarm. Tunable without BE change.
const CLOSE_THRESHOLD_PCT = 2;

type SubTab = "gtts" | "alerts";

// Helpers — read a defensive numeric from an unknown-shape payload.
function n(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Pick the "most informative" distance for color coding. For single-leg
// GTTs this is just the scalar; for OCO GTTs we take the min(|dist|) so
// amber kicks in whenever EITHER leg is close to firing.
function readMinAbsDistance(monitor: unknown): number | null {
    if (!monitor || typeof monitor !== "object") return null;
    const m = monitor as KiteGttMonitorSuccess;
    const raw = m.distance_pct;
    if (typeof raw === "number" && Number.isFinite(raw)) return Math.abs(raw);
    if (Array.isArray(raw)) {
        let best: number | null = null;
        for (const leg of raw) {
            if (typeof leg === "number" && Number.isFinite(leg)) {
                const abs = Math.abs(leg);
                if (best === null || abs < best) best = abs;
            }
        }
        return best;
    }
    return null;
}

function gttColor(gtt: KiteGtt): string {
    const status = (gtt.status || "").toLowerCase();
    if (status === "triggered") return CLR_LOSS;
    if (status === "cancelled" || status === "expired") return "var(--color-neutral-500)";
    if (status !== "active") return "var(--color-neutral-500)";
    const absDist = readMinAbsDistance(gtt.monitor);
    if (absDist === null) return CLR_GAIN;  // active but no distance — treat as safe default
    return absDist <= CLOSE_THRESHOLD_PCT ? CLR_WARN : CLR_GAIN;
}

// Format distance_pct for display. Single-leg → "+1.23%" / "-0.42%" /
// "—"; OCO two-leg → "+1.23% / -0.42%".
function formatDistance(monitor: unknown): string {
    if (!monitor || typeof monitor !== "object") return "—";
    const m = monitor as KiteGttMonitorSuccess;
    const raw = m.distance_pct;
    const fmtOne = (v: unknown): string => {
        const num = n(v);
        if (num === null) return "—";
        const sign = num >= 0 ? "+" : "−";
        return `${sign}${Math.abs(num).toFixed(2)}%`;
    };
    if (typeof raw === "number") return fmtOne(raw);
    if (Array.isArray(raw)) return raw.map(fmtOne).join(" / ");
    return "—";
}

// Build a short "trigger ₹X" / "trigger ₹X / ₹Y" label for the GTT row.
function formatTriggerValues(gtt: KiteGtt): string {
    const vals = gtt.condition?.trigger_values;
    if (!Array.isArray(vals) || vals.length === 0) return "—";
    return vals
        .map((v) => (typeof v === "number" && Number.isFinite(v) ? `₹${formatCurrency(v)}` : "—"))
        .join(" / ");
}

// Flatten the alert's RHS into a user-readable "value" (constant or
// cross-instrument). RHS types vary per Kite SDK version so we check
// for all the shapes defensively.
function formatAlertRhs(alert: KiteAlert): string {
    const rhsNum = n(alert.rhs_constant);
    if (rhsNum !== null) return `₹${formatCurrency(rhsNum)}`;
    if (alert.rhs_tradingsymbol) {
        return alert.rhs_exchange
            ? `${alert.rhs_exchange}:${alert.rhs_tradingsymbol}`
            : alert.rhs_tradingsymbol;
    }
    return "—";
}

const KiteMonitoring: React.FC = () => {
    const {state, refreshGtts, refreshAlerts} = useKite();
    const [activeTab, setActiveTab] = useState<SubTab>("gtts");
    const [historyUuid, setHistoryUuid] = useState<string | null>(null);
    const [historyAlertName, setHistoryAlertName] = useState<string | null>(null);

    // Lazy fetch: fire the active tab's endpoint on first activation.
    // Re-firing is guarded by `checked + !loading` so re-selecting the
    // same tab during a session doesn't re-hit the BE.
    useEffect(() => {
        if (!state.isAuthenticated) return;
        if (activeTab === "gtts") {
            if (!state.gtts.checked && !state.gtts.loading) {
                void refreshGtts(false);
            }
        } else if (activeTab === "alerts") {
            if (!state.alerts.checked && !state.alerts.loading) {
                void refreshAlerts(false);
            }
        }
    }, [
        activeTab,
        state.isAuthenticated,
        state.gtts.checked,
        state.gtts.loading,
        state.alerts.checked,
        state.alerts.loading,
        refreshGtts,
        refreshAlerts,
    ]);

    // Aggregates for the sub-tab count pills.
    const gttsCount = useMemo(() => {
        const list = state.gtts.data;
        return Array.isArray(list) ? list.length : null;
    }, [state.gtts.data]);

    const alertsCount = useMemo(() => {
        const list = state.alerts.data;
        return Array.isArray(list) ? list.length : null;
    }, [state.alerts.data]);

    const handleAlertClick = useCallback((alert: KiteAlert) => {
        if (!alert.uuid) return;
        setHistoryUuid(alert.uuid);
        setHistoryAlertName(alert.name ?? alert.lhs_tradingsymbol ?? null);
    }, []);

    const handleCloseModal = useCallback(() => {
        setHistoryUuid(null);
        setHistoryAlertName(null);
    }, []);

    // Hide the section entirely when Kite isn't connected. This is NOT
    // a placeholder — nothing to show if the user hasn't connected.
    if (!state.isAuthenticated) return null;

    return (
        <section className={style.section}>
            <div className={style.header}>
                <h4 className={style.sectionTitle}>Kite monitoring</h4>
                <span className={style.sectionSub}>GTTs &amp; price alerts · 5-min cache</span>
            </div>

            <div className={style.card}>
                <div className={style.tabs} role="tablist" aria-label="Monitoring views">
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "gtts"}
                        onClick={() => setActiveTab("gtts")}
                        className={`${style.tab} ${activeTab === "gtts" ? style.tabActive : ""}`}
                    >
                        <i className="ph ph-target" aria-hidden="true"/>
                        <span>GTTs</span>
                        <span className={style.tabCount}>
                            {gttsCount === null ? "—" : gttsCount}
                        </span>
                    </button>
                    <button
                        type="button"
                        role="tab"
                        aria-selected={activeTab === "alerts"}
                        onClick={() => setActiveTab("alerts")}
                        className={`${style.tab} ${activeTab === "alerts" ? style.tabActive : ""}`}
                    >
                        <i className="ph ph-bell" aria-hidden="true"/>
                        <span>Alerts</span>
                        <span className={style.tabCount}>
                            {alertsCount === null ? "—" : alertsCount}
                        </span>
                    </button>
                </div>

                <div className={style.tabBody} role="tabpanel">
                    {activeTab === "gtts" && (
                        <GttsPanel state={state.gtts}/>
                    )}
                    {activeTab === "alerts" && (
                        <AlertsPanel
                            state={state.alerts}
                            onAlertClick={handleAlertClick}
                        />
                    )}
                </div>
            </div>

            {historyUuid && (
                <AlertHistoryModal
                    open={historyUuid !== null}
                    alertUuid={historyUuid}
                    alertName={historyAlertName}
                    onClose={handleCloseModal}
                />
            )}
        </section>
    );
};

// ─────────────────────── GTT panel ───────────────────────

const GttsPanel: React.FC<{state: {data: KiteGtt[] | null; loading: boolean; checked: boolean}}> = ({state}) => {
    if (state.loading) return <div className={style.empty}>Loading GTTs…</div>;
    if (!state.checked) return <div className={style.empty}>—</div>;
    const list = state.data ?? [];
    if (list.length === 0) return <div className={style.empty}>No active GTTs.</div>;

    return (
        <div className={style.tableWrap}>
            <table className={style.table}>
                <thead>
                    <tr>
                        <th>Symbol</th>
                        <th>Status</th>
                        <th>Type</th>
                        <th className={style.numCol}>Trigger</th>
                        <th className={style.numCol}>LTP</th>
                        <th className={style.numCol}>Distance</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((gtt, i) => {
                        const key = typeof gtt.id === "number" ? `gtt-${gtt.id}` : `gtt-idx-${i}`;
                        const color = gttColor(gtt);
                        const ltp = n(
                            (gtt.monitor && typeof gtt.monitor === "object" &&
                                "current_ltp" in gtt.monitor)
                                ? (gtt.monitor as KiteGttMonitorSuccess).current_ltp
                                : null
                        );
                        const status = (gtt.status ?? "—").toLowerCase();
                        const type = gtt.type ?? "—";
                        return (
                            <tr key={key}>
                                <td>
                                    <span className={style.symbol}>
                                        {gtt.condition?.tradingsymbol ?? "—"}
                                    </span>
                                    {gtt.condition?.exchange && (
                                        <span className={style.exch}>
                                            {" · "}{gtt.condition.exchange}
                                        </span>
                                    )}
                                </td>
                                <td>
                                    <span
                                        className={style.statusChip}
                                        style={{
                                            color,
                                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
                                        }}
                                    >
                                        {status}
                                    </span>
                                </td>
                                <td className={style.typeCell}>{type}</td>
                                <td className={style.numCol}>{formatTriggerValues(gtt)}</td>
                                <td className={style.numCol}>
                                    {ltp !== null ? `₹${formatCurrency(ltp)}` : "—"}
                                </td>
                                <td className={style.numCol} style={{color}}>
                                    {formatDistance(gtt.monitor)}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

// ─────────────────────── Alerts panel ───────────────────────

const AlertsPanel: React.FC<{
    state: {data: KiteAlert[] | null; loading: boolean; checked: boolean};
    onAlertClick: (alert: KiteAlert) => void;
}> = ({state, onAlertClick}) => {
    if (state.loading) return <div className={style.empty}>Loading alerts…</div>;
    if (!state.checked) return <div className={style.empty}>—</div>;
    const list = state.data ?? [];
    if (list.length === 0) return <div className={style.empty}>No alerts configured.</div>;

    return (
        <div className={style.tableWrap}>
            <table className={style.table}>
                <thead>
                    <tr>
                        <th>Name</th>
                        <th>Watches</th>
                        <th>Condition</th>
                        <th>Status</th>
                        <th>Type</th>
                    </tr>
                </thead>
                <tbody>
                    {list.map((alert, i) => {
                        const key = alert.uuid ?? `alert-idx-${i}`;
                        const name = alert.name ?? "—";
                        const lhsSymbol = alert.lhs_tradingsymbol
                            ? (alert.lhs_exchange
                                ? `${alert.lhs_exchange}:${alert.lhs_tradingsymbol}`
                                : alert.lhs_tradingsymbol)
                            : "—";
                        const op = alert.operator ?? "—";
                        const rhs = formatAlertRhs(alert);
                        const status = (alert.status ?? "—").toLowerCase();
                        const enabled = status === "enabled";
                        const clickable = typeof alert.uuid === "string" && alert.uuid.length > 0;
                        return (
                            <tr
                                key={key}
                                onClick={clickable ? () => onAlertClick(alert) : undefined}
                                className={clickable ? style.rowClickable : undefined}
                                tabIndex={clickable ? 0 : undefined}
                                role={clickable ? "button" : undefined}
                                onKeyDown={clickable ? (e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        onAlertClick(alert);
                                    }
                                } : undefined}
                                aria-label={clickable ? `View history for alert ${name}` : undefined}
                            >
                                <td>
                                    <span className={style.symbol}>{name}</span>
                                </td>
                                <td>
                                    <span className={style.exch}>{lhsSymbol}</span>
                                    {alert.lhs_attribute && (
                                        <span className={style.attribute}>
                                            {" · "}{alert.lhs_attribute}
                                        </span>
                                    )}
                                </td>
                                <td className={style.conditionCell}>
                                    <code className={style.op}>{op}</code> {rhs}
                                </td>
                                <td>
                                    <span
                                        className={style.statusChip}
                                        style={{
                                            color: enabled ? CLR_GAIN : "var(--color-neutral-500)",
                                            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${enabled ? CLR_GAIN : "var(--color-neutral-600)"} 35%, transparent)`,
                                        }}
                                    >
                                        {status}
                                    </span>
                                </td>
                                <td className={style.typeCell}>{alert.type ?? "—"}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default KiteMonitoring;
