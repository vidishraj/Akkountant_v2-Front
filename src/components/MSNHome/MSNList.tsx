import React from "react";
import {Card, CardContent, Typography, Box} from "@mui/material";
import style from "./MSNHome.module.scss";
import {MSNListResponse} from "../../utils/interfaces.ts";

interface MSNListProps {
    list: MSNListResponse[];
    onClick: (buyCode: string) => void; // Strongly typed callback function
}

const MSNList: React.FC<MSNListProps> = ({list, onClick}) => {
    return (
        <Box className={style.scrollContainer}>
            {/* Render a card for each stock in the list */}
            {list.map((stock) => {
                const {buyCode, info} = stock;
                const {lastPrice, previousClose, pChange, change} = info;

                const isPositiveChange = pChange >= 0; // Determine if the price change is positive

                return (
                    <Card
                        key={buyCode}
                        className={style.stockCard}
                        onClick={() => onClick(buyCode)}
                    >
                        <CardContent className={style.cardContent}>
                            {/* Stock Buy Code */}
                            <Typography variant="h6" className={style.symbol}>
                                {buyCode}
                            </Typography>

                            {/* Current Value */}
                            <Box>
                                <Typography variant="body1" className={style.currentValue}>
                                    &#8377;{lastPrice}
                                </Typography>
                            </Box>

                            {/* Previous Value and Price Change */}
                            <Box>
                                <Typography variant="body2" className={style.previousValue}>
                                    {previousClose}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    className={isPositiveChange ? style.positiveChange : style.negativeChange}
                                >
                                    {isPositiveChange ? `+${pChange}%` : `${pChange}%`}
                                </Typography>
                            </Box>

                            {/* Absolute Change and Percentage Change */}
                            <Box>
                                <Typography
                                    variant="body2"
                                    className={isPositiveChange ? style.positiveChange : style.negativeChange}
                                >
                                    &#8377;{change}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    className={isPositiveChange ? style.positiveChange : style.negativeChange}
                                >
                                    {isPositiveChange ? `+${pChange}%` : `${pChange}%`}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                );
            })}
        </Box>
    );
};

export default MSNList;
