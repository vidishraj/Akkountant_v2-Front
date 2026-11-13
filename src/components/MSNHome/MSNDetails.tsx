import React, {useEffect, useState} from "react";
import {MSNListResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {formatDateString} from "../../utils/util.tsx";
import {
    buildT1Tooltip,
    formatCurrency,
    formatQuantity,
    getRowCurrentValue,
    getRowInvested,
    getRowUnrealizedPnL,
    getT1Quantity,
} from "../../utils/holdings.ts";
import style from "./MSNDetails.module.scss";

const PRICE_UNAVAILABLE_TOOLTIP =
    "Live price could not be fetched from the data provider for this security.";

interface MSNDetailsProps {
    details: MSNListResponse;
}

export interface Transaction {
    date: string;
    id: number;
    price: string;
    quant: string;
    transactionType: "buy" | "sell";
    securityCode?: string;
    buyId?: string;
}

/**
 * FE-4 (ak-gkqp) Nocturne-skin pass over the per-row details panel.
 *
 * Preserves EVERY computation + consume-not-recompute discipline from the
 * pre-FE-4 MSNDetails. Only the render surface swaps from MUI to plain
 * divs + Nocturne SCSS. Hero numbers continue to source from
 * `getRowCurrentValue` / `getRowInvested` / `getRowUnrealizedPnL` /
 * `getT1Quantity`, preserving Overseer's reconcile invariant.
 */
const MSNDetails: React.FC<MSNDetailsProps> = ({details}) => {
    const {state, fetchTransactions, getServiceType, getContextKey} = useMSNContext();
    const isMfOrNps = state.selectedCard.mf || state.selectedCard.nps;
    const [activeTab, setActiveTab] = useState<number>(0);
    const priceUnavailable = Boolean(details?.info && details.info.error);

    const [financialData, setFinancialData] = useState<Transaction[]>([]);

    const CLR_GAIN = "oklch(0.80 0.13 155)";
    const CLR_LOSS = "oklch(0.74 0.15 25)";

    useEffect(() => {
        const selected = getContextKey();
        const allTransactions = state.transactions[selected] || [];
        const securityCodeToMatch = details.buyCode;
        let filteredTransactions = allTransactions;
        if (securityCodeToMatch) {
            filteredTransactions = allTransactions.filter(
                (transaction: Transaction) =>
                    transaction.securityCode === securityCodeToMatch ||
                    String(transaction.securityCode) === String(securityCodeToMatch),
            );
        }
        setFinancialData(filteredTransactions);
    }, [details, state.selectedCard, state.transactions, getContextKey]);

    useEffect(() => {
        if (state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks) {
            fetchTransactions(getServiceType(), false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.selectedCard]);

    // ak-c2sy: coerce non-finite price to 0 so the current-value / PnL
    // helpers go through their existing `price <= 0 → 0` branch instead
    // of multiplying NaN through to "₹NaN" on screen. getRowCurrentValue
    // / getRowUnrealizedPnL guard with `price <= 0`, which does NOT catch
    // non-finite (NaN <= 0 is false), so we normalize here. Newly
    // reachable with FE-4's unconditional-hero display for NPS; low-
    // probability (NPS rows always carry nav in practice) but free.
    const rawActivePrice =
        state.selectedCard.nps ? Number(details.info.nav) : Number(details.info.lastPrice);
    const activePrice = Number.isFinite(rawActivePrice) ? rawActivePrice : 0;
    const invested = getRowInvested(details);
    const currentValue = priceUnavailable ? 0 : getRowCurrentValue(details, activePrice);
    const pnl = priceUnavailable ? 0 : getRowUnrealizedPnL(details, activePrice);
    const t1 = getT1Quantity(details);

    // NPS change (vs yesterday) is a FE-local compute — there's no BE field
    // and no helper to defer to; mirrors pre-FE-4 logic byte-for-byte.
    const npsChange = (() => {
        if (!state.selectedCard.nps) return null;
        const nav = Number(details.info.nav);
        const yesterday = Number(details.info.yesterday);
        const change = nav - yesterday;
        const pct = yesterday !== 0 ? (change / yesterday) * 100 : 0;
        return {change, pct};
    })();

    const technicalRows = (() => {
        if (state.selectedCard.stocks) {
            return [
                ["Open", details.info.open],
                ["Close", details.info.close],
                ["Day High", details.info.dayHigh],
                ["Day Low", details.info.dayLow],
            ];
        }
        if (state.selectedCard.mf) {
            return [
                ["Prev. Close", details.info.previousClose],
                ["Scheme Type", details.info.schemeType],
                ["Units", formatQuantity(details.buyQuant)],
                ["Avg. NAV", `₹${formatCurrency(details.buyPrice)}`],
            ];
        }
        if (state.selectedCard.nps) {
            return [
                ["Yesterday", details.info.yesterday],
                ["Last Week", details.info.lastWeek],
                ["6 Months Ago", details.info.sixMonthsAgo],
                ["Units", formatQuantity(details.buyQuant)],
            ];
        }
        return [];
    })();

    return (
        <div className={style.container}>
            <nav className={style.tabs} role="tablist">
                {["Technicals", "Transactions"].map((label, idx) => (
                    <button
                        key={label}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === idx}
                        onClick={() => setActiveTab(idx)}
                        className={`${style.tab} ${activeTab === idx ? style.tabActive : ""}`}
                    >
                        {label}
                    </button>
                ))}
            </nav>

            {activeTab === 0 && (
                <div className={style.tabContent}>
                    <div className={style.hero}>
                        <div className={style.heroLeft}>
                            <span className={style.heroTitle}>
                                {state.selectedCard.mf
                                    ? details.info.companyName
                                    : state.selectedCard.nps
                                        ? details.info.name
                                        : details.buyCode}
                            </span>
                            <span className={style.heroSub}>
                                {state.selectedCard.mf
                                    ? details.info.fundHouse
                                    : state.selectedCard.nps
                                        ? details.info.pfm_name
                                        : details.info.industry}
                            </span>
                        </div>
                        <div className={style.heroRight}>
                            {priceUnavailable ? (
                                <span className={style.priceUnavailable} title={PRICE_UNAVAILABLE_TOOLTIP}>
                                    <i className="ph ph-warning"/>
                                    <span>Price unavailable</span>
                                </span>
                            ) : (
                                <>
                                    <span className={style.heroPrice}>
                                        ₹{formatCurrency(activePrice)}
                                    </span>
                                    {state.selectedCard.nps && npsChange ? (
                                        <span
                                            className={style.heroPct}
                                            style={{color: npsChange.change >= 0 ? CLR_GAIN : CLR_LOSS}}
                                        >
                                            {npsChange.change >= 0 ? "+" : ""}{npsChange.change.toFixed(2)} ({npsChange.pct.toFixed(2)}%)
                                        </span>
                                    ) : (
                                        <span
                                            className={style.heroPct}
                                            style={{color: Number(details.info.pChange) >= 0 ? CLR_GAIN : CLR_LOSS}}
                                        >
                                            {Number(details.info.change) >= 0 ? "+" : ""}{Number(details.info.change).toFixed(2)} ({Number(details.info.pChange).toFixed(2)}%)
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    <div className={style.ivRow}>
                        <div className={style.ivCell}>
                            <span className={style.ivLabel}>Invested</span>
                            <span className={style.ivValue}>₹{formatCurrency(invested)}</span>
                        </div>
                        <div className={style.ivCell}>
                            <span className={style.ivLabel}>Current</span>
                            {priceUnavailable ? (
                                <span className={style.ivValueMuted}>—</span>
                            ) : (
                                <span className={style.ivValue}>₹{formatCurrency(currentValue)}</span>
                            )}
                        </div>
                        <div className={style.ivCell}>
                            <span className={style.ivLabel}>P&amp;L</span>
                            {priceUnavailable ? (
                                <span className={style.ivValueMuted}>—</span>
                            ) : (
                                <span
                                    className={style.ivValue}
                                    style={{color: pnl >= 0 ? CLR_GAIN : CLR_LOSS}}
                                >
                                    {pnl >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(pnl))}
                                </span>
                            )}
                        </div>
                    </div>

                    {t1 > 0 && (
                        <div className={style.t1Row}>
                            <span
                                className={style.t1Chip}
                                title={buildT1Tooltip(details, activePrice)}
                            >
                                T+1 {formatQuantity(t1)}
                            </span>
                            <span className={style.t1Meta}>
                                {formatQuantity(details.buyQuant)} settled · included in the figures above
                            </span>
                        </div>
                    )}

                    <div className={style.ohlcGrid}>
                        {technicalRows.map(([label, value]) => (
                            <div className={style.ohlcCell} key={String(label)}>
                                <span className={style.ohlcLabel}>{label}</span>
                                <span className={style.ohlcValue}>
                                    {typeof value === "number"
                                        ? value.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2})
                                        : value}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 1 && (
                <div className={style.tabContent}>
                    <div className={style.table}>
                        <div className={style.tableHead}>
                            <span>Date</span>
                            <span>{isMfOrNps ? "NAV" : "Price"}</span>
                            <span>{isMfOrNps ? "Units" : "Qty"}</span>
                            <span>Total</span>
                            <span>Action</span>
                        </div>
                        {financialData.length > 0 ? (
                            financialData.map((row, index) => {
                                const price = Number(row.price);
                                const quant = Number(row.quant);
                                const total = price * quant;
                                return (
                                    <div className={style.tableRow} key={index}>
                                        <span>{formatDateString(row.date)}</span>
                                        <span>₹{formatCurrency(price)}</span>
                                        <span>
                                            {quant.toLocaleString("en-IN", {
                                                minimumFractionDigits: isMfOrNps ? 3 : 0,
                                                maximumFractionDigits: isMfOrNps ? 3 : 0,
                                            })}
                                        </span>
                                        <span>₹{formatCurrency(total)}</span>
                                        <span
                                            className={row.transactionType === "buy" ? style.buyAction : style.sellAction}
                                        >
                                            {row.transactionType.toUpperCase()}
                                        </span>
                                    </div>
                                );
                            })
                        ) : (
                            <div className={style.tableEmpty}>No transactions found</div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default MSNDetails;
