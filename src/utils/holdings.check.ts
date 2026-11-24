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
    getRowCurrentValue,
    getRowDayChangeAmount,
    getRowDayChangeDisplay,
    getRowInvested,
    getRowUnrealizedPnL,
    getSettledQuantity,
    getT1Quantity,
    getTotalQuantity,
    isDayChangeKnown,
} from "./holdings.ts";
import {MSNListResponse, MSNRateResponse} from "./interfaces.ts";
import {normalizePortfolioTrendPoints} from "../services/wealthDigestNormalizers.ts";

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

// --- ak-yz9c P&L PATH (Commit 3 — closes the tautology-canary gap) ------------
// Commit 1 verified the QUANTITY path end-to-end (wire → helper → assertion).
// It said nothing about the P&L path — because Commit 1 left the per-row
// renderers on the retired settled-only compute (buyPrice × buyQuant), no
// helper was reading `invested` / `unrealized_pnl` / `current_value` /
// `day_change_amount`, and any assertion on those would be measuring an
// un-wired field. Reviewer + Fable independently caught this class as
// "tautology-canary: test passes without exercising the property".
//
// Commit 3 wires the P&L path: renderers call `getRowInvested` /
// `getRowCurrentValue` / `getRowUnrealizedPnL` — which prefer BE-emitted
// folded values on Kite-enriched rows and fall back to statement compute
// on MF/NPS/legacy rows. The assertions below verify BOTH branches of
// that dispatch on the shared BE fixture.

// Path A branch: BE-emitted folded fields present → helpers CONSUME them.
check("ak-yz9c fixture: getRowInvested consumes BE invested", getRowInvested(foldFixture), 676500);
check("ak-yz9c fixture: getRowCurrentValue consumes BE current_value",
    getRowCurrentValue(foldFixture, 1600), 721600);
check("ak-yz9c fixture: getRowUnrealizedPnL consumes BE unrealized_pnl",
    getRowUnrealizedPnL(foldFixture, 1600), 45100);
check("ak-yz9c fixture: getRowDayChangeAmount consumes BE day_change_amount",
    getRowDayChangeAmount(foldFixture), 9020);

// Mutation-test discriminators: swap the BE field, assert the helper's
// output changes accordingly. This proves the helper actually READS the BE
// field rather than computing locally from qty × price. If Commit 3 had
// left the renderer computing locally, mutating `unrealized_pnl` here
// would produce the same statement-compute answer (45100 by coincidence
// on this fixture only), so we mutate to a value that DIFFERS from any
// plausible statement compute to force discrimination.
check("ak-yz9c discriminator: mutated BE invested surfaces (proves helper reads it)",
    getRowInvested({...foldFixture, invested: 999999}), 999999);
check("ak-yz9c discriminator: mutated BE unrealized_pnl surfaces",
    getRowUnrealizedPnL({...foldFixture, unrealized_pnl: 12345}, 1600), 12345);
check("ak-yz9c discriminator: mutated BE current_value surfaces",
    getRowCurrentValue({...foldFixture, current_value: 500000}, 1600), 500000);

// Fallback branch: statement-only row (no BE fold fields) → helpers compute
// from buyPrice × buyQuant. Exercises the MF/NPS/legacy dispatch so the
// stocks-only migration doesn't silently break the fallback path.
const statementOnlyRow = row({
    buyPrice: 1500, buyQuant: 100,
    // no invested / current_value / unrealized_pnl / day_change_amount on wire
});
check("statement fallback: getRowInvested = buyPrice × settled",
    getRowInvested(statementOnlyRow), 150000);
check("statement fallback: getRowCurrentValue = lastPrice × settled",
    getRowCurrentValue(statementOnlyRow, 1600), 160000);
check("statement fallback: getRowUnrealizedPnL = current − invested",
    getRowUnrealizedPnL(statementOnlyRow, 1600), 10000);
check("statement fallback: getRowDayChangeAmount = null (no absolute source)",
    getRowDayChangeAmount(statementOnlyRow), null);
// Fallback price-unavailable safety
check("statement fallback: zero price yields zero current value",
    getRowCurrentValue(statementOnlyRow, 0), 0);

