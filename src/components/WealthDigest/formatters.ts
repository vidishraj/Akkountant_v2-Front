/**
 * Local copies of the two number formatters used across the app's dashboard
 * surfaces. Duplicated (not imported from GlobalSummary) because that file
 * has ongoing polish work (ak-xob) and pulling the exports would couple this
 * new page to that in-flight refactor. Both helpers are trivial enough that
 * the duplication is preferable to premature centralization.
 *
 * If either helper drifts in a way that matters — units, locale, precision —
 * fold both call-sites into a shared utils module after ak-xob lands.
 */

/**
 * IN-locale currency formatting with 2 fractional digits, comma-grouped.
 * Used for tooltip "true value" reveals on the stat tiles and anywhere the
 * page wants the un-compacted number.
 */
export const formatCurrency = (value: number): string =>
  value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/**
 * Compact human formatting — 12,345 → 12.3K; 1,234,567 → 12.35L (Indian
 * lakh); 100,000,000 → 10.00Cr. Falls back to fixed(2) below 1K so a small
 * hero number doesn't lose its cents. Used on tile faces where horizontal
 * space is constrained (especially on mobile).
 */
export const formatCompact = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_00_00_000) return (value / 1_00_00_000).toFixed(2) + "Cr";
  if (abs >= 1_00_000) return (value / 1_00_000).toFixed(2) + "L";
  if (abs >= 1_000) return (value / 1_000).toFixed(1) + "K";
  return value.toFixed(2);
};
