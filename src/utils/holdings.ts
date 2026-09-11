// Broker (Kite) holdings helpers — ak-9we.
//
// The dashboard row carries optional broker fields (see `MSNListResponse`). They are
// absent for MF / NPS / manually added securities and absent entirely until the backend
// row-9 change (ak-w4p) lands, so every reader must tolerate `undefined`.
//
// ACCOUNTING RULES encoded here (do not bypass these helpers in components):
//  1. `buyQuant` is the SETTLED quantity; `t1_quantity` is bought-but-unsettled and is
//     NOT included in it. Committed position = buyQuant + t1_quantity.
//  2. P&L is computed on the settled quantity only, because our statement-derived cost
//     basis (`buyPrice`) covers exactly those shares. Valuing T+1 shares at market while
//     their purchase cost is missing from the basis would book their whole market value
//     as profit. T+1 value is therefore surfaced separately, never folded into P&L.
//  3. The broker's `average_price` is a cross-check surface only — it never replaces
//     `buyPrice` in any calculation.
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
    /** Our statement-derived cost basis — the source of truth. */
    ours: number;
    /** Broker-computed average price. */
    broker: number;
    /** broker - ours, in ₹. */
    difference: number;
    /** Divergence relative to our basis, in %. */
    percent: number;
}

/**
 * Informational cross-check between our cost basis and the broker's average price.
 * Returns null unless both are usable and they diverge by more than the threshold.
 * Purely a display hint — nothing here feeds P&L.
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
        `${formatQuantity(settled)} settled. P&L below is computed on settled shares only, ` +
        `since the pending purchase is not in the cost basis yet.`
    );
};