// --- ak-quts day_change_known gate (ak-4o41 BE flag) --------------------------
// BE emits `day_change_known: false` when neither today_open nor close_price
// was available; day_change / day_change_amount are 0 by convention in that
// case but that 0 MEANS "unknown", NOT "flat today". Renderers must show
// "—", not "₹0". Asserting both branches of the gate — the explicit-unknown
// override AND the legacy (field-absent) backward-compat.
//
// Discriminator: these assertions FAIL on a hypothetical FE that treats
// day_change_known-less rows as always-known (legacy heuristic alone) OR on
// a hypothetical FE that ignores the flag entirely (would return 0 not
// null). Only an FE that reads day_change_known AS the gate passes both.

// isDayChangeKnown — flag presence / absence
check("isDayChangeKnown: absent field → assume known (legacy compat)",
    isDayChangeKnown(row()), true);
check("isDayChangeKnown: explicit true → known",
    isDayChangeKnown(row({day_change_known: true})), true);
check("isDayChangeKnown: explicit false → NOT known",
    isDayChangeKnown(row({day_change_known: false})), false);

// getRowDayChangeAmount — unknown gate overrides numeric presence
check("day_change_known: false masks day_change_amount → null",
    getRowDayChangeAmount(row({day_change_amount: 9020, day_change_known: false})), null);
check("day_change_known: true + day_change_amount=0 → 0 (genuinely flat)",
    getRowDayChangeAmount(row({day_change_amount: 0, day_change_known: true})), 0);
check("day_change_known: true + day_change_amount=9020 → 9020",
    getRowDayChangeAmount(row({day_change_amount: 9020, day_change_known: true})), 9020);
// Legacy row (no flag): existing behavior preserved
check("day_change_known absent + day_change_amount=9020 → 9020 (legacy)",
    getRowDayChangeAmount(row({day_change_amount: 9020})), 9020);

// getDayChange — unknown gate overrides broker/market fallback
check("day_change_known: false → getDayChange returns null (no market fallback)",
    getDayChange(row({day_change: 10, day_change_percentage: 0.5, day_change_known: false}), 0.33),
    null,
);
// day_change_known: true + 0/0 broker values — the gate passes, then the
// existing all-zero-broker heuristic (b8cb2c2) falls through to the market
// feed. baseInfo has change=8.1/pChange=0.33, so we get a market-source
// DayChange. Documents the compositional behavior: known=true doesn't
// FORCE the broker path, it only unblocks the dispatch; the dispatch's
// own fallback logic still runs.
check("day_change_known: true + 0/0 broker → falls through to market feed",
    getDayChange(row({day_change: 0, day_change_percentage: 0, day_change_known: true}), 0.33),
    {change: 8.1, changePercent: 0.33, source: "market"},
);
// Mutation discriminator: toggling day_change_known from true to false on
// the SAME broker-populated row changes the return from a DayChange to null.
// Proves the gate is actually consulted (not bypassed). An FE that forgot
// to read day_change_known would return the same value for both.
check("day_change_known discriminator: toggling flag changes output shape",
    getDayChange(row({day_change: 10, day_change_percentage: 0.5, day_change_known: true}), 0.33) !== null &&
    getDayChange(row({day_change: 10, day_change_percentage: 0.5, day_change_known: false}), 0.33) === null,
    true,
);

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

