import React, {useMemo, useState} from "react";
import {RealizedTrade} from "../../utils/interfaces";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import style from "./MSNHome.module.scss";

type SortKey = "name" | "pnl" | "trades";

interface GroupedTrade {
    symbol: string;
    trades: RealizedTrade[];
    totalPnl: number;
    totalQty: number;
}

/**
 * FE-4 (ak-gkqp) Nocturne-skin of the realized-gains panel. Preserves the
 * pre-FE-4 grouping (by symbol) + sort + expand pattern byte-for-byte;
 * only the rendering swaps from MUI (Card/Chip/Expand) to plain divs +
 * Nocturne SCSS.
 */
const RealizedPnL: React.FC = () => {
    const {state} = useMSNContext();
    const data = state.realizedPnl;
    const [sortKey, setSortKey] = useState<SortKey>("pnl");
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

    const CLR_GAIN = "oklch(0.80 0.13 155)";
    const CLR_LOSS = "oklch(0.74 0.15 25)";

    const groupedTrades = useMemo((): GroupedTrade[] => {
        if (!data || !data.trades) return [];
        const groups = new Map<string, GroupedTrade>();
        data.trades.forEach((trade) => {
            const existing = groups.get(trade.symbol) || {
                symbol: trade.symbol,
                trades: [],
                totalPnl: 0,
                totalQty: 0,
            };
            existing.trades.push(trade);
            existing.totalPnl += trade.profit;
            existing.totalQty += trade.quantity;
            groups.set(trade.symbol, existing);
        });
        return Array.from(groups.values());
    }, [data]);

    const sortedGroups = useMemo(() => {
        const sorted = [...groupedTrades];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name":
                    cmp = a.symbol.localeCompare(b.symbol);
                    break;
                case "pnl":
                    cmp = a.totalPnl - b.totalPnl;
                    break;
                case "trades":
                    cmp = a.trades.length - b.trades.length;
                    break;
            }
            return sortAsc ? cmp : -cmp;
        });
        return sorted;
    }, [groupedTrades, sortKey, sortAsc]);

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
        {key: "trades", label: "Trades"},
    ];

    if (data === null) {
        return (
            <div className={style.emptyPanel}>
                <span className={style.spinner}><i className="ph ph-spinner"/></span>
            </div>
        );
    }

    if (data.tradeCount === 0) {
        return (
            <div className={style.emptyPanel}>
                <span className={style.emptyPrimary}>No historical equity trades</span>
                <span className={style.emptySub}>Upload a statement to see realized P&amp;L</span>
            </div>
        );
    }

    return (
        <>
            <div className={style.sortBar} role="toolbar" aria-label="Sort realized P&L">
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
                {sortedGroups.map((group) => {
                    const isExpanded = expandedSymbol === group.symbol;
                    const isPositive = group.totalPnl >= 0;
                    return (
                        <React.Fragment key={group.symbol}>
                            <button
                                type="button"
                                className={style.historicalRow}
                                style={{borderLeft: `3px solid ${isPositive ? CLR_GAIN : CLR_LOSS}`}}
                                onClick={() => setExpandedSymbol(isExpanded ? null : group.symbol)}
                                aria-expanded={isExpanded}
                            >
                                <span className={style.rowSymbol}>{group.symbol}</span>
                                <span className={style.historicalMeta}>
                                    <span>{group.trades.length} trade{group.trades.length !== 1 ? "s" : ""}</span>
                                    <span>Qty: {group.totalQty}</span>
                                </span>
                                <span className={style.historicalPnl}>
                                    <span style={{color: isPositive ? CLR_GAIN : CLR_LOSS}}>
                                        {isPositive ? "+" : "−"}₹{formatCurrency(Math.abs(group.totalPnl))}
                                    </span>
                                    <i className={`ph ${isExpanded ? "ph-caret-up" : "ph-caret-down"}`}/>
                                </span>
                            </button>

                            {isExpanded && (
                                <div className={style.expandedTradesContainer}>
                                    {group.trades.map((trade) => (
                                        <div key={trade.sellID} className={style.expandedTradeRow}>
                                            <span>
                                                ₹{formatCurrency(trade.buyPrice)} → ₹{formatCurrency(trade.sellPrice)}
                                            </span>
                                            <span>Qty: {trade.quantity}</span>
                                            <span style={{color: trade.profit >= 0 ? CLR_GAIN : CLR_LOSS}}>
                                                {trade.profit >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(trade.profit))}
                                            </span>
                                            <span>{trade.sellDate}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </React.Fragment>
                    );
                })}
            </div>
        </>
    );
};

export default RealizedPnL;
