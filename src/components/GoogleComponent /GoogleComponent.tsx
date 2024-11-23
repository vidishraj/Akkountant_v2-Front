import {useState, useEffect} from "react";
import {Button, IconButton} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import BasicCard from "../BasicCard.tsx";
import GmailPng from "../../assets/icons/gmail.png";
import GoogleDrivePng from "../../assets/icons/google-drive.png";
import {
    checkGoogleStatus,
    makeDriveInitialRequest,
    makeInitialRequest,
} from "../../services/transactionService.ts";
import styles from "./GoogleComponent.module.scss";

const GoogleComponent = () => {
    const [gmailStatus, setGmailStatus] = useState<"success" | "error" | null>(null);
    const [gdriveStatus, setGdriveStatus] = useState<"success" | "error" | null>(null);
    const [, setLoading] = useState(false);

    useEffect(() => {
        checkConnection("gmail");
        checkConnection("gdrive");
    }, []);

    const checkConnection = async (apiType: "gmail" | "gdrive") => {
        setLoading(true);
        try {
            const response = await checkGoogleStatus(apiType);
            const isSuccess = response.Message === "Successful";
            apiType === "gmail" ? setGmailStatus(isSuccess ? "success" : "error") : setGdriveStatus(isSuccess ? "success" : "error");
        } catch {
            apiType === "gmail" ? setGmailStatus("error") : setGdriveStatus("error");
        } finally {
            setLoading(false);
        }
    };

    const handleReconnect = (apiType: "gmail" | "gdrive") => {
        apiType === "gmail" ? makeInitialRequest() : makeDriveInitialRequest();
    };

    const renderStatusRow = (apiType: "gmail" | "gdrive", status: "success" | "error" | null, iconSrc: string) => (
        <div className={styles.statusRow}>
            <IconButton
                disabled={status === "success"}
                onClick={() => handleReconnect(apiType)}
                className={styles.iconButton}
            >
                {status === "success" ? <CheckCircleIcon color="success"/> : <ErrorIcon color="error"/>}
            </IconButton>
            <Button
                variant="outlined"
                color="primary"
                disabled={status === "success"}
                onClick={() => handleReconnect(apiType)}
                className={status === "success" ? `${styles.reconnectButton} ${styles.reconnectButtonDisabled}` : styles.reconnectButton}
                sx={{
                    "&.Mui-disabled": {
                        cursor: "not-allowed !important",
                        pointerEvents: "all !important",
                    },
                }}
            >
                <img src={iconSrc} alt={`${apiType} Icon`} className={styles.reconnectIcon}/>
                Reconnect
            </Button>
        </div>
    );

    return (
        <BasicCard className={styles.googleContainer}>
            {renderStatusRow("gmail", gmailStatus, GmailPng)}
            {renderStatusRow("gdrive", gdriveStatus, GoogleDrivePng)}
        </BasicCard>
    );
};

export default GoogleComponent;
