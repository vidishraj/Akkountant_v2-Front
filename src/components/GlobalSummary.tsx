import {useEffect, useMemo, useState} from "react";
import {useMSNContext} from "../contexts/MSNContext.tsx";
import {Box, Button, Card, CardContent, Divider, Grid, Typography} from "@mui/material";
import style from "./MSNHome/MSNHome.module.scss";
import {SecuritiesRead, GlobalSummaryInterface, MSNListResponse} from "../utils/interfaces.ts";
import RefreshIcon from "@mui/icons-material/Refresh";


export const initialSecuritiesRead: SecuritiesRead = {
    ppf: false,
    epf: false,
    nps: false,
    stocks: false,
    gold: false,
    mf: false,
    fo: false,
};

export const initialSummaryState: GlobalSummaryInterface = {
    totalInvestment: 0,
    currentValue: 0,
    profit: 0,
    profitPercentage: 0,
};

const ALLOCATION_COLORS: Record<string, string> = {
    stocks: "#4a9eff",
    mf: "#9c27b0",
    nps: "#ff9800",
    epf: "#4caf50",
    ppf: "#00bcd4",
    gold: "#ffd700",
};

const ALLOCATION_LABELS: Record<string, string> = {
    stocks: "Stocks",
    mf: "MF",
    nps: "NPS",
    epf: "EPF",
    ppf: "PPF",
    gold: "Gold",
};

const msnContextKeys = ["stocks", "mf", "nps"];
const epgContextKeys = ["ppf", "epf", "gold"];

