import {useEffect, useState} from "react";
import {Card, Typography, Grid, CardContent, Divider} from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import style from "./MSNHome.module.scss";

const MSNSummary = () => {
    const [summary, setSummary] = useState<any | undefined>(undefined); // Set appropriate type later if possible
    const {state} = useMSNContext();

    useEffect(() => {
        const {selectedCard, summaries} = state;

        // Determine which summary to display based on selectedCard
        if (selectedCard.nps) {
            setSummary(summaries.nps);
        } else if (selectedCard.stocks) {
            setSummary(summaries.stocks);
        } else {
            setSummary(summaries.mf);
        }
    }, [state]);

    return (
        <Card className={style.assetCard}>
            <CardContent className={style.innerCard}>
                {summary && (
                    <>
                        {/* Total Asset Value Section */}
                        <Grid className={style.totalValueGrid}>
                            <Typography variant="h6" className={style.header}>
                                Total Asset Value
                            </Typography>
                            <Typography variant="h6" className={style.value}>
                                &#8377;{summary.totalValue.toLocaleString()}
                            </Typography>
                        </Grid>

                        <Divider sx={{borderColor: "#ccc", borderWidth: 1}}/>

                        {/* Additional Information Section */}
                        <Grid container spacing={1} className={style.infoGrid}>
                            {/* Current Value */}
                            <Grid item xs={4}>
                                <Typography variant="subtitle1" className={style.label}>
                                    Current
                                </Typography>
                                <Typography className={style.dValue} variant="body1">
                                    &#8377;{summary.currentValue.toLocaleString()}
                                </Typography>
                            </Grid>

                            {/* Change */}
                            <Grid item xs={4}>
                                <Typography variant="subtitle1" className={style.label}>
                                    Change
                                </Typography>
                                <Typography
                                    className={style.dValue}
                                    variant="body1"
                                    style={{color: summary.changeAmount >= 0 ? "green" : "red"}}
                                >
                                    {summary.changeAmount >= 0
                                        ? `+${summary.changeAmount}`
                                        : summary.changeAmount}
                                </Typography>
                            </Grid>

                            {/* % Change */}
                            <Grid item xs={4}>
                                <Typography variant="subtitle1" className={style.label}>
                                    % Change
                                </Typography>
                                <Typography
                                    className={style.dValue}
                                    variant="body1"
                                    style={{color: summary.changePercent >= 0 ? "green" : "red"}}
                                >
                                    {summary.changePercent >= 0
                                        ? `+${summary.changePercent}%`
                                        : `${summary.changePercent}%`}
                                </Typography>
                            </Grid>

                            {/* Securities Count */}
                            <Grid item xs={6}>
                                <Typography variant="subtitle1" className={style.label}>
                                    Securities Count
                                </Typography>
                                <Typography className={style.dValue} variant="body1">
                                    {summary.count}
                                </Typography>
                            </Grid>

                            {/* Market Status */}
                            <Grid item xs={6}>
                                <Typography variant="subtitle1" className={style.label}>
                                    Market Status
                                </Typography>
                                <Typography variant="body1" className={style.status}>
                                    <CircleIcon
                                        style={{color: summary.marketStatus ? "green" : "maroon"}}
                                    />
                                </Typography>
                            </Grid>
                        </Grid>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default MSNSummary;
