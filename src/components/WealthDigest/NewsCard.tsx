import React from "react";
import { Box, Chip, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";
import BasicCard from "../BasicCard";
import { DigestNewsItem } from "../../services/wealthDigestService";
import style from "./WealthDigest.module.scss";

interface NewsCardProps {
  item: DigestNewsItem;
}

// Recognized MSN route keys — used to decide whether a related_holdings chip
// should navigate to /investments/{key} or just render as a static tag.
const CATEGORY_ROUTES = new Set([
  "stocks",
  "mf",
  "nps",
  "epf",
  "ppf",
  "gold",
]);

/**
 * Compact news/context card — headline + optional detail + related-holdings
 * chips. Chips that name a known asset-category route become clickable
 * navigation targets; anything else stays as a passive tag.
 */
const NewsCard: React.FC<NewsCardProps> = ({ item }) => {
  const navigate = useNavigate();

  const handleChipClick = (holding: string) => {
    if (CATEGORY_ROUTES.has(holding)) {
      navigate(`/investments/${holding}`);
    }
  };

  return (
    <BasicCard className={style.newsCard}>
      <Box className={style.newsCardBody}>
        <Box className={style.newsCardHeader}>
          <Typography className={style.newsHeadline} component="div">
            {item.headline}
          </Typography>
          {item.timestamp && (
            <Typography className={style.newsTimestamp} component="span">
              {item.timestamp}
            </Typography>
          )}
        </Box>
        {item.detail && (
          <Typography className={style.newsDetail} component="div">
            {item.detail}
          </Typography>
        )}
        {item.related_holdings && item.related_holdings.length > 0 && (
          <Box className={style.newsChipsRow}>
            {item.related_holdings.map((h) => {
              const clickable = CATEGORY_ROUTES.has(h);
              return (
                <Chip
                  key={h}
                  label={h.toUpperCase()}
                  size="small"
                  className={`${style.newsChip} ${clickable ? style.newsChipClickable : ""}`}
                  onClick={clickable ? () => handleChipClick(h) : undefined}
                />
              );
            })}
          </Box>
        )}
      </Box>
    </BasicCard>
  );
};

export default NewsCard;
