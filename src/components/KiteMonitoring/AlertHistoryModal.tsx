// ak-166j: drill-down modal for a single alert's trigger history.
//
// Fetches /kite/alerts/<uuid>/history on open. No cache — the overseer
// typically opens this asking "did my alert actually fire recently?"
// so always-fresh is the design (BE-side also skips caching for this
// endpoint). Closed state returns the data to memory via onClose; the
// parent discards the uuid so the next open re-fetches from scratch.
//
// Accessibility: role="dialog" + aria-modal + useModalA11y for focus
// trap / focus restore; inline Esc-to-close handler per the useModalA11y
// hook contract ("caller defines Esc policy" so different dialogs can
// use Esc differently). Backdrop click also closes.

import React, {useCallback, useEffect, useRef, useState} from "react";
import useModalA11y from "../../hooks/useModalA11y";
import {fetchKiteAlertHistory} from "../../services/investmentService.ts";
import type {KiteAlertHistoryEntry} from "../../utils/interfaces.ts";
import style from "./KiteMonitoring.module.scss";

interface AlertHistoryModalProps {
    open: boolean;
    alertUuid: string;
    alertName: string | null;
    onClose: () => void;
}

/**
 * Format an IST datetime label for a trigger timestamp. Falls back to a
 * dash on invalid / missing input so the column never renders
 * "Invalid Date".
 */
function formatTriggerTs(ts: string | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

/**
 * Best-effort rendering of a trigger's `meta` payload. Kite's shape
 * varies by alert type (price alerts carry an `lhs_value` number;
 * OI/spread alerts carry different keys). We JSON-stringify as a
 * fallback so the overseer sees SOMETHING rather than an opaque
 * "[object Object]".
 */
function formatMeta(meta: unknown): string {
    if (meta === null || meta === undefined) return "—";
    if (typeof meta === "number" || typeof meta === "string") return String(meta);
    if (typeof meta === "object") {
        try {
            const obj = meta as Record<string, unknown>;
            // Common shape: {lhs_value: number}
            const lhs = obj.lhs_value ?? obj.value ?? obj.last_price;
            if (typeof lhs === "number") return String(lhs);
            return JSON.stringify(meta);
        } catch {
            return "—";
        }
    }
    return String(meta);
}

const AlertHistoryModal: React.FC<AlertHistoryModalProps> = ({
    open,
    alertUuid,
    alertName,
    onClose,
}) => {
    const panelRef = useRef<HTMLDivElement>(null);
    const closeBtnRef = useRef<HTMLButtonElement>(null);

    const [history, setHistory] = useState<KiteAlertHistoryEntry[] | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [failed, setFailed] = useState<boolean>(false);

    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
        firstFocusableRef: closeBtnRef as React.RefObject<HTMLElement>,
    });

    // Esc-to-close — the useModalA11y contract leaves this to the
    // caller because different dialogs want different Esc semantics.
    // Here Esc = cancel/close (standard non-destructive dismiss).
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    // Fetch on open. Local state (NOT KiteContext) because this is a
    // per-uuid drill-down — scoped to the modal's lifetime, not shared
    // across the app. Fresh on every open per bead rule "No cache —
    // drill-down view wants fresh data".
    useEffect(() => {
        if (!open) return;
        let cancelled = false;
        setLoading(true);
        setFailed(false);
        setHistory(null);
        fetchKiteAlertHistory(alertUuid)
            .then((res) => {
                if (cancelled) return;
                const list = Array.isArray(res?.history) ? res.history : [];
                setHistory(list);
                setLoading(false);
            })
            .catch(() => {
                if (cancelled) return;
                setFailed(true);
                setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [open, alertUuid]);

    const onBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
        // Only close when the click target is the backdrop itself, not
        // a bubbled click from inside the panel.
        if (e.target === e.currentTarget) onClose();
    }, [onClose]);

    if (!open) return null;

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
                aria-labelledby="ak166j-alert-history-title"
                className={style.modalPanel}
            >
                <div className={style.modalHeader}>
                    <div>
                        <div className={style.modalKicker}>Alert history</div>
                        <h4 id="ak166j-alert-history-title" className={style.modalTitle}>
                            {alertName ?? alertUuid}
                        </h4>
                    </div>
                    <button
                        ref={closeBtnRef}
                        type="button"
                        onClick={onClose}
                        className={`btn btn-icon ${style.modalCloseBtn}`}
                        aria-label="Close alert history"
                    >
                        <i className="ph ph-x" aria-hidden="true"/>
                    </button>
                </div>

                <div className={style.modalBody}>
                    {loading ? (
                        <div className={style.empty}>Loading history…</div>
                    ) : failed ? (
                        <div className={style.empty}>
                            Could not fetch history — close and retry.
                        </div>
                    ) : !history || history.length === 0 ? (
                        <div className={style.empty}>No triggers recorded for this alert yet.</div>
                    ) : (
                        <div className={style.tableWrap}>
                            <table className={style.table}>
                                <thead>
                                    <tr>
                                        <th>Triggered at</th>
                                        <th>LHS value</th>
                                        <th>Order outcome</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {history.map((entry, i) => {
                                        const key = typeof entry.triggered_at === "string"
                                            ? `${entry.triggered_at}-${i}`
                                            : `entry-${i}`;
                                        const meta = formatMeta(entry.meta);
                                        const order = entry.order_result
                                            ? (typeof entry.order_result === "object"
                                                ? JSON.stringify(entry.order_result)
                                                : String(entry.order_result))
                                            : "—";
                                        return (
                                            <tr key={key}>
                                                <td>{formatTriggerTs(entry.triggered_at)}</td>
                                                <td>{meta}</td>
                                                <td className={style.orderCell}>{order}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AlertHistoryModal;
