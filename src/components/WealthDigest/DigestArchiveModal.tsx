import React, {useEffect, useState} from "react";
import {
    WealthDigest,
    WealthDigestError,
    fetchDigestByDate,
} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface DigestArchiveModalProps {
    open: boolean;
    onClose: () => void;
    onSelectDigest: (digest: WealthDigest) => void;
}

const HISTORY_DAYS = 30;

function buildDateOptions(): string[] {
    const out: string[] = [];
    const today = new Date();
    for (let i = 0; i < HISTORY_DAYS; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        out.push(d.toISOString().slice(0, 10));
    }
    return out;
}

/**
 * FE-6 (ak-jhy8) Nocturne-skinned digest archive modal. MUI Dialog/List/
 * TextField/Button dropped; Nocturne backdrop + panel (same shape as
 * DepositsComponent / RatesModal from FE-5) with Esc + click-outside.
 */
const DigestArchiveModal: React.FC<DigestArchiveModalProps> = ({
    open,
    onClose,
    onSelectDigest,
}) => {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [notFound, setNotFound] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [dateOptions, setDateOptions] = useState<string[]>([]);

    useEffect(() => {
        if (open) {
            setDateOptions(buildDateOptions());
            setSelectedDate(null);
            setNotFound(null);
            setError(null);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [open, onClose]);

    const handleSelect = async (date: string) => {
        setSelectedDate(date);
        setLoading(true);
        setNotFound(null);
        setError(null);
        try {
            const digest = await fetchDigestByDate(date);
            onSelectDigest(digest);
            onClose();
        } catch (err) {
            if (err instanceof WealthDigestError && err.code === "not_found") {
                setNotFound(date);
            } else {
                setError(err instanceof Error ? err.message : "Failed to load that digest");
            }
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className={style.archiveBackdrop} onMouseDown={onClose} role="presentation">
            <div
                className={style.archivePanel}
                role="dialog"
                aria-modal="true"
                aria-label="Past digests"
                onMouseDown={(e) => e.stopPropagation()}
            >
                <div className={style.archiveHeader}>
                    <span className={style.archiveTitle}>Past digests</span>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`btn btn-icon ${style.archiveCloseBtn}`}
                        aria-label="Close"
                    >
                        <i className="ph ph-x"/>
                    </button>
                </div>
                <div className={style.archiveDialogContent}>
                    <p className={style.archiveHint}>
                        Pick a date from the past {HISTORY_DAYS} days. Not every day will have a
                        digest — some days the task doesn't run.
                    </p>

                    <label className={style.archiveDateInputLabel}>
                        <span>Jump to date</span>
                        <input
                            type="date"
                            value={selectedDate ?? ""}
                            onChange={(e) => setSelectedDate(e.target.value || null)}
                            onBlur={() => {
                                if (selectedDate) void handleSelect(selectedDate);
                            }}
                            className={style.archiveDateInput}
                        />
                    </label>

                    <ul className={style.archiveList}>
                        {dateOptions.map((d) => (
                            <li key={d}>
                                <button
                                    type="button"
                                    onClick={() => handleSelect(d)}
                                    disabled={loading}
                                    className={`${style.archiveListItem} ${selectedDate === d ? style.archiveListItemActive : ""}`}
                                >
                                    {d}
                                </button>
                            </li>
                        ))}
                    </ul>

                    {notFound && (
                        <div className={style.archiveNotice}>
                            No digest for {notFound}. Try another date.
                        </div>
                    )}
                    {error && (
                        <div className={`${style.archiveNotice} ${style.archiveNoticeError}`}>
                            {error}
                        </div>
                    )}
                </div>
                <div className={style.archiveFooter}>
                    <button
                        type="button"
                        onClick={onClose}
                        className={`btn btn-secondary ${style.archiveCancelBtn}`}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DigestArchiveModal;
