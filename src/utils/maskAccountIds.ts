// ak-fexn: mask account identifiers in investment email metadata
// (subjects / extraction summaries) by default. The design masks broker
// client IDs ("HA1234" → "HA••••") behind an explicit "Reveal IDs" toggle.
// This generalises that to the identifiers these mails actually carry.
//
// Pure + deterministic. Never logs, never stores. Callers keep the reveal
// flag in component state only, so it resets on unmount and isn't persisted.

const DOTS = "••••";

/**
 * Masks, in order:
 * 1. PAN (AAAAA9999A) → first 2 letters + dots.
 * 2. Broker client codes (2–3 letters + 4–6 digits, e.g. Zerodha "HA1234")
 *    → keep the letters, mask the digits (matches the design).
 * 3. Long digit runs (6+ digits: bank/demat accounts, folio, PRAN, UAN)
 *    → dots + last 4.
 * 4. Already partly-masked runs like "XXXX1234" / "xx1234" keep only the
 *    last 4 as well, so the output is consistent.
 * Short numbers (dates, years, amounts with separators, invoice numbers like
 * "RDE-2026-10") are left alone.
 */
export function maskAccountIds(text: string | null | undefined): string {
    if (!text) return text ?? "";
    return text
        .replace(/\b([A-Z]{2})[A-Z]{3}\d{4}[A-Z]\b/g, `$1${DOTS}`)
        .replace(/\b([A-Z]{2,3})\d{4,6}\b/g, `$1${DOTS}`)
        .replace(/\b[Xx*]{2,}(\d{4})\b/g, `${DOTS}$1`)
        .replace(/\b\d{2,}(\d{4})\b/g, (match, last4: string) =>
            match.length >= 6 ? `${DOTS}${last4}` : match,
        );
}

/** True when masking would change the text, i.e. it carries an identifier. */
export function containsAccountId(text: string | null | undefined): boolean {
    return !!text && maskAccountIds(text) !== text;
}
