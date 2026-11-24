// ak-f9kg: freelance money metrics shared by the Freelance dashboard and the
// Home KPI tiles, so the two surfaces agree by construction. Pure.
//
// Both return null for "unknown"; callers render "—", never ₹0 for missing
// data (accounting rule: a wrong total is CRITICAL).

export interface MonthEarnings {
    month: string;    // "YYYY-MM"
    earnings: number; // paid, already in INR (BE-normalised)
}

export interface UnpaidRow {
    currency: string;
    amount: number;
}

/**
 * Average paid earnings per month over the months in [startMonth, endMonth]
 * (inclusive, "YYYY-MM"; open bounds allowed). Same formula the dashboard's
 * "Monthly avg (N mo)" tile has always used: sum ÷ number of month rows in
 * range. null when there are no rows in range (unknown, not ₹0).
 */
export function monthlyAverage(
    months: readonly MonthEarnings[] | null | undefined,
    startMonth?: string | null,
    endMonth?: string | null,
): number | null {
    if (!months) return null;
    const inRange = months.filter(
        (m) => (!startMonth || m.month >= startMonth) && (!endMonth || m.month <= endMonth),
    );
    if (inRange.length === 0) return null;
    const total = inRange.reduce((sum, m) => sum + (Number(m.earnings) || 0), 0);
    return total / inRange.length;
}

/** "YYYY-MM" of a "YYYY-MM-DD" (or Date-parsable) value, else null. */
export function toMonth(value: string | null | undefined): string | null {
    if (!value) return null;
    const m = /^(\d{4})-(\d{2})/.exec(value);
    return m ? `${m[1]}-${m[2]}` : null;
}

/**
 * Indian FY months ("YYYY-04" .. "YYYY+1-03") containing `today`, for when
 * the BE didn't send fyStart/fyEnd. Matches the dashboard's "This FY" preset.
 */
export function currentFyMonths(today: Date = new Date()): {start: string; end: string} {
    const y = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
    return {start: `${y}-04`, end: `${y + 1}-03`};
}

export interface RateInfo {
    rate: number;
    /** true when the rate is a built-in approximation, not a live quote. */
    approx: boolean;
}

export interface InrTotal {
    total: number;
    /** true when ANY row used an approximate (static) rate → label it "≈". */
    approx: boolean;
}

/**
 * Total owed across currencies, converted to INR with `rateToINR`.
 * - [] / undefined rows → {total: 0, approx: false} (genuinely nothing owed).
 * - any row whose currency has NO rate → null (unknown). Never a silent 1:1,
 *   which would show $757.50 as ₹757.50.
 * - any row converted at an approximate rate → `approx: true`, so the UI
 *   shows "≈ ₹X · approx. rate" instead of presenting it as exact.
 */
export function unpaidTotalInINR(
    rows: readonly UnpaidRow[] | null | undefined,
    rateToINR: (currency: string) => RateInfo | null,
): InrTotal | null {
    if (!rows || rows.length === 0) return {total: 0, approx: false};
    let total = 0;
    let approx = false;
    for (const r of rows) {
        const amount = Number(r.amount);
        if (!Number.isFinite(amount)) return null;
        const info = rateToINR((r.currency || "INR").toUpperCase());
        if (info === null) return null;
        total += amount * info.rate;
        approx = approx || info.approx;
    }
    return {total, approx};
}
