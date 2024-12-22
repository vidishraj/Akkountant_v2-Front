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
        <Grid item xs={12} sm={4}>
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
        <Card
            className={style.assetCard}
            sx={{
                padding: {xs: '0rem', sm: '1.5rem'},
                borderRadius: 2,
                boxShadow: 3,
                overflowY: 'auto',
                minHeight: "fit-content"
            }}
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
                            &#8377;{formatCurrency(summary.totalInvestment)}
                        </Typography>
                    </Grid>
                </Grid>

                <Divider sx={{borderColor: "#ccc", borderWidth: 1, my: 2}}/>

                {/* Details Section */}
                <Grid container spacing={2} alignItems="center" justifyContent="center" flexWrap={'nowrap'}>
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

                {/* Refresh Button */}
                <Button
                    className={style.refresh}
                    variant="contained"
                    fullWidth
                    sx={{
                        mt: 2,
                        py: 1,
                        backgroundColor: '#FAFAFA',
                        color: 'black',
                        fontSize: {xs: '0.8rem', sm: '1rem'},
                        '&:hover': {
                            backgroundColor: '#e0e0e0',
                        },
                    }}
                    onClick={(e) => {
                        e.stopPropagation();
                        globalInvestmentRefresh();
                    }}
                >
                    <RefreshIcon sx={{mr: 1}}/>
                    Refresh
                </Button>
            </CardContent>
        </Card>
    );
};

export default GlobalSummary;
