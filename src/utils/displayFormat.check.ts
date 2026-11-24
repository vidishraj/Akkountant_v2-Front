// Checks for utils/displayFormat.ts (ak-h5jk). No test runner; run:
//   npx esbuild src/utils/displayFormat.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/displayFormat.check.mjs \
//     && node node_modules/.cache/displayFormat.check.mjs
// Synthetic values only.
import {activityDate, activityMemo, bankDisplayName, invoiceAmount} from "./displayFormat.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// Currency: original currency, locale-formatted, never "USD757.50".
check("USD", invoiceAmount(757.5, "USD"), "$757.50");
check("INR (en-IN grouping)", invoiceAmount(428312.7, "INR"), "₹4,28,312.70");
check("lowercase code", invoiceAmount(10, "usd"), "$10.00");
check("string amount", invoiceAmount("1234.5", "GBP"), "£1,234.50");
check("missing currency → INR", invoiceAmount(100, null), "₹100.00");
check("zero → —", invoiceAmount(0, "USD"), "—");
check("missing → —", invoiceAmount(null, "USD"), "—");
check("garbage → —", invoiceAmount("abc", "USD"), "—");
check("unknown code → CODE n", invoiceAmount(5, "ZZZZ"), "ZZZZ 5.00");
check("no 'USD' prefix anywhere", /USD\d/.test(invoiceAmount(757.5, "USD")), false);

// Bank labels.
check("HDFC_DEBIT", bankDisplayName("HDFC_DEBIT"), "HDFC");
check("BOI", bankDisplayName("BOI"), "Bank of India");
check("ICICI_AMAZON_PAY", bankDisplayName("ICICI_AMAZON_PAY"), "ICICI Amazon Pay");
check("unknown key de-snaked", bankDisplayName("KOTAK_SAVINGS_ACCOUNT"), "Kotak Savings Account");
check("known acronym kept, word title-cased", bankDisplayName("SBI_CARD"), "SBI Card");
check("HDFC in an unknown key stays HDFC", bankDisplayName("HDFC_NRE_SAVINGS"), "HDFC NRE Savings");
check("empty → —", bankDisplayName(""), "—");

// Dates (IST).
check("design date shape", activityDate("2026-10-01"), "Thu, Oct 1, 2026");
check("UTC late evening → next IST day", activityDate("2026-09-30T20:00:00Z"), "Thu, Oct 1, 2026");
check("bad date → ''", activityDate("nope"), "");

// Memo: verbatim words, collapsed whitespace, IDs masked.
check("memo kept, whitespace collapsed", activityMemo("  ATM Cash   Withdrawal\n7-11 "), "ATM Cash Withdrawal 7-11");
check("memo account masked", activityMemo("Sweep Trf From: 84021234561746"), "Sweep Trf From: ••••1746");
check("memo empty → 'Transaction'", activityMemo(""), "Transaction");

if (failures > 0) {
    console.log(`\n${failures} displayFormat check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll displayFormat checks passed");
