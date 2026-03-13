import React from "react";
import {Box, Typography} from "@mui/material";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./FileSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import {FileDetails} from "../../utils/interfaces.ts";
import BankIcon from "../BankIcon.tsx";
import DescriptionIcon from "@mui/icons-material/Description";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";

interface FileSummaryProps {
    files?: FileDetails[];
}

const FileSummary: React.FC<FileSummaryProps> = ({files}) => {
    const {state, dispatch} = useFileFilterContext();
    const {state: filterState} = useFilterContext();
    const data = files ?? state.fileDetails;

    const totalStatements = state.fileCount;
    const totalTransactions = filterState.transactionCount;

    // Count by bank (keep original key for icon lookup)
    const bankCounts = data.reduce((acc: Record<string, number>, file) => {
        const bank = file.bank || "Unknown";
        acc[bank] = (acc[bank] || 0) + 1;
        return acc;
    }, {});

    return (
        <Box className={styles.summaryContainer}>
            <Box className={styles.totalsGroup}>
                <Box className={styles.totalCard}>
                    <DescriptionIcon className={styles.totalIcon} />
                    <Box>
                        <Typography className={styles.totalValue}>
                            {totalStatements}
                        </Typography>
                        <Typography className={styles.totalLabel}>
                            Statements
                        </Typography>
                    </Box>
                </Box>
                <Box className={styles.totalCard}>
                    <ReceiptLongIcon className={styles.totalIcon} />
                    <Box>
                        <Typography className={styles.totalValue}>
                            {totalTransactions.toLocaleString('en-IN')}
                        </Typography>
                        <Typography className={styles.totalLabel}>
                            Transactions
                        </Typography>
                    </Box>
                </Box>
            </Box>

            <Box className={styles.divider} />

            <Box className={styles.banksGroup}>
                {Object.entries(bankCounts).map(([bank, count]) => (
                    <Box key={bank} className={styles.bankChip}>
                        <BankIcon bankKey={bank} width={20} height={20} />
                        <Typography className={styles.bankCount}>
                            {count}
                        </Typography>
                        <Typography className={styles.bankName}>
                            {bank.replace(/_/g, " ")}
                        </Typography>
                    </Box>
                ))}
            </Box>

            <Box className={styles.actionButtons}>
                <ClearFilterButton
                    apply={() => dispatch({type: "RESET_FILTERS"})}
                />
            </Box>
        </Box>
    );
};

export default FileSummary;
