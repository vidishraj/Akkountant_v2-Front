import React, {useEffect, useState} from "react";
import {
    Button,
    Typography,
} from "@mui/material";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import BasicCard from "../BasicCard";
import FileUploadDialog from "../FileUploadComponent/FileUpload";
import moduleStyle from "./MSNCard.module.scss";
import {useMSNContext} from "../../contexts/MSNContext";
import {InsertEPGRequest, InsertSecurityTransactionRequest, MSNSummaryResponse} from "../../utils/interfaces";
import {insertEPG, uploadFile, syncKiteHoldings, insertSecurityTransaction} from "../../services/investmentService";
import withLoader from "../LoaderHOC.tsx";
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CustomModal from "../InputDialogComponent/CustomModal.tsx";
import {useMessage} from "../../contexts/MessageContext.tsx";
import KiteAuth from "../KiteAuth/KiteAuth.tsx";

interface MSNCardProps {
    title: string;
    cardType?: "stocks" | "mf" | "nps" | undefined;
    cardType2?: "ppf" | "epf" | "gold" | undefined;
    className?: string;
}

const MSNCard: React.FC<MSNCardProps> = ({title, cardType, className, cardType2}) => {
    const {state, dispatch, fetchAndSetSummary, AllInfoForEpf, fetchAndSetSearchItems, fetchAndSetRealizedPnL, fetchAndSetFOSummary} = useMSNContext();
    const [summary, setSummary] = useState<MSNSummaryResponse>();
    const [buyModal, setBuyModal] = useState<boolean>(false);
    const [searchItems, setSearchItems] = useState<any[]>([]);
    const {setPayload} = useMessage();

    useEffect(() => {
        if (cardType) {
            setSummary(state.summaries[cardType]);
        }
        if (cardType2) {
            const epfSummary = state.summaries[cardType2];
            if (cardType2 === "ppf") {
                const net = parseFloat(epfSummary.net);
                const netProfit = parseFloat(epfSummary.netProfit);
                const unaccounted = parseFloat(epfSummary.unAccountedProfit);
                const current = net + netProfit
                const changePercent = (netProfit - unaccounted) / net * 100;
                setSummary({
                    totalValue: net - (netProfit - unaccounted),
                    currentValue: current,
                    changePercent: changePercent,
                    changeAmount: `${netProfit}`,
                    count: 0,
                    marketStatus: false
                });
            } else {
                const net = parseFloat(epfSummary.net);
                const netProfit = parseFloat(epfSummary.netProfit);
                const current = net + netProfit
                const changePercent = (netProfit) / net * 100;
                setSummary({
                    totalValue: net,
                    currentValue: current,
                    changePercent: changePercent,
                    changeAmount: netProfit,
                    count: 0,
                    marketStatus: false
                });
            }

        }
    }, [state, cardType]);

    // Fetch search items for MF
    useEffect(() => {
        if (cardType === "mf") {
            fetchAndSetSearchItems().then((response) => {
                setSearchItems(response)
            }).catch(() => {
                setSearchItems([]);
            })
        }
    }, [cardType]);

    const handleCardClick = () => {
        dispatch({
            type: "CardSelector",
            payload: {
                mf: cardType === "mf",
                stocks: cardType === "stocks",
                nps: cardType === "nps",
                ppf: cardType2 === "ppf",
                epf: cardType2 === "epf",
                gold: cardType2 === "gold",
            },
        });
        window.scrollTo({
            top: 500,
            behavior: 'smooth', // For smooth scrolling
        });

    };
    const handleFileUpload = async (selectedFile: File, serviceType: string) => {
        return uploadFile(selectedFile, {serviceType});
    };
    const [openFileUpload, setOpenFileUpload] = useState<boolean>(false);

    const renderFileUploadSection = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    setOpenFileUpload(true)
                }}
            >
                <FileUploadIcon style={{color: "black"}}/>
            </Button>
            <FileUploadDialog
                open={openFileUpload}
                onClose={() => setOpenFileUpload(false)}
                cardType={cardType2 || cardType}
                onUpload={(selectedFile) => {
                    const service = cardType === "stocks" ? "Stocks" : cardType === "nps" ? "NPS" : "EPF";
                    return handleFileUpload(selectedFile, service).then((response) => {
                        if (cardType === "stocks") {
                            fetchAndSetRealizedPnL(true);
                            fetchAndSetFOSummary(true);
                        }
                        return response;
                    }).catch((err) => {
                        return err;
                    })
                }}
            />
        </div>
    );
    const renderRefreshButton = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={async (e) => {
                    e.stopPropagation();
                    if (cardType) {
                        const serviceType = cardType === "stocks" ? "Stocks" : cardType === "mf" ? "Mutual_Funds" : "NPS";
                        fetchAndSetSummary(serviceType, true);
                    } else if (cardType2) {
                        const serviceType = cardType2 === "gold" ? "Gold" : cardType2 === "epf" ? "EPF" : "PF";
                        AllInfoForEpf(serviceType, true);
                    }
                }}
            >
                <RefreshIcon style={{color: "black"}}/>
            </Button>
        </div>
    );

    const renderCloudSyncButton = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={async (e) => {
                    e.stopPropagation();
                    try {
                        await syncKiteHoldings();
                        fetchAndSetSummary("Stocks", true);
                        setPayload({
                            type: "success",
                            message: "Holdings synced successfully"
                        });
                    } catch (error) {
                        setPayload({
                            type: "error",
                            message: "Failed to sync holdings"
                        });
                    }
                }}
            >
                <CloudSyncIcon style={{color: "black"}}/>
            </Button>
        </div>
    );
    const renderAddMFButton = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    setBuyModal(true)
                }}
            ><CustomModal title={`Buy ${cardType}`} open={buyModal} searchItems={searchItems} cardType={cardType} onCancel={() => {
                setBuyModal(false)
            }} onSubmit={(formData) => {
                const requestBody: InsertSecurityTransactionRequest = {
                    serviceType: "Mutual_Funds",
                    schemeCode: formData.schemeCode,
                    date: formData.date,
                    quantity: parseFloat(formData.quantity),
                    amount: parseFloat(formData.amount)
                };
                
                insertSecurityTransaction(requestBody).then((response) => {
                    setPayload({
                        type: 'success',
                        message: response.data.Message,
                    });
                    // Refresh the summary after adding
                    fetchAndSetSummary("Mutual_Funds", true);
                }).catch(() => {
                    setPayload({
                        type: 'error',
                        message: "Error inserting mutual fund transaction",
                    })
                })
                setBuyModal(false)
            }}/>
                <AddIcon style={{color: "black"}}/>
            </Button>
        </div>
    );

    const renderAddButton = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    setBuyModal(true)
                }}
            ><CustomModal title={`Buy ${cardType2}`} open={buyModal} onCancel={() => {
                setBuyModal(false)
            }} onSubmit={(formData) => {
                let requestBody: InsertEPGRequest = {} as InsertEPGRequest;
                if (cardType2 === "gold") {
                    requestBody = {
                        date: formData.date,
                        amount: parseFloat(formData.amount),
                        description: formData.description,
                        quantity: parseFloat(formData.quantity),
                        goldType: formData.goldCarat.substring(0, 3)
                    };
                } else if (cardType2 === "ppf") {
                    requestBody = {
                        date: formData.date,
                        description: formData.description,
                        amount: parseFloat(formData.amount),
                    };
                }
                insertEPG(cardType2 === "gold" ? "Gold" : "PF", requestBody).then((response) => {
                    setPayload({
                        type: 'success',
                        message: response.data.Message,
                    })
                }).catch(() => {
                    setPayload({
                        type: 'error',
                        message: "Error inserting",
                    })
                })
                setBuyModal(false)
            }} cardType={cardType2}/>
                <AddIcon style={{color: "black"}}/>
            </Button>
        </div>
    );

    const labelMap: any = {
        "totalValue": "Invested",
        "currentValue": "Total Value",
        "changePercent": "Change %",
        "count": "Count",
        "changeAmount": "Change"
    }
    const renderSummary = () => (
        summary && (
            <>
                {["currentValue", "totalValue", "changePercent", "changeAmount"].map((key, index) => (
                    <div className={moduleStyle.info} key={index}>
                        <Typography
                            className={moduleStyle.dValue}
                            variant="body1"
                        >
                            {key === "changePercent"
                                ? (Number(summary[key as keyof MSNSummaryResponse])?.toLocaleString('en-IN', {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })) + '%' : `₹${Number(summary[key as keyof MSNSummaryResponse])?.toLocaleString('en-IN', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                })}`}
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            className={moduleStyle.label}
                        >
                            {labelMap[key]}
                        </Typography>
                    </div>
                ))}
            </>
        )
    );

    return (
        <BasicCard
            onClick={handleCardClick}
            className={`${className} ${moduleStyle.MSNCard}`}
        >
            <div className={moduleStyle.headerRow}>
                <span className={moduleStyle.title}>{title}</span>
                <div className={moduleStyle.actionButtons}>
                    {renderRefreshButton()}
                    {cardType === "stocks" && (
                        <div onClick={(e) => e.stopPropagation()}>
                            <KiteAuth/>
                        </div>
                    )}
                    {cardType === "stocks" && renderCloudSyncButton()}
                    {(cardType === "stocks" || cardType === "nps" || cardType2 === "epf") && renderFileUploadSection()}
                    {cardType === "mf" && renderAddMFButton()}
                    {(cardType2 === "ppf" || cardType2 === "gold") && renderAddButton()}
                </div>
            </div>
            <div className={moduleStyle.summary}>{renderSummary()}</div>
        </BasicCard>
    );
};

export default withLoader(MSNCard);
