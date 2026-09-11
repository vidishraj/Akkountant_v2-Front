// Broker (Kite) holdings helpers — ak-9we / ak-yz9c fold-in.
//
// The dashboard row carries optional broker fields (see `MSNListResponse`). They are
// absent for MF / NPS / manually added securities, so every reader must tolerate
// `undefined`.
//
// ACCOUNTING RULES encoded here (do not bypass these helpers in components):
//
//  1. `buyQuant` is DB-truthed SETTLED quantity (statement-derived, unchanged).
//     `t1_qty` is broker-reported bought-but-unsettled (T+1 window).
//     `total_qty` is BE-emitted blended (settled + T+1), the single source of
//     truth for the blended position on Kite-enriched rows — helpers prefer
//     it over recomputing settled + t1.
//
//  2. P&L for KITE-ENRICHED (STOCK) ROWS folds T+1 shares into the totals
//     via BE-computed row-level `invested` / `unrealized_pnl` /
//     `current_value` / `day_change_amount`. **Renderers must CONSUME these
//     BE fields (via `getRowInvested` / `getRowCurrentValue` / etc.), never
//     recompute them locally** — recomputing re-introduces the divergent-
//     derivation class Path A was designed to kill, and breaks Overseer's
//     reconcile-test invariant (top-line Change == Σ per-row unrealized_pnl,
//     which only holds when both sides read the same BE source). MF / NPS /
//     manually-added rows (no BE fold fields) keep statement compute via
//     the helpers' fallback path — automatic scoping. This rule SUPERSEDED
//     the earlier "settled-only P&L" invariant on 2026-09-11 (ak-yz9c fold-
//     in, per 2026-09-04 flatten-on-sync policy). See
//     `MSNListResponse.buyPrice` comment in `interfaces.ts` for the full
//     three-anchor policy chain (pre-2026-09-04 / 2026-09-04 / 2026-09-11).
//
//  3. Broker's `average_price` is now AUTHORITATIVE for KITE-ENRICHED stock
//     cost basis (post-2026-09-11 ak-yz9c). `buyPrice` remains DB-
//     authoritative for the statement pipeline but is display-advisory on
//     the Kite view. `getCostBasisDivergence` still surfaces the delta as a
//     cross-check hint on rows where broker and statement diverge —
//     informational, does not feed any math. BE-side verification of Kite's
//     blended-avg semantic (Kite docs + T+2 empirical) recorded in
//     `Akkountant-v2/tests/test_kite_holdings_fields.py` module docstring;
//     see there for the authority citation.
import {MSNListResponse} from "./interfaces.ts";

/** Broker average-price divergence (fraction) at/above which we surface a cross-check hint. */
export const COST_BASIS_DIVERGENCE_THRESHOLD_PCT = 1;

const toFiniteNumber = (value: unknown): number => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

/** Settled/demat quantity — the quantity our cost basis covers. */
export const getSettledQuantity = (row: MSNListResponse): number => toFiniteNumber(row?.buyQuant);

/** Bought but not yet settled (T+1 window). 0 when the broker did not report it. */
export const getT1Quantity = (row: MSNListResponse): number =>
    Math.max(0, toFiniteNumber(row?.t1_qty));

/**
 * Total committed position: settled + pending settlement.
 *
 * Prefers the BE-emitted `total_qty` (ak-yz9c fold-in, single source of truth
 * for blended qty when the row was Kite-enriched). Falls back to computing
 * from settled + T+1 for rows without `total_qty` (non-Kite MF/NPS, or
 * pre-fold-ship legacy rows).
 */
export const getTotalQuantity = (row: MSNListResponse): number => {
    const total = row?.total_qty;
    if (typeof total === "number" && Number.isFinite(total)) {
        return Math.max(0, total);
    }
    return getSettledQuantity(row) + getT1Quantity(row);
};

export const hasPendingSettlement = (row: MSNListResponse): boolean => getT1Quantity(row) > 0;

/**
 * Market value of the pending-settlement (T+1) shares.
 * Returns 0 when there is nothing pending or the live price is unusable — the caller
 * must not display a value derived from an errored price feed.
 */
export const getPendingValue = (row: MSNListResponse, lastPrice: number): number => {
    if (row?.info?.error) return 0;
    const price = toFiniteNumber(lastPrice);
    if (price <= 0) return 0;
    return price * getT1Quantity(row);
};

// getTotalPendingValue / getTotalPendingQuantity removed in ak-yz9c — sole caller
// was the MSNSummary Pending (T+1) column that ak-yz9c retires (T+1 exposure now
// folds into portfolio totals via row-level `invested`/`current_value`, so a
// summary-column-level aggregate is no longer meaningful). Per-row `getPendingValue`
// stays for tooltip / detail contexts that still surface the pending sub-line.