const GlobalSummary = () => {
    const [summary, setSummary] = useState<GlobalSummaryInterface>(initialSummaryState);
    const [read, setRead] = useState<SecuritiesRead>(initialSecuritiesRead);
    const {state, calculateSummary, globalInvestmentRefresh} = useMSNContext();

    useEffect(() => {
        const summaryRead = calculateSummary(summary, read);
        setRead(summaryRead[0]);
        setSummary(summaryRead[1]);
    }, [state.summaries]);

    const formatCurrency = (value: number): string =>
        value.toLocaleString("en-IN", {minimumFractionDigits: 2, maximumFractionDigits: 2});

    // Compute per-type allocation breakdown
    const allocation = useMemo(() => {
        const breakdown: { key: string; value: number; pct: number }[] = [];
        let total = 0;

        msnContextKeys.forEach((key) => {
            const data = state.summaries[key];
            const cv = Number(data.currentValue) || 0;
            if (cv > 0) {
                breakdown.push({key, value: cv, pct: 0});
                total += cv;
            }
        });

        epgContextKeys.forEach((key) => {
            const data = state.summaries[key];
            let cv = 0;
            if (key === "ppf") {
                cv = Number(data.net) + Number(data.unAccountedProfit || 0);
            } else {
                cv = Number(data.net) || 0;
            }
            if (cv > 0) {
                breakdown.push({key, value: cv, pct: 0});
                total += cv;
            }
        });

        breakdown.forEach((item) => {
            item.pct = total > 0 ? (item.value / total) * 100 : 0;
        });

        return {breakdown, total};
    }, [state.summaries]);

    // Compute day change from MSN lists
    const dayChange = useMemo(() => {
        let totalDayChange = 0;
        let hasData = false;

        msnContextKeys.forEach((key) => {
            const list = state.lists[key];
            if (list && list.length > 0) {
                list.forEach((item: MSNListResponse) => {
                    const change = Number(item.info?.change) || 0;
                    const quant = Number(item.buyQuant) || 0;
                    totalDayChange += change * quant;
                    if (change !== 0) hasData = true;
                });
            }
        });

        const pct = summary.currentValue > 0
            ? (totalDayChange / summary.currentValue) * 100
            : 0;

        return {amount: totalDayChange, pct, hasData};
    }, [state.lists, summary.currentValue]);

    const renderSummaryItem = (label: string, value: number | string, color?: string) => (
        <Grid item xs={12} sm={4} sx={{textAlign: "center"}}>
            <Typography variant="subtitle1" className={style.label}>
                {label}
            </Typography>
            <Typography
                className={style.dValue}
                variant="body1"
                style={color ? {color} : undefined}
            >
                {value}
            </Typography>
        </Grid>
    );

    const realizedPnl = state.realizedPnl;
    const foSummary = state.foSummary;
    const hasRealized = (realizedPnl && realizedPnl.tradeCount > 0) || (foSummary && foSummary.tradeCount > 0);

    return (
        <Card
            className={style.assetCard}
        >
            <CardContent>
                {/* Total Value Section */}
                <Grid container spacing={2} alignItems="center" justifyContent="space-between">
                    <Grid item xs={12}>
                        <Typography variant="h6" className={style.header} textAlign="center">
                            Total Asset Value
                        </Typography>
                        <Typography
                            variant="h5"
                            className={style.value}
                            textAlign="center"
                            sx={{fontSize: {xs: '1.25rem', sm: '1.5rem'}}}
                        >
                            &#8377;{formatCurrency(summary.currentValue)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{borderColor: "#29384D", borderWidth: 1, my: 1.5}}/>

                {/* Details Section */}
                <Grid container spacing={1} alignItems="center" justifyContent="center" flexWrap={'nowrap'}>
                    {renderSummaryItem(
                        "Invested",
                        `₹${formatCurrency(summary.totalInvestment)}`
                    )}
                    {renderSummaryItem(
                        "Change",
                        summary.profit >= 0
                            ? `+₹${formatCurrency(summary.profit)}`
                            : `₹${formatCurrency(summary.profit)}`,
                        summary.profit >= 0 ? "green" : "red"
                    )}
                    {renderSummaryItem(
                        "% Change",
                        `${summary.profitPercentage.toFixed(2)}%`,
                        summary.profitPercentage >= 0 ? "green" : "red"
                    )}
                </Grid>

                {/* Day Change */}
                {dayChange.hasData && (
                    <Box className={style.dayChangeRow}>
                        <Typography
                            variant="body2"
                            sx={{
                                color: dayChange.amount >= 0 ? "#4caf50" : "#f44336",
                                fontWeight: 600,
                                fontSize: "13px",
                            }}
                        >
                            Today {dayChange.amount >= 0 ? "+" : ""}₹{formatCurrency(dayChange.amount)}
                            {" "}
                            <span style={{fontWeight: 400, opacity: 0.8}}>
                                ({dayChange.pct >= 0 ? "+" : ""}{dayChange.pct.toFixed(2)}%)
                            </span>
                        </Typography>
                    </Box>
                )}

                {/* Allocation Bar */}
                {allocation.total > 0 && (
                    <Box sx={{mt: 1.5}}>
                        <Box className={style.allocationBar}>
                            {allocation.breakdown.map((item) => (
                                <Box
                                    key={item.key}
                                    className={style.allocationSegment}
                                    sx={{
                                        width: `${item.pct}%`,
                                        backgroundColor: ALLOCATION_COLORS[item.key],
                                    }}
                                    title={`${ALLOCATION_LABELS[item.key]}: ${item.pct.toFixed(1)}%`}
                                />
                            ))}
                        </Box>
                        <Box className={style.allocationLegend}>
                            {allocation.breakdown.map((item) => (
                                <Box key={item.key} sx={{display: "flex", alignItems: "center", gap: "4px"}}>
                                    <Box
                                        sx={{
                                            width: 8,
                                            height: 8,
                                            borderRadius: "50%",
                                            backgroundColor: ALLOCATION_COLORS[item.key],
                                            flexShrink: 0,
                                        }}
                                    />
                                    <Typography sx={{color: "#7a7d85", fontSize: "11px"}}>
                                        {ALLOCATION_LABELS[item.key]} {item.pct.toFixed(1)}%
                                    </Typography>
                                </Box>
                            ))}
                        </Box>
                    </Box>
                )}

                {/* Realized Gains */}
                {hasRealized && (
                    <Box className={style.realizedSection}>
                        <Typography sx={{
                            color: "#7a7d85",
                            fontSize: "12px",
                            fontWeight: 600,
                            mb: 0.5,
                            textTransform: "uppercase",
                            letterSpacing: "0.5px",
                        }}>
                            Realized Gains
                        </Typography>
                        {realizedPnl && realizedPnl.tradeCount > 0 && (
                            <Box className={style.realizedLine}>
                                <Typography sx={{color: "#ccd0d5", fontSize: "13px"}}>
                                    Equity P&L
                                </Typography>
                                <Typography sx={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: realizedPnl.netRealizedPnL >= 0 ? "#4caf50" : "#f44336",
                                }}>
                                    {realizedPnl.netRealizedPnL >= 0 ? "+" : ""}₹{formatCurrency(realizedPnl.netRealizedPnL)}
                                    <span style={{color: "#7a7d85", fontWeight: 400, marginLeft: 6}}>
                                        ({realizedPnl.tradeCount} trades)
                                    </span>
                                </Typography>
                            </Box>
                        )}
                        {foSummary && foSummary.tradeCount > 0 && (
                            <Box className={style.realizedLine}>
                                <Typography sx={{color: "#ccd0d5", fontSize: "13px"}}>
                                    F&O P&L
                                </Typography>
                                <Typography sx={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: foSummary.netPnL >= 0 ? "#4caf50" : "#f44336",
                                }}>
                                    {foSummary.netPnL >= 0 ? "+" : ""}₹{formatCurrency(foSummary.netPnL)}
                                    <span style={{color: "#7a7d85", fontWeight: 400, marginLeft: 6}}>
                                        ({foSummary.tradeCount} contracts)
                                    </span>
                                </Typography>
                            </Box>
                        )}
                    </Box>
                )}

                {/* Refresh Button */}
                <Box sx={{display: "flex", justifyContent: "center", mt: 1.5}}>
                    <Button
                        className={style.refresh}
                        variant="text"
                        onClick={(e) => {
                            e.stopPropagation();
                            globalInvestmentRefresh();
                        }}
                    >
                        <RefreshIcon sx={{mr: 0.5, fontSize: 16}}/>
                        Refresh
                    </Button>
                </Box>
            </CardContent>
        </Card>
    );
};

export default GlobalSummary;
