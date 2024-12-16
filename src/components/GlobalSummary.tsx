import {useEffect, useState} from "react";
import {useMSNContext} from "../contexts/MSNContext.tsx";
import {Card, CardContent, Divider, Grid, Typography} from "@mui/material";
import style from "./MSNHome/MSNHome.module.scss";

interface GlobalSummary {
    totalInvestment: number;
    currentValue: number;
    profit: number;
    profitPercentage: number;
}

interface SecuritiesRead {
    [key: string]: boolean;
}

const initialSecuritiesRead: SecuritiesRead = {
    ppf: false,
    epf: false,
    nps: false,
    stocks: false,
    gold: false,
    mf: false,
};

const initialSummaryState: GlobalSummary = {
    totalInvestment: 0,
    currentValue: 0,
    profit: 0,
    profitPercentage: 0,
};

const GlobalSummary = () => {
    const [summary, setSummary] = useState<GlobalSummary>(initialSummaryState);
    const [read, setRead] = useState<SecuritiesRead>(initialSecuritiesRead);
    const {state} = useMSNContext();

    const msnContextKeys = ["mf", "stocks", "nps"];
    const epgContextKeys = ["ppf", "epf", "gold"];

    const calculateSummary = () => {
        const updatedSummary = {...initialSummaryState};
        const updatedRead = {...read};

        const processContext = (keys: string[], isEPG: boolean) => {
            keys.forEach((key) => {
                const data = state.summaries[key];
                if (!read[key] && (isEPG ? data.net !== 0 : data.totalValue !== 0)) {
                    updatedRead[key] = true;

                    if (isEPG) {
                        const profit = Number(data.netProfit);
                        updatedSummary.totalInvestment += Number(data.net) - profit;
                        updatedSummary.currentValue += Number(data.net);
                        updatedSummary.profit += profit;
                    } else {
                        updatedSummary.totalInvestment += Number(data.totalValue);
                        updatedSummary.currentValue += Number(data.currentValue);
                        updatedSummary.profit += Number(data.changeAmount);
                    }
                }
            });
        };

        processContext(msnContextKeys, false);
        processContext(epgContextKeys, true);

        updatedSummary.profitPercentage =
            (updatedSummary.profit / updatedSummary.totalInvestment) * 100;

        setRead(updatedRead);
        setSummary(updatedSummary);
    };

    useEffect(() => {
        calculateSummary();
    }, [state]);

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

                <Divider sx={{borderColor: "#ccc", borderWidth: 1}}/>

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
            </CardContent>
        </Card>
    );
};

export default GlobalSummary;
