import {useEffect, useMemo, useState} from "react";
import {useNavigate, useSearchParams} from "react-router-dom";
import {
    makeDriveTokenRequest,
    makeTokenRequest,
} from "../../services/GoogleApiUtils.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {useKite} from "../../contexts/KiteContext.tsx";
import {useWealthDigest} from "../../contexts/WealthDigestContext.tsx";
import {useAgentChatBridge} from "../../contexts/AgentChatBridgeContext.tsx";
import {fetchFreelanceDashboard} from "../../services/freelanceService.ts";
import {fetchTransactions} from "../../services/transactionService.ts";
import {fetchPortfolioTrend} from "../../services/wealthDigestService.ts";
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

const MSN_SUMMARY_KEYS = ["mf", "stocks", "nps"] as const;
const EPG_SUMMARY_KEYS = ["epf", "ppf", "gold"] as const;

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
 * Aggregates currentValue / invested / profit across the six asset summaries,
 * and aggregates day change by consuming the authoritative per-row
 * `getRowDayChangeAmount` helper (utils/holdings.ts) across the MSN holdings
 * lists.
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
        profit += Number(s.changeAmount) || 0; // lifetime P&L, NOT day delta
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

    const profitPct = invested !== 0 ? (profit / invested) * 100 : 0;
    return {currentValue, invested, profit, profitPct, dayChange, dayChangeKnown};
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
    const [ledgerCredit, setLedgerCredit] = useState<number>(0);
    const [ledgerDebit, setLedgerDebit] = useState<number>(0);
    const [trend, setTrend] = useState<{date: string; value: number}[] | null>(null);

    useEffect(() => {
        let cancelled = false;
        fetchFreelanceDashboard()
            .then((d) => {
                if (!cancelled) setFreelance(d);
            })
            .catch(() => {
                if (!cancelled) setFreelance(null);
            });
        fetchTransactions({Page: 1, Filter: {}})
            .then((res) => {
                if (cancelled) return;
                setRecentTx(res.results || []);
                setLedgerCredit(Number(res.credit_sum) || 0);
                setLedgerDebit(Number(res.debit_sum) || 0);
            })
            .catch(() => {
                if (!cancelled) {
                    setRecentTx([]);
                    setLedgerCredit(0);
                    setLedgerDebit(0);
                }
            });
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

    // ── derived state ──────────────────────────────────────────────────
    const portfolio = useMemo(
        () =>
            derivePortfolio(
                msnState.summaries as Record<string, unknown>,
                msnState.lists as Record<string, MSNListResponse[] | undefined>,
            ),
        [msnState.summaries, msnState.lists],
    );
    const spark = useMemo(() => sparklinePath((trend || []).map((p) => p.value)), [trend]);
    const trendIsSample = spark === null; // dashed 'Sample trend' chip mirrors design

    const overdueInvoices = useMemo(() => {
        const list: FreelanceEarning[] = freelance?.recentInvoices || [];
        return list.filter((inv) => inv.status === "overdue");
    }, [freelance]);

    const unpaidTotalINR = useMemo(() => {
        const inrRow = freelance?.unpaidByCurrency?.find((r) => r.currency === "INR");
        return Number(inrRow?.amount) || 0;
    }, [freelance]);

    const digestStale = digest?.last_error != null;
    const digestStaleSinceLabel = useMemo(() => {
        if (!digest?.last_error?.at) return "";
        try {
            const d = new Date(digest.last_error.at);
            if (Number.isNaN(d.getTime())) return "";
            return new Intl.DateTimeFormat("en-IN", {
                timeZone: "Asia/Kolkata",
                month: "short",
                day: "numeric",
            }).format(d);
        } catch {
            return "";
        }
    }, [digest]);

    const alerts = useMemo(() => {
        const out: {
            key: string;
            icon: string;
            color: string;
            edge: string;
            title: string;
            sub: string;
            cta: string;
            href: string;
            sample?: boolean;
        }[] = [];
        if (digestStale) {
            out.push({
                key: "digest-fail",
                icon: "ph-warning-circle",
                color: CLR_LOSS,
                edge: `color-mix(in srgb, ${CLR_LOSS} 40%, transparent)`,
                title: "Wealth Digest task failing",
                sub: digestStaleSinceLabel
                    ? `Since ${digestStaleSinceLabel} · digests are stale`
                    : "Digests are stale",
                cta: "View",
                href: "/wealth-digest",
            });
        }
        if (!kiteState.isAuthenticated) {
            out.push({
                key: "kite-session",
                icon: "ph-plugs",
                color: CLR_WARN,
                edge: `color-mix(in srgb, ${CLR_WARN} 30%, transparent)`,
                title: "Kite session expired",
                sub: "Reconnect to refresh prices and margins",
                cta: "Reconnect",
                href: "/investments",
            });
        }
        if (overdueInvoices.length > 0) {
            const label = overdueInvoices.length === 1 ? "1 invoice overdue" : `${overdueInvoices.length} invoices overdue`;
            const first = overdueInvoices[0];
            out.push({
                key: "invoice-overdue",
                icon: "ph-receipt",
                color: CLR_WARN,
                edge: `color-mix(in srgb, ${CLR_WARN} 30%, transparent)`,
                title: label,
                sub: `${first.invoiceNumber} · ${first.clientName}`,
                cta: "Follow up",
                href: "/freelance",
            });
        }
        // 4th slot: reconciliation sample — no BE wire yet; design calls for
        // a dashed-sample chip so the card visibly carries the empty state.
        out.push({
            key: "recon-sample",
            icon: "ph-arrows-left-right",
            color: "var(--color-accent)",
            edge: "var(--color-accent-800)",
            title: "Reconciliation",
            sub: "Zerodha vs statement",
            cta: "Review",
            href: "/investments",
            sample: true,
        });
        return out;
    }, [digestStale, digestStaleSinceLabel, kiteState.isAuthenticated, overdueInvoices]);

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
        const raw = digest.text.trim();
        const paraEnd = raw.indexOf("\n\n");
        return paraEnd === -1 ? raw : raw.slice(0, paraEnd);
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
                title: t.details || "Transaction",
                sub: `${t.bank || "—"} · ${new Intl.DateTimeFormat("en-IN", {
                    timeZone: "Asia/Kolkata",
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                }).format(new Date(t.date))}`,
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
            const amt =
                hide || !inv.amount
                    ? MASK
                    : inv.currency === "INR"
                        ? `₹${formatCurrency(inv.amount)}`
                        : `${inv.currency || "₹"}${formatCurrency(inv.amount)}`;
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

    const ledgerNet = ledgerCredit - ledgerDebit;

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
            sub: hide ? "6 asset types" : `₹${formatCompact(portfolio.currentValue)} · 6 asset types`,
            subColor: "var(--color-neutral-500)",
            href: "/investments",
        },
        {
            icon: "ph-receipt",
            label: "Transactions",
            sub: "Browse your ledger",
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
            sub: "Documents + statements",
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
                    {alerts.map((a) => (
                        <a
                            key={a.key}
                            href={a.href}
                            onClick={(e) => {
                                e.preventDefault();
                                navigate(a.href);
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
                    ))}
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
                        title={hide ? "" : `₹${formatCurrency(portfolio.currentValue)}`}
                    >
                        <span className={style.kpiKicker}>
                            Portfolio · 6 asset types
                            <span className={style.spacer}/>
                            {trendIsSample && <span className={style.sampleChip}>Sample trend</span>}
                        </span>
                        <div className={style.kpiHeroBody}>
                            <div className={style.kpiHeroMoney}>
                                <span className={style.kpiHeroValue}>
                                    {money(portfolio.currentValue, hide, true)}
                                </span>
                                <span className={style.kpiHeroSub}>
                                    Invested {money(portfolio.invested, hide, true)}
                                    {portfolio.invested > 0 && (
                                        <>
                                            {" · "}
                                            <span style={{color: portfolio.profit >= 0 ? CLR_GAIN : CLR_LOSS}}>
                                                {portfolio.profit >= 0 ? "+" : ""}
                                                {portfolio.profitPct.toFixed(2)}%
                                            </span>
                                        </>
                                    )}
                                    {" · "}
                                    Today{" "}
                                    {portfolio.dayChangeKnown ? (
                                        <span
                                            style={{color: portfolio.dayChange >= 0 ? CLR_GAIN : CLR_LOSS}}
                                        >
                                            {portfolio.dayChange >= 0 ? "+" : "−"}
                                            {money(Math.abs(portfolio.dayChange), hide)}
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
                            {money(freelance?.totalEarnings ?? 0, hide, true)}
                        </span>
                        <span className={style.kpiSub}>
                            Monthly avg {money(freelance?.monthlyEarnings ?? 0, hide, true)}
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
                        <span className={style.kpiValue}>{money(unpaidTotalINR, hide, true)}</span>
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
                            In {money(ledgerCredit, hide, true)} · Out {money(ledgerDebit, hide, true)}
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
        </div>
    );
};

export default Home;
