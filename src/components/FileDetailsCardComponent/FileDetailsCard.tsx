import React, {useState} from "react";
import {IconButton, Tooltip} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteIcon from "@mui/icons-material/Delete";
import BankIcon from "../BankIcon.tsx";
import styles from "./FileDetailsCard.module.scss";
import {convertToLocaleString, formatDateString} from "../../utils/util.tsx";
import {DialogComponent} from "../DialogComponent.tsx";

interface FileDetailsPage {
    bank: string;
    fileName: string;
    uploadDate: string;
    statementCount: number;
    onDownload: () => void;
    onDelete: () => void;
    style?: React.CSSProperties;
    category?: string;
    status?: string;
    summary_text?: string;
    has_pdf?: boolean;
    email_date?: string;
    subject?: string;
    sender?: string;
    extraction_summary?: Record<string, any>;
    period_start?: string;
    period_end?: string;
}

const statusConfig: Record<string, { label: string; className: string }> = {
    processed: {label: "Processed", className: "processed"},
    skipped: {label: "Skipped", className: "skipped"},
    failed: {label: "Failed", className: "failed"},
};

const FileDetailsCard: React.FC<FileDetailsPage> = (props) => {
    const {
        bank, fileName, uploadDate, statementCount, onDownload, onDelete, style,
        status, summary_text, has_pdf, email_date, subject, extraction_summary,
    } = props;
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [downloadDialog, setDownloadDialog] = useState(false);

    const displayName = subject || fileName;
    const bankName = (bank || "Unknown").replace(/_/g, " ");
    const statusInfo = status ? statusConfig[status] : undefined;

    const inserted = extraction_summary?.inserted ?? 0;
    const duplicates = extraction_summary?.duplicates ?? 0;
    const period = props.period_start && props.period_end
        ? `${formatDateString(props.period_start)} – ${formatDateString(props.period_end)}`
        : extraction_summary?.period
        || (extraction_summary?.period_start && extraction_summary?.period_end
            ? `${extraction_summary.period_start} – ${extraction_summary.period_end}`
            : null);

    return (
        <div className={`${styles.card} ${status === "failed" ? styles.cardFailed : status === "skipped" ? styles.cardSkipped : ""}`} style={style}>
            <div className={styles.cardHeader}>
                <div className={styles.bankIconWrap}>
                    <BankIcon bankKey={bank} width={36} height={36}/>
                </div>
                <div className={styles.headerInfo}>
                    <div className={styles.bankName}>{bankName}</div>
                    <div className={styles.subject} title={displayName}>{displayName}</div>
                </div>
                {statusInfo && (
                    <span className={`${styles.statusBadge} ${styles[statusInfo.className]}`}>
                        {statusInfo.label}
                    </span>
                )}
            </div>

            <div className={styles.cardBody}>
                <div className={styles.statsRow}>
                    {statementCount > 0 && (
                        <span className={styles.stat}>
                            <strong>{statementCount}</strong> items extracted
                        </span>
                    )}
                    {inserted > 0 && (
                        <span className={`${styles.stat} ${styles.statGreen}`}>
                            <strong>{inserted}</strong> inserted
                        </span>
                    )}
                    {duplicates > 0 && (
                        <span className={`${styles.stat} ${styles.statYellow}`}>
                            <strong>{duplicates}</strong> duplicates
                        </span>
                    )}
                    {period && (
                        <span className={styles.stat}>
                            {period}
                        </span>
                    )}
                </div>
                {summary_text && statementCount === 0 && (
                    <div className={styles.summaryText}>{summary_text}</div>
                )}
            </div>

            <div className={styles.cardFooter}>
                <span className={styles.date}>
                    {email_date ? convertToLocaleString(email_date) : convertToLocaleString(uploadDate)}
                </span>
                <div className={styles.actions}>
                    {has_pdf === false ? (
                        <Tooltip title="PDF not available" arrow>
                            <span>
                                <IconButton size="small" disabled>
                                    <DownloadIcon style={{color: "#555", fontSize: 18}}/>
                                </IconButton>
                            </span>
                        </Tooltip>
                    ) : (
                        <Tooltip title="Download PDF" arrow>
                            <IconButton size="small" onClick={() => setDownloadDialog(true)}>
                                <DownloadIcon style={{color: "#7b68ee", fontSize: 18}}/>
                            </IconButton>
                        </Tooltip>
                    )}
                    <Tooltip title="Delete" arrow>
                        <IconButton size="small" onClick={() => setDeleteConfirm(true)}>
                            <DeleteIcon style={{color: "#8b8b8b", fontSize: 18}}/>
                        </IconButton>
                    </Tooltip>
                </div>
            </div>

            <DialogComponent
                open={downloadDialog}
                message={`Download ${displayName}?`}
                onCancel={() => setDownloadDialog(false)}
                onConfirm={() => {
                    setDownloadDialog(false);
                    onDownload();
                }}
            />
            <DialogComponent
                open={deleteConfirm}
                message={`Delete ${displayName}?`}
                onCancel={() => setDeleteConfirm(false)}
                onConfirm={() => {
                    setDeleteConfirm(false);
                    onDelete();
                }}
            />
        </div>
    );
};

export default FileDetailsCard;
