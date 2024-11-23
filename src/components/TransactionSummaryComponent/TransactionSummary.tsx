import React from "react";
import {Box, Typography} from "@mui/material";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./TransactionSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import CustomIconSwitch from "./EmailStatementSwitcher.tsx";


interface TransactionSummaryProps {
}

const TransactionSummary: React.FC<TransactionSummaryProps> = () => {
    const {state, dispatch} = useFilterContext();
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
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
                <CustomIconSwitch/>
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
