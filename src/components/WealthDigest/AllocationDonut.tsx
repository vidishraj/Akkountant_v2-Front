import React from "react";
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
 * FE-6 (ak-jhy8) Nocturne-native allocation donut. Replaces the pre-FE-6
 * recharts PieChart with a hand-drawn SVG that uses Nocturne ramp tokens
 * (matching FE-3's `ASSET_COLOR` map on InvestmentsLanding), so both
 * surfaces stay color-coordinated. BasicCard / MUI Box+Typography dropped
 * — plain divs with Nocturne tokens.
 */
const ASSET_COLOR: Record<string, string> = {
    stocks: "var(--color-accent-500)",
    mf: "var(--color-accent-700)",
    nps: "var(--color-accent-300)",
    epf: "var(--color-neutral-400)",
    ppf: "var(--color-neutral-600)",
    gold: "var(--color-accent-2-500)",
};

const SIZE = 180;
const R_OUTER = 78;
const R_INNER = 50;
const PAD_ANGLE_RAD = (2 * Math.PI) / 360; // 1°

/**
 * Build a donut-slice SVG path (sector between innerR and outerR from
 * startAngle to endAngle, radians measured clockwise from -π/2).
 */
function arcPath(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
    const toXY = (r: number, a: number) => ({
        x: cx + r * Math.cos(a),
        y: cy + r * Math.sin(a),
    });
    const large = a1 - a0 > Math.PI ? 1 : 0;
    const p0 = toXY(r1, a0);
    const p1 = toXY(r1, a1);
    const p2 = toXY(r0, a1);
    const p3 = toXY(r0, a0);
    return [
        `M${p0.x.toFixed(2)},${p0.y.toFixed(2)}`,
        `A${r1},${r1} 0 ${large} 1 ${p1.x.toFixed(2)},${p1.y.toFixed(2)}`,
        `L${p2.x.toFixed(2)},${p2.y.toFixed(2)}`,
        `A${r0},${r0} 0 ${large} 0 ${p3.x.toFixed(2)},${p3.y.toFixed(2)}`,
        "Z",
    ].join(" ");
}

const AllocationDonut: React.FC<AllocationDonutProps> = ({slices, totalCurrentValue}) => {
    const hasData = slices.length > 0 && totalCurrentValue > 0;
    const total = slices.reduce((s, x) => s + x.value, 0);

    const cx = SIZE / 2;
    const cy = SIZE / 2;

    // Compute arc segments. Angles start at -π/2 (12 o'clock) and advance
    // clockwise. Each slice gets a PAD_ANGLE gap taken from its own share so
    // the total still sums to 2π.
    const startAngle = -Math.PI / 2;
    let cursor = startAngle;
    const arcs = slices.map((s) => {
        const sweep = total > 0 ? (s.value / total) * 2 * Math.PI : 0;
        const padded = Math.max(0, sweep - PAD_ANGLE_RAD);
        const a0 = cursor;
        const a1 = cursor + padded;
        cursor += sweep;
        return {
            slice: s,
            d: arcPath(cx, cy, R_INNER, R_OUTER, a0, a1),
            color: ASSET_COLOR[s.key] || "var(--color-neutral-500)",
        };
    });

    return (
        <div className={style.widgetCard}>
            <div className={style.widgetHeader}>
                <h3 className={style.widgetTitle}>Allocation</h3>
                <span className={style.widgetSubtitle}>By asset type</span>
            </div>
            <div className={style.widgetBody}>
                {!hasData ? (
                    <div className={style.widgetPlaceholder}>
                        Load some holdings on the Investments page to see allocation.
                    </div>
                ) : (
                    <>
                        <svg
                            viewBox={`0 0 ${SIZE} ${SIZE}`}
                            width="100%"
                            height={SIZE}
                            role="img"
                            aria-label="Allocation donut"
                        >
                            {arcs.map(({slice, d, color}) => (
                                <path
                                    key={slice.key}
                                    d={d}
                                    fill={color}
                                    aria-label={`${slice.label} ${slice.pct.toFixed(1)}%`}
                                >
                                    <title>
                                        {slice.label}: ₹{formatCompact(slice.value)} · {slice.pct.toFixed(1)}%
                                    </title>
                                </path>
                            ))}
                        </svg>
                        <div className={style.donutLegend}>
                            {slices.map((s) => (
                                <div key={s.key} className={style.donutLegendRow}>
                                    <span
                                        className={style.donutLegendSwatch}
                                        style={{background: ASSET_COLOR[s.key] || "var(--color-neutral-500)"}}
                                        aria-hidden
                                    />
                                    <span className={style.donutLegendLabel}>{s.label}</span>
                                    <span className={style.donutLegendValue}>{s.pct.toFixed(1)}%</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default AllocationDonut;
