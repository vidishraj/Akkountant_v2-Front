// Checks for utils/maskAccountIds.ts (ak-fexn). No test runner in the repo;
// run with:
//   npx esbuild src/utils/maskAccountIds.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/maskAccountIds.check.mjs \
//     && node node_modules/.cache/maskAccountIds.check.mjs
// All identifiers below are synthetic.
import {containsAccountId, MASK_INPUT_MAX, maskAccountIds} from "./maskAccountIds.ts";
import {EMAIL_BODY_CSP, withEmailBodyCsp} from "./emailSandbox.ts";

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

// ── ak-36mz: masker gaps ──────────────────────────────────────────────────
check("NSDL demat IN+14", maskAccountIds("DP ID IN30012345678901 credited"), "DP ID IN••••8901 credited");
check("NSDL demat lowercase", maskAccountIds("dp in30012345678901"), "dp in••••8901");
check("lowercase PAN", maskAccountIds("pan abcde1234f on file"), "pan ab•••• on file");
check("lowercase client code", maskAccountIds("client ha1234 note"), "client ha•••• note");
check("dashed account", maskAccountIds("A/c 5010-0123-4567-89 debited"), "A/c ••••6789 debited");
check("spaced account", maskAccountIds("A/c 5010 0123 4567 89"), "A/c ••••6789");
check("spaced phone", maskAccountIds("Call 98765 43210 now"), "Call ••••3210 now");
check("+91 spaced phone", maskAccountIds("Mobile +91 98765 43210"), "Mobile +••••3210");
check("unspaced phone", maskAccountIds("Mobile 9876543210"), "Mobile ••••3210");
check("UPI id", maskAccountIds("Paid to vidish.raj@okicici via UPI"), "Paid to vi••••@okicici via UPI");
check("UPI id with digits", maskAccountIds("from 9876543210@ybl"), "from 98••••@ybl");
check("email address NOT treated as UPI", maskAccountIds("from alerts@hdfcbank.net"), "from alerts@hdfcbank.net");
// Money is never masked (review MAJOR: '12345678.50' → '••••5678.50').
check("decimal amount untouched", maskAccountIds("Credited 12345678.50 today"), "Credited 12345678.50 today");
check("comma-decimal amount untouched", maskAccountIds("Total 1234567,00"), "Total 1234567,00");
check("₹-prefixed long amount untouched", maskAccountIds("₹1234567 credited"), "₹1234567 credited");
check("Rs.-prefixed amount untouched", maskAccountIds("Rs. 1234567 credited"), "Rs. 1234567 credited");
check("INR-prefixed amount untouched", maskAccountIds("INR 1234567 credited"), "INR 1234567 credited");
check("₹ spaced grouped amount untouched", maskAccountIds("₹ 12 34 567 89"), "₹ 12 34 567 89");
check("account next to an amount: only the account masks",
    maskAccountIds("A/c 50100123456789 credited ₹1,23,456.00"), "A/c ••••6789 credited ₹1,23,456.00");
// Years stay readable.
check("FY year untouched", maskAccountIds("Capital gains FY2026 report"), "Capital gains FY2026 report");
check("AY year lowercase untouched", maskAccountIds("ay2025 ITR"), "ay2025 ITR");
check("dashed date untouched (8 digits)", maskAccountIds("Statement 2026-10-31"), "Statement 2026-10-31");

// ── ak-36mz review: quantities, scrip codes, bounds ──────────────────────
check("units quantity untouched", maskAccountIds("Allotted 1234567 units"), "Allotted 1234567 units");
check("qty untouched", maskAccountIds("Sold 250000 qty"), "Sold 250000 qty");
check("shares untouched", maskAccountIds("Bought 100000 shares"), "Bought 100000 shares");
check("BSE scrip code untouched", maskAccountIds("BSE 500325 RELIANCE"), "BSE 500325 RELIANCE");
check("scrip code: untouched", maskAccountIds("Scrip code: 500325"), "Scrip code: 500325");
check("client code IS still masked (bare 'code' is not a scrip guard)", maskAccountIds("client code 123456"), "client code ••••3456");
check("folio still masked", maskAccountIds("Folio 12345678 SIP"), "Folio ••••5678 SIP");
const longInput = "x".repeat(20000);
const t0 = Date.now();
const longOut = maskAccountIds(longInput);
check("long input truncated to MASK_INPUT_MAX + ellipsis", longOut.length, MASK_INPUT_MAX + 1);
check("long input is fast (< 50 ms)", Date.now() - t0 < 50, true);
const upiBomb = "a.".repeat(8000) + "@x";
const t1 = Date.now();
maskAccountIds(upiBomb);
check("UPI rule stays fast on a pathological 16k string (< 50 ms)", Date.now() - t1 < 50, true);

// ── ak-36mz: email body CSP ───────────────────────────────────────────────
const META = `<meta http-equiv="Content-Security-Policy" content="${EMAIL_BODY_CSP}">`;
check("CSP value", EMAIL_BODY_CSP, "default-src 'none'; img-src data: cid:; style-src 'unsafe-inline'");
const PREFIX = `<!doctype html>${META}`;
check("CSP first, before a normal document", withEmailBodyCsp("<html><head><title>t</title></head><body>x</body></html>"),
    `${PREFIX}<html><head><title>t</title></head><body>x</body></html>`);
check("CSP first, sender doctype dropped", withEmailBodyCsp("<!DOCTYPE html PUBLIC \"-//W3C//DTD XHTML 1.0\"><p>x</p>"), `${PREFIX}<p>x</p>`);
check("CSP first, bare fragment", withEmailBodyCsp("<p>hi</p>"), `${PREFIX}<p>hi</p>`);
check("CSP first, leading BOM/whitespace doctype dropped", withEmailBodyCsp("\uFEFF  <!doctype html><p>x</p>"), `${PREFIX}<p>x</p>`);
// Review MAJOR decoys: sender HTML that fooled the old <head> regex. With the
// meta as the first bytes, none of them can move it out of the implied head.
const decoys = [
    "<!-- <head> --><html><body><img src=\"https://t.example/p.gif\"></body></html>",
    "<p title=\"<head>\">x</p><img src=\"https://t.example/p.gif\">",
    "<img src=\"https://t.example/p.gif\"><head></head>",
];
decoys.forEach((d, i) => {
    const out = withEmailBodyCsp(d);
    check(`decoy #${i}: output starts with doctype + CSP meta`, out.startsWith(PREFIX), true);
    check(`decoy #${i}: nothing from the sender precedes the meta`, out.indexOf(META), "<!doctype html>".length);
    check(`decoy #${i}: sender HTML preserved after the meta`, out.slice(PREFIX.length), d);
});
check("CSP blocks remote images (img-src has no http/https)", /img-src[^;]*https?:/.test(EMAIL_BODY_CSP), false);

if (failures > 0) {
    console.log(`\n${failures} mask check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll mask checks passed");
