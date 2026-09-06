import {useState, useEffect, useMemo, useCallback} from "react";
import {
    AreaChart,
    Area,
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
                    <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={filteredMonthlyData}>
                            <defs>
                                <linearGradient id="earningsGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#7B68EE" stopOpacity={0.4} />
                                    <stop offset="95%" stopColor="#7B68EE" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#5B5B7B" />
                            <XAxis dataKey="month" stroke="#FAFAFA" fontSize={11} tickFormatter={formatMonthLabel}
                                   angle={-35} textAnchor="end" height={50} interval={0} />
                            <YAxis stroke="#FAFAFA" fontSize={11} tickFormatter={(v: number) => v >= 100000 ? `${(v / 100000).toFixed(1)}L` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : `${v}`} />
                            <Tooltip
                                contentStyle={{backgroundColor: "#121C24", border: "1px solid #5B5B7B", borderRadius: "4px", color: "#FAFAFA"}}
                                labelFormatter={formatMonthLabel}
                                formatter={(value: number) => [formatBaseCurrency(value), "Paid Earnings"]}
                            />
                            <Area type="monotone" dataKey="earnings" stroke="#7B68EE" strokeWidth={2}
                                  fill="url(#earningsGradient)" dot={{fill: "#7B68EE", strokeWidth: 2, r: 4}}
                                  activeDot={{r: 6, fill: "#9B8AFF"}} />
                        </AreaChart>
                    </ResponsiveContainer>
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