// --- portfolio-trend normalizer (ak-uqjz) ------------------------------------
// BE emits `total_value`; pre-ak-uqjz reader looked at `portfolio_value` which
// was never on the wire → every point filtered to NaN → chart silently empty.
// These assertions pin the authoritative field name and prove shape+legacy
// tolerance survives. The `total_value` assertion is the pre-fix RED
// discriminator: on e9f2742 it would read `undefined`, drop the point, and
// return `[]`, failing the non-empty + value check below.
check(
    "ak-uqjz: bare-list total_value is the authoritative field",
    normalizePortfolioTrendPoints(
        [{date: "2026-11-01", total_value: 12345.67}],
        90,
    ),
    [{date: "2026-11-01", value: 12345.67}],
);
check(
    "ak-uqjz: portfolio_value retained as legacy alias",
    normalizePortfolioTrendPoints(
        [{date: "2026-11-02", portfolio_value: 2222.22}],
        90,
    ),
    [{date: "2026-11-02", value: 2222.22}],
);
check(
    "ak-uqjz: legacy `value` alias still accepted",
    normalizePortfolioTrendPoints(
        [{date: "2026-11-03", value: 333.33}],
        90,
    ),
    [{date: "2026-11-03", value: 333.33}],
);
check(
    "ak-uqjz: wrapped {points: [...]} legacy shape still accepted",
    normalizePortfolioTrendPoints(
        {points: [{date: "2026-11-04", total_value: 44}]},
        90,
    ),
    [{date: "2026-11-04", value: 44}],
);
check(
    "ak-uqjz: total_value wins over legacy aliases on a mixed-field row",
    normalizePortfolioTrendPoints(
        [{date: "2026-11-05", total_value: 100, portfolio_value: 999, value: 1}],
        90,
    ),
    [{date: "2026-11-05", value: 100}],
);
check(
    "ak-uqjz: rows missing a date are dropped",
    normalizePortfolioTrendPoints(
        [{total_value: 50}, {date: "2026-11-06", total_value: 60}],
        90,
    ),
    [{date: "2026-11-06", value: 60}],
);
check(
    "ak-uqjz: rows missing ALL value aliases are dropped (non-finite guard)",
    normalizePortfolioTrendPoints(
        [{date: "2026-11-07"}, {date: "2026-11-08", total_value: 80}],
        90,
    ),
    [{date: "2026-11-08", value: 80}],
);
check(
    "ak-uqjz: slice-to-tail enforces days window",
    normalizePortfolioTrendPoints(
        [
            {date: "d1", total_value: 1},
            {date: "d2", total_value: 2},
            {date: "d3", total_value: 3},
        ],
        2,
    ),
    [{date: "d2", value: 2}, {date: "d3", value: 3}],
);
check(
    "ak-uqjz: non-array non-wrapped body → []",
    normalizePortfolioTrendPoints({foo: "bar"}, 90),
    [],
);
check(
    "ak-uqjz: empty bare list → []",
    normalizePortfolioTrendPoints([], 90),
    [],
);

// --- ak-o8p5: day-change display has ONE sign source -------------------------
const r2 = (n: number | null): number | null => (n === null ? null : Math.round(n * 100) / 100);
const disp = (r: MSNListResponse, fb?: number) => {
    const d = getRowDayChangeDisplay(r, fb);
    return {known: d.known, amount: r2(d.amount), percent: r2(d.percent), direction: d.direction};
};

// The prod bug: BE-folded ₹ is positive (last 1600 > close 1580 over 451 qty),
// broker day_change zero-coerced, market feed pChange NEGATIVE (different basis).
const mixedSign = row({
    total_qty: 451, close_price: 1580, day_change_amount: 9020,
    day_change: 0, day_change_percentage: 0,
    info: {...baseInfo, lastPrice: 1600, change: -3.2, pChange: -0.2},
});
check("o8p5: folded +₹ with feed −% → +₹ and +% on the SAME basis",
    disp(mixedSign, -0.2), {known: true, amount: 9020, percent: 1.27, direction: 1});

// Mirror: folded ₹ negative, feed % positive.
const mixedSignNeg = row({
    total_qty: 100, close_price: 500, day_change_amount: -750,
    day_change: 0, day_change_percentage: 0,
    info: {...baseInfo, lastPrice: 492.5, change: 1.1, pChange: 0.4},
});
check("o8p5: folded −₹ with feed +% → −₹ and −%",
    disp(mixedSignNeg, 0.4), {known: true, amount: -750, percent: -1.5, direction: -1});

// Folded ₹ but no basis to compute % on (no close_price): a disagreeing
// helper % is dropped rather than shown against the ₹.
const noBasisDisagree = row({
    total_qty: 451, day_change_amount: 9020,
    day_change: 0, day_change_percentage: 0,
    info: {...baseInfo, pChange: -0.2, change: -3.2},
});
check("o8p5: no basis + disagreeing % → % dropped, ₹ kept",
    disp(noBasisDisagree, -0.2), {known: true, amount: 9020, percent: null, direction: 1});

// Folded ₹ with no basis but an AGREEING helper % → keep it.
const noBasisAgree = row({
    total_qty: 451, day_change_amount: 9020,
    day_change: 0, day_change_percentage: 0,
    info: {...baseInfo, pChange: 0.5, change: 8},
});
check("o8p5: no basis + agreeing % → kept",
    disp(noBasisAgree, 0.5), {known: true, amount: 9020, percent: 0.5, direction: 1});

