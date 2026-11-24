import {useCallback, useEffect, useMemo} from "react";
import {useMSNContext} from "../contexts/MSNContext";
import {
    portfolioTotalsIfReady,
    PortfolioTotals,
    SummariesReadiness,
    summariesReadiness,
    summariesStale,
    SummaryKey,
    SummaryStatusMap,
} from "../utils/portfolioTotals";

/**
 * ak-s74k: the one place that ensures the six investment summaries are
 * loaded and exposes the portfolio total only when ALL of them have resolved.
 *
 * Before this, only /investments fetched the summaries; a cold load of /home
 * summed MSNContext's zero initial state and rendered ₹0, and /wealth-digest
 * had its own bootstrap that showed partial sums while requests landed.
 *
 * - Default (Home, Wealth Digest): on mount, fetch every summary that has
 *   never loaded (idle) or failed (error). Already-loaded summaries are reused.
 * - `refreshOnMount` (Investments): fetch all six on mount, as that page
 *   always did, so a revisit picks up fresh numbers. Loaded data stays shown
 *   while the refresh is in flight.
 *
 * - `autoLoad: false` (InvestmentsLanding): read-only consumer; its parent
 *   route (Investments) already issues the loads.
 *
 * `totals` is null unless readiness is "ready": callers render "—" for
 * loading/error, never a partial sum and never the ₹0 placeholder state.
 * `stale` is true when a refresh failed after data had loaded; the totals
 * are complete but may be out of date, so callers show a small hint.
 */

const FETCHERS: Record<SummaryKey, {kind: "msn" | "epg"; serviceType: string}> = {
    stocks: {kind: "msn", serviceType: "Stocks"},
    nps: {kind: "msn", serviceType: "NPS"},
    mf: {kind: "msn", serviceType: "Mutual_Funds"},
    epf: {kind: "epg", serviceType: "EPF"},
    gold: {kind: "epg", serviceType: "Gold"},
    ppf: {kind: "epg", serviceType: "PF"},
};

const KEYS = Object.keys(FETCHERS) as SummaryKey[];

export interface InvestmentSummariesState {
    readiness: SummariesReadiness;
    totals: PortfolioTotals | null;
    stale: boolean;
    /** Per-asset status, for per-asset surfaces (e.g. landing cards). */
    status: SummaryStatusMap;
    /**
     * Re-request every summary that failed OR is stale (bypasses the request
     * cache), so the "may be stale" hint has a working refresh (ak-h5jk).
     */
    retry: () => void;
}

export function useInvestmentSummaries(
    options: {refreshOnMount?: boolean; autoLoad?: boolean} = {},
): InvestmentSummariesState {
    const {refreshOnMount = false, autoLoad = true} = options;
    const {state, fetchAndSetSummary, AllInfoForEpf} = useMSNContext();

    const load = useCallback(
        (key: SummaryKey, clearCache: boolean) => {
            const f = FETCHERS[key];
            if (f.kind === "msn") fetchAndSetSummary(f.serviceType, clearCache);
            else AllInfoForEpf(f.serviceType, clearCache);
        },
        [fetchAndSetSummary, AllInfoForEpf],
    );

    useEffect(() => {
        if (!autoLoad) return;
        KEYS.forEach((k) => {
            const s = state.summaryStatus[k];
            if (refreshOnMount || s === "idle" || s === "error") load(k, false);
        });
        // Mount-only: re-running on status changes would loop on errors.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const readiness = summariesReadiness(state.summaryStatus);

    const totals = useMemo(
        () => portfolioTotalsIfReady(state.summaryStatus, state.summaries),
        [state.summaryStatus, state.summaries],
    );

    const retry = useCallback(() => {
        KEYS.forEach((k) => {
            const s = state.summaryStatus[k];
            if (s === "error" || s === "stale") load(k, true);
        });
    }, [state.summaryStatus, load]);

    return {
        readiness,
        totals,
        stale: summariesStale(state.summaryStatus),
        status: state.summaryStatus,
        retry,
    };
}
