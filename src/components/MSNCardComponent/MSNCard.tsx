import React, {useEffect, useState} from "react";
import {
    Button,
    Typography,
} from "@mui/material";
import FileUploadIcon from "@mui/icons-material/FileUpload";
import BasicCard from "../BasicCard";
import FileUploadDialog from "../FileUploadComponent/FileUpload";
import moduleStyle from "./MSNCard.module.scss";
import {useMSNContext} from "../../contexts/MSNContext";
import {InsertEPGRequest, MSNSummaryResponse} from "../../utils/interfaces";
import {insertEPG, uploadFile} from "../../services/investmentService";
import withLoader from "../LoaderHOC.tsx";
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import CustomModal from "../InputDialogComponent/CustomModal.tsx";
import {useMessage} from "../../contexts/MessageContext.tsx";

interface MSNCardProps {
    title: string;
    cardType?: "stocks" | "mf" | "nps" | undefined;
    cardType2?: "ppf" | "epf" | "gold" | undefined;
    className?: string;
}

const MSNCard: React.FC<MSNCardProps> = ({title, cardType, className, cardType2}) => {
    const {state, dispatch, fetchAndSetSummary, AllInfoForEpf} = useMSNContext();
    const [summary, setSummary] = useState<MSNSummaryResponse>();
    const [buyModal, setBuyModal] = useState<boolean>(false);
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
    };
    const handleFileUpload = async (selectedFile: File, serviceType: string) => {
        return uploadFile(selectedFile, {serviceType});
    };
    const [openFileUpload, setOpenFileUpload] = useState<boolean>(false);
    const getServiceType = () => (cardType === "mf" ? "Mutual_Funds" : cardType === "stocks" ? "Stocks" : "NPS");

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
                    return handleFileUpload(selectedFile, getServiceType()).then((response) => {
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
                onClick={(e) => {
                    e.stopPropagation();
                    if (cardType) {
                        const serviceType = cardType === "mf" ? "Mutual_Funds" : cardType === "stocks" ?
                            "Stocks" : "NPS";
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
    const renderAddButton = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    setBuyModal(true)
                }}
            >
                <AddIcon style={{color: "black"}}/>
            </Button>
        </div>
    );

    const labelMap: any = {
        "totalValue": "Total Value",
        "currentValue": "Current",
        "changePercent": "Change %",
        "count": "Count",
        "changeAmount": "Change"
    }
    const renderSummary = () => (
        summary && (
            <>
                {["totalValue", "currentValue", "changePercent", "changeAmount"].map((key, index) => (
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
            <span className={moduleStyle.title}>{title}</span>
            <div className={moduleStyle.actionButtons}>
                {renderRefreshButton()}
                {(cardType === "stocks" || cardType === "nps" || cardType2 === "epf") && renderFileUploadSection()}
                {(cardType2 === "ppf" || cardType2 === "gold") && renderAddButton()}
            </div>
            <div className={moduleStyle.summary}>{renderSummary()}</div>
            <CustomModal title={`Buy ${cardType2}`} open={buyModal} onCancel={() => {
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
                })
                setBuyModal(false)
            }} cardType={cardType2}/>
        </BasicCard>
    );
};

export default withLoader(MSNCard);
