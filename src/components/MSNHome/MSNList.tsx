import React, {useMemo, useState} from "react";
import {Card, CardContent, Typography, Box, Chip, Tooltip} from "@mui/material";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import style from "./MSNHome.module.scss";
import {MSNListResponse} from "../../utils/interfaces.ts";
import withLoader from "../LoaderHOC.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

const PRICE_UNAVAILABLE_TOOLTIP = "Live price could not be fetched from the data provider for this security.";

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
}

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
            let {buyCode, info} = stock;
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

            const currentValue = priceUnavailable ? 0 : lastPrice * buyQuant;
            const profit = priceUnavailable ? 0 : currentValue - (buyPrice * buyQuant);
            const profitPercentage = priceUnavailable || buyPrice * buyQuant === 0
                ? 0
                : (profit / (buyPrice * buyQuant)) * 100;

            return {stock, buyCode, lastPrice, buyQuant, buyPrice, pChange, profit, profitPercentage, currentValue, priceUnavailable};
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
                    cmp = a.currentValue - b.currentValue;
                    break;
                case "dayChange":
                    cmp = a.pChange - b.pChange;
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

    const SortIcon = sortAsc ? ArrowUpwardIcon : ArrowDownwardIcon;

    const sortOptions: { key: SortKey; label: string }[] = [
        {key: "name", label: "Name"},
        {key: "pnl", label: "P&L"},
        {key: "pnlPct", label: "P&L%"},
        {key: "value", label: "Value"},
        {key: "dayChange", label: "Day"},
    ];

    return (
        <>
            {list.length > 0 && (
                <Box className={style.sortBar}>
                    {sortOptions.map(({key, label}) => (
                        <Chip
                            key={key}
                            label={label}
                            size="small"
                            icon={sortKey === key ? <SortIcon style={{fontSize: 14, color: "#fafafa"}}/> : undefined}
                            onClick={() => handleSort(key)}
                            className={sortKey === key ? style.sortChipActive : style.sortChip}
                        />
                    ))}
                </Box>
            )}
            <Box className={style.scrollContainer} style={{
                justifyContent: list.length === 0 ? 'center' : '',
                alignItems: list.length === 0 ? 'center' : '',
            }}>
                {sortedList.length > 0 ? sortedList.map((item) => {
                    const {
                        stock, buyCode, lastPrice, buyQuant, buyPrice,
                        pChange, profit, profitPercentage, priceUnavailable
                    } = item;
                    const profitString = profit.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    const profitPercentageString = profitPercentage.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    const isPositiveChange = pChange >= 0;

                    const formattedLastPrice = lastPrice.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    // Neutral border when price feed errored — green/red would be misleading.
                    const cardBorderColor = priceUnavailable
                        ? '#7a7d85'
                        : profit >= 0 ? '#4caf50' : '#f44336';
                    const formattedQty = Number.isInteger(buyQuant) ? buyQuant.toString() : buyQuant.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });
                    const formattedBuyPrice = buyPrice.toLocaleString('en-IN', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                    });

                    return (
                        <Card
                            key={stock.buyCode + stock.buyID}
                            className={style.stockCard}
                            style={{ borderLeft: `3px solid ${cardBorderColor}` }}
                            onClick={() => onClick(buyCode)}
                        >
                            <CardContent className={style.cardContent}>
                                <Typography variant={'body2'} className={style.symbol} sx={{ fontSize: '14px', fontWeight: 'bold' }}>
                                    {buyCode}
                                </Typography>

                                <Box className={style.currentBox}>
                                    {priceUnavailable ? (
                                        <Tooltip title={PRICE_UNAVAILABLE_TOOLTIP} arrow>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <ErrorOutlineIcon sx={{ fontSize: 14, color: '#ffb74d' }}/>
                                                <Typography variant="body2" sx={{ color: '#ffb74d', fontSize: '12px', fontStyle: 'italic' }}>
                                                    Price unavailable
                                                </Typography>
                                            </Box>
                                        </Tooltip>
                                    ) : (
                                        <>
                                            <Typography variant="body1" className={style.currentValue}>
                                                &#8377;{formattedLastPrice}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                className={isPositiveChange ? style.positiveChange : style.negativeChange}
                                            >
                                                {isPositiveChange ? `+${pChange}%` : `${pChange}%`}
                                            </Typography>
                                        </>
                                    )}
                                </Box>

                                <Box className={style.previousBox}>
                                    <Typography variant="body2" className={style.previousValue}>
                                        Avg: &#8377;{formattedBuyPrice}
                                    </Typography>
                                    <Typography variant="body2" className={style.previousValue}>
                                        Qty: {formattedQty}
                                    </Typography>
                                </Box>

                                <Box className={style.changeBox}>
                                    {priceUnavailable ? (
                                        <>
                                            <Typography variant="body2" sx={{ color: '#7a7d85' }}>
                                                —
                                            </Typography>
                                            <Typography variant="body2" sx={{ color: '#7a7d85' }}>
                                                —
                                            </Typography>
                                        </>
                                    ) : (
                                        <>
                                            <Typography
                                                variant="body2"
                                                className={profit > 0 ? style.positiveChange : style.negativeChange}
                                            >
                                                &#8377;{profitString}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                className={profitPercentage > 0 ? style.positiveChange : style.negativeChange}
                                            >
                                                {profitPercentage > 0 ? `+${profitPercentageString}%` : `${profitPercentageString}%`}
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            </CardContent>
                        </Card>
                    );
                }) : <Box sx={{ textAlign: 'center', py: 4, color: '#7a7d85' }}>
                    <Typography variant="body1" sx={{ mb: 1, color: '#FAFAFA' }}>No data!</Typography>
                    <Typography variant="body2">Upload a statement or add an instrument to get started.</Typography>
                </Box>}
            </Box>
        </>
    );
};

export default withLoader(MSNList);
