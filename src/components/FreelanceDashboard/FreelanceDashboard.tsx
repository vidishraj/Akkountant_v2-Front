import {useState, useEffect, useMemo, useCallback} from "react";
import {
    // AreaChart/Area dropped ak-wnrr — earnings chart replaced by a hand-
    // drawn gap-aware SVG (buildEarningsTrendPaths). The remaining recharts
    // consumers are the Pie (client distribution) and Bar charts which have
    // no interpolation concern (categorical data).
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
} from "recharts";
import {
    fetchFreelanceDashboard,
    fetchInvoiceById,
} from "../../services/freelanceService";
import {FreelanceDashboard as DashboardData, InvoiceData} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import {Dialog, DialogTitle, DialogContent, IconButton, CircularProgress} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import InvoicePDFPreview from "../InvoiceCreator/InvoicePDFPreview";
import ErrorBoundary from "../ErrorBoundary";
import {currencyService} from "../../services/currencyService";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./FreelanceDashboard.module.scss";

interface FreelanceDashboardProps {
    refreshTrigger?: number;
    isActive?: boolean;
    onNavigateToManage?: () => void;
}

type DatePreset = "thisMonth" | "last3Months" | "currentFY" | "previousFY" | "allTime";

// Indian Financial Year: April 1 – March 31
const getFYDates = (offset: number = 0) => {
    const now = new Date();
    const fyStartYear = (now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1) + offset;
    return {
        start: new Date(fyStartYear, 3, 1),      // April 1
        end: new Date(fyStartYear + 1, 2, 31),    // March 31
    };
};

const formatMonthLabel = (month: string) => {
    const [y, m] = month.split("-");
    const labels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${labels[parseInt(m, 10) - 1]} '${y.slice(2)}`;
};

/**
 * Convert a "YYYY-MM" month key to an absolute month-index (year*12 + month).
 * Lets us detect month gaps > 1 between adjacent emitted points with simple
 * arithmetic — no Date math, no DST / timezone concerns.
 */
const monthIndex = (yyyyMm: string): number => {
    const [y, m] = yyyyMm.split("-").map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(m)) return 0;
    return y * 12 + (m - 1);
};

interface MonthlyPoint {
    month: string;
    earnings: number;
}

/**
 * ak-wnrr priority fix (brief 06 §8 + reviewer-flagged phantom-dip risk):
 *
 * Pre-ak-wnrr the dashboard used recharts `<AreaChart>` with
 * `<Area type="monotone">`. That draws a smooth line through whatever
 * points are in `data`, which silently fabricates two kinds of fiction:
 *
 * 1. If BE emits only non-zero months, recharts compresses the x-axis
 *    and draws a straight line through consecutive x-positions — the
 *    chart visually implies every month had activity, erasing the zero
 *    months entirely.
 * 2. If BE emits zero-filled months, `type="monotone"` smooths the line
 *    through (month, 0) → (month+1, large) with no visual "gap" marker
 *    to indicate the zero was a BE-gap, not a real-zero.
 *
 * Both failure modes are an accounting-visualization-honesty violation —
 * same class as InvestmentsLanding's constant-composition rule (§8). Fix
 * here mirrors the `buildTrendPaths` discipline landed on ak-ff9r and
 * ak-jhy8: segment the line at month gaps > 1, render those spans as
 * dashed connectors, never interpolate.
 *
 * Returns SVG path strings for the solid line segments, the dashed gap
 * connectors, and the filled area under solid segments only. Returns
 * null when fewer than 2 points — caller renders a placeholder.
 */
