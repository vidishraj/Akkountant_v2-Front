import React from "react";
import {useNavigate} from "react-router-dom";
import {DigestWatchItem} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface WatchItemCardProps {
    item: DigestWatchItem;
    onAsk?: () => void;
}

const SEVERITY_META: Record<
    DigestWatchItem["severity"],
    {icon: string; label: string; toneClass: string}
> = {
    info: {icon: "ph-info", label: "Info", toneClass: "watchTone_info"},
    warning: {icon: "ph-warning", label: "Warning", toneClass: "watchTone_warning"},
    critical: {icon: "ph-warning-octagon", label: "Critical", toneClass: "watchTone_critical"},
};

/**
 * ak-x1i5: design "Watch" card — outlined row, severity-coloured filled icon
 * and uppercase severity label, detail, then "Ask about this" (plus
 * "Investigate" when the digest names an asset to open).
 */
const WatchItemCard: React.FC<WatchItemCardProps> = ({item, onAsk}) => {
    const navigate = useNavigate();
    const meta = SEVERITY_META[item.severity] ?? SEVERITY_META.info;
    const tone = style[meta.toneClass as "watchTone_info"];

    return (
        <div role="note" className={style.watchCard}>
            <i className={`ph-fill ${meta.icon} ${style.watchIcon} ${tone}`} aria-hidden/>
            <div className={style.watchBody}>
                <div className={style.insightCardHeader}>
                    <span className={style.insightCardTitle}>{item.title}</span>
                    <span className={`${style.watchSeverity} ${tone}`}>{meta.label}</span>
                </div>
                {item.detail && <p className={style.insightCardDetail}>{item.detail}</p>}
                <div className={style.watchActions}>
                    {onAsk && (
                        <button
                            type="button"
                            className={`btn btn-ghost ${style.askLink}`}
                            onClick={onAsk}
                        >
                            Ask about this
                        </button>
                    )}
                    {item.investigate_target && (
                        <button
                            type="button"
                            className={`btn btn-ghost ${style.askLink}`}
                            onClick={() => navigate(`/investments/${item.investigate_target}`)}
                        >
                            Investigate {item.investigate_target.toUpperCase()}
                            <i className="ph ph-arrow-right" aria-hidden/>
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default WatchItemCard;
