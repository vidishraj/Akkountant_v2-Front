import {useEffect, useMemo, useState} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {
    makeDriveTokenRequest,
    makeTokenRequest,
} from "../../services/GoogleApiUtils.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useInvestmentSummaries} from "../../hooks/useInvestmentSummaries.ts";
import {MSN_SUMMARY_KEYS} from "../../utils/portfolioTotals.ts";
import {buildAttentionItems, digestStaleSinceLabel as formatDigestStaleSince} from "../../utils/attentionItems.ts";
import {useKite} from "../../contexts/KiteContext.tsx";
import {useWealthDigest} from "../../contexts/WealthDigestContext.tsx";
import {useAgentChatBridge} from "../../contexts/AgentChatBridgeContext.tsx";
import {fetchFreelanceDashboard} from "../../services/freelanceService.ts";
import {fetchTransactions} from "../../services/transactionService.ts";
import {fetchPortfolioTrend} from "../../services/wealthDigestService.ts";
import {refreshReconIssuesCount, setReconIssuesCount, useReconIssuesCount} from "../../services/reconCountStore.ts";
import {fetchOptedBanks} from "../../services/transactionService.ts";
import {listVaultFiles} from "../../services/fileStorageService.ts";
import {activityDate, activityMemo, bankDisplayName, invoiceAmount} from "../../utils/displayFormat.ts";
import {currentFyMonths, monthlyAverage, toMonth, unpaidTotalInINR} from "../../utils/freelanceMetrics.ts";
import {currencyService} from "../../services/currencyService.ts";
import ReconciliationDialog from "../../components/ReconciliationDialog/ReconciliationDialog.tsx";
import {formatCompact, formatCurrency} from "../../components/WealthDigest/formatters.ts";
import {getRowDayChangeAmount} from "../../utils/holdings.ts";
import type {FreelanceDashboard, FreelanceEarning, MSNListResponse, Transaction} from "../../utils/interfaces.ts";
import type {AgentType} from "../../services/agentService.ts";
import style from "./Home.module.scss";

/**
 * FE-2 (ak-7mru) Home status dashboard. Replaces the legacy 4-lottie
 * landing with the design/Home.dc.html layout:
 *
 *   [date + 'N things need you today' + Hide toggle]
 *   [omni Ask bar + 4 sample prompt chips]
 *   [alerts strip]
 *   [KPI grid: Portfolio hero (sparkline) · Paid · Owed · Ledger net]
 *   ┌─────────────── main column ───────────────┐  ┌─ right rail ─┐
 *   │ From your Wealth Digest + pulse + cards   │  │ Quick start  │
 *   │ Recent activity feed                      │  │ Jump to …    │
 *   └───────────────────────────────────────────┘  └──────────────┘
 *
 * Data wiring consumes existing BE surfaces only (per bead "no new BE").
 * Every color / space / radius / shadow comes from Nocturne tokens via
 * `var(--...)` in Home.module.scss.
 *
 * Cross-cutting (§23) honored:
 * - day_change_known gate: Today line shows '—' unless ALL per-asset MSN
 *   summaries have `marketStatus: true` AND at least one has a non-zero
 *   changeAmount. Never displays '₹0 / 0%' ambiguous.
 * - Hide toggle masks amount faces with '₹ ••••'; sparkline is kept because
 *   it carries no explicit rupee readout — only shape.
 * - Omni bar routes to the in-page AgentChat drawer on the content page
 *   that owns that agent — NOT the per-page AgentHeaderInput — via
 *   `useAgentChatBridge().setCommand({type:'send_message', ...})` after
 *   navigating. Lands the message in the destination page's drawer.
 * - INR formatting uses the shared `formatCurrency` / `formatCompact`
 *   helpers (en-IN locale, tabular-nums via SCSS).
 * - IST dates via Intl.DateTimeFormat('en-IN', {timeZone:'Asia/Kolkata'}).
 *
 * Google Drive / Google-services OAuth callback handling is preserved
 * verbatim from the pre-FE-2 Home — this page is the OAuth redirect
 * landing surface.
 */

// ─────────────────────────────────────────────────────────────── helpers ──
// Signed-money OKLCH triples match the design's gain/loss/warning hues.
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";
const CLR_WARN = "oklch(0.82 0.12 75)";