// ─── Row-level P&L helpers (ak-yz9c fold-in) ─────────────────────────────────
//
// These helpers embody the CONSUME-NOT-RECOMPUTE principle for row-level P&L
// under Path A: when the BE-emitted folded field is present (Kite-enriched
// stock rows), read it verbatim; when absent (MF / NPS / manually-added
// rows), fall back to statement compute. Renderers call the helpers and
// never branch on Kite-vs-not themselves — the helpers' present/absent
// dispatch is the scoping mechanism.
//
// Why consume, not re-derive: Path A puts BE as the source of truth for
// money math. Re-computing `average_price × total_qty` on the client re-
// introduces the divergent-derivation class Path A was designed to kill,
// and breaks Overseer's reconcile invariant (top-line Change == Σ per-row
// unrealized_pnl only holds when both sides read the SAME BE source).
// Rounding drift matters too: BE Decimal vs FE toLocaleString diverges by
// paise on unfriendly numbers, which fails the reconcile by construction.
//
// Same shape as `getTotalQuantity`'s prefer-BE-`total_qty`-else-compute
// pattern from Commit 1 — proven pattern, replicated across the P&L axis.

/**
 * Row-level invested — BE-emitted `invested` for Kite-enriched stock rows;
 * statement compute (`buyPrice × settled_qty`) for MF/NPS/legacy rows.
 */
export const getRowInvested = (row: MSNListResponse): number => {
    if (typeof row?.invested === "number" && Number.isFinite(row.invested)) {
        return row.invested;
    }
    return toFiniteNumber(row?.buyPrice) * getSettledQuantity(row);
};

/**
 * Row-level current market value — BE-emitted `current_value` (folded,
 * `last_price × total_qty` including T+1) for Kite-enriched stock rows;
 * live-feed compute (`lastPrice × settled_qty`) for MF/NPS/legacy rows.
 * Returns 0 when a fallback row's price is unusable (0 / errored feed).
 */
export const getRowCurrentValue = (row: MSNListResponse, lastPrice: number): number => {
    if (typeof row?.current_value === "number" && Number.isFinite(row.current_value)) {
        return row.current_value;
    }
    const price = toFiniteNumber(lastPrice);
    if (price <= 0) return 0;
    return price * getSettledQuantity(row);
};

/**
 * Row-level unrealized P&L — BE-emitted `unrealized_pnl` (folded) for
 * Kite-enriched stock rows; `(lastPrice − buyPrice) × settled_qty` for
 * MF/NPS/legacy rows (computed via getRowCurrentValue - getRowInvested,
 * which itself respects the same BE/fallback dispatch).
 */
export const getRowUnrealizedPnL = (row: MSNListResponse, lastPrice: number): number => {
    if (typeof row?.unrealized_pnl === "number" && Number.isFinite(row.unrealized_pnl)) {
        return row.unrealized_pnl;
    }
    return getRowCurrentValue(row, lastPrice) - getRowInvested(row);
};

/**
 * Row-level absolute day P&L — BE-emitted `day_change_amount` (folded,
 * `total_qty × (last_price − close_price)`) for Kite-enriched stock rows;
 * null for rows without the field (MF/NPS render day change as a
 * percentage-only via `getDayChange` — no absolute number to fall back to).
 */
export const getRowDayChangeAmount = (row: MSNListResponse): number | null => {
    if (typeof row?.day_change_amount === "number" && Number.isFinite(row.day_change_amount)) {
        return row.day_change_amount;
    }
    return null;
};

export interface DayChange {
    /**
     * Absolute per-share day change in ₹, or null when the source only gives us a
     * percentage (MF / NPS feeds). Never fabricate a 0 here — the caller renders the
     * percentage alone instead of a misleading "₹0.00".
     */
    change: number | null;
    /** Day change in %. */
    changePercent: number;
    /** `broker` = Kite-computed passthrough, `market` = derived from the NSE/live feed. */
    source: "broker" | "market";
}

/**
 * Day change for a row, preferring the broker-provided values and falling back to the
 * live market feed we already render prices from. Returns null when neither is usable
 * (e.g. the price feed errored) so the caller can render a neutral placeholder.
 */
