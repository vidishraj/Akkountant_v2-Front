// Checks for utils/maskAccountIds.ts (ak-fexn). No test runner in the repo;
// run with:
//   npx esbuild src/utils/maskAccountIds.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/maskAccountIds.check.mjs \
//     && node node_modules/.cache/maskAccountIds.check.mjs
// All identifiers below are synthetic.
import {containsAccountId, maskAccountIds} from "./maskAccountIds.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

// Design case: broker client code.
check("broker client code (design HA1234)", maskAccountIds("Contract note for HA1234 - 31 Oct"), "Contract note for HA•••• - 31 Oct");
check("3-letter client code", maskAccountIds("Client ABC123456 holdings"), "Client ABC•••• holdings");
// Long account / folio / PRAN / UAN numbers keep the last 4.
check("bank account number", maskAccountIds("Statement for A/c 50100123456789"), "Statement for A/c ••••6789");
check("12-digit PRAN", maskAccountIds("NPS statement PRAN 110012345678"), "NPS statement PRAN ••••5678");
check("folio with slash", maskAccountIds("Folio 12345678/90 allotment"), "Folio ••••5678/90 allotment");
check("already partly masked XXXX", maskAccountIds("A/c XXXXXXXX1234 debited"), "A/c ••••1234 debited");
check("PAN", maskAccountIds("Form 16 for ABCDE1234F"), "Form 16 for AB••••");
// Things that must NOT change.
check("year untouched", maskAccountIds("Annual statement 2026"), "Annual statement 2026");
check("date untouched", maskAccountIds("Passbook as of 31-10-2026"), "Passbook as of 31-10-2026");
check("invoice-style number untouched", maskAccountIds("RDE-2026-10 paid"), "RDE-2026-10 paid");
check("en-IN amount untouched", maskAccountIds("₹1,23,456 credited"), "₹1,23,456 credited");
check("5-digit number untouched", maskAccountIds("Order 12345 placed"), "Order 12345 placed");
check("ISIN untouched (12 chars, not a client code)", maskAccountIds("INF179K01XX0 units"), "INF179K01XX0 units");
check("ticker untouched", maskAccountIds("INOXINDIA bought"), "INOXINDIA bought");
check("empty", maskAccountIds(""), "");
check("null", maskAccountIds(null), "");
check("contains: yes", containsAccountId("A/c 50100123456789"), true);
check("contains: no", containsAccountId("Monthly NAV update"), false);

if (failures > 0) {
    console.log(`\n${failures} mask check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll mask checks passed");
