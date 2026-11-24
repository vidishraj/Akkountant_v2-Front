import React from "react";
import {useNavigate} from "react-router-dom";
import {formatCompact} from "./formatters";
import style from "./WealthDigest.module.scss";

interface AllocationSlice {
    key: string;
    label: string;
    value: number;
    pct: number;
}

interface AllocationDonutProps {
    slices: AllocationSlice[];
    totalCurrentValue: number;
}

/**
 * ak-x1i5: categorical allocation donut per the design — one hue per asset
 * type (CSS vars `--wd-cat-*` on the page root), ring drawn as dashed
 * circles, legend rows navigate to the asset. Slices are sorted largest
 * first so the ring and legend read in the same order.
 */
const CAT_VAR: Record<string, string> = {
    stocks: "var(--wd-cat-stocks)",
    mf: "var(--wd-cat-mf)",
    nps: "var(--wd-cat-nps)",
    ppf: "var(--wd-cat-ppf)",
    epf: "var(--wd-cat-epf)",
    gold: "var(--wd-cat-gold)",
};
const FALLBACK = "var(--color-neutral-500)";
const R = 15.915; // circumference ≈ 100 → dash units are percentages
const GAP = 0.6;

const AllocationDonut: React.FC<AllocationDonutProps> = ({slices, totalCurrentValue}) => {
    const navigate = useNavigate();
    const sorted = [...slices].sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, x) => s + x.value, 0);
    const hasData = sorted.length > 0 && totalCurrentValue > 0 && total > 0;

    let cum = 0;
    const rings = sorted.map((s) => {
        const p = (s.value / total) * 100;
        const g = sorted.length > 1 ? Math.max(p - GAP, 0.3) : p;
        const ring = {slice: s, dash: `${g} ${100 - g}`, off: String(-cum)};
        cum += p;
        return ring;
    });

    return (
        <div className={style.widgetCard}>
            <div className={style.widgetHeader}>
                <h3 className={style.widgetTitle}>Allocation</h3>
                <span className={style.widgetSubtitle}>by asset type</span>
            </div>
            {!hasData ? (
                <div className={style.widgetPlaceholder}>
                    Load some holdings on the Investments page to see allocation.
                </div>
            ) : (
                <>
                    <div className={style.donutRow}>
                        <svg
                            viewBox="0 0 42 42"
                            className={style.donutSvg}
                            role="img"
                            aria-label="Allocation by asset type"
                        >
                            {rings.map(({slice, dash, off}) => (
                                <circle
                                    key={slice.key}
                                    cx="21"
                                    cy="21"
                                    r={R}
                                    fill="none"
                                    stroke={CAT_VAR[slice.key] ?? FALLBACK}
                                    strokeWidth="5"
                                    strokeDasharray={dash}
                                    strokeDashoffset={off}
                                >
                                    <title>
                                        {slice.label}: ₹{formatCompact(slice.value)} · {slice.pct.toFixed(1)}%
                                    </title>
                                </circle>
                            ))}
                        </svg>
                        <div className={style.donutLegend}>
                            {sorted.map((s) => (
                                <button
                                    key={s.key}
                                    type="button"
                                    className={style.donutLegendRow}
                                    onClick={() => navigate(`/investments/${s.key}`)}
                                    title={`${s.label} · ₹${formatCompact(s.value)} · ${s.pct.toFixed(1)}%`}
                                >
                                    <span
                                        className={style.donutLegendSwatch}
                                        style={{background: CAT_VAR[s.key] ?? FALLBACK}}
                                        aria-hidden
                                    />
                                    <span className={style.donutLegendLabel}>{s.label}</span>
                                    <span className={style.donutLegendValue}>{s.pct.toFixed(1)}%</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <span className={style.widgetFootnote}>
                        Stocks, MF, NPS at current value · EPF, PPF, gold at net — same basis as Investments.
                    </span>
                </>
            )}
        </div>
    );
};

export default AllocationDonut;
