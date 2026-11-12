import React from "react";
import {useNavigate} from "react-router-dom";
import {DigestNewsItem} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface NewsCardProps {
    item: DigestNewsItem;
}

const CATEGORY_ROUTES = new Set(["stocks", "mf", "nps", "epf", "ppf", "gold"]);

/**
 * FE-6 (ak-jhy8) Nocturne-skinned news card. MUI Chip/Box/Typography dropped;
 * plain divs/spans; chips that name a known asset-category route become
 * clickable navigation targets.
 */
const NewsCard: React.FC<NewsCardProps> = ({item}) => {
    const navigate = useNavigate();
    const handleChipClick = (holding: string) => {
        if (CATEGORY_ROUTES.has(holding)) navigate(`/investments/${holding}`);
    };

    return (
        <div className={style.newsCard}>
            <div className={style.newsCardBody}>
                <div className={style.newsCardHeader}>
                    <div className={style.newsHeadline}>{item.headline}</div>
                    {item.timestamp && <span className={style.newsTimestamp}>{item.timestamp}</span>}
                </div>
                {item.detail && <div className={style.newsDetail}>{item.detail}</div>}
                {item.related_holdings && item.related_holdings.length > 0 && (
                    <div className={style.newsChipsRow}>
                        {item.related_holdings.map((h) => {
                            const clickable = CATEGORY_ROUTES.has(h);
                            return (
                                <button
                                    key={h}
                                    type="button"
                                    disabled={!clickable}
                                    onClick={clickable ? () => handleChipClick(h) : undefined}
                                    className={`${style.newsChip} ${clickable ? style.newsChipClickable : ""}`}
                                >
                                    {h.toUpperCase()}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default NewsCard;
