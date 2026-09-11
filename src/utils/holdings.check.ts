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
    getSettledQuantity,
    getT1Quantity,
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
check("t1 passthrough", getT1Quantity(row({t1_qty: 50})), 50);
check("negative t1 clamped to 0", getT1Quantity(row({t1_qty: -5})), 0);
check("non-numeric t1 reads as 0", getT1Quantity(row({t1_qty: "abc" as unknown as number})), 0);
check("total = settled + pending when no total_qty", getTotalQuantity(row({t1_qty: 50})), 150);
check("total = settled when nothing pending", getTotalQuantity(row()), 100);
check("fractional quantities preserved", getTotalQuantity(row({buyQuant: 12.5, t1_qty: 2.5})), 15);
// ak-yz9c: prefer BE-emitted total_qty as single source of truth for blended qty
check("total_qty wire-authoritative when present", getTotalQuantity(row({buyQuant: 250, t1_qty: 201, total_qty: 451})), 451);
check("total_qty wins even if settled+t1 would disagree",
    getTotalQuantity(row({buyQuant: 0, t1_qty: 0, total_qty: 451})), 451);
check("non-finite total_qty falls back to computed",
    getTotalQuantity(row({buyQuant: 100, t1_qty: 50, total_qty: "nan" as unknown as number})), 150);

// --- pending market value -----------------------------------------------------
check("pending value = price x pending qty", getPendingValue(row({t1_qty: 50}), 2450.5), 122525);
check("no pending qty -> no pending value", getPendingValue(row(), 2450.5), 0);
check(
    "errored price feed -> no pending value",
    getPendingValue(row({t1_qty: 50, info: {...baseInfo, error: "API_FAILED"}}), 2450.5),
    0,
);
check("zero price -> no pending value", getPendingValue(row({t1_qty: 50}), 0), 0);

// --- ak-yz9c shared fold-in fixture -------------------------------------------
// Same fixture as BE mutation-test (agreed with backend on the contract exchange):
//   settled=250, t1=201, avg=1500, last=1600, close=1580
// FE-side row-level assertions on the wire fields BE emits. The mutation-test
// discriminator: swapping total_qty back to settled-only (250) must cause the
// blended-qty assertion to fail — proves the check would catch a regression
// where BE forgot to emit total_qty or FE ignored it. Same rig discipline as
// the compiler-discrimination probe from ak-owrh.
const foldFixture = row({
    buyPrice: 1500, buyQuant: 250,
    settled_qty: 250, t1_qty: 201, total_qty: 451,
    invested: 676500, current_value: 721600,
    unrealized_pnl: 45100, day_change_amount: 9020,
    average_price: 1500, close_price: 1580,
    info: {...baseInfo, lastPrice: 1600},
});
check("ak-yz9c fixture: getSettledQuantity", getSettledQuantity(foldFixture), 250);
check("ak-yz9c fixture: getT1Quantity", getT1Quantity(foldFixture), 201);
check("ak-yz9c fixture: getTotalQuantity (uses total_qty)", getTotalQuantity(foldFixture), 451);
// Discriminated-broken guard: if BE regressed to emitting only settled qty via
// total_qty, the below would return 250 not 451 — mutation-test-style probe.
check("ak-yz9c discriminator: total_qty=settled would fail blended check",
    getTotalQuantity({...foldFixture, total_qty: 250}) !== 451, true);

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
// The backend sends 0 for fields Kite omitted, so all-zero broker values must not
// win over a market feed that shows real movement.
check(
    "all-zero broker values fall back to the market feed",
    getDayChange(row({day_change: 0, day_change_percentage: 0}), 0.33),
    {change: 8.1, changePercent: 0.33, source: "market"},
);
check(
    "broker percent alone is enough to win",
    getDayChange(row({day_change: 0, day_change_percentage: 0.42}), 0.33),
    {change: 0, changePercent: 0.42, source: "broker"},
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
