import React, {useMemo, useState} from "react";
import {FOContract} from "../../utils/interfaces";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import style from "./MSNHome.module.scss";

type SortKey = "name" | "pnl" | "contracts";

interface GroupedContract {
    underlying: string;
    contracts: FOContract[];
    totalPnl: number;
    contractCount: number;
}

/**
 * FE-4 (ak-gkqp) Nocturne-skin of the F&O P&L panel. Preserves the pre-FE-4
 * grouping (by underlying) + sort + expand pattern byte-for-byte; only the
 * rendering swaps from MUI to plain divs + Nocturne SCSS.
 */
const FOSection: React.FC = () => {
    const {state} = useMSNContext();
    const data = state.foSummary;
    const [sortKey, setSortKey] = useState<SortKey>("pnl");
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedUnderlying, setExpandedUnderlying] = useState<string | null>(null);

    const CLR_GAIN = "oklch(0.80 0.13 155)";
    const CLR_LOSS = "oklch(0.74 0.15 25)";

    const groupedContracts = useMemo((): GroupedContract[] => {
        if (!data || !data.contracts) return [];
        const groups = new Map<string, GroupedContract>();
        data.contracts.forEach((contract) => {
            const existing = groups.get(contract.underlying) || {
                underlying: contract.underlying,
                contracts: [],
                totalPnl: 0,
                contractCount: 0,
            };
            existing.contracts.push(contract);
            existing.totalPnl += contract.pnl;
            existing.contractCount++;
            groups.set(contract.underlying, existing);
        });
        return Array.from(groups.values());
    }, [data]);

    const sortedGroups = useMemo(() => {
        const sorted = [...groupedContracts];
        sorted.sort((a, b) => {
            let cmp = 0;
            switch (sortKey) {
                case "name":
                    cmp = a.underlying.localeCompare(b.underlying);
                    break;
                case "pnl":
                    cmp = a.totalPnl - b.totalPnl;
                    break;
                case "contracts":
                    cmp = a.contractCount - b.contractCount;
                    break;
            }
            return sortAsc ? cmp : -cmp;
        });
        return sorted;
    }, [groupedContracts, sortKey, sortAsc]);

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
        {key: "contracts", label: "Contracts"},
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
                <span className={style.emptyPrimary}>No F&amp;O trades</span>
                <span className={style.emptySub}>Upload a statement to see F&amp;O P&amp;L</span>
            </div>
        );
    }

    return (
        <>
            <div className={style.sortBar} role="toolbar" aria-label="Sort F&O P&L">
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
                    const isExpanded = expandedUnderlying === group.underlying;
                    const isPositive = group.totalPnl >= 0;
                    return (
                        <React.Fragment key={group.underlying}>
                            <button
                                type="button"
                                className={style.historicalRow}
                                style={{borderLeft: `3px solid ${isPositive ? CLR_GAIN : CLR_LOSS}`}}
                                onClick={() => setExpandedUnderlying(isExpanded ? null : group.underlying)}
                                aria-expanded={isExpanded}
                            >
                                <span className={style.rowSymbol}>{group.underlying}</span>
                                <span className={style.historicalMeta}>
                                    <span>{group.contractCount} contract{group.contractCount !== 1 ? "s" : ""}</span>
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
                                    {group.contracts.map((contract, idx) => (
                                        <div
                                            key={`${contract.symbol}_${contract.expiry_date}_${idx}`}
                                            className={style.expandedTradeRow}
                                        >
                                            <span>
                                                {contract.strike_price}{" "}
                                                <span
                                                    style={{
                                                        color: contract.option_type === "CE" ? CLR_GAIN : CLR_LOSS,
                                                        fontWeight: 600,
                                                    }}
                                                >
                                                    {contract.option_type}
                                                </span>
                                            </span>
                                            <span>{contract.expiry_date}</span>
                                            <span>Qty: {contract.buy_qty}</span>
                                            <span style={{color: contract.pnl >= 0 ? CLR_GAIN : CLR_LOSS}}>
                                                {contract.pnl >= 0 ? "+" : "−"}₹{formatCurrency(Math.abs(contract.pnl))}
                                            </span>
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

export default FOSection;
