import React from "react";
import {useNavigate} from "react-router-dom";
import {DigestWatchItem} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface WatchItemCardProps {
    item: DigestWatchItem;
}

const SEVERITY_META: Record<DigestWatchItem["severity"], {icon: string; className: string}> = {
    info: {icon: "ph-info", className: "stateBanner_info"},
    warning: {icon: "ph-warning-circle", className: "stateBanner_warning"},
    critical: {icon: "ph-x-circle", className: "stateBanner_error"},
};

/**
 * FE-6 (ak-jhy8) Nocturne-skinned watch-item card. MUI Alert dropped; uses
 * the shared `.stateBanner` surface so watch items visually align with the
 * page's 5 state banners.
 */
const WatchItemCard: React.FC<WatchItemCardProps> = ({item}) => {
    const navigate = useNavigate();
    const meta = SEVERITY_META[item.severity];

    return (
        <div
            role="note"
            className={`${style.stateBanner} ${style[meta.className as "stateBanner_info"]} ${style.watchAlert}`}
        >
            <i className={`ph-fill ${meta.icon}`} aria-hidden/>
            <div className={style.stateBannerBody}>
                <div className={style.watchAlertTitle}>{item.title}</div>
                {item.detail && <div className={style.watchAlertBody}>{item.detail}</div>}
                {item.investigate_target && (
                    <span className={style.watchAlertTarget}>
                        Related: {item.investigate_target.toUpperCase()}
                    </span>
                )}
            </div>
            {item.investigate_target && (
                <button
                    type="button"
                    className={`btn btn-ghost ${style.watchInvestigateBtn}`}
                    onClick={() => navigate(`/investments/${item.investigate_target}`)}
                >
                    <span>Investigate</span>
                    <i className="ph ph-arrow-right"/>
                </button>
            )}
        </div>
    );
};

export default WatchItemCard;
