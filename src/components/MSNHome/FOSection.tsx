import React, {useMemo, useState} from "react";
import {Box, Card, CardContent, Typography, Chip} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {FOContract} from "../../utils/interfaces";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import style from "./MSNHome.module.scss";

type SortKey = "name" | "pnl" | "contracts";

interface GroupedContract {
    underlying: string;
    contracts: FOContract[];
    totalPnl: number;
    contractCount: number;
}

const FOSection: React.FC = () => {
    const {state} = useMSNContext();
    const data = state.foSummary;
    const [sortKey, setSortKey] = useState<SortKey>("pnl");
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedUnderlying, setExpandedUnderlying] = useState<string | null>(null);

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

    const formatCurrency = (value: number) =>
        value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const SortIcon = sortAsc ? ArrowUpwardIcon : ArrowDownwardIcon;

    const sortOptions: { key: SortKey; label: string }[] = [
        {key: "name", label: "Name"},
        {key: "pnl", label: "P&L"},
        {key: "contracts", label: "Contracts"},
    ];

    if (!data || data.tradeCount === 0) {
        return (
            <Box className={style.noDataMessage}>
                <Typography variant="body1" sx={{color: "#FAFAFA", mb: 1}}>
                    No F&O trades
                </Typography>
                <Typography variant="body2" sx={{color: "#7a7d85"}}>
                    Upload a statement to see F&O P&L
                </Typography>
            </Box>
        );
    }

    return (
        <>
            <Box className={style.sortBar}>
                {sortOptions.map(({key, label}) => (
                    <Chip
                        key={key}
                        label={label}
                        size="small"
                        icon={sortKey === key ? <SortIcon style={{fontSize: 16, color: "#fafafa"}}/> : undefined}
                        onClick={() => handleSort(key)}
                        className={sortKey === key ? style.sortChipActive : style.sortChip}
                    />
                ))}
            </Box>
            <Box className={style.scrollContainer}>
                {sortedGroups.map((group) => {
                    const isExpanded = expandedUnderlying === group.underlying;
                    const isPositive = group.totalPnl >= 0;

                    return (
                        <React.Fragment key={group.underlying}>
                            <Card
                                className={style.historicalCard}
                                style={{borderLeft: `3px solid ${isPositive ? '#4caf50' : '#f44336'}`}}
                                onClick={() => setExpandedUnderlying(isExpanded ? null : group.underlying)}
                            >
                                <CardContent className={style.cardContent}>
                                    <Typography
                                        variant="body2"
                                        className={style.symbol}
                                        sx={{fontSize: "14px", fontWeight: "bold"}}
                                    >
                                        {group.underlying}
                                    </Typography>

                                    <Box sx={{textAlign: "center", width: "20%"}}>
                                        <Typography variant="caption" sx={{color: "#888"}}>
                                            {group.contractCount} contract{group.contractCount !== 1 ? "s" : ""}
                                        </Typography>
                                    </Box>

                                    <Box sx={{textAlign: "right", width: "30%", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 1}}>
                                        <Typography
                                            variant="body2"
                                            className={isPositive ? style.positiveChange : style.negativeChange}
                                            sx={{fontWeight: "bold"}}
                                        >
                                            {isPositive ? "+" : ""}{"\u20B9"}{formatCurrency(group.totalPnl)}
                                        </Typography>
                                        {isExpanded ? (
                                            <ExpandLessIcon sx={{color: "#fafafa", fontSize: 18}}/>
                                        ) : (
                                            <ExpandMoreIcon sx={{color: "#7a7d85", fontSize: 18}}/>
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>

                            {isExpanded && (
                                <Box className={style.expandedTradesContainer}>
                                    {group.contracts.map((contract) => (
                                        <Box key={contract.symbol} className={style.expandedTradeRow}>
                                            <span>
                                                {contract.strike_price}{" "}
                                                <span style={{
                                                    color: contract.option_type === "CE" ? "#4caf50" : "#f44336",
                                                    fontWeight: "bold",
                                                }}>
                                                    {contract.option_type}
                                                </span>
                                            </span>
                                            <span>{contract.expiry_date}</span>
                                            <span>Qty: {contract.buy_qty}</span>
                                            <span
                                                style={{color: contract.pnl >= 0 ? "#4caf50" : "#f44336", fontWeight: "bold"}}
                                            >
                                                {contract.pnl >= 0 ? "+" : ""}{"\u20B9"}{formatCurrency(contract.pnl)}
                                            </span>
                                        </Box>
                                    ))}
                                </Box>
                            )}
                        </React.Fragment>
                    );
                })}
            </Box>
        </>
    );
};

export default FOSection;
