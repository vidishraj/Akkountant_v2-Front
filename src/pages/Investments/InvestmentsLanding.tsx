import {useCallback, useEffect, useMemo, useState} from "react";
import {useNavigate} from "react-router-dom";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useKite} from "../../contexts/KiteContext.tsx";
import {fetchPortfolioTrend, PortfolioTrendPoint} from "../../services/wealthDigestService.ts";
import {getKiteLoginUrl} from "../../services/investmentService.ts";
import {getRowDayChangeAmount} from "../../utils/holdings.ts";
import {formatCompact, formatCurrency} from "../../components/WealthDigest/formatters.ts";
import KiteMonitoring from "../../components/KiteMonitoring/KiteMonitoring.tsx";
import Watchlist from "../../components/Watchlist/Watchlist.tsx";
import type {KiteTrade, MSNListResponse} from "../../utils/interfaces.ts";
import style from "./InvestmentsLanding.module.scss";

/**
 * FE-3 (ak-ff9r) Investments landing. Replaces the pre-FE-3 stack of
 * InvestmentsLanding + GlobalSummary + MSNCard + GlobalInvestmentsCharts
 * with a single Nocturne-native page per
 * design/Akkountant Redesign.dc.html lines 67-217 (Investments screen).
 *
 * The parent `Investments.tsx` outlet still fetches every summary on mount
 * and mounts the AgentChat drawer; this page just reads from context + hits
 * `/investment-snapshot/history` for the trend. No new BE wires.
 *
 * Cross-cutting (§23) honored throughout:
 * - §2 accounting correctness: `derivePortfolio` sums BE-authoritative
 *   per-row `getRowDayChangeAmount` for day change (same discipline as
 *   ak-7mru's Home dashboard fix); never re-derives from summary fields.
 * - §3 day_change_known gate: Today line renders '—' when any MSN row has
 *   `day_change_known=false` or no holdings loaded. The gate is strict —
 *   one row of ambiguity poisons the aggregate.
 * - §6 INR formatting: shared formatCurrency / formatCompact; tabular-nums
 *   via SCSS; `₹` glyph as a literal.
 * - §7 IST dates: Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata'}).
 * - §8 constant-composition trend: fetchPortfolioTrend used as-is; gaps
 *   rendered as dashed strokes between known points (never interpolated).
 * - §9 `total_value` wire field: consumed via fetchPortfolioTrend which
 *   already normalizes shape (ak-uqjz `wealthDigestNormalizers.ts`).
 *
 * Deferred per bead text:
 * - Reconciliation count — BE not yet wired; dashed Sample chip per the
 *   FE scope's "stub with Sample chips" convention.
 *
 * ak-oc5s: Available-funds tile now consumes /kite/margins live
 * (ak-zai2 Bundle 2) via `kiteState.margins` — 4-state renderer
 * documented at the tile IIFE.
 */

// OKLCH triples from design — sanctioned per FE scope (gain/loss/warning).
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";

const MSN_SUMMARY_KEYS = ["stocks", "mf", "nps"] as const;
const EPG_SUMMARY_KEYS = ["epf", "ppf", "gold"] as const;

// Per-asset tokenized color hints — map to Nocturne accent-ramp steps so
// the allocation bar/legend stays inside the tonal system.
const ASSET_COLOR: Record<string, string> = {
    stocks: "var(--color-accent-500)",
    mf: "var(--color-accent-700)",
    nps: "var(--color-accent-300)",
    epf: "var(--color-neutral-400)",
    ppf: "var(--color-neutral-600)",
    gold: "var(--color-accent-2-500)",
};

const ASSET_LABEL: Record<string, string> = {
    stocks: "Stocks",
    mf: "Mutual Funds",
    nps: "NPS",
    epf: "EPF",
    ppf: "PPF",
    gold: "Gold",
};

// Chart ranges offered on the trend toggle — the fetch always goes to 90d
// then the client slices. Keeps the FE off a BE change for multi-range.
const RANGE_OPTS: {label: string; days: number}[] = [
    {label: "7D", days: 7},
    {label: "30D", days: 30},
    {label: "90D", days: 90},
];

/**
 * Hero aggregation. Keeps per-row day-change sourced from
 * `getRowDayChangeAmount` (same pattern as Home / ak-7mru CRITICAL fix).
 * profit = sum of lifetime P&L (changeAmount semantics on MSNSummary).
 */
