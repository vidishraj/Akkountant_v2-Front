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

const TransactionCard: React.FC<TransactionPage> = (props) => {
    const {date, description, amount, bank, style} = props;

    return (
        <Card className={styles.card} style={style}>
            {/* Bank Icon Section */}
            <Box className={styles.bankIcon}>
                <BankIcon
                    bankKey={bank}
                    width={40}
                    height={40}
                />
            </Box>

            {/* Description and Date Section */}
            <Box className={styles.description}>
                <Typography className={styles.description__text}>
                    {description}
                </Typography>
                <Typography className={styles.description__date}>
                    {convertToLocaleString(date)}
                </Typography>
            </Box>

            {/* Amount and Tag Section */}
            <Box className={styles.amount}>
                <Typography
                    className={`${styles.amount__value} ${
                        amount >= 0 ? styles.positive : styles.negative
                    }`}
                >
                    ₹{amount.toLocaleString()}
                </Typography>
                {/*Not sure about how to render tag*/}
                {/*<Typography className={styles.amount__tag}>{tag}</Typography>*/}
            </Box>
        </Card>
    );
};

export default TransactionCard;
