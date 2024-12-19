import React, {useState} from "react";
import {Box, Button, Typography} from "@mui/material";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./TransactionSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import CustomIconSwitch from "./EmailStatementSwitcher.tsx";
import DateModal from "../DateModalComponent.tsx";
import RefreshIcon from "@mui/icons-material/Refresh";
import {triggerEmailCheck} from "../../services/transactionService.ts";

interface TransactionSummaryProps {
    refreshTransactions: any
}

const TransactionSummary: React.FC<TransactionSummaryProps> = (props) => {
    const {state, dispatch} = useFilterContext();
    const {refreshTransactions} = props;
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
    const [dateModalState, setDateModalState] = useState(false);
    const [googleSwitch, setGoogleSwitch] = useState(true);
    const net = -1 * (debit - (-1 * credit)); // Calculate net balance

    return (
        <Box className={styles.summaryContainer}>
            {/* Credit */}
            <Box className={styles.credit}>
                <Typography variant="subtitle1" className={styles.subtitle}>
                    Credit
                </Typography>
                <Typography variant="subtitle1" className={styles.creditAmount}>
                    ₹{credit ? Math.abs(credit).toFixed(2) : 0}
                </Typography>
            </Box>

            {/* Debit */}
            <Box className={styles.debit}>
                <Typography variant="subtitle1" className={styles.subtitle}>
                    Debit
                </Typography>
                <Typography variant="subtitle1" className={styles.debitAmount}>
                    ₹{debit ? Math.abs(debit).toFixed(2) : 0}
                </Typography>
            </Box>

            {/* Net */}
            <Box className={styles.net}>
                <Typography variant="subtitle1" className={styles.subtitle}>
                    Net
                </Typography>
                <Typography
                    variant="subtitle1"
                    className={`${styles.netAmount} ${
                        net >= 0 ? styles.netPositive : styles.netNegative
                    }`}
                >
                    ₹{net ? parseFloat(String(net)).toFixed(2) : 0}
                </Typography>
            </Box>
            <Box className={styles.actionButtons}>
                <Button
                    className={styles.FileUploadButton}
                    variant="contained"
                    onClick={(e) => {
                        e.stopPropagation();
                        refreshTransactions()
                    }}
                >
                    <RefreshIcon style={{color: "black"}}/>
                </Button>
                <Button className={styles.reconnectButton} onClick={() => {
                    setDateModalState(true)
                }}>
                    {!googleSwitch ? "Trigger Mail Check" : "Trigger Statement Check"}
                </Button>
                <CustomIconSwitch setChecked={() => {
                    setGoogleSwitch(!googleSwitch)
                }}/>
                <DateModal title={!googleSwitch ? "Trigger Mail Check" : "Trigger Statement Check"}
                           isOpen={dateModalState} onSubmit={(dates) => {
                    if (!googleSwitch) {
                        triggerEmailCheck(dates.to, dates.from, false).then(r => {
                            console.log(r)
                        }).catch(() => {
                            console.log("Error while reading mails.")
                        });

                    }
                }} onCancel={() => {
                    setDateModalState(false);
                }}/>
                <ClearFilterButton apply={() => {
                    dispatch({
                        type: "RESET_FILTERS"
                    })
                }}/>
            </Box>

        </Box>
    );
};

export default TransactionSummary;
