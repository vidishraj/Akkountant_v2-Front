import {useState, useEffect, useMemo, useCallback} from "react";
// ak-hpd3: recharts dropped entirely from this file.
// - AreaChart/Area was already dropped in ak-wnrr (replaced by a hand-
//   drawn gap-aware SVG, `buildEarningsTrendPaths`).
// - PieChart (Client Distribution) → Nocturne CSS-bar list.
// - BarChart "Monthly Paid Earnings (Bar)" removed — duplicate.
// - BarChart "Unpaid by Currency" → CSS-bar list.
// ak-h8ab (FE-17 redesign) piles on:
// - Overdue hero card at page-top with 3 agent-chat-dispatched actions
//   (Draft follow-up email / Mark paid / View invoice).
// - 4-KPI grid promoted — Paid-this-FY gradient hero / Monthly-avg /
//   Avg-invoice / Collection-rate.
// - Recurring card (sample until BE recurring-detector lands).
// - FY-for-CA card with "Prepare PDF" FE-side generation via pdf-lib
//   (ak-cw3d pattern; already a project dep).
// - Recent invoices compact footer "All invoices →".
import {
    fetchFreelanceDashboard,
    fetchInvoiceById,
} from "../../services/freelanceService";
import {FreelanceDashboard as DashboardData, FreelanceEarning, InvoiceData} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import {useAgentChatBridge} from "../../contexts/AgentChatBridgeContext";
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
    // ak-h8ab: AgentChatBridge handle — used by Overdue hero actions
    // (Draft follow-up email + Mark paid). Mirrors the ak-inli drawer-
    // Links + ak-v1f5 prompt-strip dispatch shape: setCommand type
    // "send_message" with a pre-filled payload; agent handles the
    // actual composition / mutation path from there.
    const {setCommand: setAgentCommand} = useAgentChatBridge();

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

    // ak-hpd3: palette for the Nocturne CSS-bar list (Client Distribution +
    // Unpaid by Currency). Tokens cycle through the accent + accent-2 ramps
    // so bars read as a varied-but-related family; neutral-600 is the
    // last fallback when there are more bars than palette slots. Values
    // are CSS variables so a design-system refresh retunes the bars
    // without touching the component.
    const BAR_PALETTE = [
        "var(--color-accent-500)",
        "var(--color-accent-2-500)",
        "var(--color-accent-700)",
        "var(--color-accent-2-700)",
        "var(--color-accent-300)",
        "var(--color-accent-2-300)",
        "var(--color-neutral-500)",
        "var(--color-neutral-600)",
    ];

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

    // ak-hpd3: `paidVsUnpaidData` useMemo removed — it only fed the
    // duplicate "Monthly Paid Earnings (Bar)" recharts chart that
    // duplicated the primary gap-aware SVG. The primary SVG consumes
    // `filteredMonthlyData` directly.

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

    // ak-h8ab: pick the top overdue invoice for the hero card. Priority
    // ordering: oldest date (most delinquent) first, then largest INR
    // amount as the tie-breaker. The hero card is top-of-page per brief
    // 06 §6/§7 — the design puts the daily-action affordance before any
    // of the KPIs.
    //
    // ak-h8ab MINOR-1 fix (reviewer-flagged): the tie-breaker uses
    // `a.amount` directly (NOT `paidAmount ?? amount`) — for overdue
    // invoices, BE emits `paidAmount: 0` not null, so the ?? coalesce
    // never falls through and both sides evaluate to 0, silently
    // no-oping the sub-sort. `a.amount` is the billed amount (always
    // present on an invoice) and is the right tie-breaker here.
    const topOverdueInvoice: FreelanceEarning | null = useMemo(() => {
        if (!dashboardData?.recentInvoices?.length) return null;
        const overdues = dashboardData.recentInvoices.filter(
            (inv) => inv.status === "overdue",
        );
        if (!overdues.length) return null;
        // Sort: oldest first; tie-broken by largest INR-normalised amount.
        const sorted = [...overdues].sort((a, b) => {
            const dateDiff = a.date.localeCompare(b.date); // ISO strings
            if (dateDiff !== 0) return dateDiff;
            const aAmt = getINRConversion(a.amount, a.currency ?? "INR");
            const bAmt = getINRConversion(b.amount, b.currency ?? "INR");
            return bAmt - aAmt;
        });
        return sorted[0];
    }, [dashboardData, getINRConversion]);

    // ak-h8ab: generic agent-chat dispatcher — same shape as ak-inli /
    // ak-v1f5. Fires `setCommand({type:"send_message", payload})` and
    // opens the drawer with the payload pre-filled; agent's tool-use
    // layer handles the composition / mutation step.
    const dispatchAgent = useCallback((payload: string) => {
        setAgentCommand({
            type: "send_message",
            payload,
            timestamp: Date.now(),
        });
    }, [setAgentCommand]);

    // ak-h8ab (FE-17): build the FY summary PDF for the CA. FE-side
    // pdf-lib generation per lead's ruling (no new BE endpoint); same
    // pattern as ak-cw3d's identity-doc watermarker. Save-to-download.
    // The FY window is the CURRENT Indian FY (April 1 — March 31) —
    // filters the dashboard's `earningsByMonth` + `recentInvoices` to
    // that window so the CA sees the correct year even if the viewer's
    // current Range filter is something else.
    const [preparingFyPdf, setPreparingFyPdf] = useState<boolean>(false);
    const prepareFyCaPdf = useCallback(async () => {
        if (!dashboardData) return;
        setPreparingFyPdf(true);
        try {
            const {PDFDocument, rgb, StandardFonts} = await import("pdf-lib");
            const fy = getFYDates(0);
            const fyStart = fy.start;
            const fyEnd = fy.end;
            const fyLabel = `FY ${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}`;
            // Rendered-date is IST per §23 #7 (matches PortfolioTrendChart /
            // Home / InvestmentsLanding / WealthDigest).
            const istDate = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
            }).format(new Date());

            const fyMonthKeys = (dashboardData.earningsByMonth ?? []).filter((m) => {
                const [y, mm] = m.month.split("-").map(Number);
                if (!Number.isFinite(y) || !Number.isFinite(mm)) return false;
                const dt = new Date(y, mm - 1, 1);
                return dt >= fyStart && dt <= fyEnd;
            });
            const fyEarnings = fyMonthKeys.reduce((s, m) => s + m.earnings, 0);

            // ak-h8ab MAJOR fix (reviewer-flagged, tax-correctness):
            // the pre-fix boundary compared against
            // `fyStart.toISOString().slice(0, 10)` which emits UTC —
            // for an IST-local-midnight Apr-1 Date this shifts back to
            // `…-03-31` (prior-FY) and the Mar-31 end shifts back to
            // `…-03-30` (current-FY). Result: prior-FY Mar-31 invoices
            // leaked IN; current-FY Mar-31 invoices got DROPPED.
            // Both are tax-document-level wrong for a CA-facing export.
            //
            // Fix: build literal YYYY-MM-DD strings from year integers
            // directly. `inv.date` is already an ISO "YYYY-MM-DD" string
            // (per FreelanceEarning interface), so string-compare is
            // TZ-immune. The current-FY start-year = fyStart.getFullYear();
            // the end-year is start+1 (Indian FY = Apr-1 → Mar-31).
            const fyStartStr = `${fyStart.getFullYear()}-04-01`;
            const fyEndStr = `${fyStart.getFullYear() + 1}-03-31`;
            const fyInvoices = (dashboardData.recentInvoices ?? []).filter(
                (inv) => inv.date >= fyStartStr && inv.date <= fyEndStr,
            );
            const paidCount = fyInvoices.filter((i) => i.status === "paid").length;
            const pendingCount = fyInvoices.filter(
                (i) => i.status !== "paid" && i.status !== "overdue",
            ).length;
            const overdueCount = fyInvoices.filter((i) => i.status === "overdue").length;
            const avgInv = fyInvoices.length > 0
                ? fyEarnings / Math.max(1, paidCount)
                : 0;

            const doc = await PDFDocument.create();
            const page = doc.addPage([595.28, 841.89]); // A4
            const regular = await doc.embedFont(StandardFonts.Helvetica);
            const bold = await doc.embedFont(StandardFonts.HelveticaBold);

            let y = 800;
            const left = 50;
            const text = (s: string, size: number, isBold = false, color = rgb(0.1, 0.1, 0.15)) => {
                page.drawText(s, {
                    x: left, y, size,
                    font: isBold ? bold : regular,
                    color,
                });
                y -= size * 1.5;
            };
            const line = () => {
                page.drawLine({
                    start: {x: left, y: y + 6},
                    end: {x: 545, y: y + 6},
                    thickness: 0.5,
                    color: rgb(0.85, 0.85, 0.9),
                });
                y -= 10;
            };

            text("Freelance FY Summary for CA", 18, true);
            text(`${fyLabel}  ·  Prepared ${istDate} IST`, 10, false, rgb(0.4, 0.4, 0.5));
            y -= 6;
            line();

            text("Earnings", 13, true);
            text(`Total paid earnings (INR): Rs. ${fyEarnings.toFixed(2)}`, 11);
            text(`Invoices (paid): ${paidCount}`, 11);
            text(`Average invoice value (INR): Rs. ${avgInv.toFixed(2)}`, 11);
            y -= 4;
            line();

            text("Invoice breakdown", 13, true);
            text(`Paid: ${paidCount}`, 11);
            text(`Pending: ${pendingCount}`, 11);
            text(`Overdue: ${overdueCount}`, 11);
            text(`Total invoices in FY: ${fyInvoices.length}`, 11);
            y -= 4;
            line();

            text("Monthly breakdown", 13, true);
            if (fyMonthKeys.length === 0) {
                text("No month entries emitted for this FY.", 10, false, rgb(0.5, 0.5, 0.55));
            } else {
                page.drawText("Month", {
                    x: left, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.4),
                });
                page.drawText("Earnings (INR)", {
                    x: left + 220, y, size: 10, font: bold, color: rgb(0.3, 0.3, 0.4),
                });
                y -= 16;
                for (const m of fyMonthKeys) {
                    page.drawText(formatMonthLabel(m.month), {
                        x: left, y, size: 10, font: regular,
                    });
                    page.drawText(`Rs. ${m.earnings.toFixed(2)}`, {
                        x: left + 220, y, size: 10, font: regular,
                    });
                    y -= 14;
                    if (y < 60) break;
                }
            }

            const bytes = await doc.save();
            const copy = new Uint8Array(bytes).buffer;
            const blob = new Blob([copy], {type: "application/pdf"});
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `freelance-fy-${fyStart.getFullYear()}-${String(fyEnd.getFullYear()).slice(2)}-${istDate}.pdf`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setPayload({type: "success", message: "FY summary PDF prepared"});
        } catch {
            setPayload({type: "error", message: "Failed to prepare FY summary PDF"});
        } finally {
            setPreparingFyPdf(false);
        }
    }, [dashboardData, setPayload]);

    // ak-h8ab: Recurring card SAMPLE data per bead. BE recurring-
    // detector pass pending; swap to a live list when it lands.
    // Shape mirrors the ak-4qgd Transactions "Recurring" sample.
    const SAMPLE_RECURRING_CLIENTS: {name: string; cadence: string; next: string; amount: number}[] = [
        {name: "RDE Advisors", cadence: "Monthly", next: "5 Dec", amount: 85000},
        {name: "SoulTalk", cadence: "Monthly", next: "12 Dec", amount: 42000},
    ];

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

            {/* ak-h8ab Overdue hero card (new) — daily-action affordance
                per brief 06 §6/§7. Orange-edge wrapper, oldest-overdue
                invoice (tie-broken by amount) rendered with 3 actions
                that dispatch via AgentChatBridge (except View which
                routes through the existing in-page preview dialog). */}
            {topOverdueInvoice && (
                <div className={ownStyles.overdueHero}>
                    <div className={ownStyles.overdueHeroSide} aria-hidden="true"/>
                    <div className={ownStyles.overdueHeroBody}>
                        <div className={ownStyles.overdueHeroKicker}>
                            <i className="ph ph-warning" aria-hidden="true"/>
                            <span>Overdue · action required</span>
                        </div>
                        <div className={ownStyles.overdueHeroTitle}>
                            <span className={ownStyles.overdueHeroClient}>
                                {topOverdueInvoice.clientName}
                            </span>
                            <span className={ownStyles.overdueHeroInvoice}>
                                {" · "}{topOverdueInvoice.invoiceNumber}
                            </span>
                        </div>
                        <div className={ownStyles.overdueHeroAmount}>
                            {topOverdueInvoice.status === "paid"
                                ? formatBaseCurrency(topOverdueInvoice.paidAmount || topOverdueInvoice.amount)
                                : formatCurrency(topOverdueInvoice.amount, topOverdueInvoice.currency || "INR")}
                            <span className={ownStyles.overdueHeroDate}>
                                {" · due "}{new Date(topOverdueInvoice.date).toLocaleDateString()}
                            </span>
                        </div>
                        <div className={ownStyles.overdueHeroActions}>
                            <button
                                type="button"
                                className={`btn btn-primary ${ownStyles.overdueHeroBtn}`}
                                onClick={() => {
                                    dispatchAgent(
                                        `Draft a polite follow-up email to ${topOverdueInvoice.clientName} about overdue invoice ${topOverdueInvoice.invoiceNumber} (due ${new Date(topOverdueInvoice.date).toLocaleDateString()}, amount ${formatCurrency(topOverdueInvoice.amount, topOverdueInvoice.currency || "INR")}). I will review and send it from my email client.`,
                                    );
                                }}
                            >
                                <i className="ph ph-envelope" aria-hidden="true"/>
                                <span>Draft follow-up email</span>
                            </button>
                            <button
                                type="button"
                                className={`btn btn-secondary ${ownStyles.overdueHeroBtn}`}
                                onClick={() => {
                                    dispatchAgent(
                                        `Mark invoice ${topOverdueInvoice.invoiceNumber} from ${topOverdueInvoice.clientName} as paid (was ${formatCurrency(topOverdueInvoice.amount, topOverdueInvoice.currency || "INR")}, due ${new Date(topOverdueInvoice.date).toLocaleDateString()}).`,
                                    );
                                }}
                            >
                                <i className="ph ph-check-circle" aria-hidden="true"/>
                                <span>Mark paid…</span>
                            </button>
                            <button
                                type="button"
                                className={`btn btn-ghost ${ownStyles.overdueHeroBtn}`}
                                onClick={() => handleInvoiceClick(topOverdueInvoice.invoiceNumber)}
                            >
                                <i className="ph ph-eye" aria-hidden="true"/>
                                <span>View invoice</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ak-h8ab 4-KPI grid — Paid-this-FY (gradient hero) /
                Monthly Avg / Avg Invoice / Collection Rate. Replaces
                the pre-ak-h8ab 3-KPI (Total Paid / Unpaid / Monthly)
                per brief 06 §6. Unpaid-Value replaced by Avg Invoice
                (promoted from secondary); Collection Rate promoted
                from secondary. Monthly-avg keeps its vs-prev-period
                trend chip since it's the time-series KPI. */}
            <div className={ownStyles.kpiGrid}>
                <div className={`${ownStyles.kpiCard} ${ownStyles.kpiCardHero}`}>
                    <div className={ownStyles.kpiLabel}>Paid this FY</div>
                    <div className={ownStyles.kpiValue}>
                        {formatBaseCurrency(activePreset === "allTime" || (!startDate && !endDate) ? dashboardData.totalEarnings : filteredTotalEarnings)}
                    </div>
                    <div className={ownStyles.kpiSub}>
                        {activePreset === "allTime" || (!startDate && !endDate) ? "All time (FY filter unset)" : "Filtered to current range"}
                    </div>
                </div>
                <div className={ownStyles.kpiCard}>
                    <div className={ownStyles.kpiLabel}>
                        Monthly avg ({filteredMonthlyData.length} mo)
                    </div>
                    <div className={ownStyles.kpiValue}>
                        {formatBaseCurrency(filteredMonthlyData.length > 0 ? filteredTotalEarnings / filteredMonthlyData.length : 0)}
                    </div>
                    {renderTrend(monthlyTrend, "vs prev period")}
                </div>
                <div className={ownStyles.kpiCard}>
                    <div className={ownStyles.kpiLabel}>Average invoice</div>
                    <div className={ownStyles.kpiValue}>
                        {formatBaseCurrency(avgInvoiceValue)}
                    </div>
                    <div className={ownStyles.kpiSub}>
                        Across {dashboardData.completedProjects} projects
                    </div>
                </div>
                <div className={ownStyles.kpiCard}>
                    <div className={ownStyles.kpiLabel}>Collection rate</div>
                    <div
                        className={ownStyles.kpiValue}
                        style={{color: collectionRate >= 80
                            ? "oklch(0.80 0.13 155)"
                            : collectionRate >= 50
                                ? "oklch(0.82 0.12 75)"
                                : "oklch(0.74 0.15 25)"}}
                    >
                        {collectionRate.toFixed(0)}%
                    </div>
                    <div className={ownStyles.kpiSub}>
                        Paid vs billed · {dashboardData.activeClients} active clients
                    </div>
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
                    <h3 className={styles.sectionTitle}>Who you work for</h3>
                    {/* ak-hpd3: PieChart replaced by a CSS-bar list.
                        Pie-slice angles are hard to compare across clients;
                        a sorted-descending horizontal-bar list reads at a
                        glance. Bar width = share of total paid earnings
                        (CONSUME from BE verbatim — the FE only aggregates
                        for the denominator, matching §23 #2). §4 PII:
                        client names are row-visible per the ak-9aqn
                        "row-level minimal" posture — the Freelance
                        Dashboard is the overseer's own surface. */}
                    {(() => {
                        const clients = (dashboardData.earningsByClient ?? [])
                            .filter((c) => c.earnings > 0)
                            .sort((a, b) => b.earnings - a.earnings);
                        if (clients.length === 0) {
                            return (
                                <div className={ownStyles.emptyRow}>
                                    No client earnings in the selected range.
                                </div>
                            );
                        }
                        const total = clients.reduce((s, c) => s + c.earnings, 0);
                        return (
                            <ul className={ownStyles.distList} aria-label="Earnings by client (sorted descending)">
                                {clients.map((c, i) => {
                                    const pct = total > 0 ? (c.earnings / total) * 100 : 0;
                                    const color = BAR_PALETTE[i % BAR_PALETTE.length];
                                    return (
                                        <li key={`${c.client}-${i}`} className={ownStyles.distRow}>
                                            <span className={ownStyles.distName} title={c.client}>
                                                {c.client}
                                            </span>
                                            <div className={ownStyles.distTrack} aria-hidden="true">
                                                <div
                                                    className={ownStyles.distFill}
                                                    style={{width: `${pct.toFixed(2)}%`, background: color}}
                                                />
                                            </div>
                                            <span className={ownStyles.distValue}>
                                                {formatBaseCurrency(c.earnings)}
                                            </span>
                                            <span className={ownStyles.distPct}>
                                                {pct.toFixed(1)}%
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        );
                    })()}
                </div>
            </div>

            {/* ak-hpd3: Monthly Paid Earnings (Bar) removed — it duplicated
                the primary gap-aware SVG "Monthly Paid Earnings (INR)" chart
                above (brief 06 §6 explicit duplication flag). The Unpaid-by-
                Currency breakdown is retained as unique information and
                re-skinned as a Nocturne CSS-bar list (matching the "Who you
                work for" list above — single visual language across the
                dashboard; no recharts). */}
            {dashboardData.unpaidByCurrency && dashboardData.unpaidByCurrency.length > 0 && (
                <div className={ownStyles.chartContainer} style={{marginBottom: 20}}>
                    <h3 className={styles.sectionTitle}>Unpaid by currency</h3>
                    {(() => {
                        const rows = (dashboardData.unpaidByCurrency ?? [])
                            .map((item) => ({
                                ...item,
                                inrAmount: getINRConversion(item.amount, item.currency),
                            }))
                            .filter((r) => r.inrAmount > 0 || r.amount > 0)
                            .sort((a, b) => b.inrAmount - a.inrAmount);
                        if (rows.length === 0) {
                            return (
                                <div className={ownStyles.emptyRow}>
                                    No unpaid invoices in the selected range.
                                </div>
                            );
                        }
                        const total = rows.reduce((s, r) => s + r.inrAmount, 0);
                        return (
                            <ul className={ownStyles.distList} aria-label="Unpaid amounts by currency (INR-equivalent, sorted descending)">
                                {rows.map((r, i) => {
                                    const pct = total > 0 ? (r.inrAmount / total) * 100 : 0;
                                    const color = BAR_PALETTE[i % BAR_PALETTE.length];
                                    return (
                                        <li key={r.currency} className={ownStyles.distRow}>
                                            <span className={ownStyles.distName}>
                                                {r.currency}
                                                {typeof r.count === "number" && r.count > 0 && (
                                                    <span className={ownStyles.distNameSub}>
                                                        {" · "}{r.count} invoice{r.count === 1 ? "" : "s"}
                                                    </span>
                                                )}
                                            </span>
                                            <div className={ownStyles.distTrack} aria-hidden="true">
                                                <div
                                                    className={ownStyles.distFill}
                                                    style={{width: `${pct.toFixed(2)}%`, background: color}}
                                                />
                                            </div>
                                            <span className={ownStyles.distValue}>
                                                {formatBaseCurrency(r.inrAmount)}
                                            </span>
                                            <span className={ownStyles.distPct}>
                                                {pct.toFixed(1)}%
                                            </span>
                                        </li>
                                    );
                                })}
                            </ul>
                        );
                    })()}
                </div>
            )}
            </ErrorBoundary>

            {/* ak-h8ab Recurring card (sample data). Lead ruling: BE
                recurring-detector hasn't landed yet; surface the UX with
                a sample list + "Save as templates" affordance so the
                shape is carved out. Swap the array for a BE-fed list
                when the detector lands; card chrome is unchanged. */}
            <div className={ownStyles.sideCard}>
                <div className={ownStyles.sideCardHeader}>
                    <h4 className={ownStyles.sideCardTitle}>Recurring</h4>
                    <span className={ownStyles.sampleChip}>Sample</span>
                </div>
                <ul className={ownStyles.recurList}>
                    {SAMPLE_RECURRING_CLIENTS.map((r) => (
                        <li key={r.name} className={ownStyles.recurItem}>
                            <div className={ownStyles.recurLeft}>
                                <span className={ownStyles.recurVendor}>{r.name}</span>
                                <span className={ownStyles.recurMeta}>
                                    {r.cadence} \u00b7 next {r.next}
                                </span>
                            </div>
                            <span className={ownStyles.recurAmount}>
                                {formatBaseCurrency(r.amount)}
                            </span>
                        </li>
                    ))}
                </ul>
                <div className={ownStyles.sideCardFooter}>
                    <button
                        type="button"
                        className={`btn btn-secondary ${ownStyles.sideCardBtn}`}
                        onClick={() => dispatchAgent(
                            "Save my recurring freelance clients as invoice templates so I can re-issue next month with a single click.",
                        )}
                    >
                        <i className="ph ph-bookmark-simple" aria-hidden="true"/>
                        <span>Save as templates</span>
                    </button>
                    <span className={ownStyles.sideCardHint}>
                        BE detector pending
                    </span>
                </div>
            </div>

            {/* ak-h8ab FY-for-CA card with "Prepare PDF". FE-side
                pdf-lib generation per lead's ruling \u2014 pdf-lib is
                already a project dep (ak-cw3d / DocumentSigner).
                Save-to-download (not Files vault for v1). FY window =
                CURRENT Indian FY; \u00a77 IST timestamp on the rendered
                PDF. */}
            <div className={ownStyles.sideCard}>
                <div className={ownStyles.sideCardHeader}>
                    <h4 className={ownStyles.sideCardTitle}>
                        {(() => {
                            const fy = getFYDates(0);
                            return `FY ${fy.start.getFullYear()}-${String(fy.end.getFullYear()).slice(2)} summary for your CA`;
                        })()}
                    </h4>
                </div>
                <p className={ownStyles.fyCaLead}>
                    One-click PDF summarising this financial year's earnings,
                    invoice breakdown, and monthly roll-up \u2014 ready to hand
                    to your chartered accountant. Generated locally; nothing
                    is uploaded.
                </p>
                <div className={ownStyles.sideCardFooter}>
                    <button
                        type="button"
                        className={`btn btn-primary ${ownStyles.sideCardBtn}`}
                        onClick={prepareFyCaPdf}
                        disabled={preparingFyPdf}
                    >
                        {preparingFyPdf ? (
                            <>
                                <i className="ph ph-circle-notch" aria-hidden="true"/>
                                <span>Preparing\u2026</span>
                            </>
                        ) : (
                            <>
                                <i className="ph ph-file-pdf" aria-hidden="true"/>
                                <span>Prepare PDF</span>
                            </>
                        )}
                    </button>
                    <span className={ownStyles.sideCardHint}>
                        Saved to downloads \u00b7 IST-dated filename
                    </span>
                </div>
            </div>

            {/* ak-h8ab: Recent Invoices with compact footer. Pre-redesign
                had the "View All" affordance at the TOP of the card;
                design per brief 06 \u00a76 wants a compact footer link "All
                invoices \u2192" at the BOTTOM. Also removed the pre-ak-h8ab
                secondary-metrics row entirely \u2014 Completed-Projects +
                Active-Clients were low-signal; the 4-KPI grid above now
                carries Avg-invoice + Collection-rate. */}
            <div className={ownStyles.chartContainer}>
                <div className={ownStyles.recentInvoicesHeader}>
                    <h3 className={styles.sectionTitle} style={{marginBottom: 0, borderBottom: "none", paddingBottom: 0}}>
                        Recent invoices
                    </h3>
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
                {onNavigateToManage && (
                    <div className={ownStyles.recentInvoicesFooter}>
                        <button
                            type="button"
                            className={`btn btn-ghost ${ownStyles.recentInvoicesLink}`}
                            onClick={onNavigateToManage}
                        >
                            <span>All invoices</span>
                            <i className="ph ph-arrow-right" aria-hidden="true"/>
                        </button>
                    </div>
                )}
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
