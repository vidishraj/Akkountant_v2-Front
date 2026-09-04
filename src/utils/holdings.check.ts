// Money-math checks for `utils/holdings.ts` (ak-9we).
//
// The repo has no test runner, so this is a self-contained assertion script:
//     npm run check:holdings
// It is bundled with esbuild and executed by node; a non-zero exit means a broken
// invariant. Keep it dependency-free so it stays runnable.
import {
    formatQuantity,
    getCostBasisDivergence,
    getDayChange,
    getPendingValue,
    getPledgeInfo,
    getT1Quantity,
    getTotalPendingQuantity,
    getTotalPendingValue,
    getTotalQuantity,
} from "./holdings.ts";
import {MSNListResponse, MSNRateResponse} from "./interfaces.ts";

let failures = 0;

const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const baseInfo: MSNRateResponse = {
    symbol: "RELIANCE",
    companyName: "Reliance Industries",
    industry: "Energy",
    lastPrice: 2450.5,
    change: 8.1,
    pChange: 0.33,
    previousClose: 2442.4,
    open: 2445,
    close: 2442.4,
    dayHigh: 2460,
    dayLow: 2440,
};

const row = (extra: Partial<MSNListResponse> = {}): MSNListResponse => ({
    buyID: 1,
    buyCode: "RELIANCE",
    buyPrice: 2380.15,
    buyQuant: 100,
    schemeCode: "RELIANCE",
    serviceType: "Stocks",
    date: "2026-09-01",
    info: baseInfo,
    ...extra,
});

// --- pending (T+1) quantity ---------------------------------------------------
check("absent t1 field reads as 0", getT1Quantity(row()), 0);
check("t1 passthrough", getT1Quantity(row({t1_quantity: 50})), 50);
check("negative t1 clamped to 0", getT1Quantity(row({t1_quantity: -5})), 0);
check("non-numeric t1 reads as 0", getT1Quantity(row({t1_quantity: "abc" as unknown as number})), 0);
check("total = settled + pending", getTotalQuantity(row({t1_quantity: 50})), 150);
check("total = settled when nothing pending", getTotalQuantity(row()), 100);
check("fractional quantities preserved", getTotalQuantity(row({buyQuant: 12.5, t1_quantity: 2.5})), 15);

// --- pending market value -----------------------------------------------------
check("pending value = price x pending qty", getPendingValue(row({t1_quantity: 50}), 2450.5), 122525);
check("no pending qty -> no pending value", getPendingValue(row(), 2450.5), 0);
check(
    "errored price feed -> no pending value",
    getPendingValue(row({t1_quantity: 50, info: {...baseInfo, error: "API_FAILED"}}), 2450.5),
    0,
);
check("zero price -> no pending value", getPendingValue(row({t1_quantity: 50}), 0), 0);

// --- list aggregation ---------------------------------------------------------
const list: MSNListResponse[] = [
    row({t1_quantity: 50}), //                                    50 x 2450.50 = 122525
    row({t1_quantity: 10, info: {...baseInfo, lastPrice: 100}}), // 10 x 100    =   1000
    row({t1_quantity: 7, info: {...baseInfo, error: "API_FAILED"}}), // unpriced =      0
    row(), //                                                       nothing pending
];
check("aggregate value skips unpriced rows", getTotalPendingValue(list), 123525);
check("aggregate quantity still counts unpriced rows", getTotalPendingQuantity(list), 67);
check("aggregates tolerate a missing list", getTotalPendingValue(undefined), 0);

// --- day change ---------------------------------------------------------------
check(
    "broker values win over the market feed",
    getDayChange(row({day_change: 10.3, day_change_percentage: 0.42}), 0.33),
    {change: 10.3, changePercent: 0.42, source: "broker"},
);
check(
    "missing broker percent derived from close price",
    getDayChange(row({day_change: 10, close_price: 2000}), 0.33),
    {change: 10, changePercent: 0.5, source: "broker"},
);
check(
    "negative broker day change preserved",
    getDayChange(row({day_change: -10.3, day_change_percentage: -0.42}), 0.33),
    {change: -10.3, changePercent: -0.42, source: "broker"},
);
check(
    "flat broker day is still broker-sourced",
    getDayChange(row({day_change: 0, day_change_percentage: 0}), 0.33),
    {change: 0, changePercent: 0, source: "broker"},
);
check("falls back to the market feed", getDayChange(row(), 0.33), {
    change: 8.1,
    changePercent: 0.33,
    source: "market",
});
check(
    "percent-only feed (MF/NPS) reports a null absolute change",
    getDayChange(row({info: {nav: "45.1", pChange: 0.35} as unknown as MSNRateResponse}), 0.35),
    {change: null, changePercent: 0.35, source: "market"},
);
check(
    "flat market day is still rendered",
    getDayChange(row({info: {...baseInfo, change: 0, pChange: 0}}), 0),
    {change: 0, changePercent: 0, source: "market"},
);
check(
    "errored price feed has no day change",
    getDayChange(row({info: {...baseInfo, error: "API_FAILED"}}), 0.33),
    null,
);
check(
    "feed with neither change nor percent has no day change",
    getDayChange(row({info: {nav: "45.1"} as unknown as MSNRateResponse}), undefined),
    null,
);

// --- collateral / authorised --------------------------------------------------
check("no pledge fields -> nothing to show", getPledgeInfo(row()), null);
check("collateral only", getPledgeInfo(row({collateral_quantity: 50})), {pledged: 50, authorised: 0});
check(
    "collateral and authorised",
    getPledgeInfo(row({collateral_quantity: 50, authorised_quantity: 100})),
    {pledged: 50, authorised: 100},
);
check("explicit zeros -> nothing to show", getPledgeInfo(row({collateral_quantity: 0, authorised_quantity: 0})), null);

// --- cost-basis cross-check ---------------------------------------------------
check("no broker average -> no hint", getCostBasisDivergence(row()), null);
check("divergence within threshold -> no hint", getCostBasisDivergence(row({average_price: 2380.15 * 1.005})), null);
const divergence = getCostBasisDivergence(row({average_price: 2380.15 * 1.05}));
check("5% divergence surfaced", divergence && Math.round(divergence.percent * 100) / 100, 5);
check(
    "broker below our basis keeps a negative sign",
    (getCostBasisDivergence(row({average_price: 2000}))?.difference ?? 0) < 0,
    true,
);
check("zero cost basis -> no hint", getCostBasisDivergence(row({buyPrice: 0, average_price: 2000})), null);

// --- formatting ---------------------------------------------------------------
check("whole quantities render without decimals", formatQuantity(150), "150");
check("fractional quantities render with 2 decimals", formatQuantity(12.345), "12.35");

if (failures > 0) {
    console.log(`\n${failures} holdings check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll holdings checks passed");
