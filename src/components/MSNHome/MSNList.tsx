import React, {useMemo, useState} from "react";
import {MSNListResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {
    buildT1Tooltip,
    formatCurrency,
    formatQuantity,
    getCostBasisDivergence,
    getDayChange,
    getPendingValue,
    getPledgeInfo,
    getRowCurrentValue,
    getRowInvested,
    getRowUnrealizedPnL,
    getT1Quantity,
    getTotalQuantity,
    isDayChangeKnown,
    type CostBasisDivergence,
    type DayChange,
    type PledgeInfo,
} from "../../utils/holdings.ts";
import style from "./MSNHome.module.scss";

const PRICE_UNAVAILABLE_TOOLTIP =
    "Live price could not be fetched from the data provider for this security.";

interface MSNListProps {
    list: MSNListResponse[];
    onClick: (buyCode: string) => void;
}

type SortKey = "name" | "pnl" | "pnlPct" | "value" | "dayChange";

interface ComputedStock {
    stock: MSNListResponse;
    buyCode: string;
    lastPrice: number;
    buyQuant: number;
    buyPrice: number;
    pChange: number;
    profit: number;
    profitPercentage: number;
    currentValue: number;
    priceUnavailable: boolean;
    pendingQuant: number;
    pendingValue: number;
    totalQuant: number;
    dayChange: DayChange | null;
    /**
     * False iff BE explicitly reported `day_change_known: false` (ak-4o41).
     * Distinct from "dayChange === null" (no displayable signal from any
     * source): known=false means BE's broker-side computation couldn't
     * run, and rendering ₹0 would conflate unknown with flat.
     */
    dayChangeKnown: boolean;
    pledge: PledgeInfo | null;
    costBasisDivergence: CostBasisDivergence | null;
}

/**
 * FE-4 (ak-gkqp) Nocturne-skin pass over the MSN holdings list.
 *
 * Preserves EVERY computation from the pre-FE-4 MSNList byte-for-byte:
 * - Same `ComputedStock` shape
 * - Same CONSUME-not-recompute dispatch through `getRowCurrentValue` /
 *   `getRowInvested` / `getRowUnrealizedPnL` for stocks/mf (BE fold-in)
 *   + fallback for MF/NPS/manual via helpers' internal dispatch
 * - Same broker-source precedence (`getDayChange` / `isDayChangeKnown`)
 * - Same T+1 settlement split via `getT1Quantity` / `getPendingValue` /
 *   `getTotalQuantity`
 * - Same price-unavailable neutral styling when `info.error` truthy
 * - Same strict day_change_known gate (ak-quts byte-identical):
 *     !dayChangeKnown → '—' with neutral styling (NEVER green/red)
 * - Same cost-basis divergence hint pattern
 *
 * Only the rendering surface swaps from MUI (Card/Chip/Box/Typography)
 * to plain divs with Nocturne tokens. Zero semantic drift.
 */
const MSNList: React.FC<MSNListProps> = ({list, onClick}) => {
    const {state} = useMSNContext();
    const [sortKey, setSortKey] = useState<SortKey>("pnl");
    const [sortAsc, setSortAsc] = useState(false);

    const computedList = useMemo(() => {
        if (!Array.isArray(list)) return [];
        return list.map((stock): ComputedStock => {
            let lastPrice = 0;
            let buyQuant = 0;
            let buyPrice = 0;
            let pChange = 0;
            let {buyCode} = stock;
            const {info} = stock;
            if (state.selectedCard.stocks || state.selectedCard.mf) {
                if (state.selectedCard.mf && info.companyName) {
                    buyCode = info.companyName;
                }
                lastPrice = info.lastPrice;
                pChange = info.pChange;
                buyPrice = stock.buyPrice;
                buyQuant = stock.buyQuant;
            } else if (state.selectedCard.nps && stock.info.lastWeek && info.name) {
                buyCode = info.name;
                lastPrice = Number(stock.info.nav);
                const previousClose = Number(stock.info.lastWeek);
                buyQuant = stock.buyQuant;
                buyPrice = stock.buyPrice;
                pChange = Number(((lastPrice - previousClose) / previousClose * 100).toFixed(2));
            }
            // Backend sets `info.error` (e.g. "API_FAILED") when the live price feed errored.
            // In that case lastPrice is unreliable (often 0) and any P&L derived from it would be misleading
            // (e.g. -100% loss against buyValue). Surface this to the renderer instead of computing fake numbers.
            const priceUnavailable = Boolean(info && info.error);

            // Value + P&L: CONSUME the BE-emitted fold-in fields for Kite-enriched
            // stock rows (blended, includes T+1 valued at Kite's last_price); fall
            // back to statement compute (lastPrice × buyQuant vs buyPrice × buyQuant)
            // for MF/NPS/manually-added rows via the helpers' automatic dispatch.
            // Re-implementing `average_price × total_qty` locally would break
            // Overseer's reconcile invariant (top-line Change == Σ per-row
            // unrealized_pnl only holds when both sides read the same BE source).
            // See `utils/holdings.ts` rule #2 for the full policy chain.
            const currentValue = priceUnavailable ? 0 : getRowCurrentValue(stock, lastPrice);
            const invested = getRowInvested(stock);
            const profit = priceUnavailable ? 0 : getRowUnrealizedPnL(stock, lastPrice);
            const profitPercentage =
                priceUnavailable || invested === 0 ? 0 : (profit / invested) * 100;

            const pendingQuant = getT1Quantity(stock);
            const pendingValue = getPendingValue(stock, lastPrice);
            const totalQuant = getTotalQuantity(stock);
            const dayChange = getDayChange(stock, pChange);
            const dayChangeKnown = isDayChangeKnown(stock);
            const pledge = getPledgeInfo(stock);
            const costBasisDivergence = getCostBasisDivergence(stock);

            return {
                stock,
                buyCode,
                lastPrice,
                buyQuant,
                buyPrice,
                pChange,
                profit,
                profitPercentage,
                currentValue,
                priceUnavailable,
                pendingQuant,
                pendingValue,
                totalQuant,
                dayChange,
                dayChangeKnown,
                pledge,
                costBasisDivergence,
            };
        });
    }, [list, state.selectedCard]);

    const sortedList = useMemo(() => {
        const sorted = [...computedList];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name":
                    cmp = a.buyCode.localeCompare(b.buyCode);
                    break;
                case "pnl":
                    cmp = a.profit - b.profit;
                    break;
                case "pnlPct":
                    cmp = a.profitPercentage - b.profitPercentage;
                    break;
                case "value":
                    // Sort on the full committed position (settled + pending at market).
                    cmp = (a.currentValue + a.pendingValue) - (b.currentValue + b.pendingValue);
                    break;
                case "dayChange":
                    cmp = (a.dayChange?.changePercent ?? a.pChange) - (b.dayChange?.changePercent ?? b.pChange);
                    break;
            }
            return sortAsc ? cmp : -cmp;
        });
        return sorted;
    }, [computedList, sortKey, sortAsc]);

    const handleSort = (key: SortKey) => {
        if (sortKey === key) {
            setSortAsc(!sortAsc);
        } else {
            setSortKey(key);
            setSortAsc(false);
        }
    };

    const sortOptions: {key: SortKey; label: string}[] = [
        {key: "name", label: "Name"},
        {key: "pnl", label: "P&L"},
        {key: "pnlPct", label: "P&L%"},
        {key: "value", label: "Value"},
        {key: "dayChange", label: "Day"},
    ];

    if (list.length === 0) {
        return (
            <div className={style.emptyPanel}>
                <span className={style.emptyPrimary}>No data!</span>
                <span className={style.emptySub}>Upload a statement or add an instrument to get started.</span>
            </div>
        );
    }

    return (
        <>
            <div className={style.sortBar} role="toolbar" aria-label="Sort holdings">
                {sortOptions.map(({key, label}) => {
                    const active = sortKey === key;
                    return (
                        <button
                            key={key}
                            type="button"
                            onClick={() => handleSort(key)}
                            className={`${style.sortChip} ${active ? style.sortChipActive : ""}`}
                            aria-pressed={active}
                        >
                            {label}
                            {active && <i className={`ph ${sortAsc ? "ph-arrow-up" : "ph-arrow-down"}`}/>}
                        </button>
                    );
                })}
            </div>
            <div className={style.scrollContainer}>
                {sortedList.map((item) => {
                    const {
                        stock,
                        buyCode,
                        lastPrice,
                        buyQuant,
                        buyPrice,
                        pChange,
                        profit,
                        profitPercentage,
                        priceUnavailable,
                        pendingQuant,
                        totalQuant,
                        dayChange,
                        dayChangeKnown,
                        pledge,
                        costBasisDivergence,
                    } = item;

                    const profitString = formatCurrency(Math.abs(profit));
                    const profitPercentageString = Math.abs(profitPercentage).toFixed(2);
                    const displayPercent = dayChange ? dayChange.changePercent : pChange;
                    const isPositiveChange = displayPercent >= 0;

                    const formattedLastPrice = formatCurrency(lastPrice);
                    // Neutral border when price feed errored — green/red would be misleading.
                    const cardBorderColor = priceUnavailable
                        ? "var(--color-neutral-600)"
                        : profit >= 0
                            ? "oklch(0.80 0.13 155)"
                            : "oklch(0.74 0.15 25)";
                    // Quantity shown is the committed position (settled + pending); the T+1
                    // badge next to it discloses the split.
                    const formattedQty = formatQuantity(pendingQuant > 0 ? totalQuant : buyQuant);
                    const formattedBuyPrice = formatCurrency(buyPrice);
                    const percentLabel = dayChange
                        ? `${dayChange.changePercent >= 0 ? "+" : ""}${dayChange.changePercent.toFixed(2)}%`
                        : `${isPositiveChange ? "+" : ""}${pChange}%`;
                    // Day-change label (ak-quts) — strict poison on unknown rows.
                    const dayChangeLabel = !dayChangeKnown
                        ? "—"
                        : dayChange && dayChange.change !== null
                            ? `${dayChange.change >= 0 ? "+" : "-"}₹${formatCurrency(Math.abs(dayChange.change))} (${percentLabel})`
                            : percentLabel;

                    const changeClass =
                        !dayChangeKnown || displayPercent === 0
                            ? style.neutralValue
                            : isPositiveChange
                                ? style.positiveChange
                                : style.negativeChange;

                    return (
                        <button
                            key={stock.buyCode + stock.buyID}
                            type="button"
                            className={style.row}
                            style={{borderLeft: `3px solid ${cardBorderColor}`}}
                            onClick={() => onClick(buyCode)}
                        >
                            <span className={style.rowSymbol}>{buyCode}</span>

                            <span className={style.rowCurrentBox}>
                                {priceUnavailable ? (
                                    <span className={style.priceUnavailable} title={PRICE_UNAVAILABLE_TOOLTIP}>
                                        <i className="ph ph-warning"/>
                                        <span>Price unavailable</span>
                                    </span>
                                ) : (
                                    <>
                                        <span className={style.rowCurrentValue}>₹{formattedLastPrice}</span>
                                        <span className={changeClass}>{dayChangeLabel}</span>
                                    </>
                                )}
                            </span>

                            <span className={style.rowPreviousBox}>
                                <span className={style.rowMeta}>
                                    Avg: ₹{formattedBuyPrice}
                                    {costBasisDivergence && (
                                        <span
                                            className={style.costBasisHint}
                                            title={
                                                `Broker average is ₹${formatCurrency(costBasisDivergence.broker)} ` +
                                                `(${costBasisDivergence.percent >= 0 ? "+" : ""}${costBasisDivergence.percent.toFixed(2)}% ` +
                                                `vs our ₹${formatCurrency(costBasisDivergence.ours)} statement-derived basis). ` +
                                                `Informational cross-check only — our basis is used for all P&L.`
                                            }
                                        >
                                            <i className="ph ph-info"/>
                                        </span>
                                    )}
                                </span>
                                <span className={style.rowMeta}>
                                    Qty: {formattedQty}
                                    {pendingQuant > 0 && (
                                        <span
                                            className={style.t1Chip}
                                            title={buildT1Tooltip(stock, lastPrice)}
                                        >
                                            T+1 {formatQuantity(pendingQuant)}
                                        </span>
                                    )}
                                </span>
                                {pledge && (
                                    <span className={style.pledgeLine}>
                                        {pledge.pledged > 0 && `${formatQuantity(pledge.pledged)} pledged`}
                                        {pledge.pledged > 0 && pledge.authorised > 0 && " · "}
                                        {pledge.authorised > 0 && `${formatQuantity(pledge.authorised)} authorised`}
                                    </span>
                                )}
                            </span>

                            <span className={style.rowChangeBox}>
                                {priceUnavailable ? (
                                    <>
                                        <span className={style.neutralValue}>—</span>
                                        <span className={style.neutralValue}>—</span>
                                    </>
                                ) : (
                                    <>
                                        <span className={profit >= 0 ? style.positiveChange : style.negativeChange}>
                                            {profit >= 0 ? "+" : "−"}₹{profitString}
                                        </span>
                                        <span className={profitPercentage >= 0 ? style.positiveChange : style.negativeChange}>
                                            {profitPercentage >= 0 ? "+" : "−"}{profitPercentageString}%
                                        </span>
                                    </>
                                )}
                            </span>
                        </button>
                    );
                })}
            </div>
        </>
    );
};

export default MSNList;
