import React, {useState} from "react";
import {Card, Box, Typography, IconButton} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import BankIcon from "../BankIcon.tsx";
import styles from "./FileDetailsCard.module.scss";
import {convertToLocaleString} from "../../utils/util.tsx";
import {DialogComponent} from "../DialogComponent.tsx";

interface FileDetailsPage {
    bank: string;
    fileName: string;
    uploadDate: string;
    statementCount: number;
    onDownload: () => void;
    onDelete: () => void;
    style?: React.CSSProperties;
}

const FileDetailsCard: React.FC<FileDetailsPage> = (props) => {
    const {bank, fileName, uploadDate, statementCount, onDownload, onDelete, style} = props;
    const [deleteConfirm, setDeleteConfirm] = useState<boolean>(false);
    const [downloadDialog, setDownloadDialog] = useState<boolean>(false);


    return (
        <Card className={styles.card} style={style}>
            {/* Bank Icon Section */}
            <Box className={styles.bankIcon}>
                <BankIcon bankKey={bank} width={40} height={40}/>
            </Box>

            {/* File Details Section */}
            <Box className={styles.details}>
                <Typography className={styles.details__fileName}>{fileName}</Typography>
                <Typography className={styles.details__info}>
                    {convertToLocaleString(uploadDate)} | {statementCount} Statements
                </Typography>
            </Box>

            {/* Actions Section */}
            <Box className={styles.actions}>
                <IconButton className={styles.actions__icon} onClick={() => {
                    setDownloadDialog(true)
                }}>
                    <DownloadIcon style={{color: "#FAFAFA"}}/>
                </IconButton>
                <IconButton className={styles.actions__icon} onClick={() => {
                    setDeleteConfirm(true)
                }}>
                    <DeleteIcon style={{color: "#FAFAFA"}}/>
                </IconButton>
            </Box>
            <DialogComponent
                open={downloadDialog}
                message={`Are you sure you want to download the file  ${fileName}?`}
                onCancel={() => setDownloadDialog(false)}
                onConfirm={() => {
                    setDownloadDialog(false)
                    onDownload()
                }}
            />
            <DialogComponent
                open={deleteConfirm}
                message={`Are you sure you want to delete the file ${fileName}?`}
                onCancel={() => setDeleteConfirm(false)}
                onConfirm={() => {
                    setDeleteConfirm(false)
                    onDelete()
                }}
            />

        </Card>
    );
};

export default FileDetailsCard;
