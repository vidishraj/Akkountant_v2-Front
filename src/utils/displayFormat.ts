// ak-h5jk: display helpers for Home's activity feed (design: Home.dc.html
// "Recent activity" — "HDFC · Thu, Oct 1, 2026", invoices "$757.50").

import {maskAccountIds} from "./maskAccountIds.ts";

/** Human bank/account names for BE bank keys (fallback: de-snake + title case). */
const BANK_DISPLAY: Record<string, string> = {
    HDFC_DEBIT: "HDFC",
    HDFC_REGALIA: "HDFC Regalia",
    Millenia_Credit: "HDFC Millennia",
    BOI: "Bank of India",
    ICICI_AMAZON_PAY: "ICICI Amazon Pay",
    YES_BANK_DEBIT: "YES Bank",
    YES_BANK_ACE: "YES Bank Ace",
};

const BANK_ACRONYMS = new Set(["HDFC", "ICICI", "SBI", "BOI", "YES", "IDFC", "AU", "RBL", "UPI", "NRE", "NRO", "PNB", "IDBI"]);

export function bankDisplayName(key: string | null | undefined): string {
    if (!key) return "—";
    if (BANK_DISPLAY[key]) return BANK_DISPLAY[key];
    return key
        .split(/[_\s]+/)
        .filter(Boolean)
        .map((w) => (BANK_ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()))
        .join(" ");
}

/** "Thu, Oct 1, 2026" in IST, or "" for an unparseable date. */
export function activityDate(value: string | null | undefined): string {
    if (!value) return "";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    }).format(d);
}

/**
 * Invoice amount in its ORIGINAL currency, locale-formatted ("$757.50",
 * "₹4,28,312.70", "£1,234.50") instead of "USD757.50". No conversion.
 * Missing/zero amount → "—". Unknown currency code → "CODE 1,234.00".
 */
export function invoiceAmount(amount: number | string | null | undefined, currency: string | null | undefined): string {
    const n = Number(amount);
    if (amount === null || amount === undefined || amount === "" || !Number.isFinite(n) || n === 0) return "—";
    const code = (currency || "INR").toUpperCase();
    try {
        return new Intl.NumberFormat("en-IN", {style: "currency", currency: code}).format(n);
    } catch {
        return `${code} ${new Intl.NumberFormat("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2}).format(n)}`;
    }
}

/**
 * Bank memo for the activity feed: the memo stays the source of truth (no
 * re-wording), but whitespace is collapsed and account / reference numbers
 * are masked, matching the design's "Sweep Trf From: 8402••••1746".
 */
export function activityMemo(details: string | null | undefined): string {
    const collapsed = (details || "").replace(/\s+/g, " ").trim();
    return collapsed ? maskAccountIds(collapsed) : "Transaction";
}
