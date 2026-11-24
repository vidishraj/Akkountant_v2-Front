import React from "react";
import {useNavigate} from "react-router-dom";
import {DigestNewsItem} from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface NewsCardProps {
    item: DigestNewsItem;
}

const CATEGORY_ROUTES = new Set(["stocks", "mf", "nps", "epf", "ppf", "gold"]);

/**
 * ak-x1i5: design "Know" card — translucent surface, headline, one-to-two
 * line detail, related-holding tags (asset categories navigate), timestamp
 * on the right when the BE provides one.
 */
const NewsCard: React.FC<NewsCardProps> = ({item}) => {
    const navigate = useNavigate();
    const holdings = item.related_holdings ?? [];

    return (
        <div className={style.newsCard}>
            <span className={style.insightCardTitle}>{item.headline}</span>
            {item.detail && <p className={style.insightCardDetail}>{item.detail}</p>}
            {(holdings.length > 0 || item.timestamp) && (
                <div className={style.newsChipsRow}>
                    {holdings.map((h) => {
                        const clickable = CATEGORY_ROUTES.has(h);
                        return (
                            <button
                                key={h}
                                type="button"
                                disabled={!clickable}
                                onClick={clickable ? () => navigate(`/investments/${h}`) : undefined}
                                className={`tag tag-neutral ${style.newsChip} ${clickable ? style.newsChipClickable : ""}`}
                            >
                                {h.toUpperCase()}
                            </button>
                        );
                    })}
                    <span className={style.metaSpacer}/>
                    {item.timestamp && (
                        <span className={style.newsTimestamp}>{item.timestamp}</span>
                    )}
                </div>
            )}
        </div>
    );
};

export default NewsCard;