function buildEarningsTrendPaths(points: MonthlyPoint[], w = 600, h = 220): {
    line: string;
    gaps: string;
    area: string;
    yTicks: {y: number; label: string}[];
    xLabels: {x: number; label: string}[];
} | null {
    if (points.length < 2) return null;
    const values = points.map((p) => p.earnings);
    const mx = Math.max(...values, 0);
    const mn = Math.min(0, Math.min(...values));
    const spread = mx - mn || 1;
    const padTop = 14;
    const padBot = 28;
    const innerH = h - padTop - padBot;
    const stepX = w / Math.max(1, points.length - 1);
    const coords = points.map((p, i) => {
        const x = i * stepX;
        const y = padTop + innerH - ((p.earnings - mn) / spread) * innerH;
        return {x, y, month: p.month};
    });

    // Segment at month gaps > 1. Solid segments from contiguous month
    // blocks; dashed connectors across gap spans. Each segment gets its
    // own area fill path so the gradient fill doesn't bleed across gaps.
    const lineSegments: string[] = [];
    const gapSegments: string[] = [];
    const areaSegments: string[] = [];
    let curSeg: {x: number; y: number}[] = [coords[0]];
    const flushSeg = () => {
        if (curSeg.length < 2) return;
        lineSegments.push("M" + curSeg.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join("L"));
        const first = curSeg[0];
        const last = curSeg[curSeg.length - 1];
        areaSegments.push(
            `M${first.x.toFixed(1)},${(padTop + innerH).toFixed(1)}L` +
            curSeg.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join("L") +
            `L${last.x.toFixed(1)},${(padTop + innerH).toFixed(1)}Z`,
        );
    };

    for (let i = 1; i < coords.length; i++) {
        const prev = coords[i - 1];
        const cur = coords[i];
        const gap = monthIndex(cur.month) - monthIndex(prev.month);
        if (gap > 1) {
            flushSeg();
            gapSegments.push(`M${prev.x.toFixed(1)},${prev.y.toFixed(1)}L${cur.x.toFixed(1)},${cur.y.toFixed(1)}`);
            curSeg = [cur];
        } else {
            curSeg.push(cur);
        }
    }
    flushSeg();

    // Y axis: 4 ticks (0, 1/3, 2/3, max). Compact ₹ formatting.
    const fmtCompact = (v: number): string => {
        if (v >= 1_00_00_000) return `₹${(v / 1_00_00_000).toFixed(1)}Cr`;
        if (v >= 1_00_000) return `₹${(v / 1_00_000).toFixed(1)}L`;
        if (v >= 1_000) return `₹${(v / 1_000).toFixed(0)}K`;
        return `₹${v.toFixed(0)}`;
    };
    const yTicks = [0, 1, 2, 3].map((i) => {
        const value = mn + spread * (i / 3);
        return {y: padTop + innerH - (i / 3) * innerH, label: fmtCompact(value)};
    });

    // X axis: label every point when < 12, else every other.
    const xStride = points.length > 12 ? 2 : 1;
    const xLabels = coords
        .filter((_, i) => i % xStride === 0)
        .map((c) => ({x: c.x, label: formatMonthLabel(c.month)}));

    return {
        line: lineSegments.join(" "),
        gaps: gapSegments.join(" "),
        area: areaSegments.join(" "),
        yTicks,
        xLabels,
    };
}

