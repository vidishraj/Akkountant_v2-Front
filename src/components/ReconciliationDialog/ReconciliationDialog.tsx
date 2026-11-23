import {useCallback, useEffect, useRef, useState} from "react";
import useModalA11y from "../../hooks/useModalA11y";
import {
    getReconciliationIssues,
    resolveReconciliationIssue,
} from "../../services/reconciliationService.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";
import type {
    ReconciliationIssue,
    ReconciliationIssueStatus,
} from "../../utils/interfaces.ts";
import styles from "./ReconciliationDialog.module.scss";

/**
 * ak-j8tc (FE companion to ak-cipj BE): reconciliation review drawer.
 *
 * Opens from the Home "Reconciliation · N issues to review" alert
 * card OR the Investments status-strip Reconciliation tile. Lists
 * rows for the current status filter (open by default, resolved
 * toggle) ordered newest-first per BE's detected_at DESC. Each row
 * expands inline to show `discrepancy_type` + `kite_trade_id` +
 * the BE's parsed `discrepancy_detail` JSON + a Resolve action.
 *
 * Posture:
 *   - §4 — trade-level data is Overseer's own. Low PII sensitivity
 *     but kite_trade_id + nested payload amounts carry the same
 *     restraint-on-default-display convention as the rest of
 *     Investments: full payload is in the expand drawer, not the
 *     collapsed row (collapsed row shows discrepancy_type + a short
 *     relative timestamp only).
 *   - §5 — resolve is a MUTATION, not a destructive hard-delete.
 *     Guarded by a click-to-confirm inline confirm (second click
 *     fires the POST). BE is idempotent so a double-fire is a 200
 *     noop, not a failure.
 *   - §2 CONSUME — `count` in the parent is read from BE's
 *     `response.count`; this drawer does not re-count or recount.
 *
 * Accessibility: role="dialog" + aria-modal + useModalA11y
 * focus-trap + inline Esc/backdrop close (matches
 * FileTimestampsDialog / AlertHistoryModal shape).
 */

interface ReconciliationDialogProps {
    open: boolean;
    onClose: () => void;
    // Fires AFTER each successful resolve so the parent can
    // optimistically refresh its badge count without a round-trip.
    onResolved?: (issueId: number) => void;
}

const STATUS_FILTERS: {value: ReconciliationIssueStatus; label: string}[] = [
    {value: "open", label: "Open"},
    {value: "resolved", label: "Resolved"},
];

