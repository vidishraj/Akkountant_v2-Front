import {useEffect, useState} from "react";
import {
    Box,
    Button,
    Typography,
    TableCell,
    TableBody,
    TableHead,
    Table,
    TableContainer,
    TableRow,
    Paper,
    Tabs,
    Tab,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";
import InvestmentEmails from "../InvestmentEmails/InvestmentEmails.tsx";
import MSNSummary from "../MSNHome/MSNSummary.tsx";
import {EPGResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

import style from "./EPGHome.module.scss";
import {formatDateString} from "../../utils/util.tsx";

interface EPGlist {
    date: string;
    description?: string;
    amount: number;
    interest: number;
    quantity?: number;
    goldType?: string;
}

const formatINR = (val: number | string) =>
    Number(val).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const EPGHome = () => {
    const {state, dispatch, fetchAndSetUserSecurities, deleteComplete} = useMSNContext();
    const [summaryState, setSummaryState] = useState<EPGResponse>();
    const [listState, setListState] = useState<EPGlist[]>([]);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);
    const [epgTab, setEpgTab] = useState(0);

    const getContextKey = () =>
        state.selectedCard.ppf
            ? "ppf"
            : state.selectedCard.epf
                ? "epf"
                : "gold";

    const populateListState = () => {
        const list: EPGlist[] = [];
        const contextKey = getContextKey();
        const transactions = state.summaries[contextKey]?.transactions || [];

        transactions.forEach((item) => {
            list.push({
                date: item.date,
                amount: item.amount,
                interest: item.interest,
                description: state.selectedCard.epf || state.selectedCard.gold ? item.description : undefined,
                quantity: state.selectedCard.gold ? item.quant : undefined,
                goldType: state.selectedCard.gold ? item.goldType : undefined,
            });
        });

        setListState(list);
    };

    useEffect(() => {
        const contextKey = getContextKey();
        setSummaryState(state.summaries[contextKey]);
        populateListState();
    }, [state]);

    useEffect(() => {
        fetchAndSetUserSecurities();
    }, []);

    const handleDeleteAll = () => {
        setDeleteConfirmation(false);
        deleteComplete();
    };

    const handleResetCardSelector = () => dispatch({type: "ResetCardSelector"});

    const isPPF = state.selectedCard.ppf;
    const isEPF = state.selectedCard.epf;
    const isGold = state.selectedCard.gold;

    const getAccountAge = (deposits: any[]) => {
        if (deposits.length === 0) return "—";
        const firstDate = new Date(deposits[0].date);
        const now = new Date();
        const diffMs = now.getTime() - firstDate.getTime();
        const totalMonths = Math.floor(diffMs / (30.44 * 24 * 60 * 60 * 1000));
        const years = Math.floor(totalMonths / 12);
        const months = totalMonths % 12;
        return years > 0 ? `${years}y ${months}m` : `${months}m`;
    };

    const getMetrics = () => {
        if (!summaryState) return null;
        const netProfit = parseFloat(summaryState.netProfit);
        const deposits = summaryState.deposits || [];
        const transactions = summaryState.transactions || [];

        if (isPPF || isEPF) {
            const unaccounted = parseFloat(summaryState.unAccountedProfit || 0);
            return {
                type: 'interest' as const,
                depositCount: deposits.length,
                accountAge: getAccountAge(deposits),
                pendingInterest: isPPF ? unaccounted : unaccounted,
                totalInterest: netProfit,
            };
        }

        if (isGold) {
            const totalWeight = transactions.reduce((sum, t) => sum + Number(t.quant || 0), 0);
            const typeCounts: Record<string, number> = {};
            transactions.forEach((t) => {
                const key = `${t.goldType || '?'}K`;
                typeCounts[key] = (typeCounts[key] || 0) + 1;
            });
            return {
                type: 'gold' as const,
                purchaseCount: deposits.length,
                totalWeight,
                typeCounts,
            };
        }

        return null;
    };

    const getEmailCategory = () => {
        if (isEPF) return "epf_passbook";
        if (isGold) return "gold_receipt";
        if (isPPF) return "investment_confirmation";
        return undefined;
    };

    const metrics = getMetrics();

    return (
        <div className={style.container}>
            <Button
                startIcon={<ArrowBackIcon/>}
                onClick={handleResetCardSelector}
                className={style.backButton}
                style={{alignSelf: "flex-start"}}
            >
                Back
            </Button>
            {summaryState && (
                <div className={style.innerSummary}>
                    <MSNSummary isLoading={false}/>
                </div>
            )}

            {/* Metrics Grid */}
            {metrics?.type === 'interest' && (
                <Box className={style.metricsGrid}>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Deposits</Typography>
                        <Typography className={style.metricsValue}>{metrics.depositCount}</Typography>
                    </Box>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Account Age</Typography>
                        <Typography className={style.metricsValue}>{metrics.accountAge}</Typography>
                    </Box>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Pending Interest</Typography>
                        <Typography className={style.metricsValue} sx={{color: '#4caf50'}}>
                            ₹{formatINR(metrics.pendingInterest)}
                        </Typography>
                    </Box>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Total Interest</Typography>
                        <Typography className={style.metricsValue} sx={{color: '#4caf50'}}>
                            ₹{formatINR(metrics.totalInterest)}
                        </Typography>
                    </Box>
                </Box>
            )}
            {metrics?.type === 'gold' && (
                <Box className={style.metricsGrid}>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Purchases</Typography>
                        <Typography className={style.metricsValue}>{metrics.purchaseCount}</Typography>
                    </Box>
                    <Box className={style.metricsCell}>
                        <Typography className={style.metricsLabel}>Total Weight</Typography>
                        <Typography className={style.metricsValue}>{metrics.totalWeight.toFixed(2)}g</Typography>
                    </Box>
                    {Object.entries(metrics.typeCounts).map(([type, count]) => (
                        <Box className={style.metricsCell} key={type}>
                            <Typography className={style.metricsLabel}>{type} Gold</Typography>
                            <Typography className={style.metricsValue}>{count}</Typography>
                        </Box>
                    ))}
                </Box>
            )}

            <div className={style.listBackButton} style={{minWidth: "320px"}}>
                <Tabs
                    value={epgTab}
                    onChange={(_e, newValue) => setEpgTab(newValue)}
                    className={style.epgTabs}
                    variant="fullWidth"
                >
                    <Tab label="Deposits" />
                    <Tab label="Emails" />
                </Tabs>
                {epgTab === 0 ? (
                    listState.length > 0 ? (
                        <TableContainer component={Paper} className={style.tableContainer}>
                            <Table stickyHeader>
                                <TableHead>
                                    <TableRow>
                                        <TableCell><b>Date</b></TableCell>
                                        {!isPPF && <TableCell><b>Description</b></TableCell>}
                                        <TableCell><b>Amount</b></TableCell>
                                        <TableCell><b>Profit</b></TableCell>
                                        {isGold && <TableCell><b>Qty</b></TableCell>}
                                        {isGold && <TableCell><b>Type</b></TableCell>}
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {listState.map((item, index) => {
                                        const profit = Number(item.interest);
                                        return (
                                            <TableRow key={index}>
                                                <TableCell>{formatDateString(item.date)}</TableCell>
                                                {!isPPF && <TableCell>{item.description}</TableCell>}
                                                <TableCell>₹{formatINR(item.amount)}</TableCell>
                                                <TableCell className={profit >= 0 ? style.profitPositive : style.profitNegative}>
                                                    {profit >= 0 ? '+' : ''}₹{formatINR(profit)}
                                                </TableCell>
                                                {isGold && <TableCell>{item.quantity}g</TableCell>}
                                                {isGold && <TableCell>{item.goldType}K</TableCell>}
                                            </TableRow>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    ) : (
                        <Box sx={{
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '200px',
                            color: '#7a7d85',
                            textAlign: 'center',
                        }}>
                            <Typography variant="body2">
                                No data!<br/>Upload statement or add instrument.
                            </Typography>
                        </Box>
                    )
                ) : (
                    <InvestmentEmails category={getEmailCategory()} />
                )}
            </div>

            <ConfirmationDialog
                open={deleteConfirmation}
                onCancel={() => setDeleteConfirmation(false)}
                onSubmit={handleDeleteAll}
                message="Are you sure you want to delete all data?"
            />
        </div>
    );
};

export default EPGHome;
