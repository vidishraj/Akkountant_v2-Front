import React from "react";
import { Box, Tooltip, Typography } from "@mui/material";
import ArrowDropUpIcon from "@mui/icons-material/ArrowDropUp";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import BasicCard from "../BasicCard";
import style from "./WealthDigest.module.scss";

/**
 * Semantic delta polarity — separated from the sign of the number because "up
 * is not always good" (cash % rising isn't necessarily a positive; the caller
 * gets to say so). Passing `neutral` opts out of the up/down coloring entirely
 * and lands the delta in the muted text token.
 */
export type DeltaPolarity = "positive" | "negative" | "neutral";

interface StatTileProps {
  /** Uppercase eyebrow label — sentence case, no trailing colon. */
  label: string;
  /** The prominent number/text. Formatting is caller's responsibility. */
  value: string;
  /** Optional full-precision text shown in a hover tooltip on the value. */
  valueTooltip?: string;
  /** Optional secondary line under the value — asset name, "vs yesterday", etc. */
  subtitle?: string;
  /** Optional delta indicator drawn below the value with an up/down arrow. */
  delta?: {
    text: string;              // "+0.68%" or "−₹2,140"
    polarity: DeltaPolarity;
  };
  /** Elevates the tile to hero size — one per KPI row (per dataviz guidance). */
  hero?: boolean;
  /** Click handler; when present, the tile renders as an interactive card. */
  onClick?: () => void;
  /** Aria label for click affordance — falls back to `${label}: ${value}`. */
  ariaLabel?: string;
}

/**
 * A single KPI tile on the WealthDigest page — label + big number + optional
 * delta + optional subtitle. Wraps the existing BasicCard so it inherits the
 * app's card surface + border treatment; extends with hover state when
 * onClick is present.
 *
 * The delta text carries color (green/red) because it's carrying a semantic
 * up/down signal, not identity — one of the two dataviz-approved exceptions
 * to "text wears text tokens, never data color." The label, value, and
 * subtitle all stay in text tokens.
 */
const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  valueTooltip,
  subtitle,
  delta,
  hero = false,
  onClick,
  ariaLabel,
}) => {
  const clickable = typeof onClick === "function";

  const valueNode = (
    <Typography
      className={hero ? style.tileValueHero : style.tileValue}
      component="div"
      role="presentation"
    >
      {value}
    </Typography>
  );

  return (
    <BasicCard
      className={`${style.tile} ${clickable ? style.tileClickable : ""} ${
        hero ? style.tileHero : ""
      }`}
      onClick={onClick}
    >
      <Box
        className={style.tileInner}
        role={clickable ? "button" : undefined}
        aria-label={clickable ? ariaLabel ?? `${label}: ${value}` : undefined}
        tabIndex={clickable ? 0 : undefined}
        onKeyDown={(e) => {
          if (!clickable) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onClick?.();
          }
        }}
      >
        <Typography className={style.tileLabel} component="div">
          {label}
        </Typography>

        {valueTooltip ? (
          <Tooltip title={valueTooltip} arrow placement="top">
            {valueNode}
          </Tooltip>
        ) : (
          valueNode
        )}

        {subtitle && (
          <Typography className={style.tileSubtitle} component="div">
            {subtitle}
          </Typography>
        )}

        {delta && (
          <Box
            className={`${style.tileDelta} ${style["tileDelta_" + delta.polarity]}`}
          >
            {delta.polarity === "positive" && (
              <ArrowDropUpIcon fontSize="small" aria-hidden />
            )}
            {delta.polarity === "negative" && (
              <ArrowDropDownIcon fontSize="small" aria-hidden />
            )}
            <span>{delta.text}</span>
          </Box>
        )}
      </Box>
    </BasicCard>
  );
};

export default StatTile;
