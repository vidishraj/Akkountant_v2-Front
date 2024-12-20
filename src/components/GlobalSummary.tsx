import {useEffect, useState} from "react";
import {useMSNContext} from "../contexts/MSNContext.tsx";
import {Button, Card, CardContent, Divider, Grid, Typography} from "@mui/material";
import style from "./MSNHome/MSNHome.module.scss";
import {SecuritiesRead, GlobalSummaryInterface} from "../utils/interfaces.ts";
import RefreshIcon from "@mui/icons-material/Refresh";


export const initialSecuritiesRead: SecuritiesRead = {
    ppf: false,
    epf: false,
    nps: false,
    stocks: false,
    gold: false,
    mf: false,
};

export const initialSummaryState: GlobalSummaryInterface = {
    totalInvestment: 0,
    currentValue: 0,
    profit: 0,
    profitPercentage: 0,
};

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

    const renderSummaryItem = (label: string, value: number | string, color?: string) => (
        <Grid item xs={4}>
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

    return (
        <Card className={style.assetCard} style={{marginRight: "1rem"}}>
            <CardContent className={style.innerCard}>
                <Grid className={style.totalValueGrid}>
                    <Typography variant="h6" className={style.header}>
                        Total Asset Value
                    </Typography>
                    <Typography variant="h6" className={style.value}>
                        &#8377;{formatCurrency(summary.totalInvestment)}
                    </Typography>
                </Grid>

                <Divider sx={{borderColor: "#ccc", borderWidth: 1, minHeight: '55px'}}/>

                <Grid container spacing={1} className={style.infoGrid}>
                    {renderSummaryItem(
                        "Current",
                        `₹${formatCurrency(summary.currentValue)}`
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
                <Button
                    className={style.refresh}
                    variant="contained"
                    onClick={(e) => {
                        e.stopPropagation();
                        globalInvestmentRefresh()
                    }}
                >
                    <RefreshIcon style={{color: "black"}}/>
                </Button>
            </CardContent>
        </Card>
    );
};

export default GlobalSummary;
