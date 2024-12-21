import {ReactNode, useEffect, useState} from "react";
import {Card, Typography, Grid, CardContent, Divider, Button, useMediaQuery} from "@mui/material";
import CircleIcon from "@mui/icons-material/Circle";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import style from "./MSNHome.module.scss";
import withLoader from "../LoaderHOC.tsx";
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import PercentIcon from '@mui/icons-material/Percent';
import DepositModal from "../DepositsComponent.tsx";
import {fetchRates} from "../../services/investmentService.ts";
import RatesModal from "../RatesModal.tsx";
import {useMessage} from "../../contexts/MessageContext.tsx";

const MSNSummary = () => {
    const [summary, setSummary] = useState<any | undefined>(undefined); // Set appropriate type later if possible
    const {state, getServiceType} = useMSNContext();
    const isMobile = useMediaQuery("(max-width:1000px)");
    const {setPayload} = useMessage();
    const [depositModal, setDepositModal] = useState<boolean>(false);
    const [ratesModal, setRatesModal] = useState<boolean>(false);
    const [ratesData, setRatesData] = useState<any[]>([]);
    const getContextKey = () =>
        state.selectedCard.ppf
            ? "ppf"
            : state.selectedCard.epf
                ? "epf"
                : "gold";

    function setRate() {
        fetchRates(getServiceType()).then((response) => {
            setRatesData(response.data.data);
            setRatesModal(true)
        }).catch(() => {
            setPayload({
                type: "error",
                message: "Error while fetching rates. Please try later"
            })
        })
    }

    useEffect(() => {
        const {selectedCard, summaries} = state;

        // Determine which summary to display based on selectedCard
        if (selectedCard.nps) {
            setSummary(summaries.nps);
        } else if (selectedCard.stocks) {
            setSummary(summaries.stocks);
        } else if (selectedCard.mf) {
            setSummary(summaries.mf);
        } else if (selectedCard.epf || selectedCard.gold) {
            const cardType = selectedCard.epf ? "epf" : "gold"
            const net = parseFloat(summaries[cardType].net);
            const netProfit = parseFloat(summaries[cardType].netProfit);
            const current = net + netProfit
            const changePercent = (netProfit) / net * 100;
            setSummary({
                totalValue: net,
                currentValue: current,
                changePercent: changePercent,
                changeAmount: netProfit,
                count: 0,
                marketStatus: false
            });
        } else if (selectedCard.ppf) {
            const net = parseFloat(summaries.ppf.net);
            const netProfit = parseFloat(summaries.ppf.netProfit);
            const unaccounted = parseFloat(summaries.ppf.unAccountedProfit);
            const current = net + netProfit
            const changePercent = (netProfit - unaccounted) / net * 100;
            setSummary({
                totalValue: net - (netProfit - unaccounted),
                currentValue: current,
                changePercent: changePercent,
                changeAmount: `${netProfit}`,
                count: 0,
                marketStatus: false
            });
        }
    }, [state]);

    const renderSummaryItem = (label: string, value: number | string | ReactNode, color?: string) => (
        <Grid item xs={12} sm={4} alignItems="center" justifyContent="center" flexDirection="column" display={'flex'}>
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
        <Card className={style.assetCard} sx={isMobile ? {
            padding: {xs: '0rem', sm: '1.5rem'},
            borderRadius: 2,
            boxShadow: 3,
            overflowY: 'auto',
            minHeight: "fit-content"
        } : {}}>
            <CardContent className={isMobile ? '' : style.innerCard}>
                {summary && isMobile ? (<>
                    <Grid container spacing={2} alignItems="center"
                          justifyContent="space-between">
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
                                &#8377;{Number(summary.totalValue).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                            </Typography>
                        </Grid>
                    </Grid><Divider sx={{borderColor: "#ccc", borderWidth: 1, my: 2}}/>

                    {/* Details Section */}
                    <Grid container spacing={2} alignItems="center" justifyContent="space-evenly" flexWrap={'nowrap'}>
                        {
                            renderSummaryItem(
                                "Current", Number(summary.totalValue).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })
                            )}
                        {renderSummaryItem(
                            "Change", Number(summary.changeAmount).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        )}
                        {renderSummaryItem(
                            "% Change", Number(summary.changePercent).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })
                        )}
                    </Grid>
                    <Grid container spacing={2} alignItems="center" justifyContent="space-evenly" flexWrap={'nowrap'}
                          marginTop={(state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks) ? '' : 1}>
                        {state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks ?
                            renderSummaryItem(
                                "Market Status", <CircleIcon
                                    style={{color: summary.marketStatus ? "green" : "maroon"}}
                                />
                            ) : state.selectedCard.ppf && <Button
                            startIcon={<FormatListBulletedIcon/>}
                            onClick={() => setDepositModal(true)}
                            className={style.depositsButton}
                        >
                            Deposits
                        </Button>}
                        {state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks ? renderSummaryItem(
                                "Securities Count", summary.count
                            ) :
                            <Button
                                startIcon={<PercentIcon/>}
                                onClick={() => {
                                    setRate()
                                    setRatesModal(true)
                                }}
                                className={style.rateButton}
                            >
                                Rates
                            </Button>}
                    </Grid>
                </>) : summary && (
                    <>
                        {/* Total Asset Value Section */}
                        <Grid className={style.totalValueGrid}>
                            <Typography variant="h6" className={style.header}>
                                Total Asset Value
                            </Typography>
                            <Typography variant="h6" className={style.value}>
                                &#8377;{Number(summary.totalValue).toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
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
                                    &#8377;{Number(summary.currentValue).toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}
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
                                        ? `+${Number(summary.changeAmount).toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}`
                                        : Number(summary.changeAmount).toLocaleString('en-IN', {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2,
                                        })}
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
                                        ? `${Number(summary.changePercent).toFixed(2)}%`
                                        : `${Number(summary.changePercent).toFixed(2)}%`}
                                </Typography>
                            </Grid>

                            {/* Securities Count */}
                            <Grid item xs={6}>
                                {state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks ?
                                    <>
                                        <Typography variant="subtitle1" className={style.label}>
                                            Securities Count
                                        </Typography>
                                        <Typography className={style.dValue} variant="body1">
                                            {summary.count}
                                        </Typography>
                                    </> :
                                    state.selectedCard.ppf &&
                                    <Button
                                        startIcon={<FormatListBulletedIcon/>}
                                        onClick={() => setDepositModal(true)}
                                        className={style.depositsButton}
                                    >
                                        Deposits
                                    </Button>}
                            </Grid>

                            {/* Market Status */}
                            <Grid item xs={6}>
                                {state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks ?
                                    <>
                                        <Typography variant="subtitle1" className={style.label}>
                                            Market Status
                                        </Typography>
                                        <Typography variant="body1" className={style.status}>
                                            <CircleIcon
                                                style={{color: summary.marketStatus ? "green" : "maroon"}}
                                            />
                                        </Typography>
                                    </> :
                                    <Button
                                        startIcon={<PercentIcon/>}
                                        onClick={() => {
                                            setRate()
                                            setRatesModal(true)
                                        }}
                                        className={style.rateButton}
                                    >
                                        Rates
                                    </Button>}
                            </Grid>
                        </Grid>
                    </>
                )}
            </CardContent>
            <DepositModal
                open={depositModal}
                onClose={() => setDepositModal(false)}
                data={state.summaries[getContextKey()].deposits}
                title={getContextKey()}
            /><RatesModal
            open={ratesModal}
            onClose={() => setRatesModal(false)}
            data={ratesData}
            title={getContextKey()}
        />
        </Card>
    );
};

export default withLoader(MSNSummary);
