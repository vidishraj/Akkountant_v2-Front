import React, {useEffect, useMemo, useState} from "react";
import {
    PortfolioTrendPoint,
    fetchPortfolioTrend,
} from "../../services/wealthDigestService";
import {formatCompact} from "./formatters";
import style from "./WealthDigest.module.scss";

interface PortfolioTrendChartProps {
    days?: number;
}

/**
 * FE-6 (ak-jhy8) Nocturne-native portfolio-value trend chart.
 *
 * Data source: `/investment-snapshot/history` endpoint (ak-4o41); per-point
 * wire field is `total_value` (ak-uqjz — authoritative, normalized in
 * `wealthDigestNormalizers.ts`).
 *
 * ** §23 rule #8 — constant-composition semantics enforced here. **
 * Pre-FE-6 used `recharts <Line type="monotone">` which interpolates linearly
 * across missing days — this FABRICATED movement whenever BE omitted a date
 * (phantom-dip). The FE-6 rewrite swaps to a hand-drawn SVG that segments
 * the line at calendar gaps > 1 day, drawing dashed-connector strokes
 * across gap spans. Known points stay as a solid line; omitted-day spans
 * read as "acknowledged omissions" rather than "straight line through
 * nothing." Mirrors the same `buildTrendPaths` discipline landed on
 * InvestmentsLanding (ak-ff9r).
 *
 * BasicCard / MUI Box+Typography dropped — Nocturne-token-driven divs only.
 */

const CHART_W = 600;
const CHART_H = 200;
const CHART_PAD_TOP = 12;
const CHART_PAD_BOT = 22;

interface TrendPaths {
    line: string;
    area: string;
    gaps: string;
    startLabel: string;
    endLabel: string;
    yAxis: {position: number; label: string}[];
}

/**
 * Build SVG paths from the trend series. Same gap-aware segmentation
 * discipline as ak-ff9r's InvestmentsLanding.
 *
 * Returns null when fewer than 2 points → caller renders placeholder.
 */
function buildTrendPaths(points: PortfolioTrendPoint[]): TrendPaths | null {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const spread = mx - mn || 1;
    const stepX = CHART_W / (points.length - 1);
    const innerH = CHART_H - CHART_PAD_TOP - CHART_PAD_BOT;

    const coords = points.map((p, i) => {
        const x = (i * stepX).toFixed(1);
        const y = (CHART_PAD_TOP + innerH - ((p.value - mn) / spread) * innerH).toFixed(1);
        return {x, y, date: p.date};
    });

    // Segment at calendar gaps > 1 day — gap spans render as dashed connectors.
    const lineSegments: string[] = [];
    const gapSegments: string[] = [];
    let curSeg: {x: string; y: string}[] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const dayGap = Math.round(
            (Date.parse(cur.date) - Date.parse(prev.date)) / 86_400_000,
        );
        if (dayGap > 1) {
            if (curSeg.length > 1) {
                lineSegments.push("M" + curSeg.map((c) => `${c.x},${c.y}`).join("L"));
            }
            gapSegments.push(`M${prev.x},${prev.y}L${cur.x},${cur.y}`);
            curSeg = [cur];
        } else {
            curSeg.push(cur);
        }
    }
    if (curSeg.length > 1) {
        lineSegments.push("M" + curSeg.map((c) => `${c.x},${c.y}`).join("L"));
    }

    const line = lineSegments.join(" ");
    const first = coords[0];
    const last = coords[coords.length - 1];
    const area = `M${first.x},${CHART_H - CHART_PAD_BOT}L${coords.map((c) => `${c.x},${c.y}`).join("L")}L${last.x},${CHART_H - CHART_PAD_BOT}Z`;
    const gaps = gapSegments.join(" ");

    const dateFmt = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
    });

    // Y-axis: 3 ticks at min/mid/max.
    const yTicks = [0, 0.5, 1].map((t) => {
        const value = mn + spread * t;
        const position = CHART_PAD_TOP + innerH * (1 - t);
        return {position, label: `₹${formatCompact(value)}`};
    });

    return {
        line,
        area,
        gaps,
        startLabel: dateFmt.format(new Date(points[0].date)),
        endLabel: dateFmt.format(new Date(points[points.length - 1].date)),
        yAxis: yTicks,
    };
}

const PortfolioTrendChart: React.FC<PortfolioTrendChartProps> = ({days = 90}) => {
    const [points, setPoints] = useState<PortfolioTrendPoint[] | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        fetchPortfolioTrend(days)
            .then((p) => {
                if (!cancelled) setPoints(p);
            })
            .catch(() => {
                if (!cancelled) setPoints([]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [days]);

    const paths = useMemo(() => (points ? buildTrendPaths(points) : null), [points]);

    return (
        <div className={style.widgetCard}>
            <div className={style.widgetHeader}>
                <h3 className={style.widgetTitle}>Portfolio value</h3>
                <span className={style.widgetSubtitle}>Last {days} days</span>
            </div>
            <div className={style.widgetBody}>
                {loading ? (
                    <div className={style.widgetPlaceholder}>Loading…</div>
                ) : !paths ? (
                    <div className={style.widgetPlaceholder}>
                        Trend data not yet available.
                        <br/>
                        <span className={style.widgetPlaceholderHint}>
                            (daily snapshots accumulate as the scheduler runs)
                        </span>
                    </div>
                ) : (
                    <>
                        <svg
                            viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                            preserveAspectRatio="none"
                            className={style.trendSvg}
                            role="img"
                            aria-label="Portfolio value trend"
                        >
                            <defs>
                                <linearGradient id="fejhy8-tg" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.28"/>
                                    <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0"/>
                                </linearGradient>
                            </defs>
                            {/* Horizontal gridlines at each y-axis tick */}
                            {paths.yAxis.map((tick, i) => (
                                <line
                                    key={`grid-${i}`}
                                    x1="0"
                                    x2={CHART_W}
                                    y1={tick.position}
                                    y2={tick.position}
                                    stroke="var(--color-divider)"
                                    strokeWidth="1"
                                    vectorEffect="non-scaling-stroke"
                                />
                            ))}
                            <path d={paths.area} fill="url(#fejhy8-tg)"/>
                            {paths.gaps && (
                                <path
                                    d={paths.gaps}
                                    stroke="var(--color-neutral-600)"
                                    strokeWidth="1.25"
                                    strokeDasharray="2 3"
                                    vectorEffect="non-scaling-stroke"
                                    fill="none"
                                />
                            )}
                            <path
                                d={paths.line}
                                fill="none"
                                stroke="var(--color-accent)"
                                strokeWidth="1.75"
                                vectorEffect="non-scaling-stroke"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        </svg>
                        <div className={style.trendFooter}>
                            <span>{paths.startLabel}</span>
                            <span className={style.trendFooterCenter}>
                                Dashed breaks = omitted days (incomplete prices), never filled in
                            </span>
                            <span>{paths.endLabel}</span>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default PortfolioTrendChart;
