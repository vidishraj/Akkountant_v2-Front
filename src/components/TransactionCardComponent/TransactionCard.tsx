import React from "react";
import {Card, Box, Typography} from "@mui/material";
import {convertToLocaleString} from "../../utils/util.tsx";
import BankIcon from "../BankIcon.tsx";
import styles from "./TransactionCard.module.scss";

interface TransactionPage {
    date: string;
    description: string;
    amount: number;
    tag: string;
    bank: string;
    style?: React.CSSProperties;
}

const cleanDescription = (desc: string): string => {
    if (!desc) return desc;
    let cleaned = desc;
    // Strip UPI- prefix and extract payee name
    if (cleaned.startsWith("UPI-") || cleaned.startsWith("UPI/")) {
        const parts = cleaned.substring(4).split(/[-/@]/);
        if (parts.length > 0 && parts[0].trim().length > 0) {
            cleaned = parts[0].trim();
        }
    }
    // Clean up common noise
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
};

const TransactionCard: React.FC<TransactionPage> = (props) => {
    const {date, description, amount, tag, bank, style} = props;
    const isCredit = amount < 0;

    return (
        <Card className={styles.card} style={style}>
            <Box className={styles.bankIcon}>
                <BankIcon bankKey={bank} width={40} height={40} />
            </Box>

            <Box className={styles.description}>
                <Typography className={styles.description__text} title={description}>
                    {cleanDescription(description)}
                </Typography>
                <Typography className={styles.description__date}>
                    {convertToLocaleString(date)}
                </Typography>
            </Box>

            <Box className={styles.amount}>
                <Typography
                    className={`${styles.amount__value} ${isCredit ? styles.credit : styles.debit}`}
                >
                    ₹{amount.toLocaleString()}
                </Typography>
                {tag && (
                    <Typography className={styles.amount__tag}>
                        {tag}
                    </Typography>
                )}
            </Box>
        </Card>
    );
};

export default TransactionCard;
