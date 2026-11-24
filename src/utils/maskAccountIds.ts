// ak-fexn / ak-36mz: mask account identifiers in investment email metadata
// (subjects / extraction summaries) by default. The design masks broker
// client IDs ("HA1234" → "HA••••") behind an explicit "Reveal IDs" toggle.
// This generalises that to the identifiers these mails actually carry.
//
// Pure + deterministic. Never logs, never stores. Callers keep the reveal
// flag in component state only, so it resets on unmount and isn't persisted.

const DOTS = "••••";
const last4 = (digits: string): string => digits.replace(/\D/g, "").slice(-4);

// Money must never be masked: a digit run directly followed by a decimal or
// grouping separator + digit ("12345678.50", "1234567,00"), or directly
// preceded by a currency marker ("₹1234567", "Rs. 1234567", "INR 1234567").
const NOT_MONEY_AFTER = "(?![.,]\\d)";
const NOT_MONEY_BEFORE = "(?<!(?:₹|\\$|Rs\\.?|INR|USD)\\s?)";
// Quantities and exchange scrip codes are not identifiers either:
// "1234567 units", "500 qty", "BSE 500325", "scrip code: 500325".
const NOT_QTY_AFTER = "(?!\\s?(?:units?|qty|shares?|nos?)\\b)";
// Only BSE/NSE/scrip (optionally "… code") — NOT a bare "code", which would
// leave "client code 123456" unmasked.
const NOT_SCRIP_BEFORE = "(?<!(?:BSE|NSE|scrip)(?:\\s?code)?\\s?:?\\s?)";

// Bound the work per call: subjects/summaries are short, and an unbounded
// sender-controlled string made the UPI rule quadratic (16k chars ≈ 6–8 s of
// main-thread jank). Anything longer is truncated before masking.
export const MASK_INPUT_MAX = 512;

// "FY2026", "AY2025", "CY2024" are years, not client codes.
const YEAR_PREFIX = /^(fy|ay|cy)$/i;

/**
 * Masks, in order:
 * 1. UPI IDs ("name.x@okicici") → first 2 chars + dots + "@handle". Email
 *    addresses ("a@b.com") are left alone: a UPI handle has no dot after @.
 * 2. NSDL demat IDs ("IN" + 14 digits) → "IN" + dots + last 4.
 * 3. PAN (AAAAA9999A, any case) → first 2 letters + dots.
 * 4. Broker client codes (2–3 letters + 4–6 digits, any case, e.g. Zerodha
 *    "HA1234") → keep the letters, mask the digits (matches the design).
 *    FY/AY/CY + year is left alone.
 * 5. Runs already partly masked ("XXXX1234", "**1234") → dots + last 4.
 * 6. Grouped numbers split by single spaces/dashes with ≥ 9 digits in total
 *    (accounts "5010-0123-4567", phones "98765 43210") → dots + last 4.
 *    Dates ("31-10-2026", 8 digits) stay.
 * 7. Plain runs of 6+ digits (bank/demat/folio/PRAN/UAN, unspaced phones)
 *    → dots + last 4, except money (see guards above).
 * Short numbers, years, invoice numbers ("RDE-2026-10"), en-IN grouped
 * amounts, quantities ("1234567 units"), scrip codes ("BSE 500325"), ISINs
 * and tickers are left alone. Input over MASK_INPUT_MAX chars is truncated.
 */
export function maskAccountIds(text: string | null | undefined): string {
    if (!text) return text ?? "";
    const input = text.length > MASK_INPUT_MAX ? `${text.slice(0, MASK_INPUT_MAX)}…` : text;
    return input
        // 1. UPI
        // (local part bounded to 64 chars: keeps the rule linear)
        .replace(/\b([\w.-]{2})[\w.-]{0,62}@([a-zA-Z]{2,})\b(?![.\w])/g, `$1${DOTS}@$2`)
        // 2. NSDL demat
        .replace(/\b(IN)(\d{14})\b/gi, (_m, p: string, d: string) => `${p}${DOTS}${last4(d)}`)
        // 3. PAN
        .replace(/\b([A-Za-z]{2})[A-Za-z]{3}\d{4}[A-Za-z]\b/g, `$1${DOTS}`)
        // 4. client codes
        .replace(/\b([A-Za-z]{2,3})(\d{4,6})\b/g, (m, letters: string, digits: string) =>
            YEAR_PREFIX.test(letters) && digits.length === 4 ? m : `${letters}${DOTS}`,
        )
        // 5. already partly masked
        .replace(/\b[Xx*]{2,}(\d{4})\b/g, `${DOTS}$1`)
        // 6. grouped (spaced / dashed) numbers
        .replace(
            new RegExp(`${NOT_MONEY_BEFORE}${NOT_SCRIP_BEFORE}\\b\\d{2,6}(?:[ -]\\d{2,6}){1,4}\\b${NOT_MONEY_AFTER}${NOT_QTY_AFTER}`, "gi"),
            (m) => (m.replace(/\D/g, "").length >= 9 ? `${DOTS}${last4(m)}` : m),
        )
        // 7. plain long runs
        .replace(
            new RegExp(`${NOT_MONEY_BEFORE}${NOT_SCRIP_BEFORE}\\b\\d{6,}\\b${NOT_MONEY_AFTER}${NOT_QTY_AFTER}`, "gi"),
            (m) => `${DOTS}${last4(m)}`,
        );
}

/** True when masking would change the text, i.e. it carries an identifier. */
export function containsAccountId(text: string | null | undefined): boolean {
    return !!text && maskAccountIds(text) !== text;
}
