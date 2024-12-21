import React, {useState} from "react";
import {Box, Button, Typography} from "@mui/material";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./TransactionSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import CustomIconSwitch from "./EmailStatementSwitcher.tsx";
import DateModal from "../DateModalComponent.tsx";
import RefreshIcon from "@mui/icons-material/Refresh";
import {triggerEmailCheck, triggerStatementCheck} from "../../services/transactionService.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";

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
    const {setPayload} = useMessage();
    return (
        <Box className={styles.summaryContainer}>
            {/* Credit */}
            <Box className={styles.summaryBox}>
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
            </Box>
            {/* Action Buttons */}
            <Box className={styles.actionButtons}>
                <Button
                    className={styles.FileUploadButton}
                    variant="contained"
                    onClick={(e) => {
                        e.stopPropagation();
                        refreshTransactions();
                    }}
                >
                    <RefreshIcon style={{color: "black"}}/>
                </Button>
                <Button
                    className={styles.reconnectButton}
                    style={{border: '0.2px solid white'}}
                    onClick={() => {
                        setDateModalState(true);
                    }}
                >
                    {!googleSwitch ? "Mail Check" : "Statement Check"}
                </Button>
                <CustomIconSwitch
                    setChecked={() => {
                        setGoogleSwitch(!googleSwitch);
                    }}
                />
                <DateModal
                    title={!googleSwitch ? "Trigger Mail Check" : "Trigger Statement Check"}
                    isOpen={dateModalState}
                    onSubmit={(dates) => {
                        setDateModalState(false);
                        if (!googleSwitch) {
                            triggerEmailCheck(dates.to, dates.from, false).then((r) => {
                                if (r.status === 200) {
                                    const successCount = r.data.Message.read;
                                    const errors = r.data.Message.conflicts;
                                    setPayload({
                                        type: "success",
                                        message: `${successCount} emails read successfully. ${errors} errors`,
                                    });
                                    refreshTransactions();
                                }
                            }).catch(() => {
                                setPayload({
                                    type: "error",
                                    message: "Error while reading emails.",
                                });
                            });
                        } else {
                            triggerStatementCheck(dates.to, dates.from, false).then((r) => {
                                if (r.status === 200) {
                                    const successCount = r.data.Message.read;
                                    const errors = r.data.Message.conflicts;
                                    setPayload({
                                        type: "success",
                                        message: `${successCount} transactions read successfully. ${errors} integrity errors`,
                                    });
                                    refreshTransactions();
                                }
                            }).catch(() => {
                                setPayload({
                                    type: "error",
                                    message: "Error while reading statements.",
                                });
                            });
                        }
                    }}
                    onCancel={() => {
                        setDateModalState(false);
                    }}
                />
                <ClearFilterButton
                    apply={() => {
                        dispatch({
                            type: "RESET_FILTERS",
                        });
                    }}
                />
            </Box>
        </Box>
    );

};

export default TransactionSummary;
