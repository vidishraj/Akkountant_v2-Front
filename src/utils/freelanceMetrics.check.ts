// Checks for utils/freelanceMetrics.ts (ak-f9kg). No test runner; run:
//   npx esbuild src/utils/freelanceMetrics.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/freelanceMetrics.check.mjs \
//     && node node_modules/.cache/freelanceMetrics.check.mjs
// Synthetic amounts only.
import {currentFyMonths, monthlyAverage, toMonth, unpaidTotalInINR} from "./freelanceMetrics.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// live: INR, USD; static (approx): GBP; unknown: everything else.
const rate = (c: string) =>
    c === "INR" ? {rate: 1, approx: false}
        : c === "USD" ? {rate: 88, approx: false}
            : c === "GBP" ? {rate: 120, approx: true}
                : null;

// Owed to you (defect #1: a USD-only overdue read ₹0).
check("USD-only unpaid is converted, not ₹0", unpaidTotalInINR([{currency: "USD", amount: 100}], rate), {total: 8800, approx: false});
check("mixed currencies summed in INR", unpaidTotalInINR([{currency: "INR", amount: 500}, {currency: "USD", amount: 10}], rate), {total: 1380, approx: false});
check("lower-case code ok", unpaidTotalInINR([{currency: "usd", amount: 1}], rate), {total: 88, approx: false});
check("unknown currency → null (no silent 1:1)", unpaidTotalInINR([{currency: "INR", amount: 500}, {currency: "JPY", amount: 1000}], rate), null);
check("nothing owed → 0", unpaidTotalInINR([], rate), {total: 0, approx: false});
check("rows missing → 0", unpaidTotalInINR(undefined, rate), {total: 0, approx: false});
check("any static rate → total flagged approx", unpaidTotalInINR([{currency: "USD", amount: 1}, {currency: "GBP", amount: 1}], rate), {total: 208, approx: true});
check("bad amount → null", unpaidTotalInINR([{currency: "INR", amount: Number.NaN}], rate), null);

// Monthly avg (defect #2), the dashboard's formula: sum ÷ months in range.
const months = [
    {month: "2026-03", earnings: 999},   // previous FY
    {month: "2026-04", earnings: 100},
    {month: "2026-05", earnings: 300},
    {month: "2026-06", earnings: 200},
    {month: "2027-04", earnings: 777},   // next FY
];
check("FY average over in-range months only", monthlyAverage(months, "2026-04", "2027-03"), 200);
check("open-ended range = all months", monthlyAverage(months), (999 + 100 + 300 + 200 + 777) / 5);
check("no months in range → null (not ₹0)", monthlyAverage(months, "2030-04", "2031-03"), null);
check("missing data → null", monthlyAverage(undefined, "2026-04", "2027-03"), null);
check("string earnings parsed", monthlyAverage([{month: "2026-04", earnings: "50" as unknown as number}], "2026-04", "2026-04"), 50);

// FY helpers.
check("toMonth from YYYY-MM-DD", toMonth("2026-04-01"), "2026-04");
check("toMonth junk → null", toMonth("April"), null);
check("FY in November", currentFyMonths(new Date(2026, 10, 24)), {start: "2026-04", end: "2027-03"});
check("FY in February belongs to previous April", currentFyMonths(new Date(2027, 1, 10)), {start: "2026-04", end: "2027-03"});
check("FY on 1 April starts a new FY", currentFyMonths(new Date(2027, 3, 1)), {start: "2027-04", end: "2028-03"});

if (failures > 0) {
    console.log(`\n${failures} freelanceMetrics check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll freelanceMetrics checks passed");
