import React, {useMemo, useState} from "react";
import {Box, Card, CardContent, Typography, Chip} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import {RealizedTrade} from "../../utils/interfaces";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import style from "./MSNHome.module.scss";

type SortKey = "name" | "pnl" | "trades";

interface GroupedTrade {
    symbol: string;
    trades: RealizedTrade[];
    totalPnl: number;
    totalQty: number;
}

const RealizedPnL: React.FC = () => {
    const {state} = useMSNContext();
    const data = state.realizedPnl;
    const [sortKey, setSortKey] = useState<SortKey>("pnl");
    const [sortAsc, setSortAsc] = useState(false);
    const [expandedSymbol, setExpandedSymbol] = useState<string | null>(null);

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

    const formatCurrency = (value: number) =>
        value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });

    const SortIcon = sortAsc ? ArrowUpwardIcon : ArrowDownwardIcon;

    const sortOptions: { key: SortKey; label: string }[] = [
        {key: "name", label: "Name"},
        {key: "pnl", label: "P&L"},
        {key: "trades", label: "Trades"},
    ];

    if (!data || data.tradeCount === 0) {
        return (
            <Box className={style.noDataMessage}>
                <Typography variant="body1" sx={{color: "#FAFAFA", mb: 1}}>
                    No historical equity trades
                </Typography>
                <Typography variant="body2" sx={{color: "#7a7d85"}}>
                    Upload a statement to see realized P&L
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
                    const isExpanded = expandedSymbol === group.symbol;
                    const isPositive = group.totalPnl >= 0;

                    return (
                        <React.Fragment key={group.symbol}>
                            <Card
                                className={style.historicalCard}
                                style={{borderLeft: `3px solid ${isPositive ? '#4caf50' : '#f44336'}`}}
                                onClick={() => setExpandedSymbol(isExpanded ? null : group.symbol)}
                            >
                                <CardContent className={style.cardContent}>
                                    <Typography
                                        variant="body2"
                                        className={style.symbol}
                                        sx={{fontSize: "14px", fontWeight: "bold"}}
                                    >
                                        {group.symbol}
                                    </Typography>

                                    <Box sx={{textAlign: "center", width: "20%"}}>
                                        <Typography variant="caption" sx={{color: "#888"}}>
                                            {group.trades.length} trade{group.trades.length !== 1 ? "s" : ""}
                                        </Typography>
                                        <Typography variant="caption" display="block" sx={{color: "#888"}}>
                                            Qty: {group.totalQty}
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
                                    {group.trades.map((trade) => (
                                        <Box key={trade.sellID} className={style.expandedTradeRow}>
                                            <span>
                                                {"\u20B9"}{formatCurrency(trade.buyPrice)} {"\u2192"} {"\u20B9"}{formatCurrency(trade.sellPrice)}
                                            </span>
                                            <span>Qty: {trade.quantity}</span>
                                            <span
                                                style={{color: trade.profit >= 0 ? "#4caf50" : "#f44336", fontWeight: "bold"}}
                                            >
                                                {trade.profit >= 0 ? "+" : ""}{"\u20B9"}{formatCurrency(trade.profit)}
                                            </span>
                                            <span>{trade.sellDate}</span>
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

export default RealizedPnL;