function derivePortfolio(
    summaries: Record<string, unknown>,
    lists: Record<string, MSNListResponse[] | undefined>,
): {
    currentValue: number;
    invested: number;
    profit: number;
    profitPct: number;
    dayChange: number;
    dayChangeKnown: boolean;
} {
    let currentValue = 0;
    let invested = 0;
    let profit = 0;

    MSN_SUMMARY_KEYS.forEach((k) => {
        const s = summaries[k] as
            | {totalValue?: number; currentValue?: number; changeAmount?: number | string}
            | undefined;
        if (!s) return;
        const totalValue = Number(s.totalValue) || 0;
        if (totalValue === 0) return;
        invested += totalValue;
        currentValue += Number(s.currentValue) || 0;
        profit += Number(s.changeAmount) || 0;
    });

    EPG_SUMMARY_KEYS.forEach((k) => {
        const s = summaries[k] as
            | {net?: number | string; netProfit?: number | string; unAccountedProfit?: number | string}
            | undefined;
        if (!s) return;
        const net = Number(s.net) || 0;
        const netProfit = Number(s.netProfit) || 0;
        const unaccounted = Number(s.unAccountedProfit || 0);
        if (net === 0) return;
        if (k === "ppf") {
            invested += net - (netProfit - unaccounted);
            currentValue += net + unaccounted;
        } else {
            invested += net - netProfit;
            currentValue += net;
        }
        profit += netProfit;
    });

    let dayChange = 0;
    let anyMsnHoldings = false;
    let anyUnknown = false;
    MSN_SUMMARY_KEYS.forEach((k) => {
        const list = lists[k];
        if (!Array.isArray(list) || list.length === 0) return;
        list.forEach((row) => {
            anyMsnHoldings = true;
            const amt = getRowDayChangeAmount(row);
            if (amt === null) {
                anyUnknown = true;
                return;
            }
            dayChange += amt;
        });
    });
    const dayChangeKnown = anyMsnHoldings && !anyUnknown;
    if (!dayChangeKnown) dayChange = 0;

    const profitPct = invested !== 0 ? (profit / invested) * 100 : 0;
    return {currentValue, invested, profit, profitPct, dayChange, dayChangeKnown};
}

/**
 * Per-asset current value + invested + change. Used for the 6 asset cards.
 */
function deriveAssetCard(
    key: string,
    summaries: Record<string, unknown>,
): {currentValue: number; invested: number; change: number; changePct: number; count: number} {
    const isMsn = (MSN_SUMMARY_KEYS as readonly string[]).includes(key);
    const s = summaries[key] as
        | {totalValue?: number; currentValue?: number; changeAmount?: number | string; count?: number;
            net?: number | string; netProfit?: number | string; unAccountedProfit?: number | string;
            deposits?: unknown[]}
        | undefined;
    if (!s) return {currentValue: 0, invested: 0, change: 0, changePct: 0, count: 0};
    if (isMsn) {
        const totalValue = Number(s.totalValue) || 0;
        const currentValue = Number(s.currentValue) || 0;
        const change = Number(s.changeAmount) || 0;
        const count = Number(s.count) || 0;
        const changePct = totalValue !== 0 ? (change / totalValue) * 100 : 0;
        return {currentValue, invested: totalValue, change, changePct, count};
    }
    // EPG
    const net = Number(s.net) || 0;
    const netProfit = Number(s.netProfit) || 0;
    const unaccounted = Number(s.unAccountedProfit || 0);
    const count = Array.isArray(s.deposits) ? s.deposits.length : 0;
    let currentValue = net;
    let invested = net - netProfit;
    if (key === "ppf") {
        currentValue = net + unaccounted;
        invested = net - (netProfit - unaccounted);
    }
    const change = netProfit;
    const changePct = invested !== 0 ? (change / invested) * 100 : 0;
    return {currentValue, invested, change, changePct, count};
}

/**
 * SVG path pair for the trend chart — returns the line path AND an area
 * path (closed shape) to render the accent-tinted glow below the stroke.
 * Also returns a dashed-gaps path for the spans where the BE omitted
 * dates (constant-composition semantics — those days have no value and
 * MUST NOT be interpolated).
 *
 * Gap detection: if two adjacent emitted points span more than 1 calendar
 * day, the stretch between them is a gap. Rendered as a dashed line
 * connecting the endpoints so the chart reads as "known points, with
 * acknowledged omissions" rather than "straight line through nothing."
 */
function buildTrendPaths(points: PortfolioTrendPoint[], width = 600, height = 150): {
    line: string;
    area: string;
    gaps: string;
    startLabel: string;
    endLabel: string;
} | null {
    if (points.length < 2) return null;
    const values = points.map((p) => p.value);
    const mn = Math.min(...values);
    const mx = Math.max(...values);
    const spread = mx - mn || 1;
    const stepX = width / (points.length - 1);

    const coords = points.map((p, i) => {
        const x = (i * stepX).toFixed(1);
        const y = (height - 10 - ((p.value - mn) / spread) * (height - 20)).toFixed(1);
        return {x, y, date: p.date};
    });

    // Segment the line at calendar gaps > 1 day; the line path only draws
    // across contiguous segments; the gaps path draws dashed connectors.
    const lineSegments: string[] = [];
    const gapSegments: string[] = [];
    let curSeg: {x: string; y: string}[] = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const dayGap = Math.round((Date.parse(cur.date) - Date.parse(prev.date)) / 86400_000);
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
    const area = `M${first.x},${height}L${coords.map((c) => `${c.x},${c.y}`).join("L")}L${last.x},${height}Z`;
    const gaps = gapSegments.join(" ");
    const dateFmt = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "numeric",
        month: "short",
    });
    const startLabel = dateFmt.format(new Date(points[0].date));
    const endLabel = dateFmt.format(new Date(points[points.length - 1].date));
    return {line, area, gaps, startLabel, endLabel};
}

