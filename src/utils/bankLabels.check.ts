// Checks for utils/bankLabels.ts (ak-5aw4). No test runner; run:
//   npx esbuild src/utils/bankLabels.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/bankLabels.check.mjs \
//     && node node_modules/.cache/bankLabels.check.mjs
import {bankMonogram, bankName, bankShortName, isStatementRecord, KNOWN_BANK_KEYS} from "./bankLabels.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// Exact BE BankEnums values (ak-iu8i contract, case-sensitive).
const OLD = ["Millenia_Credit", "HDFC_DEBIT", "ICICI_AMAZON_PAY", "YES_BANK_DEBIT", "YES_BANK_ACE", "BOI", "HDFC_REGALIA"];
const NEW = ["AXIS", "KOTAK", "SBI", "SBI_CARD", "BOB", "PAYTM"];
[...OLD, ...NEW].forEach((k) => check(`${k} has a label`, KNOWN_BANK_KEYS.includes(k), true));

check("AXIS name", bankName("AXIS"), "Axis Bank");
check("KOTAK name", bankName("KOTAK"), "Kotak Mahindra Bank");
check("SBI name/short", [bankName("SBI"), bankShortName("SBI")], ["State Bank of India", "SBI"]);
check("SBI_CARD", bankName("SBI_CARD"), "SBI Card");
check("BOB name/short", [bankName("BOB"), bankShortName("BOB")], ["Bank of Baroda", "BoB"]);
check("PAYTM name", bankName("PAYTM"), "Paytm Payments Bank");
check("old ledger chip labels unchanged", OLD.map(bankShortName), ["Millennia", "HDFC", "ICICI Pay", "Yes Bank", "Yes Ace", "BOI", "Regalia"]);
check("old Home names unchanged", ["HDFC_DEBIT", "BOI"].map(bankName), ["HDFC", "Bank of India"]);
check("no raw key ever shown for new banks", NEW.some((k) => bankShortName(k) === k && k.includes("_")), false);
check("unknown key de-snaked", bankName("IDFC_FIRST_SAVINGS"), "IDFC First Savings");
check("empty → —", bankName(null), "—");

// Monograms.
check("monogram SBI", bankMonogram("SBI"), "SBI");
check("monogram BoB", bankMonogram("BOB"), "BOB");
check("monogram Axis", bankMonogram("AXIS"), "AX");
check("monogram SBI Card", bankMonogram("SBI_CARD"), "SC");
check("monogram ≤ 3 chars for every bank", [...OLD, ...NEW].every((k) => bankMonogram(k).length >= 1 && bankMonogram(k).length <= 3), true);
check("monogram null", bankMonogram(undefined), "?");

// Statements visibility: by WHAT THE RECORD IS (review MAJOR).
const rec = (o: Record<string, unknown>) => o as Parameters<typeof isStatementRecord>[0];
check("new bank, bank_statement → shown", isStatementRecord(rec({bank: "SBI_CARD", category: "bank_statement"}), []), true);
check("'UNKNOWN' bank_statement → shown", isStatementRecord(rec({bank: "UNKNOWN", category: "bank_statement"}), ["HDFC_DEBIT"]), true);
check("legacy 'UNKNOWN' w/o category but WITH transactions → shown",
    isStatementRecord(rec({bank: "UNKNOWN", statementCount: 12}), ["HDFC_DEBIT"]), true);
check("legacy id 'HDFC' with extracted items → shown", isStatementRecord(rec({bank: "HDFC", items_extracted: 4}), []), true);
check("legacy row, known bank, no counts → shown", isStatementRecord(rec({bank: "HDFC_DEBIT", statementCount: 0}), []), true);
check("legacy row, BE-listed future bank → shown", isStatementRecord(rec({bank: "FEDERAL"}), ["FEDERAL"]), true);
check("investment email → hidden (other view)", isStatementRecord(rec({bank: "HDFC_DEBIT", category: "investment", items_extracted: 3}), []), false);
check("classifier-dropped not_financial → hidden", isStatementRecord(rec({bank: "UNKNOWN", category: "not_financial"}), []), false);
check("legacy unknown id, no counts → hidden", isStatementRecord(rec({bank: "VAULT_DOC", statementCount: 0}), ["HDFC_DEBIT"]), false);
check("no bank, no counts, no category → hidden", isStatementRecord(rec({}), []), false);
check("failed bank statement (0 rows) still shown", isStatementRecord(rec({bank: "BOB", category: "bank_statement", statementCount: 0}), []), true);

// Unrecognised + prototype safety (review MINOR).
check("'UNKNOWN' label", [bankName("UNKNOWN"), bankShortName("UNKNOWN")], ["Unrecognised bank", "Unrecognised bank"]);
check("'UNKNOWN' monogram", bankMonogram("UNKNOWN"), "?");
check("'constructor' is not a label", bankName("constructor"), "Constructor");
check("'__proto__' is not a label", bankShortName("__proto__"), "Proto");
check("'toString' not treated as a known bank", isStatementRecord(rec({bank: "toString"}), []), false);
check("'hasOwnProperty' not treated as a known bank", isStatementRecord(rec({bank: "hasOwnProperty"}), []), false);

if (failures > 0) {
    console.log(`\n${failures} bankLabels check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll bankLabels checks passed");
