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
import {FileUploadResponse, MSNSummaryResponse} from "../../utils/interfaces";
import {uploadFile} from "../../services/investmentService";

interface MSNCardProps {
    title: string;
    cardType: "stocks" | "mf" | "nps";
    className?: string;
}

const MSNCard: React.FC<MSNCardProps> = ({title, cardType, className}) => {
    const {state, dispatch} = useMSNContext();
    const [summary, setSummary] = useState<MSNSummaryResponse>();

    useEffect(() => {
        setSummary(state.summaries[cardType]);
    }, [state, cardType]);

    const handleCardClick = () => {
        dispatch({
            type: "CardSelector",
            payload: {
                mf: cardType === "mf",
                stocks: cardType === "stocks",
                nps: cardType === "nps",
            },
        });
    };

    const handleFileUpload = async (selectedFile: File, serviceType: string) => {
        const response: FileUploadResponse = await uploadFile(selectedFile, {serviceType});
        console.log(`File processed successfully. Total transactions: ${response.file_count}`);
    };

    const renderFileUploadSection = () => (
        <div onClick={(e) => e.stopPropagation()}>
            <Button
                className={moduleStyle.FileUploadButton}
                variant="contained"
                onClick={(e) => {
                    e.stopPropagation();
                    dispatch({type: "OpenStockFileUpload", payload: true});
                }}
            >
                <FileUploadIcon style={{color: "black"}}/>
            </Button>
            <FileUploadDialog
                open={state.stockFileUpload}
                onClose={() => dispatch({type: "OpenStockFileUpload", payload: false})}
                onUpload={(selectedFile) => handleFileUpload(selectedFile, cardType.toUpperCase())}
            />
        </div>
    );

    const renderSummary = () => (
        summary && (
            <>
                {["totalValue", "currentValue", "changePercent", "count"].map((key, index) => (
                    <div className={moduleStyle.info} key={index}>
                        <Typography
                            className={moduleStyle.dValue}
                            variant="body1"
                        >
                            {key === "count"
                                ? summary[key]
                                : `₹${summary[key as keyof MSNSummaryResponse]?.toLocaleString()}`}
                        </Typography>
                        <Typography
                            variant="subtitle1"
                            className={moduleStyle.label}
                        >
                            {key.charAt(0).toUpperCase() + key.slice(1)}
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
                {(cardType === "stocks" || cardType === "nps") && renderFileUploadSection()}
            </div>
            <div className={moduleStyle.summary}>{renderSummary()}</div>
        </BasicCard>
    );
};

export default MSNCard;
