import {useState, useEffect} from "react";
import {Button, Typography} from "@mui/material";
import BasicCard from "../BasicCard.tsx";
import GmailPng from "../../assets/icons/gmail.png";
import GoogleDrivePng from "../../assets/icons/google-drive.png";
import {checkGoogleStatus} from "../../services/transactionService.ts";
import styles from "./GoogleComponent.module.scss";
import {makeDriveInitialRequest, makeInitialRequest} from "../../services/GoogleApiUtils.tsx";

const GoogleComponent = () => {
    const [gmailStatus, setGmailStatus] = useState<"success" | "error" | null>(null);
    const [gdriveStatus, setGdriveStatus] = useState<"success" | "error" | null>(null);

    useEffect(() => {
        checkConnection("gmail");
        checkConnection("gdrive");
    }, []);

    const checkConnection = async (apiType: "gmail" | "gdrive") => {
        try {
            const response = await checkGoogleStatus(apiType);
            const isSuccess = response.Message === "Successful";
            apiType === "gmail" ? setGmailStatus(isSuccess ? "success" : "error") : setGdriveStatus(isSuccess ? "success" : "error");
        } catch {
            apiType === "gmail" ? setGmailStatus("error") : setGdriveStatus("error");
        }
    };

    const handleReconnect = (apiType: "gmail" | "gdrive") => {
        apiType === "gmail" ? makeInitialRequest() : makeDriveInitialRequest();
    };

    const renderStatusRow = (apiType: "gmail" | "gdrive", status: "success" | "error" | null, iconSrc: string, label: string) => {
        const connected = status === "success";
        return (
            <div className={styles.statusRow}>
                <img src={iconSrc} alt={label} className={styles.serviceIcon} />
                <div className={styles.serviceInfo}>
                    <Typography className={styles.serviceName}>{label}</Typography>
                    <Typography className={`${styles.statusText} ${connected ? styles.connected : styles.disconnected}`}>
                        {status === null ? "Checking..." : connected ? "Connected" : "Not connected"}
                    </Typography>
                </div>
                <span className={`${styles.statusDot} ${connected ? styles.dotGreen : styles.dotRed}`} />
                {!connected && (
                    <Button
                        size="small"
                        onClick={() => handleReconnect(apiType)}
                        className={styles.connectBtn}
                    >
                        Connect
                    </Button>
                )}
            </div>
        );
    };

    return (
        <BasicCard className={styles.googleContainer}>
            {renderStatusRow("gmail", gmailStatus, GmailPng, "Gmail")}
            {renderStatusRow("gdrive", gdriveStatus, GoogleDrivePng, "Google Drive")}
        </BasicCard>
    );
};

export default GoogleComponent;
