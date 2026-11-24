// Money-math + load-gate checks for `utils/portfolioTotals.ts` (ak-s74k).
//
// The repo has no test runner, so this is a self-contained assertion script:
//     npm run check:portfolio
// Bundled with esbuild and executed by node; a non-zero exit means a broken
// invariant. Fixture values are synthetic.
import {
    computePortfolioTotals,
    initialSummaryStatus,
    portfolioTotalsIfReady,
    statusOnFetchError,
    statusOnFetchStart,
    summariesReadiness,
    summariesStale,
    SummaryStatusMap,
} from "./portfolioTotals.ts";

let failures = 0;

const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const round2 = (n: number): number => Math.round(n * 100) / 100;

// MSNContext's initial (unfetched) summaries — the shape that produced ₹0.
const zeroMsn = {totalValue: 0, currentValue: 0, changePercent: 0, changeAmount: 0, count: 0, marketStatus: false};
const zeroEpg = {deposits: [], net: 0, netProfit: 0, transactions: [], unAccountedProfit: undefined};
const coldSummaries = {mf: zeroMsn, stocks: zeroMsn, nps: zeroMsn, epf: zeroEpg, gold: zeroEpg, ppf: zeroEpg};

// Loaded summaries. MSN fields arrive as decimal strings on the wire; Gold has
// no unAccountedProfit; PF.net arrives as an int.
const loadedSummaries = {
    stocks: {totalValue: "1000.00", currentValue: "1200.50", changeAmount: "200.50"},
    mf: {totalValue: "500.00", currentValue: "450.00", changeAmount: "-50.00"},
    nps: {totalValue: "100.00", currentValue: "110.00", changeAmount: "10.00"},
    epf: {net: "300.00", netProfit: "30.00", unAccountedProfit: "5.00"},
    gold: {net: "200.00", netProfit: "20.00"},
    ppf: {net: 400, netProfit: "40.00", unAccountedProfit: "4.00"},
};

const allLoaded: SummaryStatusMap = {mf: "loaded", stocks: "loaded", nps: "loaded", epf: "loaded", ppf: "loaded", gold: "loaded"};

// ── readiness ────────────────────────────────────────────────────────────
check("cold load: initial status is loading, not ready", summariesReadiness(initialSummaryStatus), "loading");
check("all six loaded → ready", summariesReadiness(allLoaded), "ready");
check("five loaded + one loading → loading", summariesReadiness({...allLoaded, gold: "loading"}), "loading");
check("five loaded + one idle → loading", summariesReadiness({...allLoaded, ppf: "idle"}), "loading");
check("any error → error", summariesReadiness({...allLoaded, nps: "error"}), "error");
check("error beats loading", summariesReadiness({...allLoaded, nps: "error", mf: "loading"}), "error");

// ── status transitions ───────────────────────────────────────────────────
check("start from idle → loading", statusOnFetchStart("idle"), "loading");
check("start from error → loading", statusOnFetchStart("error"), "loading");
check("refresh of loaded data stays loaded", statusOnFetchStart("loaded"), "loaded");
check("refresh of stale data stays stale until it succeeds", statusOnFetchStart("stale"), "stale");
check("first-load failure → error", statusOnFetchError("loading"), "error");
check("refresh failure keeps data but marks it stale", statusOnFetchError("loaded"), "stale");
check("repeat refresh failure stays stale", statusOnFetchError("stale"), "stale");
check("stale counts as ready (complete, possibly old)", summariesReadiness({...allLoaded, epf: "stale"}), "ready");
check("stale is flagged", summariesStale({...allLoaded, epf: "stale"}), true);
check("all fresh is not stale", summariesStale(allLoaded), false);

// ── the gate (ak-s74k core) ──────────────────────────────────────────────
check("cold /home: zero initial summaries + initial status → null ('—'), not ₹0",
    portfolioTotalsIfReady(initialSummaryStatus, coldSummaries), null);
check("partial load (3 of 6) → null, never a partial sum",
    portfolioTotalsIfReady({...initialSummaryStatus, stocks: "loaded", mf: "loaded", nps: "loaded"}, loadedSummaries), null);
check("one asset errored → null",
    portfolioTotalsIfReady({...allLoaded, epf: "error"}, loadedSummaries), null);

// ── the sum (formula preserved from Home / WealthDigest) ─────────────────
// invested: 1000 + 500 + 100 (MSN totalValue)
//         + (300 − 30) EPF + (200 − 20) Gold + (400 − (40 − 4)) PPF
//         = 1600 + 270 + 180 + 364 = 2414
// current:  1200.5 + 450 + 110 + 300 + 200 + (400 + 4) = 2664.5
// profit:   200.5 − 50 + 10 + 30 + 20 + 40 = 250.5
const t = portfolioTotalsIfReady(allLoaded, loadedSummaries);
check("ready → totals present", t !== null, true);
check("invested", round2(t!.invested), 2414);
check("currentValue", round2(t!.currentValue), 2664.5);
check("profit (lifetime P&L)", round2(t!.profit), 250.5);
check("profitPct", round2(t!.profitPct), round2((250.5 / 2414) * 100));

// An asset that genuinely has nothing (loaded, zero) contributes nothing.
const withEmptyNps = {...loadedSummaries, nps: {totalValue: "0.00", currentValue: "0.00", changeAmount: "0.00"}};
const t2 = computePortfolioTotals(withEmptyNps);
check("loaded-but-empty MSN asset is skipped (invested)", round2(t2.invested), 2314);
check("loaded-but-empty MSN asset is skipped (current)", round2(t2.currentValue), 2554.5);

const t3 = computePortfolioTotals({...loadedSummaries, gold: {net: 0, netProfit: 0}});
check("loaded-but-empty EPG asset is skipped", round2(t3.currentValue), 2464.5);

check("zero invested → 0% (no divide-by-zero)", computePortfolioTotals(coldSummaries).profitPct, 0);

if (failures > 0) {
    console.log(`\n${failures} check(s) failed`);
    process.exit(1);
}
console.log("\nall portfolio-total checks passed");
