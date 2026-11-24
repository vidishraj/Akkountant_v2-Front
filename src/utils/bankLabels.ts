// ak-5aw4: ONE source for bank keys → display labels (Home activity feed,
// Transactions ledger chip + detail drawer, statement cards, BankIcon
// monogram). Keys are the exact, case-sensitive BE BankEnums values
// (ak-iu8i contract).

export interface BankLabel {
    /** Full name (Home activity feed, detail drawer, statement cards). */
    name: string;
    /** Compact label for the ledger's mono chip. */
    short: string;
}

export const BANK_LABELS: Record<string, BankLabel> = {
    // Existing ids
    HDFC_DEBIT: {name: "HDFC", short: "HDFC"},
    HDFC_REGALIA: {name: "HDFC Regalia", short: "Regalia"},
    Millenia_Credit: {name: "HDFC Millennia", short: "Millennia"},
    BOI: {name: "Bank of India", short: "BOI"},
    ICICI_AMAZON_PAY: {name: "ICICI Amazon Pay", short: "ICICI Pay"},
    YES_BANK_DEBIT: {name: "YES Bank", short: "Yes Bank"},
    YES_BANK_ACE: {name: "YES Bank Ace", short: "Yes Ace"},
    // ak-iu8i (new)
    AXIS: {name: "Axis Bank", short: "Axis"},
    KOTAK: {name: "Kotak Mahindra Bank", short: "Kotak"},
    SBI: {name: "State Bank of India", short: "SBI"},
    SBI_CARD: {name: "SBI Card", short: "SBI Card"},
    BOB: {name: "Bank of Baroda", short: "BoB"},
    PAYTM: {name: "Paytm Payments Bank", short: "Paytm"},
};

export const KNOWN_BANK_KEYS: readonly string[] = Object.keys(BANK_LABELS);

/** Own-property lookup only (review MINOR: "constructor" must not resolve). */
function labelFor(key: string): BankLabel | undefined {
    return Object.prototype.hasOwnProperty.call(BANK_LABELS, key) ? BANK_LABELS[key] : undefined;
}

/** How unmapped senders were stamped before ak-iu8i. */
const UNRECOGNISED_KEYS = new Set(["UNKNOWN", "Unknown", "unknown"]);
export const UNRECOGNISED_BANK = "Unrecognised bank";

const BANK_ACRONYMS = new Set(["HDFC", "ICICI", "SBI", "BOI", "BOB", "YES", "IDFC", "AU", "RBL", "UPI", "NRE", "NRO", "PNB", "IDBI"]);

/** De-snake an unknown key, keeping bank acronyms upper-case. */
function fallbackName(key: string): string {
    return key
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((w) => (BANK_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");
}

export function bankName(key: string | null | undefined): string {
    if (!key) return "—";
    if (UNRECOGNISED_KEYS.has(key)) return UNRECOGNISED_BANK;
    return labelFor(key)?.name ?? fallbackName(key);
}

export function bankShortName(key: string | null | undefined): string {
    if (!key) return "—";
    if (UNRECOGNISED_KEYS.has(key)) return UNRECOGNISED_BANK;
    return labelFor(key)?.short ?? fallbackName(key);
}

/** 1–3 letter monogram for icon fallbacks: "SBI", "AX", "BoB"→"BOB". */
export function bankMonogram(key: string | null | undefined): string {
    if (!key || UNRECOGNISED_KEYS.has(key)) return "?";
    const short = bankShortName(key);
    const words = short.split(/\s+/).filter(Boolean);
    if (words.length === 1) {
        const w = words[0];
        return (BANK_ACRONYMS.has(w.toUpperCase()) ? w : w.slice(0, 2)).toUpperCase().slice(0, 3);
    }
    return words.map((w) => w[0]).join("").toUpperCase().slice(0, 3);
}

/** The FileDetails fields the Statements visibility rule reads. */
export interface StatementRecordLike {
    bank?: string | null;
    category?: string | null;
    statementCount?: number | null;
    items_extracted?: number | null;
}

/**
 * Statements view visibility (ak-5aw4). Decided by WHAT THE RECORD IS, not by
 * a bank-id list (review MAJOR: prod has rows stamped "UNKNOWN", pre-ak-iu8i,
 * and legacy ids like "HDFC", that carry real transactions):
 * 1. category "bank_statement" → shown, whatever the bank id.
 * 2. any OTHER explicit category (investment, not_financial, …) → hidden;
 *    those records belong to other views.
 * 3. no category (legacy rows) → shown when it has extracted statements /
 *    items (i.e. linked transactions), or its bank is BE-listed / labelled.
 */
export function isStatementRecord(rec: StatementRecordLike, beBanks: readonly string[]): boolean {
    const category = rec.category ?? null;
    if (category === "bank_statement") return true;
    if (category) return false;
    if ((Number(rec.statementCount) || 0) > 0 || (Number(rec.items_extracted) || 0) > 0) return true;
    const bank = rec.bank;
    if (!bank) return false;
    return beBanks.includes(bank) || labelFor(bank) !== undefined;
}