/**
 * ak-2k93: Format a Kite trade timestamp into an IST HH:MM label.
 * Kite SDK returns a mix of ISO strings / "YYYY-MM-DD HH:MM:SS" strings
 * on the trade rows; `Date()` parses both. Invalid / missing timestamps
 * fall back to '—' so the column never shows "Invalid Date".
 */
function formatTradeTime(ts: string | undefined): string {
    if (!ts) return "—";
    const d = new Date(ts);
    if (isNaN(d.getTime())) return "—";
    return new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(d);
}

/**
 * ak-2k93: Compute a trade's value defensively from BE fields. Quantity
 * can be missing (unusual but possible per interface drift); price uses
 * `price` with `average_price` as a Kite-SDK-alias fallback. Returns
 * `{qty, px, value}` with every field coerced to a finite number or 0.
 */
function readTradeNums(t: KiteTrade): {qty: number; px: number; value: number} {
    const qty = typeof t.quantity === "number" && Number.isFinite(t.quantity) ? t.quantity : 0;
    const rawPx = typeof t.price === "number" && Number.isFinite(t.price)
        ? t.price
        : (typeof t.average_price === "number" && Number.isFinite(t.average_price) ? t.average_price : 0);
    return {qty, px: rawPx, value: qty * rawPx};
}