export const getDayChange = (row: MSNListResponse, fallbackPercent?: number): DayChange | null => {
    const hasBrokerChange = row?.day_change !== undefined && Number.isFinite(Number(row.day_change));
    const hasBrokerPercent =
        row?.day_change_percentage !== undefined && Number.isFinite(Number(row.day_change_percentage));
    // The backend coerces values Kite omits to 0 (`holding.get(...) or 0`), so an
    // all-zero pair is indistinguishable from "not reported". Preferring it would
    // render a flat day next to a price the market feed shows as having moved, so
    // fall through to that feed instead — a genuinely flat day reads the same either way.
    const brokerReportedMovement =
        (hasBrokerChange && toFiniteNumber(row.day_change) !== 0) ||
        (hasBrokerPercent && toFiniteNumber(row.day_change_percentage) !== 0);

    if (brokerReportedMovement) {
        const change = toFiniteNumber(row.day_change);
        const closePrice = toFiniteNumber(row.close_price);
        // Derive whichever half the broker omitted; a 0 close price means we cannot.
        const changePercent = hasBrokerPercent
            ? toFiniteNumber(row.day_change_percentage)
            : closePrice > 0
                ? (change / closePrice) * 100
                : 0;
        return {change, changePercent, source: "broker"};
    }

    if (row?.info?.error) return null;

    // MF / NPS feeds carry no absolute change — report null rather than a fabricated ₹0.
    const hasMarketChange = row?.info?.change !== undefined && Number.isFinite(Number(row.info.change));
    const marketChange = hasMarketChange ? toFiniteNumber(row.info.change) : null;
    const marketPercent = fallbackPercent !== undefined && Number.isFinite(Number(fallbackPercent))
        ? toFiniteNumber(fallbackPercent)
        : toFiniteNumber(row?.info?.pChange);
    if (!hasMarketChange && marketPercent === 0) return null;
    return {change: marketChange, changePercent: marketPercent, source: "market"};
};

export interface PledgeInfo {
    pledged: number;
    authorised: number;
}

/**
 * Collateral / authorised sub-line data. Returns null when the broker reported neither,
 * which is the common case. Deliberately does NOT compute a "free vs pledged" split of
 * our own quantity: how collateral relates to the settled quantity is broker-defined and
 * unconfirmed, so we report the raw pledged/authorised counts rather than invent a split.
 */
export const getPledgeInfo = (row: MSNListResponse): PledgeInfo | null => {
    const pledged = Math.max(0, toFiniteNumber(row?.collateral_quantity));
    const authorised = Math.max(0, toFiniteNumber(row?.authorised_quantity));
    if (pledged <= 0 && authorised <= 0) return null;
    return {pledged, authorised};
};

export interface CostBasisDivergence {
    /** DB-truthed statement-derived cost basis (display-advisory post-2026-09-11). */
    ours: number;
    /** Broker (Kite) average price — authoritative for Kite-view P&L post-2026-09-11. */
    broker: number;
    /** broker - ours, in ₹. */
    difference: number;
    /** Divergence relative to the statement basis, in %. */
    percent: number;
}

/**
 * Informational cross-check between the statement-derived cost basis and Kite's
 * broker average. Returns null unless both are usable and they diverge by more
 * than the threshold. Post-2026-09-11 (ak-yz9c), Kite avg is authoritative — this
 * helper still surfaces the delta as a visible hint on rows where broker and
 * statement diverge (typically after corporate actions), but the delta is
 * informational only and doesn't feed any math.
 */
export const getCostBasisDivergence = (row: MSNListResponse): CostBasisDivergence | null => {
    const ours = toFiniteNumber(row?.buyPrice);
    const broker = toFiniteNumber(row?.average_price);
    if (ours <= 0 || broker <= 0) return null;
    const difference = broker - ours;
    const percent = (difference / ours) * 100;
    if (Math.abs(percent) <= COST_BASIS_DIVERGENCE_THRESHOLD_PCT) return null;
    return {ours, broker, difference, percent};
};

export const formatQuantity = (quantity: number): string =>
    Number.isInteger(quantity)
        ? quantity.toString()
        : quantity.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

export const formatCurrency = (value: number): string =>
    value.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

/** Tooltip copy for the T+1 badge — settlement is normal flow, so keep the tone neutral. */
export const buildT1Tooltip = (row: MSNListResponse, lastPrice: number): string => {
    const pending = getT1Quantity(row);
    const settled = getSettledQuantity(row);
    const pendingValue = getPendingValue(row, lastPrice);
    const valueSuffix = pendingValue > 0 ? ` (≈ ₹${formatCurrency(pendingValue)} at market)` : "";
    return (
        `${formatQuantity(pending)} share(s) purchased, pending demat settlement (T+1)${valueSuffix}. ` +
        `${formatQuantity(settled)} settled. Invested / P&L include these T+1 shares — ` +
        `Kite's broker-blended cost basis covers the full position (ak-yz9c fold-in).`
    );
};
