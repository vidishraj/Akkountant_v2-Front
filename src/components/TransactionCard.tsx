import React, {CSSProperties} from "react";
import {Card, Box, Typography} from "@mui/material";
import {convertToLocaleString} from "../utils/util.tsx";
import BankIcon from "./BankIcon.tsx";

interface TransactionPage {
    date: string;
    description: string;
    amount: number;
    tag: string;
    bank: string;
    style?: CSSProperties;
}

const TransactionCard: React.FC<TransactionPage> = (props) => {
    /**
     * This component renders a single transaction card.
     * Layout includes an icon for the bank and transaction details.
     */
    const {date, description, amount, tag, bank, style} = props;
    return (
        <Card
            sx={{
                minWidth: '310px',
                display: "flex",
                alignItems: "center",
                height: "50px",
                padding: 1,
                gap: 1,
                ...style,
            }}
        >
            {/* Bank Icon */}
            <Box sx={{flexBasis: "20%", display: "flex", justifyContent: "center"}}>
                <BankIcon bankKey={bank} width={70} height={50} altText={bank}/>
            </Box>

            {/* Transaction Details */}
            <Box sx={{
                flexBasis: "60%",
                overflow: "hidden",
                // justifyContent: 'flex-start',
                alignItems: 'flex-start',
                display: "flex",
                flexDirection: "column"
            }}>
                <Typography
                    variant="body1"
                    noWrap
                    sx={{fontWeight: 600, textOverflow: "ellipsis"}}
                >
                    {description}
                </Typography>
                <Typography variant="body2" color="textSecondary">
                    {convertToLocaleString(date)}
                </Typography>
            </Box>

            {/* Amount and Tag */}
            <Box sx={{flexBasis: "40%", textAlign: "right", overflow: "hidden"}}>
                <Typography variant="body1" sx={{fontWeight: 700}}>
                    ₹{amount.toLocaleString()} {/* Assuming currency format */}
                </Typography>
                <Typography variant="body2" noWrap color="textSecondary">
                    {tag}
                </Typography>
            </Box>
        </Card>
    );
};

export default TransactionCard;
