// Portfolio-total math shared by Home and Wealth Digest (ak-s74k).
//
// Both pages previously carried their own copy of this sum and both read
// MSNContext's zero-initialised summaries before anything had been fetched,
// so a cold load rendered a ₹0 total. The sum now lives here once, and
// callers gate it on `summariesReadiness(...) === "ready"`: a total is only
// shown when EVERY asset summary has resolved, never a partial sum.

export const MSN_SUMMARY_KEYS = ["mf", "stocks", "nps"] as const;
export const EPG_SUMMARY_KEYS = ["epf", "ppf", "gold"] as const;
export const SUMMARY_KEYS = [...MSN_SUMMARY_KEYS, ...EPG_SUMMARY_KEYS] as const;

export type SummaryKey = (typeof SUMMARY_KEYS)[number];

/**
 * Per-asset summary load state.
 * - idle:    never requested this session (initial zero state is NOT data)
 * - loading: first request in flight
 * - loaded:  the latest response succeeded (an in-flight refresh keeps this)
 * - stale:   data landed earlier but the latest refresh failed — the values
 *            are complete but may be out of date
 * - error:   the first request failed and no data has ever landed
 */
export type SummaryStatus = "idle" | "loading" | "loaded" | "stale" | "error";

export type SummaryStatusMap = Record<SummaryKey, SummaryStatus>;

export type SummariesReadiness = "loading" | "ready" | "error";

export const initialSummaryStatus: SummaryStatusMap = {
    mf: "idle",
    stocks: "idle",
    nps: "idle",
    epf: "idle",
    ppf: "idle",
    gold: "idle",
};

/** True when this asset has data to show (fresh or stale). */
export function hasSummaryData(s: SummaryStatus): boolean {
    return s === "loaded" || s === "stale";
}

/**
 * "ready" only when all six summaries have data (loaded or stale). Any error
 * (with nothing loaded for that asset) makes the aggregate unknowable →
 * "error". Anything else is still "loading".
 */
export function summariesReadiness(status: SummaryStatusMap): SummariesReadiness {
    const values = SUMMARY_KEYS.map((k) => status[k]);
    if (values.every(hasSummaryData)) return "ready";
    if (values.some((s) => s === "error")) return "error";
    return "loading";
}

/** True when any asset's numbers come from a refresh that later failed. */
export function summariesStale(status: SummaryStatusMap): boolean {
    return SUMMARY_KEYS.some((k) => status[k] === "stale");
}

/** Next status when a fetch starts: data already on screen stays on screen. */
export function statusOnFetchStart(prev: SummaryStatus): SummaryStatus {
    return hasSummaryData(prev) ? prev : "loading";
}

/** Next status when a fetch fails: earlier data stays, but is marked stale. */
export function statusOnFetchError(prev: SummaryStatus): SummaryStatus {
    return hasSummaryData(prev) ? "stale" : "error";
}

export interface PortfolioTotals {
    currentValue: number;
    invested: number;
    profit: number;
    profitPct: number;
}

/**
 * Sums the six asset summaries. Formula preserved verbatim from the two
 * page-local copies it replaces (Home.derivePortfolio totals half and
 * WealthDigest.derivePortfolioTotal):
 * - MSN (mf/stocks/nps): invested = totalValue, current = currentValue,
 *   profit = changeAmount (lifetime P&L). Skipped when totalValue is 0.
 * - EPG (epf/gold): invested = net − netProfit, current = net.
 * - PPF: invested = net − (netProfit − unAccountedProfit),
 *   current = net + unAccountedProfit.
 * - EPG profit = netProfit. EPG assets skipped when net is 0.
 * - F&O is settled, not a holding → excluded.
 *
 * Callers MUST gate on readiness; this function cannot tell "not loaded"
 * from "genuinely empty".
 */
export function computePortfolioTotals(summaries: Record<string, unknown>): PortfolioTotals {
    let currentValue = 0;
    let invested = 0;
    let profit = 0;

    MSN_SUMMARY_KEYS.forEach((k) => {
        const s = summaries[k] as
            | {totalValue?: number | string; currentValue?: number | string; changeAmount?: number | string}
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

    const profitPct = invested !== 0 ? (profit / invested) * 100 : 0;
    return {currentValue, invested, profit, profitPct};
}

/**
 * The gate every portfolio-total consumer uses: totals only when all six
 * summaries have loaded, otherwise null (render "—").
 */
export function portfolioTotalsIfReady(
    status: SummaryStatusMap,
    summaries: Record<string, unknown>,
): PortfolioTotals | null {
    return summariesReadiness(status) === "ready" ? computePortfolioTotals(summaries) : null;
}
