import React, {useState} from "react";
import {Box, Button, Typography} from "@mui/material";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./TransactionSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import DateModal from "../DateModalComponent.tsx";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmailIcon from "@mui/icons-material/Email";
import {triggerEmailCheck} from "../../services/transactionService.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";

interface TransactionSummaryProps {
    refreshTransactions: any
}

const formatAmount = (value: number) =>
    Math.abs(value).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const TransactionSummary: React.FC<TransactionSummaryProps> = (props) => {
    const {state, dispatch} = useFilterContext();
    const {refreshTransactions} = props;
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
    const [dateModalState, setDateModalState] = useState(false);
    const net = -1 * (debit - (-1 * credit));
    const {setPayload} = useMessage();
    return (
        <Box className={styles.summaryContainer}>
            <Box className={styles.metricsGroup}>
                <Box className={`${styles.metricCard} ${styles.creditCard}`}>
                    <Typography className={styles.metricLabel}>Credit</Typography>
                    <Typography className={styles.metricValue} style={{color: '#4ade80'}}>
                        ₹{credit ? formatAmount(credit) : '0.00'}
                    </Typography>
                </Box>
                <Box className={`${styles.metricCard} ${styles.debitCard}`}>
                    <Typography className={styles.metricLabel}>Debit</Typography>
                    <Typography className={styles.metricValue} style={{color: '#ef4444'}}>
                        ₹{debit ? formatAmount(debit) : '0.00'}
                    </Typography>
                </Box>
                <Box className={`${styles.metricCard} ${styles.netCard}`}>
                    <Typography className={styles.metricLabel}>Net</Typography>
                    <Typography className={styles.metricValue} style={{color: net >= 0 ? '#4ade80' : '#ef4444'}}>
                        ₹{net ? formatAmount(net) : '0.00'}
                    </Typography>
                </Box>
            </Box>

            <Box className={styles.divider} />

            <Box className={styles.actionButtons}>
                <Button
                    className={styles.iconBtn}
                    onClick={(e) => {
                        e.stopPropagation();
                        refreshTransactions();
                    }}
                >
                    <RefreshIcon fontSize="small" />
                </Button>
                <Button
                    className={styles.scanBtn}
                    onClick={() => setDateModalState(true)}
                >
                    <EmailIcon fontSize="small" sx={{mr: 0.5}} />
                    Scan
                </Button>
                <ClearFilterButton
                    apply={() => {
                        dispatch({type: "RESET_FILTERS"});
                        setTimeout(() => refreshTransactions(), 0);
                    }}
                />
            </Box>

            <DateModal
                title={"Scan Emails"}
                isOpen={dateModalState}
                onSubmit={(dates) => {
                    setDateModalState(false);
                    triggerEmailCheck(dates.to, dates.from, false).then((r) => {
                        if (r.status === 200) {
                            const msg = r.data.Message;
                            const textCount = msg.text_emails_processed || 0;
                            const pdfCount = msg.pdf_emails_processed || 0;
                            const errorCount = msg.errors?.length || 0;
                            setPayload({
                                type: "success",
                                message: `${textCount + pdfCount} emails processed (${msg.total_emails_fetched || 0} fetched, ${msg.pre_skipped || 0} skipped). ${errorCount} errors`,
                            });
                            refreshTransactions();
                        }
                    }).catch(() => {
                        setPayload({
                            type: "error",
                            message: "Error while scanning emails.",
                        });
                    });
                }}
                onCancel={() => setDateModalState(false)}
            />
        </Box>
    );
};

export default TransactionSummary;
