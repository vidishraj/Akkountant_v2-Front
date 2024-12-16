import {useEffect, useState} from "react";
import {Box, Button, Card, CardContent, Typography} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";

import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";
import MSNSummary from "../MSNHome/MSNSummary.tsx";
import {EPGResponse} from "../../utils/interfaces.ts";
import {useMSNContext} from "../../contexts/MSNContext.tsx";

import style from "./EPGHome.module.scss";
import {formatDateString} from "../../utils/util.tsx";

interface EPGlist {
    date: string;
    description?: string;
    amount: number;
    interest: number;
    quantity?: number;
    goldType?: string;
}

const EPGHome = () => {
    const {state, dispatch, fetchAndSetUserSecurities, deleteComplete} = useMSNContext();
    const [summaryState, setSummaryState] = useState<EPGResponse>();
    const [listState, setListState] = useState<EPGlist[]>([]);
    const [deleteConfirmation, setDeleteConfirmation] = useState(false);

    const getContextKey = () =>
        state.selectedCard.ppf
            ? "ppf"
            : state.selectedCard.epf
                ? "epf"
                : "gold";

    const populateListState = () => {
        const list: EPGlist[] = [];
        const contextKey = getContextKey();
        const transactions = state.summaries[contextKey]?.transactions || [];

        transactions.forEach((item) => {
            list.push({
                date: item.date,
                amount: item.amount,
                interest: item.interest,
                description: state.selectedCard.epf || state.selectedCard.gold ? item.description : undefined,
                quantity: state.selectedCard.gold ? item.quant : undefined,
                goldType: state.selectedCard.gold ? item.goldType : undefined,
            });
        });

        setListState(list);
    };

    useEffect(() => {
        const contextKey = getContextKey();
        setSummaryState(state.summaries[contextKey]);
        populateListState();
    }, [state]);

    useEffect(() => {
        fetchAndSetUserSecurities();
    }, []);

    const handleDeleteAll = () => {
        setDeleteConfirmation(false);
        deleteComplete();
    };

    const handleResetCardSelector = () => dispatch({type: "ResetCardSelector"});

    return (
        <div className={style.container}>
            {summaryState && (
                <div className={style.innerSummary}>
                    <MSNSummary isLoading={false}/>
                </div>
            )}

            <div className={style.listBackButton} style={{minWidth: "320px", width: "100%"}}>
                <Box
                    className={style.scrollContainer}
                    style={{
                        justifyContent: listState.length === 0 ? "center" : "",
                        alignItems: listState.length === 0 ? "center" : "",
                    }}
                >
                    {listState.length > 0 ? (
                        <>
                            <Card
                                key={"header_list"}
                                className={`${style.stockCard} ${style.headerCard}`} // Add a specific class for the header
                            >
                                <CardContent className={style.cardContent}>
                                    <Typography variant="body2" className={style.date}>
                                        Date
                                    </Typography>
                                    {!state.selectedCard.ppf && (
                                        <Typography variant="body2" className={style.description}>
                                            Description
                                        </Typography>
                                    )}
                                    {state.selectedCard.gold ? (
                                        <div className={style.basicFlex}>
                                            <Typography variant="body2" className={style.amount}>
                                                Amount
                                            </Typography>
                                            <Typography variant="body2" className={style.interest}>
                                                Profit
                                            </Typography>
                                        </div>
                                    ) : (
                                        <>
                                            <Typography
                                                variant="body2"
                                                className={style.amount}
                                                style={{width: "25%"}}
                                            >
                                                Amount
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                className={style.interest}
                                                style={{width: "25%"}}
                                            >
                                                Profit
                                            </Typography>
                                        </>
                                    )}
                                    {state.selectedCard.gold && (
                                        <div className={style.basicFlex}>
                                            <Typography variant="body2" className={style.quantity}>
                                                Quantity
                                            </Typography>
                                            <Typography variant="body2" className={style.goldType}>
                                                Type
                                            </Typography>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        {listState.map((item, index) => (
                            <Card key={index} className={style.stockCard}>
                                <CardContent className={style.cardContent}>
                                    <Typography variant="body2" className={style.date}>
                                        {formatDateString(item.date)}
                                    </Typography>
                                    {!state.selectedCard.ppf && (
                                        <Typography variant="body2" className={style.description}>
                                            {item.description}
                                        </Typography>
                                    )}
                                    {state.selectedCard.gold ? (
                                        <div className={style.basicFlex}>
                                            <Typography variant="body2" className={style.amount}>
                                                ₹{Number(item.amount).toLocaleString('en-IN', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                            </Typography>
                                            <Typography variant="body2" className={style.interest}>
                                                ₹{Number(item.interest).toLocaleString('en-IN', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                            </Typography>
                                        </div>
                                    ) : (
                                        <>
                                            <Typography
                                                variant="body2"
                                                className={style.amount}
                                                style={{width: "25%"}}
                                            >
                                                ₹{Number(item.amount).toLocaleString('en-IN', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                            </Typography>
                                            <Typography
                                                variant="body2"
                                                className={style.interest}
                                                style={{width: "25%"}}
                                            >
                                                ₹{Number(item.interest).toLocaleString('en-IN', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                            </Typography>
                                        </>
                                    )}
                                    {state.selectedCard.gold && (
                                        <div className={style.basicFlex}>
                                            <Typography variant="body2" className={style.quantity}>
                                                {item.quantity}g
                                            </Typography>
                                            <Typography variant="body2" className={style.goldType}>
                                                {item.goldType} carat
                                            </Typography>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                        ))}
                        </>) : <>
                        <div style={{textAlign: 'center'}}> No data! <br/>
                            Upload statement or Add instrument!
                        </div>
                    </>}

                </Box>
                <Button
                    startIcon={<ArrowBackIcon/>}
                    onClick={handleResetCardSelector}
                    className={style.backButton}
                >
                    Back
                </Button>
            </div>

            <ConfirmationDialog
                open={deleteConfirmation}
                onCancel={() => setDeleteConfirmation(false)}
                onSubmit={handleDeleteAll}
                message="Are you sure you want to delete all data?"
            />
        </div>
    );
};

export default EPGHome;