// No folded amount (MF-like): market per-share ₹ and % disagree → % dropped.
const feedDisagree = row({info: {...baseInfo, change: 2.5, pChange: -0.1}});
check("o8p5: feed ₹ vs feed % disagree → ₹ wins, % dropped",
    disp(feedDisagree, -0.1), {known: true, amount: 2.5, percent: null, direction: 1});

// Percent-only row (MF/NPS feed with no absolute change).
const pctOnly = row({info: {...baseInfo, change: undefined as unknown as number, pChange: -0.8}});
check("o8p5: percent-only row → direction from %",
    disp(pctOnly, -0.8), {known: true, amount: null, percent: -0.8, direction: -1});

// Broker-reported movement still wins over the feed and agrees with itself.
const broker = row({day_change: -4, day_change_percentage: -0.25, info: {...baseInfo, pChange: 0.6}});
check("o8p5: broker per-share pair is used as-is",
    disp(broker, 0.6), {known: true, amount: -4, percent: -0.25, direction: -1});

// Explicit unknown (ak-4o41) stays "—" regardless of feed numbers.
check("o8p5: day_change_known false → unknown",
    disp(row({day_change_known: false, day_change_amount: 0, info: {...baseInfo, pChange: -1}}), -1),
    {known: false, amount: null, percent: null, direction: 0});

// Review fix: folded ₹ == 0 with no basis must not borrow a signed feed %.
const flatNoBasis = row({
    total_qty: 0, day_change_amount: 0,
    day_change: 0, day_change_percentage: 0,
    info: {...baseInfo, change: -2.4, pChange: -0.5},
});
check("o8p5: flat folded ₹, no basis, −0.5% feed → no % (not '+₹0.00 (+0.50%)')",
    disp(flatNoBasis, -0.5), {known: true, amount: 0, percent: null, direction: 0});
check("o8p5: flat folded ₹, no basis, +0.5% feed → no %",
    disp({...flatNoBasis, info: {...baseInfo, change: 2.4, pChange: 0.5}}, 0.5),
    {known: true, amount: 0, percent: null, direction: 0});
check("o8p5: flat folded ₹ WITH basis → 0%",
    disp(row({total_qty: 10, close_price: 100, day_change_amount: 0, day_change: 0, day_change_percentage: 0,
        info: {...baseInfo, pChange: -0.5}}), -0.5),
    {known: true, amount: 0, percent: 0, direction: 0});

// sourcesDisagree marker (MINOR-1).
check("o8p5: folded + vs feed − → sourcesDisagree", getRowDayChangeDisplay(mixedSign, -0.2).sourcesDisagree, true);
check("o8p5: folded − vs feed + → sourcesDisagree", getRowDayChangeDisplay(mixedSignNeg, 0.4).sourcesDisagree, true);
check("o8p5: agreeing sources → no marker", getRowDayChangeDisplay(noBasisAgree, 0.5).sourcesDisagree, false);
check("o8p5: feed ₹ vs feed % conflict → marker", getRowDayChangeDisplay(feedDisagree, -0.1).sourcesDisagree, true);
check("o8p5: flat ₹ never flags", getRowDayChangeDisplay(flatNoBasis, -0.5).sourcesDisagree, false);
check("o8p5: unknown never flags",
    getRowDayChangeDisplay(row({day_change_known: false, info: {...baseInfo, pChange: -1}}), -1).sourcesDisagree, false);

// Invariant over the mixed fixtures: the shown % never contradicts the ₹.
[mixedSign, mixedSignNeg, noBasisDisagree, noBasisAgree, feedDisagree, broker].forEach((r, i) => {
    const d = getRowDayChangeDisplay(r, r.info.pChange);
    const ok = d.amount === null || d.percent === null || d.amount === 0 || d.percent === 0
        || Math.sign(d.amount) === Math.sign(d.percent);
    check(`o8p5 invariant #${i}: ₹ and % never disagree`, ok, true);
    check(`o8p5 invariant #${i}: direction matches ₹`,
        d.amount === null || d.amount === 0 || Math.sign(d.amount) === d.direction, true);
});

if (failures > 0) {
    console.log(`\n${failures} holdings check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll holdings checks passed");
