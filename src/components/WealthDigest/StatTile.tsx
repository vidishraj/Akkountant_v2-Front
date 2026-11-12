import React from "react";
import style from "./WealthDigest.module.scss";

/**
 * FE-6 (ak-jhy8) Nocturne-skin pass over the KPI tile. Preserves the same
 * `.tile*` class contract so WealthDigest.module.scss stays the source of
 * truth for sizing / hero elevation.
 */
export type DeltaPolarity = "positive" | "negative" | "neutral";

interface StatTileProps {
    label: string;
    value: string;
    valueTooltip?: string;
    subtitle?: string;
    delta?: {
        text: string;
        polarity: DeltaPolarity;
    };
    hero?: boolean;
    onClick?: () => void;
    ariaLabel?: string;
}

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

    return (
        <div
            className={`${style.tile} ${clickable ? style.tileClickable : ""} ${hero ? style.tileHero : ""}`}
            onClick={onClick}
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
            <div className={style.tileInner}>
                <div className={style.tileLabel}>{label}</div>
                <div
                    className={hero ? style.tileValueHero : style.tileValue}
                    title={valueTooltip}
                >
                    {value}
                </div>
                {subtitle && <div className={style.tileSubtitle}>{subtitle}</div>}
                {delta && (
                    <div
                        className={`${style.tileDelta} ${
                            style["tileDelta_" + delta.polarity as "tileDelta_positive"]
                        }`}
                    >
                        {delta.polarity === "positive" && (
                            <i className="ph ph-caret-up" aria-hidden/>
                        )}
                        {delta.polarity === "negative" && (
                            <i className="ph ph-caret-down" aria-hidden/>
                        )}
                        <span>{delta.text}</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StatTile;