const InvestmentsLanding = () => {
    const navigate = useNavigate();
    const {state, dispatch, globalInvestmentRefresh} = useMSNContext();
    const {state: kiteState, refreshTrades} = useKite();

    useEffect(() => {
        dispatch({type: "ResetCardSelector"});
    }, [dispatch]);

    // ak-2k93: Today's trades section — default collapsed; fetch is LAZY
    // (fires inside the expand handler, not on mount). Hidden entirely
    // when Kite isn't connected per bead spec ("If !kite.connected → hide
    // the section entirely (not a placeholder; nothing to show)").
    const [tradesExpanded, setTradesExpanded] = useState<boolean>(false);
    const handleToggleTrades = useCallback(() => {
        setTradesExpanded((prev) => {
            const next = !prev;
            // Fire the fetch on the OPEN edge only, and only once per
            // session (checked flag). Caller can explicitly refresh via a
            // dedicated button later; for now opening is the trigger.
            if (next && !kiteState.trades.checked && !kiteState.trades.loading) {
                void refreshTrades(false);
            }
            return next;
        });
    }, [kiteState.trades.checked, kiteState.trades.loading, refreshTrades]);

    const [rangeDays, setRangeDays] = useState<number>(90);
    const [trend, setTrend] = useState<PortfolioTrendPoint[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        // Always fetch the 90d window; client slices per range toggle. Keeps
        // us off a BE multi-range dependency the endpoint doesn't support.
        fetchPortfolioTrend(90)
            .then((pts) => {
                if (!cancelled) setTrend(pts);
            })
            .catch(() => {
                if (!cancelled) setTrend([]);
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const portfolio = useMemo(
        () => derivePortfolio(
            state.summaries as Record<string, unknown>,
            state.lists as Record<string, MSNListResponse[] | undefined>,
        ),
        [state.summaries, state.lists],
    );

    const trendSlice = useMemo(() => {
        const pts = trend || [];
        // ak-txsw: calendar-day cutoff rather than point-count slice.
        // Pre-ak-txsw: `pts.slice(-rangeDays)` sliced by array entries,
        // not calendar days. Because the /investment-snapshot/history
        // series is sparse (weekends, holidays, feed outages — the same
        // reason buildTrendPaths has gap-segmentation), the last N
        // POINTS can span ~N+2 to ~N+5 calendar days, so "7D" could
        // show ~9-11 days of trading history. No wrong money / no
        // phantom shape; purely a label-accuracy boundary issue.
        //
        // Fix: filter by `Date.parse(p.date) >= Date.now() - rangeDays*86400000`
        // so "7D" means last 7 calendar days regardless of sparsity. Cold
        // ranges (zero points in-window) still fall through to the
        // existing `trendCold` branch via the `< 2` length check below.
        //
        // `.date` is `YYYY-MM-DD` IST per `PortfolioTrendPoint` in
        // `services/wealthDigestNormalizers.ts`. Date.parse treats it as
        // UTC midnight — sub-day TZ skew is harmless at this precision
        // (7/30/90 day windows).
        const cutoff = Date.now() - rangeDays * 86400000;
        return pts.filter((p) => {
            const t = Date.parse(p.date);
            return Number.isFinite(t) && t >= cutoff;
        });
    }, [trend, rangeDays]);

    const trendPaths = useMemo(
        () => buildTrendPaths(trendSlice),
        [trendSlice],
    );
    const trendCold = trend !== null && trendSlice.length < 2;

    const allocation = useMemo(() => {
        const items: {key: string; label: string; value: number; pct: number; color: string}[] = [];
        let total = 0;
        MSN_SUMMARY_KEYS.forEach((k) => {
            const s = state.summaries[k] as {currentValue?: number} | undefined;
            const cv = Number(s?.currentValue) || 0;
            if (cv > 0) {
                items.push({key: k, label: ASSET_LABEL[k], value: cv, pct: 0, color: ASSET_COLOR[k]});
                total += cv;
            }
        });
        EPG_SUMMARY_KEYS.forEach((k) => {
            const s = state.summaries[k] as
                | {net?: number | string; unAccountedProfit?: number | string}
                | undefined;
            let cv = Number(s?.net) || 0;
            if (k === "ppf") cv = (Number(s?.net) || 0) + (Number(s?.unAccountedProfit) || 0);
            if (cv > 0) {
                items.push({key: k, label: ASSET_LABEL[k], value: cv, pct: 0, color: ASSET_COLOR[k]});
                total += cv;
            }
        });
        items.forEach((item) => {
            item.pct = total > 0 ? (item.value / total) * 100 : 0;
        });
        return {items, total};
    }, [state.summaries]);

    const assetCards = useMemo(() => {
        const summaries = state.summaries as Record<string, unknown>;
        return {
            msn: MSN_SUMMARY_KEYS.map((k) => ({
                key: k,
                label: ASSET_LABEL[k],
                color: ASSET_COLOR[k],
                route:
                    k === "stocks"
                        ? "/investments/stocks"
                        : k === "mf"
                            ? "/investments/mf"
                            : "/investments/nps",
                ...deriveAssetCard(k, summaries),
            })),
            epg: EPG_SUMMARY_KEYS.map((k) => ({
                key: k,
                label: ASSET_LABEL[k],
                color: ASSET_COLOR[k],
                route:
                    k === "epf"
                        ? "/investments/epf"
                        : k === "ppf"
                            ? "/investments/ppf"
                            : "/investments/gold",
                ...deriveAssetCard(k, summaries),
            })),
        };
    }, [state.summaries]);

    const today = useMemo(
        () =>
            new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                weekday: "short",
                day: "numeric",
                month: "short",
            }).format(new Date()),
        [],
    );

    const openKite = async () => {
        try {
            const res = await getKiteLoginUrl();
            if (res?.login_url) window.location.href = res.login_url;
        } catch {
            // No-op — the Kite tile stays in its 'expired' state; next click
            // retries. We don't surface a payload here because the NotificationBanner
            // provider isn't scoped to this subtree in a way this component can assume.
        }
    };

    // Split the hero amount into whole and decimal halves — the design
    // puts the paise fraction at a smaller font. We do the split on the
    // formatted string so precision is identical to Nocturne's reveal.
    const splitAmount = (value: number): {whole: string; decimal: string} => {
        const txt = formatCurrency(value);
        const dot = txt.lastIndexOf(".");
        if (dot === -1) return {whole: txt, decimal: ""};
        return {whole: txt.slice(0, dot), decimal: txt.slice(dot)};
    };
    const heroAmt = splitAmount(portfolio.currentValue);

    const realized = state.realizedPnl;
    const fo = state.foSummary;

    return (
        <div className={style.page}>
            {/* ── Hero + trend chart ── */}
            <section className={style.heroRow}>
                <div className={style.heroCol}>
                    <div className={style.heroHeader}>
                        <span className={style.heroKicker}>Total asset value</span>
                        <span className={style.heroDate}>{today}</span>
                        <button
                            type="button"
                            onClick={globalInvestmentRefresh}
                            className={`btn btn-ghost ${style.refreshBtn}`}
                        >
                            <i className="ph ph-arrow-clockwise"/>
                            <span>Refresh all</span>
                        </button>
                    </div>
                    <div className={style.heroAmount} title={`₹${formatCurrency(portfolio.currentValue)}`}>
                        <span className={style.heroWhole}>₹{heroAmt.whole}</span>
                        <span className={style.heroDecimal}>{heroAmt.decimal}</span>
                    </div>
                    <div className={style.heroMetrics}>
                        <div className={style.heroMetric}>
                            <span className={style.heroMetricLabel}>Today</span>
                            <span
                                className={style.heroMetricValue}
                                style={{color: portfolio.dayChangeKnown ? (portfolio.dayChange >= 0 ? CLR_GAIN : CLR_LOSS) : "var(--color-neutral-500)"}}
                                title={portfolio.dayChangeKnown
                                    ? "Day change across holdings with a known day basis"
                                    : "No day basis yet — unknown, not flat"}
                            >
                                {portfolio.dayChangeKnown
                                    ? `${portfolio.dayChange >= 0 ? "+" : "−"}₹${formatCompact(Math.abs(portfolio.dayChange))}`
                                    : "—"}
                                {portfolio.dayChangeKnown && portfolio.currentValue > 0 && (
                                    <span className={style.heroMetricPct}>
                                        {" "}{portfolio.dayChange >= 0 ? "+" : "−"}{Math.abs((portfolio.dayChange / portfolio.currentValue) * 100).toFixed(2)}%
                                    </span>
                                )}
                            </span>
                        </div>
                        <div className={style.heroMetric}>
                            <span className={style.heroMetricLabel}>Change</span>
                            <span
                                className={style.heroMetricValue}
                                style={{color: portfolio.profit >= 0 ? CLR_GAIN : CLR_LOSS}}
                            >
                                {portfolio.profit >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(portfolio.profit))}
                                <span className={style.heroMetricPct}>
                                    {" "}{portfolio.profit >= 0 ? "+" : "−"}{Math.abs(portfolio.profitPct).toFixed(2)}%
                                </span>
                            </span>
                        </div>
                        <div className={style.heroMetric}>
                            <span className={style.heroMetricLabel}>Invested</span>
                            <span className={style.heroMetricValue}>₹{formatCurrency(portfolio.invested)}</span>
                        </div>
                    </div>
                </div>

                <div className={style.trendCol}>
                    <div className={style.trendHeader}>
                        <span className={style.trendTitle}>Portfolio value</span>
                        <span className={style.trendRange}>{trendPaths?.startLabel && trendPaths?.endLabel ? `${trendPaths.startLabel} – ${trendPaths.endLabel}` : "Last 90 days"}</span>
                        <span className={style.spacer}/>
                        <div className={style.trendRangeToggle} role="tablist">
                            {RANGE_OPTS.map((r) => (
                                <button
                                    key={r.label}
                                    type="button"
                                    role="tab"
                                    aria-selected={rangeDays === r.days}
                                    onClick={() => setRangeDays(r.days)}
                                    className={`${style.trendRangeOpt} ${rangeDays === r.days ? style.trendRangeOptActive : ""}`}
                                >
                                    {r.label}
                                </button>
                            ))}
                        </div>
                    </div>
                    {trendPaths ? (
                        <>
                            <svg
                                viewBox="0 0 600 150"
                                preserveAspectRatio="none"
                                className={style.trendSvg}
                            >
                                <defs>
                                    <linearGradient id="feff9r-tg" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.28"/>
                                        <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0"/>
                                    </linearGradient>
                                </defs>
                                <path d={trendPaths.area} fill="url(#feff9r-tg)"/>
                                {trendPaths.gaps && (
                                    <path
                                        d={trendPaths.gaps}
                                        stroke="var(--color-neutral-600)"
                                        strokeWidth="1"
                                        strokeDasharray="2 3"
                                        vectorEffect="non-scaling-stroke"
                                        fill="none"
                                    />
                                )}
                                <path
                                    d={trendPaths.line}
                                    fill="none"
                                    stroke="var(--color-accent)"
                                    strokeWidth="1.75"
                                    vectorEffect="non-scaling-stroke"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <div className={style.trendFooter}>
                                <span>{trendPaths.startLabel}</span>
                                <span className={style.trendFooterCenter}>
                                    Dashed breaks = omitted days (incomplete prices), never filled in
                                </span>
                                <span>{trendPaths.endLabel}</span>
                            </div>
                        </>
                    ) : (
                        <div className={style.trendCold}>
                            {trendCold ? (
                                <>
                                    <span className={style.trendColdTitle}>Building your history</span>
                                    <span className={style.trendColdSub}>
                                        One snapshot is taken each day. The line appears once two
                                        complete days exist; days with a missing price are left out,
                                        not filled in.
                                    </span>
                                </>
                            ) : (
                                <span className={style.trendColdTitle}>Loading…</span>
                            )}
                        </div>
                    )}
                </div>
            </section>

            {/* ── Allocation bar + legend ── */}
            <section className={style.allocation}>
                <div className={style.allocationBar}>
                    {allocation.items.map((a) => (
                        <div
                            key={a.key}
                            title={`${a.label}: ${a.pct.toFixed(1)}% · ₹${formatCompact(a.value)}`}
                            className={style.allocationSeg}
                            style={{width: `${a.pct}%`, background: a.color}}
                        />
                    ))}
                </div>
                <div className={style.allocationLegend}>
                    {allocation.items.map((a) => (
                        <div key={a.key} className={style.allocationLegendItem}>
                            <span className={style.allocationLegendSwatch} style={{background: a.color}}/>
                            <span>{a.label}</span>
                            <span className={style.allocationLegendPct}>{a.pct.toFixed(1)}%</span>
                            <span className={style.allocationLegendValue}>₹{formatCompact(a.value)}</span>
                        </div>
                    ))}
                </div>
            </section>

            {/* ── Status strip: Kite / Funds / Reconciliation / Realized ── */}
            <section className={style.statusStrip}>
                <div
                    className={style.statusTile}
                    style={{boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${CLR_WARN} 35%, transparent)`}}
                >
                    <div className={style.statusKicker}>
                        <i className="ph ph-plugs" style={{color: CLR_WARN, fontSize: 15}}/>
                        <span>Kite session</span>
                    </div>
                    <div className={style.statusValue}>
                        {kiteState.isAuthenticated ? "Connected" : "Expired — reconnect"}
                    </div>
                    <div className={style.statusFooter}>
                        <span>Tokens expire daily</span>
                        <button
                            type="button"
                            onClick={openKite}
                            className={`btn btn-primary ${style.statusBtn}`}
                        >
                            {kiteState.isAuthenticated ? "Refresh" : "Reconnect"}
                        </button>
                    </div>
                </div>

                {/* ak-oc5s: live Kite margins wired from /kite/margins
                    (ak-zai2 Bundle 2). Four display states:
                      (a) not connected  → placeholder + hint
                      (b) connected, loading or not checked → '—' + hint
                      (c) connected, data present  → equity-available
                                                     headline + breakdown
                      (d) connected, checked, no equity data → '—' +
                                                     "Margins unavailable" hint
                    All numeric reads are defensive (typeof-number) —
                    the BE pass-through may drop fields silently on Kite
                    drift. */}
                {(() => {
                    const marginsData = kiteState.margins.data;
                    const marginsLoading = kiteState.margins.loading;
                    const marginsChecked = kiteState.margins.checked;
                    const connected = kiteState.isAuthenticated;

                    // Reader helpers — tolerate drift.
                    const n = (v: unknown): number | null =>
                        typeof v === 'number' && Number.isFinite(v) ? v : null;
                    const equity = marginsData?.equity;
                    const commodity = marginsData?.commodity;
                    const equityAvail = n(equity?.available?.live_balance)
                        ?? n(equity?.available?.cash);
                    const commodityAvail = n(commodity?.available?.live_balance)
                        ?? n(commodity?.available?.cash);
                    const equityUtilised = n(equity?.utilised?.debits);
                    const commodityEnabled = commodity?.enabled === true
                        || typeof commodityAvail === 'number';

                    const notConnected = !connected;
                    const loadingFirst = connected && (marginsLoading || !marginsChecked);
                    const liveData = connected && marginsChecked && equityAvail !== null;
                    // The remaining branch (connected && checked && no equity data)
                    // falls through to the silent-fallback `else` below — now reachable
                    // after SET_MARGINS_FAILED flips checked:true on transport error.

                    let valueNode: React.ReactNode;
                    let valueStyle: React.CSSProperties;
                    let hintNode: React.ReactNode;

                    if (notConnected) {
                        valueNode = '—';
                        valueStyle = {color: 'var(--color-neutral-500)'};
                        hintNode = 'Connect Kite to see available funds';
                    } else if (loadingFirst) {
                        valueNode = '—';
                        valueStyle = {color: 'var(--color-neutral-500)'};
                        hintNode = 'Loading margins…';
                    } else if (liveData) {
                        valueNode = (
                            <span title={`₹${formatCurrency(equityAvail!)}`}>
                                ₹{formatCompact(equityAvail!)}
                            </span>
                        );
                        valueStyle = {};
                        // Hint composition: show commodity if enabled + used (equity)
                        // if non-zero. Keep compact — this tile is narrow.
                        const parts: string[] = [];
                        if (commodityEnabled && commodityAvail !== null && commodityAvail > 0) {
                            parts.push(`Commodity ₹${formatCompact(commodityAvail)}`);
                        }
                        if (equityUtilised !== null && equityUtilised > 0) {
                            parts.push(`Used ₹${formatCompact(equityUtilised)}`);
                        }
                        hintNode = parts.length > 0
                            ? `Equity available · ${parts.join(' · ')}`
                            : 'Equity available · Kite live';
                    } else {
                        // noData — BE unreachable (SET_MARGINS_FAILED path), or
                        // /kite/margins returned without an equity section
                        // (unusual). Fall back silently.
                        valueNode = '—';
                        valueStyle = {color: 'var(--color-neutral-500)'};
                        hintNode = 'Margins unavailable — retry on refresh';
                    }

                    return (
                        <div className={style.statusTile}>
                            <div className={style.statusKicker}>
                                <i className="ph ph-wallet" style={{fontSize: 15}}/>
                                <span>Available funds</span>
                            </div>
                            <div className={style.statusValue} style={valueStyle}>
                                {valueNode}
                            </div>
                            <span className={style.statusHint}>{hintNode}</span>
                        </div>
                    );
                })()}

                <button
                    type="button"
                    onClick={() => navigate("/investments/stocks")}
                    className={`${style.statusTile} ${style.statusTileButton}`}
                >
                    <div className={style.statusKicker}>
                        <i className="ph ph-arrows-left-right" style={{fontSize: 15}}/>
                        <span>Reconciliation</span>
                        <span className={style.sampleChip}>Sample</span>
                    </div>
                    <div className={style.statusValue}>3 trades unmatched</div>
                    <span className={style.statusHint} style={{color: "var(--color-accent-300)"}}>
                        Zerodha vs statement · Review →
                    </span>
                </button>

                <div className={style.statusTile}>
                    <div className={style.statusKicker}>
                        <i className="ph ph-receipt" style={{fontSize: 15}}/>
                        <span>Realized gains</span>
                    </div>
                    <div className={style.statusLine}>
                        <span>
                            Equity P&amp;L{" "}
                            <span className={style.statusLineCount}>
                                {realized?.tradeCount ?? 0}
                            </span>
                        </span>
                        <span style={{color: (realized?.netRealizedPnL ?? 0) >= 0 ? CLR_GAIN : CLR_LOSS}}>
                            {(realized?.netRealizedPnL ?? 0) >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(realized?.netRealizedPnL ?? 0))}
                        </span>
                    </div>
                    <div className={style.statusLine}>
                        <span>
                            F&amp;O P&amp;L{" "}
                            <span className={style.statusLineCount}>
                                {fo?.tradeCount ?? 0}
                            </span>
                        </span>
                        <span style={{color: (fo?.netPnL ?? 0) >= 0 ? CLR_GAIN : CLR_LOSS}}>
                            {(fo?.netPnL ?? 0) >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(fo?.netPnL ?? 0))}
                        </span>
                    </div>
                </div>
            </section>

            {/* ── Today's Kite trades (ak-2k93) ──
                Hidden entirely when Kite isn't connected — not a placeholder,
                nothing to show. When connected: default-collapsed; expanding
                lazily fires /kite/trades (fetch only on OPEN edge; checked
                flag prevents re-fetch while section is already loaded).
                Table matches MSNList row pattern (compact, Nocturne tokens).
                BUY/SELL chip tinted with the shared oklch green/red triple. */}
            {kiteState.isAuthenticated && (() => {
                const tradesState = kiteState.trades;
                const trades = tradesState.data ?? [];
                const countLabel = tradesState.checked ? String(trades.length) : "—";
                return (
                    <section className={style.tradesSection}>
                        <button
                            type="button"
                            onClick={handleToggleTrades}
                            aria-expanded={tradesExpanded}
                            className={style.tradesHeader}
                        >
                            <h4 className={style.sectionTitle}>Today's trades</h4>
                            <span className={style.tradesCount}>{countLabel}</span>
                            <span className={style.spacer}/>
                            <i
                                className={`ph ${tradesExpanded ? "ph-caret-up" : "ph-caret-down"}`}
                                style={{fontSize: 16, color: "var(--color-neutral-400)"}}
                            />
                        </button>
                        {tradesExpanded && (
                            <div className={style.tradesBody}>
                                {tradesState.loading ? (
                                    <div className={style.tradesEmpty}>Loading trades…</div>
                                ) : !tradesState.checked ? (
                                    // Pre-fetch state (shouldn't normally hit because
                                    // the toggle fires the fetch, but defensive).
                                    <div className={style.tradesEmpty}>—</div>
                                ) : trades.length === 0 ? (
                                    <div className={style.tradesEmpty}>No trades today.</div>
                                ) : (
                                    <div className={style.tradesTableWrap}>
                                        <table className={style.tradesTable}>
                                            <thead>
                                                <tr>
                                                    <th>Time</th>
                                                    <th>Symbol</th>
                                                    <th>Side</th>
                                                    <th className={style.tradesTh_num}>Qty</th>
                                                    <th className={style.tradesTh_num}>Price</th>
                                                    <th className={style.tradesTh_num}>Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {trades.map((t, i) => {
                                                    const {qty, px, value} = readTradeNums(t);
                                                    const side = (t.transaction_type || "").toUpperCase();
                                                    const isBuy = side === "BUY";
                                                    const isSell = side === "SELL";
                                                    const sideColor = isBuy ? CLR_GAIN : isSell ? CLR_LOSS : "var(--color-neutral-400)";
                                                    const ts = t.fill_timestamp
                                                        || t.exchange_timestamp
                                                        || t.order_timestamp
                                                        || "";
                                                    const rowKey = t.trade_id ?? `trade-${i}`;
                                                    return (
                                                        <tr key={rowKey}>
                                                            <td>{formatTradeTime(ts)}</td>
                                                            <td>
                                                                <span className={style.tradesSymbol}>
                                                                    {t.tradingsymbol ?? "—"}
                                                                </span>
                                                                {t.exchange && (
                                                                    <span className={style.tradesExch}>
                                                                        {" · "}{t.exchange}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td>
                                                                <span
                                                                    className={style.sideChip}
                                                                    style={{
                                                                        color: sideColor,
                                                                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${sideColor} 35%, transparent)`,
                                                                    }}
                                                                >
                                                                    {side || "—"}
                                                                </span>
                                                            </td>
                                                            <td className={style.tradesTd_num}>{qty}</td>
                                                            <td className={style.tradesTd_num}>
                                                                ₹{formatCurrency(px)}
                                                            </td>
                                                            <td className={style.tradesTd_num}>
                                                                ₹{formatCompact(value)}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        )}
                    </section>
                );
            })()}

            {/* ── Market-linked (Stocks / MF / NPS) ── */}
            <section className={style.cardsSection}>
                <div className={style.sectionHeader}>
                    <h4 className={style.sectionTitle}>Market-linked</h4>
                    <span className={style.sectionSub}>Stocks, mutual funds, NPS · priced daily</span>
                </div>
                <div className={style.cardsGrid}>
                    {assetCards.msn.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            onClick={() => navigate(c.route)}
                            className={style.assetCard}
                        >
                            <div className={style.assetCardHead}>
                                <span className={style.assetCardSwatch} style={{background: c.color}}/>
                                <span className={style.assetCardName}>{c.label}</span>
                                <span className={style.assetCardCount}>{c.count}</span>
                            </div>
                            <span className={style.assetCardValue}>
                                ₹{formatCompact(c.currentValue)}
                            </span>
                            <div className={style.assetCardGrid}>
                                <div className={style.assetCardCell}>
                                    <span className={style.assetCardCellLabel}>Invested</span>
                                    <span className={style.assetCardCellValue}>
                                        ₹{formatCompact(c.invested)}
                                    </span>
                                </div>
                                <div className={style.assetCardCell}>
                                    <span className={style.assetCardCellLabel}>Change</span>
                                    <span
                                        className={style.assetCardCellValue}
                                        style={{color: c.change >= 0 ? CLR_GAIN : CLR_LOSS}}
                                    >
                                        {c.change >= 0 ? "+" : "−"}₹{formatCompact(Math.abs(c.change))}
                                    </span>
                                </div>
                                <div className={style.assetCardCell}>
                                    <span className={style.assetCardCellLabel}>Change %</span>
                                    <span
                                        className={style.assetCardCellValue}
                                        style={{color: c.changePct >= 0 ? CLR_GAIN : CLR_LOSS}}
                                    >
                                        {c.changePct >= 0 ? "+" : "−"}{Math.abs(c.changePct).toFixed(2)}%
                                    </span>
                                </div>
                            </div>
                            <div className={style.assetCardFooter}>
                                <span className={style.assetCardOpen}>
                                    Open <i className="ph ph-arrow-right"/>
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>

            {/* ── Kite monitoring (ak-166j) ──
                GTT + Alerts card wiring /kite/gtts + /kite/alerts +
                /kite/alerts/<uuid>/history. Hidden entirely when Kite
                isn't connected (handled inside KiteMonitoring). Lazy
                fetches per sub-tab activation. */}
            <KiteMonitoring/>

            {/* ── Watchlist (ak-i0zq / ak-05af BE / ak-v55t BE) ──
                Persistent symbol list with 30s LTP polling fallback
                until the WebSocket bead (ak-vue6) lands. Hidden entirely
                when Kite isn't connected (same posture as monitoring
                above). Mounted between monitoring and Fixed-return so
                the live-price surfaces group together visually. */}
            <Watchlist/>

            {/* ── Fixed-return & physical (EPF / PPF / Gold) ── */}
            <section className={style.cardsSection}>
                <div className={style.sectionHeader}>
                    <h4 className={style.sectionTitle}>Fixed-return &amp; physical</h4>
                    <span className={style.sectionSub}>EPF, PPF, gold · accrual and compounded growth</span>
                </div>
                <div className={style.cardsGrid}>
                    {assetCards.epg.map((c) => (
                        <button
                            key={c.key}
                            type="button"
                            onClick={() => navigate(c.route)}
                            className={`${style.assetCard} ${style.assetCardEpg}`}
                        >
                            <div className={style.assetCardHead}>
                                <span className={style.assetCardSwatch} style={{background: c.color}}/>
                                <span className={style.assetCardName}>{c.label}</span>
                            </div>
                            <div className={style.assetCardEpgBody}>
                                <span className={style.assetCardValue}>
                                    ₹{formatCompact(c.currentValue)}
                                </span>
                                <span
                                    className={style.assetCardEpgPct}
                                    style={{color: c.changePct >= 0 ? CLR_GAIN : CLR_LOSS}}
                                >
                                    {c.changePct >= 0 ? "+" : "−"}{Math.abs(c.changePct).toFixed(2)}%
                                    <span className={style.assetCardEpgPctLabel}>vs invested</span>
                                </span>
                            </div>
                            <div className={style.assetCardEpgBar}>
                                <div
                                    className={style.assetCardEpgBarFill}
                                    style={{
                                        width: c.currentValue > 0
                                            ? `${Math.min(100, (c.invested / c.currentValue) * 100)}%`
                                            : "0%",
                                    }}
                                />
                            </div>
                            <div className={style.assetCardEpgMeta}>
                                <span>Invested ₹{formatCompact(c.invested)}</span>
                                <span>Earned ₹{formatCompact(c.change)}</span>
                            </div>
                            <div className={style.assetCardFooter}>
                                <span className={style.assetCardOpen}>
                                    Open <i className="ph ph-arrow-right"/>
                                </span>
                            </div>
                        </button>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default InvestmentsLanding;
