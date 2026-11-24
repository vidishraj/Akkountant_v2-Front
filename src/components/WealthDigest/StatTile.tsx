import React from "react";
import style from "./WealthDigest.module.scss";

/**
 * ak-x1i5: KPI tile per the design — small label, one value (tone-coloured
 * only when it carries an up/down signal), one muted sub-line. The hero
 * variant (Total) spans two columns with the accent gradient surface.
 */
export type ValueTone = "positive" | "negative" | "muted";

interface StatTileProps {
    label: string;
    value: string;
    valueTone?: ValueTone;
    /** Native tooltip on the whole tile (exact figures behind the compact face). */
    title?: string;
    sub?: React.ReactNode;
    hero?: boolean;
    onClick?: () => void;
    ariaLabel?: string;
}

const StatTile: React.FC<StatTileProps> = ({
    label,
    value,
    valueTone,
    title,
    sub,
    hero = false,
    onClick,
    ariaLabel,
}) => {
    const toneClass = valueTone
        ? style[("tileValue_" + valueTone) as "tileValue_positive"]
        : "";
    const content = (
        <>
            <span className={style.tileLabel}>{label}</span>
            <span className={`${hero ? style.tileValueHero : style.tileValue} ${toneClass}`}>
                {value}
            </span>
            {sub && <span className={style.tileSubtitle}>{sub}</span>}
        </>
    );
    const cls = `${style.tile} ${hero ? style.tileHero : ""} ${onClick ? style.tileClickable : ""}`;
    if (onClick) {
        return (
            <button
                type="button"
                className={cls}
                onClick={onClick}
                title={title}
                aria-label={ariaLabel ?? `${label}: ${value}`}
            >
                {content}
            </button>
        );
    }
    return (
        <div className={cls} title={title}>
            {content}
        </div>
    );
};

export default StatTile;
