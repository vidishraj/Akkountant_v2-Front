// Pure normalizers extracted from wealthDigestService.ts so the shape-handling
// logic is importable without pulling Firebase into a node test harness.
//
// Kept intentionally dependency-free (no firebase, no network) so
// `holdings.check.ts` can import and assert against it directly.

export interface PortfolioTrendPoint {
    date: string;   // YYYY-MM-DD (IST)
    value: number;  // portfolio total in ₹ at end-of-day
}

/**
 * Normalizes a response body from `GET /investment-snapshot/history` into
 * `PortfolioTrendPoint[]`.
 *
 * Shape handling: accepts the new bare-list shape `[{...}, ...]` AND the
 * legacy wrapped `{points: [...]}` shape (brief ship-order-agnostic window).
 *
 * Per-point field precedence (ak-uqjz contract-drift fix): BE emits
 * `total_value` as the authoritative wire name (confirmed in
 * portfolio_history_aggregator.py). We also accept `portfolio_value` and
 * `value` as legacy aliases so an alternate rename on either side does not
 * silently blank the chart again. Any point whose date is missing or whose
 * value is non-finite across ALL three aliases is dropped.
 *
 * The caller passes `days` so the slice-to-tail guard can enforce the
 * window even if BE returns more than requested.
 */
export function normalizePortfolioTrendPoints(
    body: unknown,
    days: number,
): PortfolioTrendPoint[] {
    const raw: unknown[] = Array.isArray(body)
        ? body
        : Array.isArray((body as { points?: unknown })?.points)
            ? ((body as { points: unknown[] }).points)
            : [];
    return raw
        .filter(
            (p): p is Record<string, unknown> => typeof p === "object" && p !== null,
        )
        .map((p): PortfolioTrendPoint | null => {
            const date = typeof p.date === "string" ? p.date : "";
            // BE wire name is `total_value`. `portfolio_value` and `value` are
            // retained as defensive legacy aliases — zero cost, shields the
            // chart from a future BE rename or legacy stub response.
            const primary = p.total_value;
            const legacy1 = p.portfolio_value;
            const legacy2 = p.value;
            const pick = (v: unknown): number | null =>
                typeof v === "number" && Number.isFinite(v) ? v : null;
            const value =
                pick(primary) ?? pick(legacy1) ?? pick(legacy2) ?? NaN;
            if (!date || !Number.isFinite(value)) return null;
            return { date, value };
        })
        .filter((p): p is PortfolioTrendPoint => p !== null)
        .slice(-days);
}
