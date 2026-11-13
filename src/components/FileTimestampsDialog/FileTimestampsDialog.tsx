import {useCallback, useEffect, useRef, useState} from "react";
import {getFileTimeStamps} from "../../services/investmentService";
import {useMessage} from "../../contexts/MessageContext";
import useModalA11y from "../../hooks/useModalA11y";
import styles from "./FileTimestampsDialog.module.scss";

/**
 * ak-2n09 FE-1 settings restore. The pre-FE-1 right-side Settings
 * drawer surfaced "last file upload" timestamps (emailed bank-statement
 * ingestion markers) via `getFileTimeStamps()`. FE-1 (ak-1myo) dropped
 * the drawer and no replacement mount was ever wired, so this surface
 * was orphaned — the service existed but no UI consumed it.
 *
 * This dialog is the Nocturne-native wrapper. It fetches
 * `/fetchTimeStamps` on open, renders the `jobs` map as a tight
 * key/value list (bank → last-seen timestamp), and offers a refresh
 * action. No pagination — the result count is ~10 entries max (one
 * per configured bank).
 *
 * PII posture: filenames/bank-ids + ISO timestamps are not sensitive
 * per se; no raw email body / sender is surfaced here. No §4
 * reveal-on-explicit-action pattern needed.
 */

interface FileTimestampsDialogProps {
    open: boolean;
    onClose: () => void;
}

// JobsResponse.jobs is the {bank/key -> timestamp} map used by the BE
// `/fetchTimeStamps` endpoint. We render the Object.entries directly;
// alphabetical order for stability.
function sortEntries(jobs: Record<string, string>): [string, string][] {
    return Object.entries(jobs || {}).sort(([a], [b]) =>
        a.localeCompare(b),
    );
}

function formatTimestampDisplay(raw: string): string {
    if (!raw) return "—";
    const d = new Date(raw);
    if (!Number.isFinite(d.getTime())) return raw; // show raw if unparseable
    return d.toLocaleString("en-IN", {
        year: "numeric",
        month: "short",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    });
}

const FileTimestampsDialog = ({open, onClose}: FileTimestampsDialogProps) => {
    const {setPayload} = useMessage();
    const [loading, setLoading] = useState(false);
    const [timestamps, setTimestamps] = useState<Record<string, string>>({});

    const panelRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open,
        panelRef: panelRef as React.RefObject<HTMLElement>,
    });

    const load = useCallback(async (clearCache = false) => {
        try {
            setLoading(true);
            const data = await getFileTimeStamps(clearCache);
            setTimestamps(data.jobs || {});
        } catch {
            setPayload({
                type: "error",
                message: "Failed to load file timestamps",
            });
        } finally {
            setLoading(false);
        }
    }, [setPayload]);

    // Fetch on open; drop state on close so a next open shows a fresh
    // load spinner rather than stale data flashing in.
    useEffect(() => {
        if (open) {
            void load(false);
        } else {
            setTimestamps({});
        }
    }, [open, load]);

    // Esc-to-close — inline per useModalA11y's "caller defines Esc
    // policy" contract.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    if (!open) return null;

    const entries = sortEntries(timestamps);

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
                aria-label="File timestamps"
                tabIndex={-1}
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={styles.header}>
                    <span className={styles.title}>
                        <i className="ph ph-clock" aria-hidden/>
                        <span>File timestamps</span>
                    </span>
                    <button
                        type="button"
                        className={styles.refreshBtn}
                        onClick={() => void load(true)}
                        disabled={loading}
                        aria-label="Refresh timestamps"
                        title="Refresh"
                    >
                        <i className="ph ph-arrows-clockwise"/>
                    </button>
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
                    {loading && entries.length === 0 ? (
                        <div className={styles.emptyState}>
                            Loading timestamps…
                        </div>
                    ) : entries.length === 0 ? (
                        <div className={styles.emptyState}>
                            No ingestion timestamps on record yet.
                        </div>
                    ) : (
                        <div className={styles.table}>
                            <div className={styles.tableHead}>
                                <span>Source</span>
                                <span className={styles.alignRight}>
                                    Last ingested
                                </span>
                            </div>
                            {entries.map(([source, ts]) => (
                                <div key={source} className={styles.tableRow}>
                                    <span className={styles.source}>
                                        {source}
                                    </span>
                                    <span className={`${styles.alignRight} ${styles.timestamp}`}>
                                        {formatTimestampDisplay(ts)}
                                    </span>
                                </div>
                            ))}
                        </div>
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

export default FileTimestampsDialog;
