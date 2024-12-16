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
        setFinancialData(state.transactions[selected])
    }, [details, state.selectedCard, state.transactions]);

    useEffect(() => {
        fetchTransactions(getServiceType(), false)
    }, []);
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
                    <Grid container spacing={2} className={style.innerContent}>
                        {Object.entries(stockOverview).map(([label, value]) => (
                            <Grid item xs={6} key={label}>
                                <Typography
                                    className={style.label}>{state.selectedCard.mf ? mfLabelMap[label] : label}</Typography>
                                <Typography className={style.value}>{value}</Typography>
                            </Grid>
                        ))}
                    </Grid>
                </Box>
            )}

            {activeTab === 1 && (
                <Box className={style.tabContent}>
                    <TableContainer component={Paper} className={style.table}>
                        <Table>
                            <TableHead>
                                <TableRow className={style.header}>
                                    <TableCell><b>Date</b></TableCell>
                                    <TableCell><b>Price</b></TableCell>
                                    <TableCell><b>Quantity</b></TableCell>
                                    <TableCell><b>Action</b></TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {financialData.map((row, index) => (
                                    <TableRow key={index}>
                                        <TableCell>{formatDateString(row.date)}</TableCell>
                                        <TableCell>{row.price}</TableCell>
                                        <TableCell>{row.quant}</TableCell>
                                        <TableCell>{row.transactionType}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

        </Box>
    );
};

export default withLoader(MSNDetails);