const FreelanceDashboard = ({refreshTrigger, isActive = true, onNavigateToManage}: FreelanceDashboardProps = {}) => {
    const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState("");
    const [endDate, setEndDate] = useState("");
    const [activePreset, setActivePreset] = useState<DatePreset | null>("currentFY");
    const [initialFilterApplied, setInitialFilterApplied] = useState(false);
    const [previewInvoice, setPreviewInvoice] = useState<InvoiceData | null>(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewOpen, setPreviewOpen] = useState(false);
    const {setPayload} = useMessage();

    const handleInvoiceClick = async (invoiceNumber: string) => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        setPreviewInvoice(null);
        try {
            const data = await fetchInvoiceById(invoiceNumber);
            setPreviewInvoice(data);
        } catch {
            setPayload({type: "error", message: "Failed to load invoice preview."});
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    const loadDashboardData = useCallback(async () => {
        try {
            setLoading(true);
            const data = await fetchFreelanceDashboard();
            setDashboardData(data);
            currencyService.updateExchangeRates().catch(console.warn);
        } catch (error) {
            setPayload({type: "error", message: "Failed to load dashboard data. Backend connection required."});
            console.error("Dashboard loading error:", error);
        } finally {
            setLoading(false);
        }
    }, [setPayload]);

    useEffect(() => {
        loadDashboardData();
    }, [refreshTrigger, loadDashboardData]);

    useEffect(() => {
        if (isActive) loadDashboardData();
    }, [isActive, loadDashboardData]);

    // Auto-apply "Current FY" filter on first data load
    useEffect(() => {
        if (dashboardData && !initialFilterApplied) {
            setInitialFilterApplied(true);
            const now = new Date();
            const fy = getFYDates(0);
            const end = fy.end > now ? now : fy.end;
            setStartDate(fy.start.toISOString().split("T")[0]);
            setEndDate(end.toISOString().split("T")[0]);
            setActivePreset("currentFY");
        }
    }, [dashboardData, initialFilterApplied]);

    const applyPreset = (preset: DatePreset) => {
        const now = new Date();
        let start: Date;
        let end: Date = now;

        switch (preset) {
            case "thisMonth":
                start = new Date(now.getFullYear(), now.getMonth(), 1);
                break;
            case "last3Months":
                start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
                break;
            case "currentFY": {
                const fy = getFYDates(0);
                start = fy.start;
                end = fy.end > now ? now : fy.end;
                break;
            }
            case "previousFY": {
                const fy = getFYDates(-1);
                start = fy.start;
                end = fy.end;
                break;
            }
            case "allTime":
                setStartDate("");
                setEndDate("");
                setActivePreset("allTime");
                return;
        }

        setStartDate(start.toISOString().split("T")[0]);
        setEndDate(end.toISOString().split("T")[0]);
        setActivePreset(preset);
    };

    const applyCustomRange = () => {
        if (!startDate || !endDate) {
            setPayload({type: "error", message: "Please select both start and end dates"});
            return;
        }
        if (new Date(startDate) > new Date(endDate)) {
            setPayload({type: "error", message: "Start date cannot be after end date"});
            return;
        }
        setActivePreset(null);
    };

    const clearDateFilter = () => {
        setStartDate("");
        setEndDate("");
        setActivePreset(null);
    };

    const formatCurrency = (amount: number, currency: string = "INR") => {
        const locale = currency === "INR" ? "en-IN" : "en-US";
        return new Intl.NumberFormat(locale, {style: "currency", currency}).format(amount);
    };

    const formatBaseCurrency = (amount: number) => formatCurrency(amount, "INR");

    const getINRConversion = (amount: number, currency: string) => {
        if (currency === "INR") return amount;
        return currencyService.convertToINRSync(amount, currency);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid": return "#4ADE80";
            case "overdue": return "#EF4444";
            default: return "#F59E0B";
        }
    };

    const normalizeStatus = (status: string) => {
        return status === "paid" ? "paid" : status === "overdue" ? "overdue" : "pending";
    };

    const COLORS = ["#7B68EE", "#32CD32", "#FFD700", "#FF6347", "#20B2AA", "#FF69B4", "#FFA500", "#9932CC"];

    // Compute derived metrics
    const unpaidTotal = useMemo(() => {
        if (!dashboardData?.unpaidByCurrency?.length) return 0;
        return dashboardData.unpaidByCurrency.reduce(
            (sum, item) => sum + getINRConversion(item.amount, item.currency), 0
        );
    }, [dashboardData]);

    const avgInvoiceValue = useMemo(() => {
        if (!dashboardData) return 0;
        const totalProjects = dashboardData.completedProjects;
        if (totalProjects === 0) return 0;
        return dashboardData.totalEarnings / totalProjects;
    }, [dashboardData]);

    const collectionRate = useMemo(() => {
        if (!dashboardData) return 0;
        const total = dashboardData.totalEarnings + unpaidTotal;
        if (total === 0) return 0;
        return (dashboardData.totalEarnings / total) * 100;
    }, [dashboardData, unpaidTotal]);

    // Filter earningsByMonth to date range (for charts)
    const filteredMonthlyData = useMemo(() => {
        if (!dashboardData?.earningsByMonth) return [];
        if (!startDate || !endDate) return dashboardData.earningsByMonth;
        const sMonth = startDate.slice(0, 7); // "YYYY-MM"
        const eMonth = endDate.slice(0, 7);
        return dashboardData.earningsByMonth.filter(m => m.month >= sMonth && m.month <= eMonth);
    }, [dashboardData, startDate, endDate]);

    // Filtered metrics from filteredMonthlyData
    const filteredTotalEarnings = useMemo(() => {
        return filteredMonthlyData.reduce((sum, m) => sum + m.earnings, 0);
    }, [filteredMonthlyData]);

    // Trend: compare current range's monthly avg to previous equivalent period's avg
    const monthlyTrend = useMemo(() => {
        if (!dashboardData?.earningsByMonth || filteredMonthlyData.length === 0) return null;
        if (!startDate || !endDate) return null;

        const rangeMonths = filteredMonthlyData.length;
        const currentAvg = filteredTotalEarnings / rangeMonths;

        // Shift start/end back by rangeMonths to get previous equivalent period
        const sDate = new Date(startDate);
        sDate.setMonth(sDate.getMonth() - rangeMonths);
        const eDate = new Date(endDate);
        eDate.setMonth(eDate.getMonth() - rangeMonths);
        const prevStart = `${sDate.getFullYear()}-${String(sDate.getMonth() + 1).padStart(2, "0")}`;
        const prevEnd = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, "0")}`;

        const prevData = dashboardData.earningsByMonth.filter(m => m.month >= prevStart && m.month <= prevEnd);
        if (prevData.length === 0) return null;

        const prevAvg = prevData.reduce((sum, m) => sum + m.earnings, 0) / prevData.length;
        if (prevAvg === 0) return currentAvg > 0 ? 100 : 0;
        return ((currentAvg - prevAvg) / prevAvg) * 100;
    }, [dashboardData, filteredMonthlyData, filteredTotalEarnings, startDate, endDate]);

    // Paid vs Unpaid monthly data (from filtered)
    const paidVsUnpaidData = useMemo(() => {
        return filteredMonthlyData.map(m => ({
            month: m.month,
            paid: m.earnings,
        }));
    }, [filteredMonthlyData]);

    // Filter recent invoices to date range
    const filteredInvoices = useMemo(() => {
        if (!dashboardData?.recentInvoices?.length) return [];
        if (!startDate || !endDate) return dashboardData.recentInvoices;
        return dashboardData.recentInvoices.filter(inv => {
            const d = inv.date;
            return d >= startDate && d <= endDate;
        });
    }, [dashboardData, startDate, endDate]);

    // Status distribution from filtered invoices
    const statusDistribution = useMemo(() => {
        if (!filteredInvoices.length) return null;
        const total = filteredInvoices.length;
        const paid = filteredInvoices.filter(i => i.status === "paid").length;
        const pending = filteredInvoices.filter(i => i.status !== "paid" && i.status !== "overdue").length;
        const overdue = filteredInvoices.filter(i => i.status === "overdue").length;
        return {
            total, paid, pending, overdue,
            paidPct: (paid / total) * 100,
            pendingPct: (pending / total) * 100,
            overduePct: (overdue / total) * 100,
        };
    }, [filteredInvoices]);

    if (loading && !dashboardData) {
        return <div className={styles.loadingSpinner}><div>Loading dashboard...</div></div>;
    }

    if (!dashboardData) {
        return <div className={styles.emptyState}>No dashboard data available</div>;
    }

    const renderTrend = (value: number | null, label?: string) => {
        if (value === null) return null;
        const suffix = label ? ` ${label}` : "";
        if (value > 0) return <div className={ownStyles.trendUp}>{"\u25B2"} {value.toFixed(0)}%{suffix}</div>;
        if (value < 0) return <div className={ownStyles.trendDown}>{"\u25BC"} {Math.abs(value).toFixed(0)}%{suffix}</div>;
        return <div className={ownStyles.trendNeutral}>{"\u2014"} 0%{suffix}</div>;
    };

    return (
        <div style={{overflow: "hidden"}}>
            {/* Compact Dashboard Filter Strip */}
            <div className={ownStyles.dashboardFilterStrip}>
                <span className={ownStyles.filterLabel}>Range</span>
                {([
                    ["currentFY", "This FY"],
                    ["previousFY", "Prev FY"],
                    ["thisMonth", "This Month"],
                    ["last3Months", "3 Months"],
                    ["allTime", "All"],
                ] as [DatePreset, string][]).map(([key, label]) => (
                    <button
                        key={key}
                        className={`${ownStyles.presetChip} ${activePreset === key ? ownStyles.activeChip : ""}`}
                        onClick={() => applyPreset(key)}
                    >
                        {label}
                    </button>
                ))}
                <div className={ownStyles.filterDivider} />
                <input type="date" className={ownStyles.filterDateInput} value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                <span style={{color: "#b0b0b0", fontSize: "0.75rem"}}>to</span>
                <input type="date" className={ownStyles.filterDateInput} value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                <button
                    className={ownStyles.filterApplyBtn}
                    onClick={applyCustomRange}
                    disabled={loading || !startDate || !endDate}
                >
                    Apply
                </button>
                {(startDate || endDate) && (
                    <button className={ownStyles.filterClearBtn} onClick={clearDateFilter}>Clear</button>
                )}
            </div>

            {/* 1. Primary Metrics Row */}
            <div className={ownStyles.primaryMetricsGrid}>
                <div className={ownStyles.metricCardPrimary}>
                    <div className={`${ownStyles.metricValue} ${ownStyles.metricValueGreen}`}>
                        {formatBaseCurrency(activePreset === "allTime" || (!startDate && !endDate) ? dashboardData.totalEarnings : filteredTotalEarnings)}
                    </div>
                    <div className={ownStyles.metricLabel}>
                        {activePreset === "allTime" || (!startDate && !endDate) ? "Total Paid Earnings" : "Paid Earnings (Filtered)"}
                    </div>
                </div>
                <div className={ownStyles.metricCardPrimary}>
                    <div className={`${ownStyles.metricValue} ${ownStyles.metricValueAmber}`}>
                        {formatBaseCurrency(unpaidTotal)}
                    </div>
                    <div className={ownStyles.metricLabel}>Unpaid Value</div>
                </div>
                <div className={ownStyles.metricCardPrimary}>
                    <div className={`${ownStyles.metricValue} ${ownStyles.metricValuePurple}`}>
                        {formatBaseCurrency(filteredMonthlyData.length > 0 ? filteredTotalEarnings / filteredMonthlyData.length : 0)}
                    </div>
                    <div className={ownStyles.metricLabel}>Monthly Avg ({filteredMonthlyData.length} mo)</div>
                    {renderTrend(monthlyTrend, "vs prev period")}
                </div>
            </div>

            {/* 2. Invoice Status Distribution Bar */}
            {statusDistribution && statusDistribution.total > 0 && (
                <div className={ownStyles.statusBarContainer}>
                    <div className={ownStyles.statusBarHeader}>
                        <span className={ownStyles.statusBarTitle}>Invoice Status Distribution</span>
                        <div className={ownStyles.statusBarLegend}>
                            <span className={ownStyles.statusLegendItem}>
                                <span className={ownStyles.statusLegendDot} style={{backgroundColor: "#4ADE80"}} />
                                Paid ({statusDistribution.paid})
                            </span>
                            <span className={ownStyles.statusLegendItem}>
                                <span className={ownStyles.statusLegendDot} style={{backgroundColor: "#F59E0B"}} />
                                Pending ({statusDistribution.pending})
                            </span>
                            <span className={ownStyles.statusLegendItem}>
                                <span className={ownStyles.statusLegendDot} style={{backgroundColor: "#EF4444"}} />
                                Overdue ({statusDistribution.overdue})
                            </span>
                        </div>
                    </div>
                    <div className={ownStyles.statusBarTrack}>
                        <div className={ownStyles.statusBarSegment}
                             style={{width: `${statusDistribution.paidPct}%`, backgroundColor: "#4ADE80"}} />
                        <div className={ownStyles.statusBarSegment}
                             style={{width: `${statusDistribution.pendingPct}%`, backgroundColor: "#F59E0B"}} />
                        <div className={ownStyles.statusBarSegment}
                             style={{width: `${statusDistribution.overduePct}%`, backgroundColor: "#EF4444"}} />
                    </div>
                </div>
            )}

            {/* 3. Charts Grid - Area + Pie */}
            {/* ErrorBoundary wrap (ak-awp hotfix follow-up): if any chart in
                this section throws — e.g. a BE aggregation edge case landing
                null on an array field like earningsByClient — the boundary
                catches it locally so the Recent Invoices table + secondary
                metrics below still render. Prior behavior was whole-page
                teardown from the Status Distribution header down. */}
            <ErrorBoundary>
            <div className={ownStyles.chartGrid}>
                <div className={ownStyles.chartContainer} style={{marginBottom: 0}}>
                    <h3 className={styles.sectionTitle}>Monthly Paid Earnings (INR)</h3>
                    {/* ak-wnrr: gap-aware SVG replaces recharts AreaChart.
                        See `buildEarningsTrendPaths` docstring above for the
                        phantom-dip discipline. Same shape as ak-ff9r
                        InvestmentsLanding + ak-jhy8 WealthDigest trend chart. */}
                    {(() => {
                        const paths = buildEarningsTrendPaths(filteredMonthlyData, 600, 260);
                        if (!paths) {
                            return (
                                <div className={ownStyles.chartPlaceholder}>
                                    Not enough data to draw a trend — need at least 2 months.
                                </div>
                            );
                        }
                        return (
                            <>
                                <svg
                                    viewBox="0 0 600 260"
                                    preserveAspectRatio="none"
                                    className={ownStyles.chartSvg}
                                    role="img"
                                    aria-label="Monthly paid earnings trend"
                                >
                                    <defs>
                                        <linearGradient id="fewnrr-earnings-grad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="0" stopColor="var(--color-accent)" stopOpacity="0.32"/>
                                            <stop offset="1" stopColor="var(--color-accent)" stopOpacity="0"/>
                                        </linearGradient>
                                    </defs>
                                    {/* Horizontal gridlines at each y-tick */}
                                    {paths.yTicks.map((tick, i) => (
                                        <line
                                            key={`grid-${i}`}
                                            x1="0"
                                            x2="600"
                                            y1={tick.y}
                                            y2={tick.y}
                                            stroke="var(--color-divider)"
                                            strokeWidth="1"
                                            vectorEffect="non-scaling-stroke"
                                        />
                                    ))}
                                    {/* Area fill — per-segment only (no bleed across gaps) */}
                                    <path d={paths.area} fill="url(#fewnrr-earnings-grad)"/>
                                    {/* Dashed gap connectors — explicit "omitted months" marker */}
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
                                    {/* Solid line segments for contiguous month blocks */}
                                    <path
                                        d={paths.line}
                                        fill="none"
                                        stroke="var(--color-accent)"
                                        strokeWidth="1.75"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                    {/* Y-axis tick labels — right-aligned inside the chart edge */}
                                    {paths.yTicks.map((tick, i) => (
                                        <text
                                            key={`yl-${i}`}
                                            x="6"
                                            y={tick.y - 3}
                                            fill="var(--color-neutral-500)"
                                            fontSize="10"
                                        >
                                            {tick.label}
                                        </text>
                                    ))}
                                </svg>
                                {/* X-axis labels (below the svg so they don't share the viewBox scale) */}
                                <div className={ownStyles.chartXAxis}>
                                    {paths.xLabels.map((lbl, i) => (
                                        <span
                                            key={`xl-${i}`}
                                            className={ownStyles.chartXLabel}
                                            style={{left: `${(lbl.x / 600) * 100}%`}}
                                        >
                                            {lbl.label}
                                        </span>
                                    ))}
                                </div>
                                {paths.gaps && (
                                    <div className={ownStyles.chartGapNote}>
                                        Dashed breaks = months with no paid earnings, left as gaps (never interpolated).
                                    </div>
                                )}
                            </>
                        );
                    })()}
                </div>

                <div className={ownStyles.chartContainer} style={{marginBottom: 0}}>
                    <h3 className={styles.sectionTitle}>Client Distribution (INR)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={(dashboardData.earningsByClient ?? []).filter(item => item.earnings > 0)}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({client, percent}) => percent && percent > 0.05 ? `${client}: ${(percent * 100).toFixed(0)}%` : ""}
                                outerRadius={100}
                                innerRadius={40}
                                fill="#8884d8"
                                dataKey="earnings"
                            >
                                {(dashboardData.earningsByClient ?? []).filter(item => item.earnings > 0).map((_, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{backgroundColor: "#121C24", border: "1px solid #5B5B7B", borderRadius: "4px", color: "#FAFAFA"}}
                                formatter={(value: number) => [formatBaseCurrency(value), "Paid Earnings"]}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* 5. Secondary Charts - Bar charts side by side */}
            <div className={ownStyles.secondaryChartGrid}>
                {paidVsUnpaidData.length > 0 && (
                    <div className={ownStyles.chartContainer} style={{marginBottom: 0}}>
                        <h3 className={styles.sectionTitle}>Monthly Paid Earnings (Bar)</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={paidVsUnpaidData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                                <XAxis dataKey="month" stroke="#FAFAFA" fontSize={11} tickFormatter={formatMonthLabel}
                                       angle={-35} textAnchor="end" height={50} interval={0} />
                                <YAxis stroke="#FAFAFA" fontSize={11} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                                <Tooltip
                                    contentStyle={{backgroundColor: "#121C24", border: "1px solid #5B5B7B", borderRadius: "4px", color: "#FAFAFA"}}
                                    labelFormatter={formatMonthLabel}
                                    formatter={(value: number) => [formatBaseCurrency(value), "Paid"]}
                                />
                                <Bar dataKey="paid" fill="#4ADE80" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {dashboardData.unpaidByCurrency && dashboardData.unpaidByCurrency.length > 0 && (
                    <div className={ownStyles.chartContainer} style={{marginBottom: 0}}>
                        <h3 className={styles.sectionTitle}>Unpaid by Currency</h3>
                        <ResponsiveContainer width="100%" height={250}>
                            <BarChart data={(dashboardData.unpaidByCurrency ?? []).map(item => ({
                                ...item,
                                inrAmount: getINRConversion(item.amount, item.currency)
                            }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                                <XAxis dataKey="currency" stroke="#FAFAFA" />
                                <YAxis stroke="#FAFAFA" />
                                <Tooltip
                                    contentStyle={{backgroundColor: "#121C24", border: "1px solid #5B5B7B", borderRadius: "4px", color: "#FAFAFA"}}
                                    formatter={(value: number) => [formatBaseCurrency(value), "Unpaid (INR)"]}
                                />
                                <Bar dataKey="inrAmount" fill="#FFD700" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
            </ErrorBoundary>

            {/* 6. Secondary Metrics Row */}
            <div className={ownStyles.dashboardGrid}>
                <div className={ownStyles.metricCard}>
                    <div className={ownStyles.metricValue}>{dashboardData.completedProjects}</div>
                    <div className={ownStyles.metricLabel}>Completed Projects</div>
                </div>
                <div className={ownStyles.metricCard}>
                    <div className={ownStyles.metricValue}>{dashboardData.activeClients}</div>
                    <div className={ownStyles.metricLabel}>Active Clients</div>
                </div>
                <div className={ownStyles.metricCard}>
                    <div className={ownStyles.metricValue}>{formatBaseCurrency(avgInvoiceValue)}</div>
                    <div className={ownStyles.metricLabel}>Avg Invoice Value</div>
                </div>
                <div className={ownStyles.metricCard}>
                    <div className={ownStyles.metricValue} style={{color: collectionRate >= 80 ? "#4ADE80" : collectionRate >= 50 ? "#F59E0B" : "#EF4444"}}>
                        {collectionRate.toFixed(0)}%
                    </div>
                    <div className={ownStyles.metricLabel}>Collection Rate</div>
                </div>
            </div>

            {/* 7. Recent Invoices Table (bottom) */}
            <div className={ownStyles.chartContainer}>
                <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px"}}>
                    <h3 className={styles.sectionTitle} style={{marginBottom: 0, borderBottom: "none", paddingBottom: 0}}>
                        Recent Invoices
                    </h3>
                    {onNavigateToManage && (
                        <button className={ownStyles.viewAllLink} onClick={onNavigateToManage}>
                            View All {"\u2192"}
                        </button>
                    )}
                </div>
                <div style={{overflowX: "auto"}}>
                    <table className={styles.dataTable}>
                        <thead>
                        <tr>
                            <th>Invoice #</th>
                            <th>Client</th>
                            <th style={{textAlign: "right"}}>Amount</th>
                            <th style={{textAlign: "center"}}>Status</th>
                            <th>Date</th>
                        </tr>
                        </thead>
                        <tbody>
                        {filteredInvoices.slice(0, 10).map((invoice, index) => (
                            <tr key={index}
                                onClick={() => handleInvoiceClick(invoice.invoiceNumber)}
                                style={{cursor: "pointer"}}
                            >
                                <td>{invoice.invoiceNumber}</td>
                                <td>{invoice.clientName}</td>
                                <td style={{textAlign: "right", fontWeight: "bold"}}>
                                    {invoice.status === "paid"
                                        ? formatBaseCurrency(invoice.paidAmount || invoice.amount)
                                        : formatCurrency(invoice.amount, invoice.currency || "USD")}
                                </td>
                                <td style={{color: getStatusColor(invoice.status), fontWeight: "bold", textAlign: "center", fontSize: "0.8rem"}}>
                                    {normalizeStatus(invoice.status).toUpperCase()}
                                </td>
                                <td style={{color: "#B0B0B0"}}>
                                    {new Date(invoice.date).toLocaleDateString()}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Invoice Preview Dialog */}
            <Dialog
                open={previewOpen}
                onClose={() => setPreviewOpen(false)}
                maxWidth="md"
                fullWidth
                PaperProps={{
                    sx: {
                        backgroundColor: "#121C24",
                        color: "#FAFAFA",
                        minHeight: "70vh",
                    },
                }}
            >
                <DialogTitle sx={{display: "flex", justifyContent: "space-between", alignItems: "center", pb: 0}}>
                    Invoice Preview
                    <IconButton onClick={() => setPreviewOpen(false)} sx={{color: "#FAFAFA"}}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{display: "flex", flexDirection: "column", flex: 1, minHeight: 0}}>
                    {previewLoading ? (
                        <div style={{display: "flex", justifyContent: "center", alignItems: "center", flex: 1, minHeight: "300px"}}>
                            <CircularProgress sx={{color: "#7b68ee"}} />
                        </div>
                    ) : (
                        <InvoicePDFPreview invoiceData={previewInvoice} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default FreelanceDashboard;
