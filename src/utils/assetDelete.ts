// ak-k9d8 (safety follow-up to ak-eub4): one source for "which asset does
// Delete all act on".
//
// Before: the confirm dialog named the asset from the page's own precedence
// over selectedCard (MSNHome stocks→mf→nps, EPGHome ppf→epf→gold), while
// MSNContext.deleteComplete() re-derived the target via getServiceType()
// (mf→stocks→ppf→gold→epf→nps). If two selectedCard flags were ever set,
// typing "Stocks" could delete Mutual Funds.
//
// Now the page resolves ONE asset key, builds the spec below from it, shows
// spec.displayName as the word to type, and passes the same spec object into
// the delete call. Nothing downstream re-derives the asset. `confirm` is sent
// in the request body so the server can refuse a mismatch.

export type InvestmentAssetKey = "stocks" | "mf" | "nps" | "epf" | "ppf" | "gold";

export const ASSET_DISPLAY_NAME: Record<InvestmentAssetKey, string> = {
    stocks: "Stocks",
    mf: "Mutual Funds",
    nps: "NPS",
    epf: "EPF",
    ppf: "PPF",
    gold: "Gold",
};

/** BE `serviceType` per asset (matches MSNContext.getContextFromService). */
export const ASSET_SERVICE_TYPE: Record<InvestmentAssetKey, string> = {
    stocks: "Stocks",
    mf: "Mutual_Funds",
    nps: "NPS",
    epf: "EPF",
    ppf: "PF",
    gold: "Gold",
};

export const MARKET_LINKED_KEYS: readonly InvestmentAssetKey[] = ["stocks", "mf", "nps"];

export interface DeleteAllSpec {
    assetKey: InvestmentAssetKey;
    /** What the dialog shows and the user must type. */
    displayName: string;
    /** Query param for DELETE deleteAllInvestments. */
    serviceType: string;
    /** Body field the server checks; always equals serviceType. */
    confirm: string;
}

export function deleteAllSpecFor(assetKey: InvestmentAssetKey): DeleteAllSpec {
    const serviceType = ASSET_SERVICE_TYPE[assetKey];
    return {
        assetKey,
        displayName: ASSET_DISPLAY_NAME[assetKey],
        serviceType,
        confirm: serviceType,
    };
}
