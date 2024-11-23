import React from "react";
import {Box, Typography} from "@mui/material";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import styles from "./FileSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";

interface FileSummaryProps {
}

const FileSummary: React.FC<FileSummaryProps> = () => {
    const {state, dispatch} = useFileFilterContext();

    // Count files by bank
    const bankFileCounts = state.fileDetails.reduce((acc: Record<string, number>, file) => {
        acc[file.bank] = (acc[file.bank] || 0) + 1;
        return acc;
    }, {});

    return (
        <Box className={styles.summaryContainer}>
            {/* File counts for each bank */}
            {Object.entries(bankFileCounts).map(([bank, count]) => (
                <Box key={bank} className={styles.bank}>
                    <Typography variant="subtitle1" className={styles.subtitle}>
                        {bank}
                    </Typography>
                    <Typography variant="subtitle1" className={styles.bankFileCount}>
                        {count} {count === 1 ? "File" : "Files"}
                    </Typography>
                </Box>
            ))}

            {/* Action buttons */}
            <Box className={styles.actionButtons}>
                <ClearFilterButton
                    apply={() =>
                        dispatch({
                            type: "RESET_FILTERS",
                        })
                    }
                />
            </Box>
        </Box>
    );
};

export default FileSummary;
