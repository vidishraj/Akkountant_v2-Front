// Checks for utils/attentionItems.ts (ak-rns8). No test runner; run:
//   npx esbuild src/utils/attentionItems.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/attentionItems.check.mjs \
//     && node node_modules/.cache/attentionItems.check.mjs
import {buildAttentionItems, digestStaleSinceLabel} from "./attentionItems.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const none = {digestStale: false, digestStaleSinceLabel: "", kiteAuthenticated: true, overdueInvoices: [], reconIssuesCount: 0};
check("nothing pending → empty (badge hidden)", buildAttentionItems(none), []);
check("recon unknown (null) → no item", buildAttentionItems({...none, reconIssuesCount: null}).length, 0);

const all = buildAttentionItems({
    digestStale: true,
    digestStaleSinceLabel: "30 Aug",
    kiteAuthenticated: false,
    overdueInvoices: [{invoiceNumber: "INV-1", clientName: "Client A"}, {invoiceNumber: "INV-2", clientName: "Client B"}],
    reconIssuesCount: 3,
});
check("order: digest, kite, invoices, recon", all.map((i) => i.key), ["digest-fail", "kite-session", "invoice-overdue", "recon-open"]);
check("digest sub uses the since-label", all[0].sub, "Since 30 Aug · digests are stale");
check("invoice title pluralises", all[2].title, "2 invoices overdue");
check("invoice sub names the first overdue", all[2].sub, "INV-1 · Client A");
check("recon sub pluralises", all[3].sub, "3 issues to review");
check("recon routes to Home (hosts the drawer)", all[3].href, "/home");
check("singulars", buildAttentionItems({...none, overdueInvoices: [{invoiceNumber: "X", clientName: "Y"}], reconIssuesCount: 1})
    .map((i) => i.title + "|" + i.sub), ["1 invoice overdue|X · Y", "Reconciliation|1 issue to review"]);
check("digest without label", buildAttentionItems({...none, digestStale: true})[0].sub, "Digests are stale");
check("since-label: bad date → ''", digestStaleSinceLabel("not-a-date"), "");
check("since-label: null → ''", digestStaleSinceLabel(null), "");
check("since-label: IST day (UTC late evening rolls to next IST day)", digestStaleSinceLabel("2026-08-30T20:00:00Z"), "31 Aug");

// ak-h5jk (ak-rns8 review a): the bell variant carries no invoice detail.
const bell = buildAttentionItems({...none, overdueInvoices: [{invoiceNumber: "INV-9", clientName: "Client Z"}], detail: false});
check("bell: invoice title still counts", bell[0].title, "1 invoice overdue");
check("bell: no invoice number / client in sub", bell[0].sub, "Follow up in Freelance");
check("bell: sub leaks neither id nor client", /INV-9|Client Z/.test(JSON.stringify(bell)), false);

if (failures > 0) {
    console.log(`\n${failures} attention check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll attention checks passed");
