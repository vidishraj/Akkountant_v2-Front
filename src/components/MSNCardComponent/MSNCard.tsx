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
import {MSNSummaryResponse} from "../../utils/interfaces";
import {uploadFile, syncKiteHoldings} from "../../services/investmentService";
import withLoader from "../LoaderHOC.tsx";
import RefreshIcon from '@mui/icons-material/Refresh';
import AddIcon from '@mui/icons-material/Add';
import {useMessage} from "../../contexts/MessageContext.tsx";
import KiteAuth from "../KiteAuth/KiteAuth.tsx";
import {useAgentChatBridge} from "../../contexts/AgentChatBridgeContext";

interface MSNCardProps {
    title: string;
    cardType?: "stocks" | "mf" | "nps" | undefined;
    cardType2?: "ppf" | "epf" | "gold" | undefined;
    className?: string;
}

const MSNCard: React.FC<MSNCardProps> = ({title, cardType, className, cardType2}) => {
    const {state, dispatch, fetchAndSetSummary, AllInfoForEpf, fetchAndSetRealizedPnL, fetchAndSetFOSummary} = useMSNContext();
    const [summary, setSummary] = useState<MSNSummaryResponse>();
    const {setPayload} = useMessage();
    const {setCommand} = useAgentChatBridge();

    useEffect(() => {
        if (cardType) {
            setSummary(state.summaries[cardType]);
        }
        if (cardType2) {
            const epfSummary = state.summaries[cardType2];
            if (cardType2 === "ppf") {
                const net = parseFloat(epfSummary.net);
                const netProfit = parseFloat(epfSummary.netProfit);
                const unaccounted = parseFloat(epfSummary.unAccountedProfit || 0);
                const invested = net - (netProfit - unaccounted);
                const current = net + unaccounted;
                const changePercent = invested !== 0 ? (netProfit / invested) * 100 : 0;
                setSummary({
                    totalValue: invested,
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
                const changePercent = net !== 0 ? (netProfit / net) * 100 : 0;
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
    const handleAddClick = (message: string) => {
        setCommand({
            type: "send_message",
            payload: message,
            timestamp: Date.now(),
        });
    };

    const renderAddButton = (message: string) => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    handleAddClick(message);
                }}
            >
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
                    {cardType === "mf" && renderAddButton("I want to add a new Mutual Fund investment.")}
                    {cardType === "nps" && renderAddButton("I want to add a new NPS investment.")}
                    {cardType2 === "ppf" && renderAddButton("I want to add a new PPF deposit.")}
                    {cardType2 === "gold" && renderAddButton("I want to add a new Gold purchase.")}
                </div>
            </div>
            <div className={moduleStyle.summary}>{renderSummary()}</div>
        </BasicCard>
    );
};

export default withLoader(MSNCard);