function todayISTLabel(): string {
    // "Thursday, 12 November · IST" — design kicker shape.
    const parts = new Intl.DateTimeFormat("en-IN", {
        timeZone: "Asia/Kolkata",
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(new Date());
    return `${parts} · IST`;
}

function routeForText(text: string): {
    key: AgentType;
    label: string;
    icon: string;
    href: string;
} {
    const t = (text || "").toLowerCase();
    if (/invoice|client|freelance|overdue|customer|paid me|rde|soultalk|traivibe/.test(t)) {
        return {key: "freelance", label: "Freelance assistant", icon: "ph-briefcase", href: "/freelance"};
    }
    if (/spend|spent|transaction|atm|debit|credit card|merchant|upi|withdraw|bank/.test(t)) {
        return {key: "transaction", label: "Transactions assistant", icon: "ph-receipt", href: "/transactions"};
    }
    return {key: "investment", label: "Investment assistant", icon: "ph-chart-line-up", href: "/investments"};
}

/**
 * Builds an SVG path for a 200x50 viewBox sparkline over the given series.
 * Returns null when series has fewer than 2 points — caller renders a
 * design-matched placeholder (dashed 'Sample trend' chip) in that case.
 */
function sparklinePath(values: number[]): string | null {
    const clean = values.filter((v): v is number => Number.isFinite(v));
    if (clean.length < 2) return null;
    const mn = Math.min(...clean);
    const mx = Math.max(...clean);
    const spread = mx - mn || 1;
    const stepX = 200 / (clean.length - 1);
    const coords = clean.map((p, i) => {
        const x = (i * stepX).toFixed(1);
        const y = (46 - ((p - mn) / spread) * 42).toFixed(1);
        return `${x},${y}`;
    });
    return `M${coords.join("L")}`;
}

/**
 * Aggregates day change by consuming the authoritative per-row
 * `getRowDayChangeAmount` helper (utils/holdings.ts) across the MSN holdings
 * lists. (ak-s74k: the currentValue / invested / profit totals moved to the
 * shared `useInvestmentSummaries` hook + utils/portfolioTotals.)
 *
 * **ak-7mru CRITICAL (reviewer-caught)**: a previous revision summed
 * `MSNSummaryResponse.changeAmount` into both `profit` AND `dayChange`. But
 * `changeAmount` is total unrealized P&L in MSNSummary semantics (see
 * MSNContext.tsx and interfaces.ts — there is NO day-change field on the
 * summary), so using it as a day delta rendered lifetime P&L in the hero's
 * "Today" line. Fixed by:
 *   - `profit` keeps `changeAmount` as its sole source (correct — lifetime P&L).
 *   - `dayChange` + `dayChangeKnown` derive from per-row MSN holdings via
 *     `getRowDayChangeAmount` (the BE-authoritative ₹-amount — carries the
 *     ak-4o41 `day_change_known` gate AND the broker > market-feed source
 *     precedence). EPG assets (epf/ppf/gold) don't have a day-change concept
 *     and don't contribute.
 *
 * `dayChangeKnown` rules (strict — "unknown, not flat" per rule §23#3):
 *   - no MSN holdings loaded yet                          → false, render '—'
 *   - any single MSN row returns `null` from the helper   → false, render '—'
 *     (we don't know the portfolio-level total; one row of ambiguity poisons
 *     the aggregate — the honest render is '—', NEVER substitute lifetime P&L)
 *   - every MSN row returned a finite ₹ value             → true, sum them
 */
function deriveDayChange(
    lists: Record<string, MSNListResponse[] | undefined>,
): {
    dayChange: number;
    dayChangeKnown: boolean;
} {
    // Day change — consume authoritative per-row helper. Any unknown row
    // poisons the aggregate per the §23#3 "unknown, not flat" rule.
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
    if (!dayChangeKnown) dayChange = 0; // callers must gate on the flag; zero out to avoid leak

    return {dayChange, dayChangeKnown};
}

const MASK = "₹ ••••";
const money = (v: number, hide: boolean, compact = false): string => {
    if (hide) return MASK;
    if (compact) return `₹${formatCompact(v)}`;
    return `₹${formatCurrency(v)}`;
};

// ─────────────────────────────────────────────────────────────── page ──
const Home = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const {state: msnState} = useMSNContext();
    const {state: kiteState} = useKite();
    const {digest} = useWealthDigest();
    const {setCommand} = useAgentChatBridge();

    // Google Drive / Google services OAuth callback handling — preserved
    // verbatim from the pre-FE-2 Home (Home is the OAuth redirect landing).
    useEffect(() => {
        const scope = searchParams.get("scope");
        const code = searchParams.get("code");
        if (code && scope && code.length > 0) {
            if (scope.endsWith("drive.file")) {
                makeDriveTokenRequest(code).catch((error) => {
                    console.error("Drive token request error:", error);
                });
            } else {
                makeTokenRequest(code).catch((error) => {
                    console.error("Token request error:", error);
                });
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const [hide, setHide] = useState<boolean>(false);
    const [omni, setOmni] = useState<string>("");

    // ── async wiring (mounts once; services cached via AxiosQueueManager) ──
    const [freelance, setFreelance] = useState<FreelanceDashboard | null>(null);
    const [recentTx, setRecentTx] = useState<Transaction[]>([]);
    // ak-5rg0 (ak-p3id companion): rebound to the new canonical BE
    // fields `in_sum` (≥ 0) + `out_sum` (≥ 0) + signed `net`
    // (in_sum − out_sum). Pre-ak-p3id the Home ledger tile read raw
    // `credit_sum` / `debit_sum` where `credit_sum` was signed-
    // negative magnitude of inflows, so the FE-side subtraction
    // flipped the sign — "+In > Out" rendered as negative. Now
    // CONSUMEd verbatim from BE.
    const [ledgerIn, setLedgerIn] = useState<number>(0);
    const [ledgerOut, setLedgerOut] = useState<number>(0);
    const [ledgerNetFromBe, setLedgerNetFromBe] = useState<number>(0);
    const [trend, setTrend] = useState<{date: string; value: number}[] | null>(null);
    // ak-j8tc (FE companion to ak-cipj BE): open-reconciliation-issues
    // count powers the alerts-strip 4th slot (replacing the pre-
    // ak-j8tc `sample: true` placeholder). CONSUMEd verbatim from
    // BE's `response.count` — never re-derived from `issues.length`.
    // Null until the first fetch resolves so we can distinguish
    // "haven't checked yet" from "checked, count = 0" (suppress
    // the card entirely in the 0 case per bead design).
    // ak-h5jk: shared with the header bell (services/reconCountStore) so the
    // badge and this strip always show the same count.
    const reconIssuesCount = useReconIssuesCount();
    // Jump-to counts (design: "11,582 rows · 7 accounts", "24 documents · 5 folders").
    const [txTotal, setTxTotal] = useState<number | null>(null);
    const [accountCount, setAccountCount] = useState<number | null>(null);
    const [vaultCounts, setVaultCounts] = useState<{files: number; folders: number} | null>(null);
    const [reconDialogOpen, setReconDialogOpen] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;
        fetchFreelanceDashboard()
            .then((d) => {
                if (!cancelled) setFreelance(d);
            })
            .catch(() => {
                if (!cancelled) setFreelance(null);
            });
        // ak-f9kg: ask for NEWEST first. Without `sorted` the BE returned page
        // 1 in its default order, so "Recent activity" showed months-old rows.
        fetchTransactions({Page: 1, Filter: {sorted: {column: "date", order: "desc"}, limit: 10}})
            .then((res) => {
                if (cancelled) return;
                setRecentTx(res.results || []);
                setTxTotal(Number.isFinite(Number(res.total_count)) ? Number(res.total_count) : null);
                // ak-5rg0: CONSUME ak-p3id canonical fields verbatim.
                // No FE-side subtraction / sign-flip; the BE's `net`
                // is already `in_sum - out_sum` with the correct sign.
                setLedgerIn(Number(res.in_sum) || 0);
                setLedgerOut(Number(res.out_sum) || 0);
                setLedgerNetFromBe(Number(res.net) || 0);
            })
            .catch(() => {
                if (!cancelled) {
                    setRecentTx([]);
                    setLedgerIn(0);
                    setLedgerOut(0);
                    setLedgerNetFromBe(0);
                }
            });
        fetchPortfolioTrend(90)
            .then((pts) => {
                if (!cancelled) setTrend(pts);
            })
            .catch(() => {
                if (!cancelled) setTrend([]);
            });
        // ak-j8tc: fetch open-reconciliation-issue count. CONSUMEd
        // verbatim from BE's `response.count` — never recomputed from
        // the list length. Transport failure leaves count at null so
        // the alerts strip stays empty rather than flashing a false
        // "0 issues" state.
        void refreshReconIssuesCount();
        // ak-h5jk: jump-to counts. Read-only, axios-cached; failures just
        // fall back to the generic sublabel.
        fetchOptedBanks()
            .then((banks) => {
                if (!cancelled) setAccountCount(Array.isArray(banks) ? banks.length : null);
            })
            .catch(() => undefined);
        listVaultFiles(null)
            .then((v) => {
                if (!cancelled) setVaultCounts({files: v.files?.length ?? 0, folders: v.folders?.length ?? 0});
            })
            .catch(() => undefined);
        return () => {
            cancelled = true;
        };
    }, []);

    // ── derived state ──────────────────────────────────────────────────
    // ak-s74k: Home never loaded the summaries, so a cold /home summed the
    // zero initial state and showed ₹0. The hook loads them and only yields
    // totals once all six have resolved; until then the tile shows "—".
    const {
        readiness: portfolioReadiness,
        totals: portfolioTotals,
        stale: portfolioStale,
        retry: retryPortfolio,
    } = useInvestmentSummaries();
    const {dayChange, dayChangeKnown} = useMemo(
        () => deriveDayChange(msnState.lists as Record<string, MSNListResponse[] | undefined>),
        [msnState.lists],
    );
    const spark = useMemo(() => sparklinePath((trend || []).map((p) => p.value)), [trend]);
    const trendIsSample = spark === null; // dashed 'Sample trend' chip mirrors design

    const overdueInvoices = useMemo(() => {
        const list: FreelanceEarning[] = freelance?.recentInvoices || [];
        return list.filter((inv) => inv.status === "overdue");
    }, [freelance]);

    // ak-f9kg: SAME selectors as the Freelance dashboard (utils/freelanceMetrics).
    // "Owed to you" converts EVERY currency (the old code summed only the INR
    // row, so a USD-only overdue read ₹0); a missing FX rate is unknown ("—").
    const [fxVersion, setFxVersion] = useState(0);
    useEffect(() => {
        let alive = true;
        currencyService.updateExchangeRates()
            .catch(() => undefined)
            .finally(() => { if (alive) setFxVersion((v) => v + 1); });
        return () => { alive = false; };
    }, []);
    const unpaidTotalINR = useMemo(
        () => (freelance ? unpaidTotalInINR(freelance.unpaidByCurrency, (c) => currencyService.getRateToINR(c)) : null),
        // fxVersion: re-read once fresh rates land.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [freelance, fxVersion],
    );
    // FY monthly average — the dashboard's "Monthly avg" formula over the FY
    // months (BE fyStart/fyEnd, else the Indian FY containing today). The
    // old binding used BE `monthlyEarnings`, a different figure (read ₹0).
    const fyMonthlyAvg = useMemo(() => {
        if (!freelance) return null;
        const fy = currentFyMonths();
        return monthlyAverage(
            freelance.earningsByMonth,
            toMonth(freelance.fyStart) ?? fy.start,
            toMonth(freelance.fyEnd) ?? fy.end,
        );
    }, [freelance]);
    const moneyOrUnknown = (v: number | null | undefined, compact = true): string =>
        v === null || v === undefined || !Number.isFinite(v) ? "—" : money(v, hide, compact);

    const digestStale = digest?.last_error != null;
    const digestStaleSinceLabel = useMemo(
        () => formatDigestStaleSince(digest?.last_error?.at),
        [digest],
    );

    // ak-rns8: shared with the header inbox via utils/attentionItems so the
    // two surfaces always agree on what needs attention.
    const alerts = useMemo(
        () => buildAttentionItems({
            digestStale,
            digestStaleSinceLabel,
            kiteAuthenticated: kiteState.isAuthenticated,
            overdueInvoices,
            reconIssuesCount,
        }),
        [digestStale, digestStaleSinceLabel, kiteState.isAuthenticated, overdueInvoices, reconIssuesCount],
    );

    const attentionCount = alerts.filter((a) => !a.sample).length;
    const attentionLabel = ((): string => {
        if (attentionCount === 0) return "You're caught up";
        if (attentionCount === 1) return "1 thing needs you today";
        const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine"];
        const prefix = attentionCount < words.length ? words[attentionCount] : String(attentionCount);
        return `${prefix} things need you today`;
    })();

    const route = useMemo(() => routeForText(omni), [omni]);

    const omniSubmit = () => {
        const text = omni.trim();
        if (!text) return;
        // Set the agent-chat command FIRST so the destination page's drawer
        // picks it up on mount; then navigate. AgentChatBridgeContext holds
        // the command across navigation (it's at root-provider scope).
        setCommand({
            type: "send_message",
            payload: text,
            timestamp: Date.now(),
        });
        setOmni("");
        navigate(route.href);
    };

    const samplePrompts: {label: string; icon: string}[] = [
        {label: "How much did I spend at Agoda in September?", icon: "ph-receipt"},
        {label: "What's my MF allocation right now?", icon: "ph-chart-pie-slice"},
        {label: "Draft a follow-up for my oldest overdue invoice", icon: "ph-briefcase"},
        {label: "How much have I booked in realized P&L this fiscal year?", icon: "ph-chart-line-up"},
    ];

    const topAction = digest?.actions?.[0];
    const topWatch = digest?.watch_items?.[0];
    const pulseLede = useMemo(() => {
        if (!digest?.text) return "";
        // First paragraph only — strip leading whitespace, cap at the first
        // double-newline. Markdown emphasis is left intact; renderer is
        // plain text so asterisks show through, which is consistent with
        // the design's "pulse first paragraph only" treatment.
        // ak-f9kg #5: skip a disclaimer-only paragraph (e.g. "[Personal use
        // — not investment advice]"), so the card shows the first real one.
        const paras = digest.text.trim().split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        const isDisclaimer = (p: string) =>
            /^\[?\s*personal use\b.*not investment advice\s*\]?\.?$/i.test(p);
        return paras.find((p) => !isDisclaimer(p)) ?? "";
    }, [digest]);

    // Recent activity: merge last transactions + recent invoices, sorted
    // most-recent first, capped at 7. Ledger rows render +/- with gain/loss
    // colors; invoice rows render amount as-is with a status badge.
    const activity = useMemo(() => {
        type Row = {
            id: string;
            when: number;
            icon: string;
            title: string;
            sub: string;
            amt: string;
            color: string;
            badge?: string;
            badgeFg?: string;
            badgeBg?: string;
            href: string;
        };
        const out: Row[] = [];
        const ingestTx = (t: Transaction, idx: number) => {
            const amount = Number(t.amount);
            if (!Number.isFinite(amount)) return;
            const isCredit = amount > 0;
            out.push({
                id: `tx-${idx}-${t.referenceID || t.date}`,
                when: Date.parse(t.date) || 0,
                icon: isCredit ? "ph-arrow-down-left" : "ph-arrow-up-right",
                // ak-h5jk: bank memo kept verbatim but whitespace-collapsed
                // and with account/reference numbers masked; friendly bank
                // name + "Thu, Oct 1, 2026" date (design).
                title: activityMemo(t.details),
                sub: [bankDisplayName(t.bank), activityDate(t.date)].filter(Boolean).join(" · "),
                amt: hide
                    ? MASK
                    : `${isCredit ? "+" : "−"}₹${formatCurrency(Math.abs(amount))}`,
                color: isCredit ? CLR_GAIN : CLR_LOSS,
                href: "/transactions",
            });
        };
        const ingestInvoice = (inv: FreelanceEarning, idx: number) => {
            const isOverdue = inv.status === "overdue";
            const isPaid = inv.status === "paid";
            // ak-h5jk: original currency, locale-formatted ("$757.50", not
            // "USD757.50"); a missing amount is "—", not the privacy mask.
            const amt = hide ? MASK : invoiceAmount(inv.amount, inv.currency);
            out.push({
                id: `inv-${idx}-${inv.invoiceNumber}`,
                when: Date.parse(inv.date) || 0,
                icon: "ph-file-text",
                title: `${inv.invoiceNumber} · ${inv.clientName || inv.projectName || ""}`,
                sub: "Invoice",
                amt,
                color: "var(--color-text)",
                badge: isPaid ? "PAID" : isOverdue ? "OVERDUE" : "PENDING",
                badgeFg: isPaid ? CLR_GAIN : isOverdue ? CLR_LOSS : CLR_WARN,
                badgeBg: isPaid
                    ? `color-mix(in srgb, ${CLR_GAIN} 14%, transparent)`
                    : isOverdue
                        ? `color-mix(in srgb, ${CLR_LOSS} 16%, transparent)`
                        : `color-mix(in srgb, ${CLR_WARN} 14%, transparent)`,
                href: "/freelance",
            });
        };
        recentTx.slice(0, 7).forEach(ingestTx);
        (freelance?.recentInvoices || []).slice(0, 4).forEach(ingestInvoice);
        return out.sort((a, b) => b.when - a.when).slice(0, 7);
    }, [recentTx, freelance, hide]);

    // ak-5rg0: `ledgerNet` is now BE-authoritative — the signed
    // `net = in_sum - out_sum` field directly, no FE re-derivation.
    // Keeps CLAUDE.md money-math invariant: "No FE-side math on
    // these fields — CONSUME verbatim from BE."
    const ledgerNet = ledgerNetFromBe;

    const quickStart = [
        {icon: "ph-file-plus", label: "Create invoice", sub: "Freelance", href: "/freelance"},
        {icon: "ph-scan", label: "Scan a receipt", sub: "Transactions", href: "/transactions"},
        {icon: "ph-plus-circle", label: "Add a purchase", sub: "Investment assistant", href: "/investments"},
        {icon: "ph-upload-simple", label: "Upload a document", sub: "Files", href: "/files"},
    ];

    const areas = [
        {
            icon: "ph-newspaper",
            label: "Wealth Digest",
            sub: digestStale ? `Stale — task failing${digestStaleSinceLabel ? ` since ${digestStaleSinceLabel}` : ""}` : "Latest digest ready",
            subColor: digestStale ? CLR_LOSS : "var(--color-neutral-500)",
            href: "/wealth-digest",
        },
        {
            icon: "ph-chart-line-up",
            label: "Investments",
            sub: hide || !portfolioTotals
                ? "6 asset types"
                : `₹${formatCompact(portfolioTotals.currentValue)} · 6 asset types`,
            subColor: "var(--color-neutral-500)",
            href: "/investments",
        },
        {
            icon: "ph-receipt",
            label: "Transactions",
            sub: txTotal !== null
                ? `${txTotal.toLocaleString("en-IN")} rows${accountCount ? ` · ${accountCount} account${accountCount === 1 ? "" : "s"}` : ""}`
                : "Browse your ledger",
            subColor: "var(--color-neutral-500)",
            href: "/transactions",
        },
        {
            icon: "ph-briefcase",
            label: "Freelance",
            sub: overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue invoice${overdueInvoices.length === 1 ? "" : "s"}` : "No overdue invoices",
            subColor: overdueInvoices.length > 0 ? CLR_WARN : "var(--color-neutral-500)",
            href: "/freelance",
        },
        {
            icon: "ph-vault",
            label: "Files",
            sub: vaultCounts
                ? `${vaultCounts.files} document${vaultCounts.files === 1 ? "" : "s"} · ${vaultCounts.folders} folder${vaultCounts.folders === 1 ? "" : "s"}`
                : "Documents + statements",
            subColor: "var(--color-neutral-500)",
            href: "/files",
        },
    ];

    return (
        <div className={style.page}>
            <div className={style.col}>
                {/* ── date + headline + hide toggle ── */}
                <section className={style.headline}>
                    <div className={style.headlineText}>
                        <span className={style.headlineKicker}>{todayISTLabel()}</span>
                        <h2 className={style.headlineTitle}>{attentionLabel}</h2>
                    </div>
                    <span className={style.spacer}/>
                    <button
                        type="button"
                        onClick={() => setHide((v) => !v)}
                        className={`btn btn-secondary ${style.hideToggle}`}
                    >
                        <i className={`ph ${hide ? "ph-eye" : "ph-eye-slash"}`}/>
                        <span>{hide ? "Show amounts" : "Hide amounts"}</span>
                    </button>
                </section>

                {/* ── omni Ask bar ── */}
                <section className={style.omniSection}>
                    <div className={style.omni}>
                        <i className={`ph ph-sparkle ${style.omniSparkle}`}/>
                        <input
                            type="text"
                            value={omni}
                            onChange={(e) => setOmni(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && omniSubmit()}
                            placeholder="Ask Akkountant anything — spending, portfolio, invoices…"
                            className={style.omniInput}
                            aria-label="Ask Akkountant"
                        />
                        <span className={style.omniRoute}>
                            <i className={`ph ${route.icon}`}/>
                            <span>{route.label}</span>
                        </span>
                        <button
                            type="button"
                            onClick={omniSubmit}
                            className={`btn btn-primary btn-icon ${style.omniSend}`}
                            title="Ask"
                            aria-label="Submit"
                        >
                            <i className="ph ph-arrow-right"/>
                        </button>
                    </div>
                    <div className={style.omniPrompts}>
                        {samplePrompts.map((p) => (
                            <button
                                key={p.label}
                                type="button"
                                onClick={() => setOmni(p.label)}
                                className={style.omniPrompt}
                            >
                                <i className={`ph ${p.icon}`}/>
                                <span>{p.label}</span>
                            </button>
                        ))}
                    </div>
                </section>

                {/* ── alerts strip ── */}
                <section className={style.alerts}>
                    {alerts.map((a) => {
                        // ak-j8tc: the reconciliation alert opens the
                        // review drawer in place instead of navigating;
                        // every other alert keeps the legacy href +
                        // navigate(href) behaviour.
                        const isRecon = a.key === "recon-open";
                        return (
                            <a
                                key={a.key}
                                href={isRecon ? "#recon" : a.href}
                                onClick={(e) => {
                                    e.preventDefault();
                                    if (isRecon) {
                                        setReconDialogOpen(true);
                                    } else {
                                        navigate(a.href);
                                    }
                                }}
                                className={style.alertCard}
                                style={{boxShadow: `inset 0 0 0 1px ${a.edge}`}}
                            >
                                <i className={`ph-fill ${a.icon} ${style.alertIcon}`} style={{color: a.color}}/>
                                <span className={style.alertBody}>
                                    <span className={style.alertTitle}>
                                        {a.title}
                                        {a.sample && <span className={style.sampleChip}>Sample</span>}
                                    </span>
                                    <span className={style.alertSub}>{a.sub}</span>
                                </span>
                                <span className={style.alertCta}>{a.cta}</span>
                            </a>
                        );
                    })}
                </section>

                {/* ── KPI grid ── */}
                <section className={style.kpiGrid}>
                    <a
                        href="/investments"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate("/investments");
                        }}
                        className={`${style.kpiTile} ${style.kpiHero}`}
                        title={hide || !portfolioTotals ? "" : `₹${formatCurrency(portfolioTotals.currentValue)}`}
                    >
                        <span className={style.kpiKicker}>
                            Portfolio · 6 asset types
                            <span className={style.spacer}/>
                            {trendIsSample && <span className={style.sampleChip}>Sample trend</span>}
                        </span>
                        <div className={style.kpiHeroBody}>
                            <div className={style.kpiHeroMoney}>
                                <span className={style.kpiHeroValue}>
                                    {portfolioTotals ? (
                                        money(portfolioTotals.currentValue, hide, true)
                                    ) : (
                                        // ak-s74k: never a partial sum or the ₹0
                                        // placeholder — unknown until all six load.
                                        <span
                                            className={style.kpiUnknown}
                                            title={portfolioReadiness === "error"
                                                ? "Some holdings failed to load — total unknown"
                                                : "Loading holdings…"}
                                        >
                                            —
                                        </span>
                                    )}
                                </span>
                                <span className={style.kpiHeroSub}>
                                    {portfolioTotals ? (
                                        <>
                                            Invested {money(portfolioTotals.invested, hide, true)}
                                            {portfolioTotals.invested > 0 && (
                                                <>
                                                    {" · "}
                                                    <span style={{color: portfolioTotals.profit >= 0 ? CLR_GAIN : CLR_LOSS}}>
                                                        {portfolioTotals.profit >= 0 ? "+" : ""}
                                                        {portfolioTotals.profitPct.toFixed(2)}%
                                                    </span>
                                                </>
                                            )}
                                            {portfolioStale && (
                                                <span
                                                    className={style.kpiUnknown}
                                                    title="The last refresh failed for at least one asset"
                                                >
                                                    {" · "}may be stale
                                                </span>
                                            )}
                                        </>
                                    ) : portfolioReadiness === "error" ? (
                                        <>
                                            Couldn't load all holdings{" · "}
                                            <span
                                                role="button"
                                                tabIndex={0}
                                                className={style.kpiRetry}
                                                onClick={(e) => {
                                                    e.preventDefault();
                                                    e.stopPropagation();
                                                    retryPortfolio();
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        retryPortfolio();
                                                    }
                                                }}
                                            >
                                                Retry
                                            </span>
                                        </>
                                    ) : (
                                        "Loading holdings…"
                                    )}
                                    {" · "}
                                    Today{" "}
                                    {dayChangeKnown ? (
                                        <span
                                            style={{color: dayChange >= 0 ? CLR_GAIN : CLR_LOSS}}
                                        >
                                            {dayChange >= 0 ? "+" : "−"}
                                            {money(Math.abs(dayChange), hide)}
                                        </span>
                                    ) : (
                                        <span
                                            title="No day basis yet — unknown, not flat"
                                            className={style.kpiUnknown}
                                        >
                                            —
                                        </span>
                                    )}
                                </span>
                            </div>
                            {spark ? (
                                <svg
                                    viewBox="0 0 200 50"
                                    preserveAspectRatio="none"
                                    className={style.kpiSpark}
                                >
                                    <path
                                        d={spark}
                                        fill="none"
                                        stroke="var(--color-accent)"
                                        strokeWidth="1.6"
                                        vectorEffect="non-scaling-stroke"
                                    />
                                </svg>
                            ) : null}
                        </div>
                    </a>

                    <a
                        href="/freelance"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate("/freelance");
                        }}
                        className={style.kpiTile}
                    >
                        <span className={style.kpiKicker}>Freelance paid · this FY</span>
                        <span className={style.kpiValue}>
                            {/* ak-5rg0 (ak-p3id companion): bind to BE's
                                canonical `fyEarnings` field (same
                                aggregation as the Freelance dashboard
                                "PAID THIS FY" tile — divergence is now
                                impossible by construction). NO
                                `totalEarnings` fallback: it is the stale
                                all-time aggregation that produced the
                                §2 divergence this arc kills; falling
                                back to it would silently re-open the
                                divergence on any future BE regression
                                that drops/nulls fyEarnings. `?? 0` is
                                the correct no-data rendering. */}
                            {moneyOrUnknown(freelance?.fyEarnings)}
                        </span>
                        <span className={style.kpiSub}>
                            Monthly avg {moneyOrUnknown(fyMonthlyAvg)} (incl. this month)
                        </span>
                    </a>

                    <a
                        href="/freelance"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate("/freelance");
                        }}
                        className={style.kpiTile}
                    >
                        <span className={style.kpiKicker}>Owed to you</span>
                        <span
                            className={style.kpiValue}
                            title={unpaidTotalINR === null && freelance
                                ? "Unknown: an unpaid invoice's currency has no exchange rate"
                                : unpaidTotalINR?.approx
                                    ? "Approximate: live exchange rates unavailable"
                                    : undefined}
                        >
                            {unpaidTotalINR?.approx && !hide ? "≈ " : ""}
                            {moneyOrUnknown(unpaidTotalINR?.total ?? null)}
                        </span>
                        <span className={style.kpiSub} style={{color: overdueInvoices.length > 0 ? CLR_WARN : "var(--color-neutral-500)"}}>
                            {overdueInvoices.length > 0
                                ? `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? "" : "s"} overdue`
                                : "No overdue invoices"}
                        </span>
                    </a>

                    <a
                        href="/transactions"
                        onClick={(e) => {
                            e.preventDefault();
                            navigate("/transactions");
                        }}
                        className={style.kpiTile}
                    >
                        <span className={style.kpiKicker}>Ledger net · all accounts</span>
                        <span
                            className={style.kpiValue}
                            style={{color: ledgerNet >= 0 ? CLR_GAIN : CLR_LOSS}}
                        >
                            {hide
                                ? MASK
                                : `${ledgerNet >= 0 ? "+" : "−"}₹${formatCompact(Math.abs(ledgerNet))}`}
                        </span>
                        <span className={style.kpiSub}>
                            In {money(ledgerIn, hide, true)} · Out {money(ledgerOut, hide, true)}
                        </span>
                    </a>
                </section>

                {/* ── Wealth Digest + Recent activity (main column of split) ── */}
                <div className={style.splitRow}>
                    <section className={style.mainColumn}>
                        <div className={style.sectionHeader}>
                            <h4 className={style.sectionTitle}>From your Wealth Digest</h4>
                            {digestStale && (
                                <span style={{color: CLR_LOSS, fontSize: 12}}>
                                    Most recent successful digest
                                    {digestStaleSinceLabel ? ` · generation failing since ${digestStaleSinceLabel}` : ""}
                                </span>
                            )}
                        </div>
                        <div className={style.digestPanel}>
                            {pulseLede ? (
                                <p className={style.digestPulse}>
                                    <span className={style.digestPulseLabel}>Portfolio pulse.</span>{" "}
                                    {pulseLede}
                                </p>
                            ) : (
                                <p className={style.digestPulseEmpty}>
                                    Your Wealth Digest hasn't been generated yet — it runs once per
                                    day when the scheduler is healthy.
                                </p>
                            )}
                            <div className={style.digestCardsRow}>
                                <div className={style.digestCard}>
                                    <span className={style.digestCardKicker}>
                                        Top action
                                        {topAction?.priority && (
                                            <span className="tag tag-outline" style={{fontSize: "9.5px", padding: "0 6px"}}>
                                                {topAction.priority.replace(/^./, (c) => c.toUpperCase())}
                                            </span>
                                        )}
                                    </span>
                                    <span className={style.digestCardTitle}>
                                        {topAction?.title || "No action pending"}
                                    </span>
                                    {topAction?.detail && (
                                        <span className={style.digestCardDetail}>{topAction.detail}</span>
                                    )}
                                </div>
                                <div className={style.digestCard}>
                                    <span className={style.digestCardKicker}>
                                        Watch
                                        {topWatch?.severity && (
                                            <span style={{color: topWatch.severity === "critical" ? CLR_LOSS : topWatch.severity === "warning" ? CLR_WARN : "var(--color-neutral-400)", letterSpacing: "0.08em"}}>
                                                {topWatch.severity.replace(/^./, (c) => c.toUpperCase())}
                                            </span>
                                        )}
                                    </span>
                                    <span className={style.digestCardTitle}>
                                        {topWatch?.title || "Nothing to watch"}
                                    </span>
                                    {topWatch?.detail && (
                                        <span className={style.digestCardDetail}>{topWatch.detail}</span>
                                    )}
                                </div>
                            </div>
                            <div className={style.digestCta}>
                                <a
                                    href="/wealth-digest"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate("/wealth-digest");
                                    }}
                                    className="btn btn-primary"
                                    style={{fontSize: 13, textDecoration: "none"}}
                                >
                                    Open full digest
                                    <i className="ph ph-arrow-right"/>
                                </a>
                                <span className={style.digestCtaSummary}>
                                    {(digest?.actions?.length || 0)} actions ·{" "}
                                    {(digest?.watch_items?.length || 0)} watch items
                                </span>
                            </div>
                        </div>

                        <div className={style.sectionHeader}>
                            <h4 className={style.sectionTitle}>Recent activity</h4>
                            <span className={style.sectionSub}>Across your ledger and invoices</span>
                        </div>
                        <div className={style.activityList}>
                            {activity.length === 0 ? (
                                <span className={style.activityEmpty}>
                                    No recent activity found.
                                </span>
                            ) : (
                                activity.map((r) => (
                                    <a
                                        key={r.id}
                                        href={r.href}
                                        onClick={(e) => {
                                            e.preventDefault();
                                            navigate(r.href);
                                        }}
                                        className={style.activityRow}
                                    >
                                        <span className={style.activityIcon}>
                                            <i className={`ph ${r.icon}`}/>
                                        </span>
                                        <span className={style.activityBody}>
                                            <span className={style.activityTitle}>{r.title}</span>
                                            <span className={style.activitySub}>{r.sub}</span>
                                        </span>
                                        <span className={style.activityMeta}>
                                            <span className={style.activityAmt} style={{color: r.color}}>
                                                {r.amt}
                                            </span>
                                            {r.badge && (
                                                <span
                                                    className={style.activityBadge}
                                                    style={{color: r.badgeFg, background: r.badgeBg}}
                                                >
                                                    {r.badge}
                                                </span>
                                            )}
                                        </span>
                                    </a>
                                ))
                            )}
                        </div>
                    </section>

                    {/* ── right rail ── */}
                    <aside className={style.rightRail}>
                        <span className={style.railKicker}>Quick start</span>
                        <div className={style.quickGrid}>
                            {quickStart.map((q) => (
                                <a
                                    key={q.label}
                                    href={q.href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate(q.href);
                                    }}
                                    className={style.quickTile}
                                >
                                    <i className={`ph ${q.icon} ${style.quickIcon}`}/>
                                    <span className={style.quickLabel}>{q.label}</span>
                                    <span className={style.quickSub}>{q.sub}</span>
                                </a>
                            ))}
                        </div>
                        <span className={`${style.railKicker} ${style.railKickerSpaced}`}>Jump to</span>
                        <div className={style.areasList}>
                            {areas.map((a) => (
                                <a
                                    key={a.label}
                                    href={a.href}
                                    onClick={(e) => {
                                        e.preventDefault();
                                        navigate(a.href);
                                    }}
                                    className={style.areaRow}
                                >
                                    <i className={`ph ${a.icon} ${style.areaIcon}`}/>
                                    <span className={style.areaBody}>
                                        <span className={style.areaLabel}>{a.label}</span>
                                        <span className={style.areaSub} style={{color: a.subColor}}>{a.sub}</span>
                                    </span>
                                    <i className="ph ph-caret-right"/>
                                </a>
                            ))}
                        </div>
                    </aside>
                </div>
            </div>
            {/* ak-j8tc: reconciliation review drawer. Opened by the
                alerts-strip "Reconciliation · N issues to review"
                card. On successful resolve the dialog fires
                onResolved(id) which decrements the local count so
                the alert strip updates without a round-trip; the
                card auto-disappears when count hits 0 (per bead's
                "honest empty state" design). */}
            <ReconciliationDialog
                open={reconDialogOpen}
                onClose={() => setReconDialogOpen(false)}
                onResolved={() => {
                    setReconIssuesCount((prev) =>
                        prev === null ? null : Math.max(0, prev - 1),
                    );
                }}
            />
        </div>
    );
};

export default Home;
