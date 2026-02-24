import {useEffect, useState} from "react";
import {Card, Typography, CardContent, Divider, Button, useMediaQuery} from "@mui/material";
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
    const [summary, setSummary] = useState<any | undefined>(undefined);
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

    const formatINR = (val: number | string) =>
        Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

    const isMSN = state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks;
    const isEPG = state.selectedCard.ppf || state.selectedCard.epf || state.selectedCard.gold;

    const renderStatItem = (label: string, value: string, color?: string) => (
        <div className={style.summaryStatItem}>
            <Typography className={style.label}>{label}</Typography>
            <Typography className={style.dValue} style={color ? {color} : undefined}>
                {value}
            </Typography>
        </div>
    );

    if (!summary) return null;

    const changeColor = Number(summary.changeAmount) >= 0 ? "#4caf50" : "#f44336";
    const pctColor = Number(summary.changePercent) >= 0 ? "#4caf50" : "#f44336";

    return (
        <Card className={style.assetCard} sx={isMobile ? {
            padding: {xs: '0rem', sm: '1rem'},
            borderRadius: '14px',
            boxShadow: 3,
            overflowY: 'auto',
            minHeight: "fit-content"
        } : {}}>
            <CardContent className={style.innerCard}>
                {/* Top: Total Asset Value */}
                <div className={style.totalValueGrid}>
                    <Typography className={style.header}>
                        Total Asset Value
                    </Typography>
                    <Typography className={style.value}>
                        {"\u20B9"}{formatINR(summary.currentValue)}
                    </Typography>
                </div>

                <Divider sx={{borderColor: "#29384D", borderWidth: 0.5, width: "85%", my: 1}}/>

                {/* Row 1: Invested | Change | % Change */}
                <div className={style.summaryStatsRow}>
                    {renderStatItem("Invested", `\u20B9${formatINR(summary.totalValue)}`)}
                    {renderStatItem(
                        "Change",
                        `${Number(summary.changeAmount) >= 0 ? "+" : ""}\u20B9${formatINR(summary.changeAmount)}`,
                        changeColor
                    )}
                    {renderStatItem(
                        "% Change",
                        `${Number(summary.changePercent).toFixed(2)}%`,
                        pctColor
                    )}
                </div>

                {/* Row 2: Context-specific items */}
                {isMSN && (
                    <div className={style.summaryStatsRow}>
                        {renderStatItem("Count", `${summary.count}`)}
                        {state.selectedCard.stocks && state.realizedPnl && state.realizedPnl.tradeCount > 0 &&
                            renderStatItem(
                                "Realized P&L",
                                `${state.realizedPnl.netRealizedPnL >= 0 ? "+" : ""}\u20B9${formatINR(state.realizedPnl.netRealizedPnL)}`,
                                state.realizedPnl.netRealizedPnL >= 0 ? "#4caf50" : "#f44336"
                            )
                        }
                        {state.selectedCard.stocks && state.foSummary && state.foSummary.tradeCount > 0 &&
                            renderStatItem(
                                "F&O P&L",
                                `${state.foSummary.netPnL >= 0 ? "+" : ""}\u20B9${formatINR(state.foSummary.netPnL)}`,
                                state.foSummary.netPnL >= 0 ? "#4caf50" : "#f44336"
                            )
                        }
                    </div>
                )}

                {/* EPG-specific action buttons */}
                {isEPG && (
                    <div className={style.summaryStatsRow}>
                        {state.selectedCard.ppf && (
                            <Button
                                startIcon={<FormatListBulletedIcon/>}
                                onClick={() => setDepositModal(true)}
                                className={style.depositsButton}
                            >
                                Deposits
                            </Button>
                        )}
                        <Button
                            startIcon={<PercentIcon/>}
                            onClick={() => {
                                setRate()
                                setRatesModal(true)
                            }}
                            className={style.rateButton}
                        >
                            Rates
                        </Button>
                    </div>
                )}
            </CardContent>
            <DepositModal
                open={depositModal}
                onClose={() => setDepositModal(false)}
                data={state.summaries[getContextKey()].deposits}
                title={getContextKey()}
            />
            <RatesModal
                open={ratesModal}
                onClose={() => setRatesModal(false)}
                data={ratesData}
                title={getContextKey()}
            />
        </Card>
    );
};

export default withLoader(MSNSummary);