// IST-local short label for detected_at. Returns "—" on
// missing/unparseable input so the row never shows "Invalid Date".
function fmtTs(ts: string | null | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    if (!Number.isFinite(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

// Pretty-print the BE's discrepancy_detail (already JSON-parsed).
// Flat scalar/number entries render as a two-column list; nested
// values fall through to stable JSON.stringify so an exotic shape
// is still legible rather than "[object Object]".
function renderDetailEntries(detail: Record<string, unknown> | null): Array<[string, string]> {
    if (!detail || typeof detail !== "object") return [];
    return Object.entries(detail).map(([k, v]) => {
        if (v === null || v === undefined) return [k, "—"];
        if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
            return [k, String(v)];
        }
        try {
            return [k, JSON.stringify(v)];
        } catch {
            return [k, "—"];
        }
    });
}

const ReconciliationDialog = ({open, onClose, onResolved}: ReconciliationDialogProps) => {
    const {setPayload} = useMessage();

    const [status, setStatus] = useState<ReconciliationIssueStatus>("open");
    const [loading, setLoading] = useState(false);
    const [issues, setIssues] = useState<ReconciliationIssue[]>([]);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [resolvingId, setResolvingId] = useState<number | null>(null);
    // Set of issue ids for which the confirm chip has been armed —
    // second click fires the resolve. Cleared on filter-change /
    // dialog-close.
    const [armedIds, setArmedIds] = useState<Set<number>>(new Set());
    const [noteDrafts, setNoteDrafts] = useState<Record<number, string>>({});

    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
    });

    const load = useCallback(
        async (next: ReconciliationIssueStatus, clearCache = false, isActive?: () => boolean) => {
            setLoading(true);
            try {
                const res = await getReconciliationIssues(next, clearCache);
                if (isActive && !isActive()) return;
                setIssues(Array.isArray(res?.issues) ? res.issues : []);
            } catch {
                if (isActive && !isActive()) return;
                setIssues([]);
                setPayload({type: "error", message: "Failed to load reconciliation issues"});
            } finally {
                if (!isActive || isActive()) setLoading(false);
            }
        },
        [setPayload],
    );

    // Fetch on open / filter change. Cancelled flag guards setState
    // against a late-arriving response after close (same unmount
    // guard pattern as ak-oc5s / ak-2k93 / ak-ncfr loadTrash).
    useEffect(() => {
        if (!open) {
            setIssues([]);
            setExpandedId(null);
            setArmedIds(new Set());
            setNoteDrafts({});
            return;
        }
        let cancelled = false;
        void load(status, false, () => !cancelled);
        return () => {
            cancelled = true;
        };
    }, [open, status, load]);

    // Esc-to-close.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const handleToggleExpand = useCallback((id: number) => {
        setExpandedId((prev) => (prev === id ? null : id));
        setArmedIds((prev) => {
            // Collapsing an armed row disarms the confirm.
            if (!prev.has(id)) return prev;
            const next = new Set(prev);
            next.delete(id);
            return next;
        });
    }, []);

    const handleResolve = useCallback(
        async (issue: ReconciliationIssue) => {
            // Two-click confirm: first click arms, second fires. Aligns
            // with §5's destructive-gate "require an explicit second
            // acknowledgement" posture without the EXACT-match ceremony
            // (resolve is a mutation, not a destructive hard-delete).
            if (!armedIds.has(issue.id)) {
                setArmedIds((prev) => {
                    const next = new Set(prev);
                    next.add(issue.id);
                    return next;
                });
                return;
            }
            setResolvingId(issue.id);
            try {
                const note = noteDrafts[issue.id] ?? "";
                await resolveReconciliationIssue(issue.id, note.length > 0 ? note : undefined);
                setIssues((prev) => prev.filter((it) => it.id !== issue.id));
                setExpandedId(null);
                setArmedIds((prev) => {
                    const next = new Set(prev);
                    next.delete(issue.id);
                    return next;
                });
                setNoteDrafts((prev) => {
                    const next = {...prev};
                    delete next[issue.id];
                    return next;
                });
                onResolved?.(issue.id);
                setPayload({type: "success", message: `Resolved issue #${issue.id}`});
            } catch {
                setPayload({type: "error", message: `Failed to resolve issue #${issue.id}`});
            } finally {
                setResolvingId(null);
            }
        },
        [armedIds, noteDrafts, onResolved, setPayload],
    );

    if (!open) return null;

    return (
        <div
            className={styles.backdrop}
            onMouseDown={onClose}
            role="presentation"
        >
            <div
                ref={panelRef}
                className={styles.panel}
                role="dialog"
                aria-modal="true"
                aria-labelledby="akj8tc-recon-title"
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <span className={styles.title}>
                        <i className="ph ph-arrows-left-right" aria-hidden="true"/>
                        <span id="akj8tc-recon-title">Trade reconciliation</span>
                    </span>
                    <div className={styles.filterTabs} role="tablist" aria-label="Status filter">
                        {STATUS_FILTERS.map((f) => (
                            <button
                                key={f.value}
                                type="button"
                                role="tab"
                                aria-selected={status === f.value}
                                className={`${styles.filterTab} ${status === f.value ? styles.filterTabActive : ""}`}
                                onClick={() => {
                                    if (status !== f.value) {
                                        setStatus(f.value);
                                        setExpandedId(null);
                                        setArmedIds(new Set());
                                    }
                                }}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        className={styles.closeBtn}
                        onClick={onClose}
                        aria-label="Close"
                    >
                        <i className="ph ph-x"/>
                    </button>
                </div>

                <div className={styles.body}>
                    {loading && issues.length === 0 ? (
                        <div className={styles.emptyState}>Loading issues…</div>
                    ) : issues.length === 0 ? (
                        <div className={styles.emptyState}>
                            {status === "open"
                                ? "Nothing to review. Daily reconcile found no deltas."
                                : "No resolved issues on record."}
                        </div>
                    ) : (
                        <ul className={styles.list}>
                            {issues.map((issue) => {
                                const isExpanded = expandedId === issue.id;
                                const isArmed = armedIds.has(issue.id);
                                const isResolvingThis = resolvingId === issue.id;
                                const entries = renderDetailEntries(issue.discrepancy_detail);
                                return (
                                    <li key={issue.id} className={styles.row}>
                                        <button
                                            type="button"
                                            className={styles.rowHead}
                                            aria-expanded={isExpanded}
                                            onClick={() => handleToggleExpand(issue.id)}
                                        >
                                            <span className={styles.rowKind}>
                                                {issue.discrepancy_type || "unknown"}
                                            </span>
                                            <span className={styles.rowTradeId}>
                                                #{issue.kite_trade_id || "—"}
                                            </span>
                                            <span className={styles.rowTs}>
                                                {fmtTs(issue.detected_at)}
                                            </span>
                                            <i
                                                className={`ph ${isExpanded ? "ph-caret-up" : "ph-caret-down"} ${styles.rowCaret}`}
                                                aria-hidden="true"
                                            />
                                        </button>
                                        {isExpanded && (
                                            <div className={styles.rowDetail}>
                                                {entries.length === 0 ? (
                                                    <div className={styles.rowDetailEmpty}>
                                                        No additional payload details.
                                                    </div>
                                                ) : (
                                                    <dl className={styles.detailList}>
                                                        {entries.map(([k, v]) => (
                                                            <div key={k} className={styles.detailRow}>
                                                                <dt className={styles.detailKey}>{k}</dt>
                                                                <dd className={styles.detailValue}>{v}</dd>
                                                            </div>
                                                        ))}
                                                    </dl>
                                                )}

                                                {status === "open" && (
                                                    <div className={styles.resolveBar}>
                                                        <input
                                                            type="text"
                                                            className={styles.resolveNoteInput}
                                                            placeholder="Optional resolution note (max 500 chars)"
                                                            maxLength={500}
                                                            value={noteDrafts[issue.id] ?? ""}
                                                            onChange={(e) =>
                                                                setNoteDrafts((prev) => ({
                                                                    ...prev,
                                                                    [issue.id]: e.target.value,
                                                                }))
                                                            }
                                                            disabled={isResolvingThis}
                                                        />
                                                        <button
                                                            type="button"
                                                            onClick={() => void handleResolve(issue)}
                                                            disabled={isResolvingThis}
                                                            className={`${styles.resolveBtn} ${isArmed ? styles.resolveBtnArmed : ""}`}
                                                        >
                                                            {isResolvingThis
                                                                ? "Resolving…"
                                                                : isArmed
                                                                ? "Confirm resolve"
                                                                : "Resolve"}
                                                        </button>
                                                    </div>
                                                )}

                                                {status === "resolved" && issue.resolution_note && (
                                                    <div className={styles.resolvedNote}>
                                                        <i className="ph ph-chat-text" aria-hidden="true"/>
                                                        <span>{issue.resolution_note}</span>
                                                    </div>
                                                )}
                                                {status === "resolved" && issue.resolved_at && (
                                                    <div className={styles.resolvedMeta}>
                                                        Resolved {fmtTs(issue.resolved_at)}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div className={styles.footer}>
                    <button
                        type="button"
                        className={`btn btn-primary ${styles.closeAction}`}
                        onClick={onClose}
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ReconciliationDialog;
