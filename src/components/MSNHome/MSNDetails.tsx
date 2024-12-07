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
    Button,
} from "@mui/material";
import style from "./MSNDetails.module.scss";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {MSNListResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

const financialData = [
    {date: "2024-08-01", price: 350.25, quantity: 10, action: "Buy"},
    {date: "2024-08-05", price: 355.10, quantity: 5, action: "Sell"},
    {date: "2024-08-12", price: 348.75, quantity: 8, action: "Buy"},
    {date: "2024-08-18", price: 360.50, quantity: 6, action: "Sell"},
    // Add more rows as needed
];

interface MSNDetailsProps {
    details: MSNListResponse;
    goBack: () => void;
}

const MSNDetails: React.FC<MSNDetailsProps> = ({details, goBack}) => {
    const {state} = useMSNContext();
    const [activeTab, setActiveTab] = useState<number>(0);
    const [stockOverview, setStockOverview] = useState<Record<string, string | number | undefined>>({});

    // Update stock overview based on investment type
    useEffect(() => {
        if (state.selectedCard.nps) {
            setStockOverview({
                "Fund Manager": details.info["pfmName"],
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
        }
    }, [details, state.selectedCard]);

    // Handle tab change
    const handleTabChange = (_: React.ChangeEvent<{}>, newValue: number) => {
        setActiveTab(newValue);
    };

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
                                <Typography className={style.label}>{label}</Typography>
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
                                        <TableCell>{row.date}</TableCell>
                                        <TableCell>{row.price}</TableCell>
                                        <TableCell>{row.quantity}</TableCell>
                                        <TableCell>{row.action}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box>
            )}

            {/* Back Button */}
            <Button
                startIcon={<ArrowBackIcon/>}
                onClick={goBack}
                className={style.backButton}
            >
                Back
            </Button>
        </Box>
    );
};

export default MSNDetails;
