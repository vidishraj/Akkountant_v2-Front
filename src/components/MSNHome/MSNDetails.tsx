import React, {useEffect, useState} from "react";
import {
    Box,
    Tab,
    Tabs,
    Typography,
    Grid,
    TableCell,
    TableBody,
    TableHead,
    Table,
    TableContainer,
    TableRow,
    Paper,
} from "@mui/material";
import style from "./MSNDetails.module.scss";
import {MSNListResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";
import withLoader from "../LoaderHOC.tsx";
import {formatDateString} from "../../utils/util.tsx";

interface MSNDetailsProps {
    details: MSNListResponse;
}

export interface Transaction {
    date: string; // The date of the transaction in ISO string format.
    id: number; // The unique identifier for the transaction.
    price: string; // The price as a string, possibly for precision.
    quant: string; // The quantity as a string, possibly for precision.
    transactionType: 'buy' | 'sell'; // The type of transaction, constrained to specific values.
    securityCode?: string; // NEW - MF scheme code or security identifier
    buyId?: string; // NEW - Reference ID for the transaction
}

const MSNDetails: React.FC<MSNDetailsProps> = ({details}) => {
    const {state, fetchTransactions, getServiceType, getContextKey} = useMSNContext();
    const [activeTab, setActiveTab] = useState<number>(0);

    const [stockOverview, setStockOverview] = useState<Record<string, string | number | undefined>>({});
    const [financialData, setFinancialData] = useState<Transaction[]>([]);
    // Update stock overview based on investment type
    useEffect(() => {
        if (state.selectedCard.nps) {
            setStockOverview({
                "Fund Manager": details.info["pfm_name"],
                "Name": details.info["name"],
                "Current": details.info["nav"],
                "Yesterday": details.info["yesterday"],
                "Last Week": details.info["lastWeek"],
                "6 Months Ago": details.info["sixMonthsAgo"],
            });
        } else if (state.selectedCard.stocks) {
            setStockOverview({
                Open: details.info["open"],
                Close: details.info["close"],
                "Day High": details.info["dayHigh"],
                "Day Low": details.info["dayLow"],
                Industry: details.info["industry"],
            });
        } else if (state.selectedCard.mf) {
            setStockOverview(details.info);
        }
        const selected = getContextKey();
        const allTransactions = state.transactions[selected] || [];

        // Filter transactions to show only those for the current security
        let filteredTransactions = allTransactions;
        const securityCodeToMatch = details.buyCode;

        if (securityCodeToMatch) {
            filteredTransactions = allTransactions.filter((transaction: Transaction) =>
                transaction.securityCode === securityCodeToMatch ||
                String(transaction.securityCode) === String(securityCodeToMatch)
            );
        }

        setFinancialData(filteredTransactions)
    }, [details, state.selectedCard, state.transactions]);

    useEffect(() => {
        if (state.selectedCard.mf || state.selectedCard.nps || state.selectedCard.stocks) {
            fetchTransactions(getServiceType(), false)
        }
    }, [state.selectedCard]);
    // Handle tab change
    const handleTabChange = (_: React.ChangeEvent<{}>, newValue: number) => {
        setActiveTab(newValue);
    };

    const mfLabelMap: any = {
        "change": "Change",
        "fundHouse": "Fund House",
        "lastPrice": "Last Price",
        "pChange": "% Change",
        "previousClose": "Prev. Close",
        "schemeType": "Scheme",
        "scheme_id": "ID",
    }

    return (
        <Box className={style.container}>
            {/* Tabs */}
            <Tabs
                value={activeTab}
                onChange={handleTabChange}
                textColor="inherit"
                indicatorColor="primary"
                className={style.tabs}
            >
                <Tab label="Technicals" className={style.tab}/>
                <Tab label="Transactions" className={style.tab}/>
            </Tabs>

            {/* Tab Content */}
            {activeTab === 0 && (
                <Box className={style.tabContent}>
                    {/* Stock Hero Section */}
                    {state.selectedCard.stocks && (
                        <>
                            <Box className={style.detailHero}>
                                <Box>
                                    <Typography variant="h6" sx={{ fontWeight: 'bold', color: '#FAFAFA' }}>
                                        {details.buyCode}
                                    </Typography>
                                    <Typography variant="caption" sx={{ color: '#7a7d85' }}>
                                        {details.info.industry}
                                    </Typography>
                                </Box>
                                <Box sx={{ textAlign: 'right' }}>
                                    <Typography variant="h5" sx={{ fontWeight: 'bold', color: '#FAFAFA' }}>
                                        &#8377;{Number(details.info.lastPrice).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                    <Typography variant="body2" sx={{ color: details.info.pChange >= 0 ? '#4caf50' : '#f44336' }}>
                                        {details.info.change >= 0 ? '+' : ''}{Number(details.info.change).toFixed(2)} ({Number(details.info.pChange).toFixed(2)}%)
                                    </Typography>
                                </Box>
                            </Box>
                            <Box className={style.investmentRow}>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#7a7d85' }}>Invested</Typography>
                                    <Typography variant="body2" sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>
                                        &#8377;{(details.buyPrice * details.buyQuant).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#7a7d85' }}>Current</Typography>
                                    <Typography variant="body2" sx={{ color: '#FAFAFA', fontWeight: 'bold' }}>
                                        &#8377;{(Number(details.info.lastPrice) * details.buyQuant).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </Typography>
                                </Box>
                                <Box>
                                    <Typography variant="caption" sx={{ color: '#7a7d85' }}>P&L</Typography>
                                    {(() => {
                                        const pnl = (Number(details.info.lastPrice) - details.buyPrice) * details.buyQuant;
                                        return (
                                            <Typography variant="body2" sx={{ color: pnl >= 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                                                {pnl >= 0 ? '+' : ''}&#8377;{pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </Typography>
                                        );
                                    })()}
                                </Box>
                            </Box>
                        </>
                    )}

                    {/* OHLC Grid for stocks */}
                    {state.selectedCard.stocks ? (
                        <Box className={style.ohlcGrid}>
                            {Object.entries(stockOverview)
                                .filter(([label]) => label !== 'Industry')
                                .map(([label, value]) => (
                                    <Box className={style.ohlcCell} key={label}>
                                        <Typography className={style.label}>{label}</Typography>
                                        <Typography className={style.value}>
                                            {typeof value === 'number' ? Number(value).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : value}
                                        </Typography>
                                    </Box>
                                ))}
                        </Box>
                    ) : (
                        <Grid container spacing={2} className={style.innerContent}>
                            {Object.entries(stockOverview).map(([label, value]) => (
                                <Grid item xs={6} key={label}>
                                    <Typography
                                        className={style.label}>{state.selectedCard.mf ? mfLabelMap[label] : label}</Typography>
                                    <Typography className={style.value}>{value}</Typography>
                                </Grid>
                            ))}
                        </Grid>
                    )}
                </Box>
            )}

            {activeTab === 1 && (
                <Box className={style.tabContent}>
                    <TableContainer component={Paper} className={style.table}>
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell><b>Date</b></TableCell>
                                    <TableCell><b>Price</b></TableCell>
                                    <TableCell><b>Quantity</b></TableCell>
                                    <TableCell><b>Action</b></TableCell>
                                    <TableCell><b>Security</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {financialData.length > 0 ? financialData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{formatDateString(row.date)}</TableCell>
                                        <TableCell>&#8377;{Number(row.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</TableCell>
                                        <TableCell>{parseFloat(row.quant).toLocaleString('en-IN')}</TableCell>
                                        <TableCell className={row.transactionType === 'buy' ? style.buyAction : style.sellAction}>
                                            {row.transactionType.toUpperCase()}
                                        </TableCell>
                                        <TableCell>{row.securityCode || row.buyId || 'N/A'}</TableCell>
                                    </TableRow>
                                )) : (
                                    <TableRow>
                                        <TableCell colSpan={5} sx={{ textAlign: 'center', color: '#7a7d85' }}>
                                            No transactions found
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

        </Box>
    );
};

export default withLoader(MSNDetails);
