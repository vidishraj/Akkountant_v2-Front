// Checks for utils/assetDelete.ts (ak-k9d8). No test runner in the repo; run:
//   npx esbuild src/utils/assetDelete.check.ts --bundle --platform=node \
//     --format=esm --outfile=node_modules/.cache/assetDelete.check.mjs \
//     && node node_modules/.cache/assetDelete.check.mjs
import {
    ASSET_DISPLAY_NAME,
    ASSET_SERVICE_TYPE,
    deleteAllSpecFor,
    InvestmentAssetKey,
} from "./assetDelete.ts";

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown): void => {
    if (JSON.stringify(actual) === JSON.stringify(expected)) {
        console.log(`ok   ${label}`);
        return;
    }
    failures += 1;
    console.log(`FAIL ${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
};

const KEYS: InvestmentAssetKey[] = ["stocks", "mf", "nps", "epf", "ppf", "gold"];

// Exact request each confirmed asset produces.
check("stocks", deleteAllSpecFor("stocks"), {assetKey: "stocks", displayName: "Stocks", serviceType: "Stocks", confirm: "Stocks"});
check("mf", deleteAllSpecFor("mf"), {assetKey: "mf", displayName: "Mutual Funds", serviceType: "Mutual_Funds", confirm: "Mutual_Funds"});
check("nps", deleteAllSpecFor("nps"), {assetKey: "nps", displayName: "NPS", serviceType: "NPS", confirm: "NPS"});
check("epf", deleteAllSpecFor("epf"), {assetKey: "epf", displayName: "EPF", serviceType: "EPF", confirm: "EPF"});
check("ppf", deleteAllSpecFor("ppf"), {assetKey: "ppf", displayName: "PPF", serviceType: "PF", confirm: "PF"});
check("gold", deleteAllSpecFor("gold"), {assetKey: "gold", displayName: "Gold", serviceType: "Gold", confirm: "Gold"});

// The bug class: the word the user types and the asset that gets deleted must
// come from the same key, for every key.
KEYS.forEach((k) => {
    const spec = deleteAllSpecFor(k);
    check(`${k}: typed word ↔ deleted serviceType share one key`,
        [spec.displayName, spec.serviceType],
        [ASSET_DISPLAY_NAME[k], ASSET_SERVICE_TYPE[k]]);
    check(`${k}: confirm body == serviceType param`, spec.confirm, spec.serviceType);
});

// Injective: no two assets share a serviceType or a confirm word, so a
// confirmation for one asset can never satisfy another.
check("serviceTypes are distinct", new Set(KEYS.map((k) => ASSET_SERVICE_TYPE[k])).size, KEYS.length);
check("display names are distinct", new Set(KEYS.map((k) => ASSET_DISPLAY_NAME[k])).size, KEYS.length);
check("typing 'Stocks' targets Stocks, not Mutual_Funds",
    KEYS.filter((k) => deleteAllSpecFor(k).displayName === "Stocks").map((k) => deleteAllSpecFor(k).serviceType),
    ["Stocks"]);

if (failures > 0) {
    console.log(`\n${failures} assetDelete check(s) FAILED`);
    process.exit(1);
}
console.log("\nAll assetDelete checks passed");
