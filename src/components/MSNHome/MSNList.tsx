import React from "react";
import {Card, CardContent, Typography, Box} from "@mui/material";
import style from "./MSNHome.module.scss";
import {MSNListResponse} from "../../utils/interfaces.ts";
import withLoader from "../LoaderHOC.tsx";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

interface MSNListProps {
    list: MSNListResponse[];
    onClick: (buyCode: string) => void; // Strongly typed callback function
}

const MSNList: React.FC<MSNListProps> = ({list, onClick}) => {
    const {state} = useMSNContext()
    return (
        <Box className={style.scrollContainer} style={{
            justifyContent: list.length === 0 ? 'center' : '',
            alignItems: list.length === 0 ? 'center' : '',
        }}>
            {/* Render a card for each stock in the list */}
            {list.length > 0 ? list.map((stock) => {
                let lastPrice = 0
                let buyQuant = 0;
                let buyPrice = 0
                let pChange = 0
                let {buyCode, info} = stock;
                let previousClose = info.lastPrice;
                if (state.selectedCard.stocks || state.selectedCard.mf) {
                    if (state.selectedCard.mf && info.schemeType) {
                        buyCode = info.schemeType
                    }
                    lastPrice = info.lastPrice;
                    pChange = info.pChange;
                    buyPrice = stock.buyPrice
                    buyQuant = stock.buyQuant;
                } else if (state.selectedCard.nps && stock.info.lastWeek && info.name) {
                    buyCode = info.name
                    lastPrice = Number(stock.info.nav);
                    previousClose = Number(stock.info.lastWeek);
                    buyQuant = stock.buyQuant;
                    buyPrice = stock.buyPrice;
                    pChange = Number(((lastPrice - previousClose) / previousClose * 100).toFixed(2))
                }
                const profit = (Number(lastPrice * buyQuant) - Number(buyPrice * buyQuant))
                const profitString = profit.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })
                const profitPercentage = (profit / Number(buyPrice * buyQuant) * 100);
                const profitPercentageString = profitPercentage.toLocaleString('en-IN', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                })
                const isPositiveChange = pChange >= 0; // Determine if the price change is positive

                return (
                    <Card
                        key={buyCode}
                        className={style.stockCard}
                        onClick={() => onClick(buyCode)}
                    >
                        <CardContent className={style.cardContent}>
                            {/* Stock Buy Code */}
                            <Typography variant={'body2'} className={style.symbol}>
                                {buyCode}
                            </Typography>

                            {/* Current Value */}
                            <Box className={style.currentBox}>
                                <Typography variant="body1" className={style.currentValue}>
                                    &#8377;{lastPrice}
                                </Typography>
                            </Box>

                            {/* Previous Value and Price Change */}
                            <Box className={style.previousBox}>
                                <Typography variant="body2" className={style.previousValue}>
                                    &#8377;{previousClose}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    className={isPositiveChange ? style.positiveChange : style.negativeChange}
                                >
                                    {isPositiveChange ? `+${pChange}%` : `${pChange}%`}
                                </Typography>
                            </Box>

                            {/* Absolute Change and Percentage Change */}
                            <Box className={style.changeBox}>
                                <Typography
                                    variant="body2"
                                    className={profit > 0 ? style.positiveChange : style.negativeChange}
                                >
                                    &#8377;{profitString}
                                </Typography>
                                <Typography
                                    variant="body2"
                                    className={profitPercentage > 0 ? style.positiveChange : style.negativeChange}
                                >
                                    {profitPercentage > 0 ? `+${profitPercentageString}%` : `${profitPercentageString}%`}
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                );
            }) : <div style={{textAlign: 'center'}}> No data! <br/>
                Upload statement or Add instrument!</div>}
        </Box>
    );
};

export default withLoader(MSNList);
