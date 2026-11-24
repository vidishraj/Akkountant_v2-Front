import React from "react";
import {formatDigestDateLabel} from "./formatters";
import style from "./WealthDigest.module.scss";

interface DigestHeaderProps {
    date: string | null;
    generatedAt?: string | null;
    onOpenHistory: () => void;
    viewingPast?: boolean;
    onBackToToday?: () => void;
}

function formatSnapshotLabel(iso: string): string {
    try {
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "";
        return d.toLocaleString(undefined, {
            hour: "2-digit",
            minute: "2-digit",
        });
    } catch {
        return "";
    }
}

/**
 * ak-x1i5: design header — accent eyebrow + large date heading, snapshot meta,
 * then (right) the disclosure line and a History button.
 */
const DigestHeader: React.FC<DigestHeaderProps> = ({
    date,
    generatedAt,
    onOpenHistory,
    viewingPast = false,
    onBackToToday,
}) => {
    const snapshotLabel = generatedAt ? formatSnapshotLabel(generatedAt) : "";
    const meta = viewingPast
        ? "Archived digest"
        : snapshotLabel
            ? `Snapshot as of ${snapshotLabel}`
            : "";
    return (
        <div className={style.headerRow}>
            <div className={style.headerLeft}>
                <span className={style.headerEyebrow}>Wealth Digest</span>
                <h1 className={style.headerTitle}>
                    {date ? formatDigestDateLabel(date) : "Wealth Digest"}
                </h1>
            </div>
            {meta && <span className={style.headerSnapshot}>{meta}</span>}
            {viewingPast && onBackToToday && (
                <button
                    type="button"
                    className={`btn btn-ghost ${style.backToTodayBtn}`}
                    onClick={onBackToToday}
                >
                    <i className="ph ph-arrow-left"/>
                    <span>Back to today</span>
                </button>
            )}
            <span className={style.headerSpacer}/>
            <span className={style.disclosureChip}>
                Personal use — not investment advice
            </span>
            <button
                type="button"
                className={`btn btn-secondary ${style.historyBtn}`}
                onClick={onOpenHistory}
            >
                <i className="ph ph-clock-counter-clockwise"/>
                <span>History</span>
            </button>
        </div>
    );
};

export default DigestHeader;
