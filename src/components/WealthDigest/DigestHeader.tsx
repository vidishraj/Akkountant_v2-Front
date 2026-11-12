import React from "react";
import style from "./WealthDigest.module.scss";

interface DigestHeaderProps {
    date: string | null;
    generatedAt?: string | null;
    onOpenHistory: () => void;
    viewingPast?: boolean;
    onBackToToday?: () => void;
}

const DAY_NAMES = [
    "Sunday", "Monday", "Tuesday", "Wednesday",
    "Thursday", "Friday", "Saturday",
];
const MONTH_NAMES = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * YYYY-MM-DD → "Wed, Aug 21" via UTC parts so the BE-sent IST calendar
 * date doesn't drift under a west-of-IST viewer's local tz.
 */
function formatDateLabel(iso: string): string {
    const [y, m, d] = iso.split("-").map(Number);
    if (!y || !m || !d) return iso;
    const date = new Date(Date.UTC(y, m - 1, d));
    return `${DAY_NAMES[date.getUTCDay()].slice(0, 3)}, ${MONTH_NAMES[m - 1]} ${d}`;
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
 * FE-6 (ak-jhy8) Nocturne-skinned WealthDigest header. MUI Chip/Button/
 * Typography dropped; plain divs/spans/buttons with Nocturne tokens.
 */
const DigestHeader: React.FC<DigestHeaderProps> = ({
    date,
    generatedAt,
    onOpenHistory,
    viewingPast = false,
    onBackToToday,
}) => {
    const snapshotLabel = generatedAt ? formatSnapshotLabel(generatedAt) : "";
    return (
        <div className={style.headerRow}>
            <div className={style.headerLeft}>
                <h1 className={style.headerTitle}>Wealth Digest</h1>
                {date && <div className={style.headerDate}>· {formatDateLabel(date)}</div>}
                {snapshotLabel && (
                    <div className={style.headerSnapshot}>· Snapshot as of {snapshotLabel}</div>
                )}
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
            </div>
            <div className={style.headerRight}>
                <button
                    type="button"
                    className={`btn btn-ghost ${style.historyBtn}`}
                    onClick={onOpenHistory}
                >
                    <i className="ph ph-clock-counter-clockwise"/>
                    <span>History</span>
                </button>
                <span className={style.disclosureChip}>
                    Personal use — not investment advice
                </span>
            </div>
        </div>
    );
};

export default DigestHeader;
