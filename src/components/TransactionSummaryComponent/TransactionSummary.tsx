import React, {useState, useRef, useCallback} from "react";
import {Box, Button, Typography, LinearProgress} from "@mui/material";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import styles from "./TransactionSummary.module.scss";
import ClearFilterButton from "../ClearFilterComponent.tsx";
import DateModal from "../DateModalComponent.tsx";
import RefreshIcon from "@mui/icons-material/Refresh";
import EmailIcon from "@mui/icons-material/Email";
import DescriptionIcon from "@mui/icons-material/Description";
import {triggerEmailCheck, getEmailScanStatus} from "../../services/transactionService.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";

interface TransactionSummaryProps {
    refreshTransactions: any
}

const formatAmount = (value: number) =>
    Math.abs(value).toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2});

const TransactionSummary: React.FC<TransactionSummaryProps> = (props) => {
    const {state, dispatch} = useFilterContext();
    const {refreshTransactions} = props;
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
    const [dateModalState, setDateModalState] = useState(false);
    const [scanning, setScanning] = useState(false);
    const [scanStage, setScanStage] = useState('');
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const net = -1 * (debit - (-1 * credit));
    const {setPayload} = useMessage();

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const startPolling = useCallback((scanId: string) => {
        setScanning(true);
        setScanStage('Starting scan...');

        pollRef.current = setInterval(async () => {
            try {
                const status = await getEmailScanStatus(scanId);

                // Update stage display
                const stageLabels: Record<string, string> = {
                    fetching_emails: 'Fetching emails...',
                    fetched_emails: `Fetched ${status.total_emails_fetched || 0} emails`,
                    classifying: 'Classifying emails...',
                    classified: `Classified ${status.emails_classified || 0} financial emails`,
                    processing_emails: `Processing ${status.text_emails_total || 0} text + ${status.pdf_emails_total || 0} PDF emails...`,
                };
                setScanStage(stageLabels[status.stage] || status.stage || 'Processing...');

                if (status.status === 'completed') {
                    stopPolling();
                    setScanning(false);
                    const r = status.result || {};
                    const textCount = r.text_emails_processed || 0;
                    const pdfCount = r.pdf_emails_processed || 0;
                    const errorCount = r.errors?.length || 0;
                    setPayload({
                        type: 'success',
                        message: `${textCount + pdfCount} emails processed (${r.total_emails_fetched || 0} fetched, ${r.pre_skipped || 0} skipped). ${errorCount} errors`,
                    });
                    refreshTransactions();
                } else if (status.status === 'failed') {
                    stopPolling();
                    setScanning(false);
                    setPayload({
                        type: 'error',
                        message: `Scan failed: ${status.errors?.[0] || 'Unknown error'}`,
                    });
                }
            } catch {
                // Status endpoint failed — keep polling, might be transient
            }
        }, 3000);
    }, [refreshTransactions, setPayload, stopPolling]);
    return (
        <Box className={styles.summaryContainer} style={scanning ? {paddingBottom: '1.4rem'} : undefined}>
            <Box className={styles.metricsGroup}>
                <Box className={`${styles.metricCard} ${styles.creditCard}`}>
                    <Typography className={styles.metricLabel}>Credit</Typography>
                    <Typography className={styles.metricValue} style={{color: '#4ade80'}}>
                        ₹{credit ? formatAmount(credit) : '0.00'}
                    </Typography>
                </Box>
                <Box className={`${styles.metricCard} ${styles.debitCard}`}>
                    <Typography className={styles.metricLabel}>Debit</Typography>
                    <Typography className={styles.metricValue} style={{color: '#ef4444'}}>
                        ₹{debit ? formatAmount(debit) : '0.00'}
                    </Typography>
                </Box>
                <Box className={`${styles.metricCard} ${styles.netCard}`}>
                    <Typography className={styles.metricLabel}>Net</Typography>
                    <Typography className={styles.metricValue} style={{color: net >= 0 ? '#4ade80' : '#ef4444'}}>
                        ₹{net ? formatAmount(net) : '0.00'}
                    </Typography>
                </Box>
            </Box>

            <Box className={styles.divider} />

            <Box className={styles.sourceToggle}>
                <Button
                    className={`${styles.sourceBtn} ${state.source === 'statement' ? styles.sourceBtnActive : ''}`}
                    onClick={() => dispatch({type: "SET_SOURCE", payload: "statement"})}
                >
                    <DescriptionIcon sx={{fontSize: 16, mr: 0.3}} />
                    Statements
                </Button>
                <Button
                    className={`${styles.sourceBtn} ${state.source === 'email' ? styles.sourceBtnActive : ''}`}
                    onClick={() => dispatch({type: "SET_SOURCE", payload: "email"})}
                >
                    <EmailIcon sx={{fontSize: 16, mr: 0.3}} />
                    Emails
                </Button>
            </Box>

            <Box className={styles.divider} />

            <Box className={styles.actionButtons}>
                <Button
                    className={styles.iconBtn}
                    onClick={(e) => {
                        e.stopPropagation();
                        refreshTransactions();
                    }}
                >
                    <RefreshIcon fontSize="small" />
                </Button>
                <Button
                    className={styles.scanBtn}
                    onClick={() => setDateModalState(true)}
                    disabled={scanning}
                >
                    <EmailIcon fontSize="small" sx={{mr: 0.5}} />
                    {scanning ? 'Scanning…' : 'Scan'}
                </Button>
                <ClearFilterButton
                    apply={() => {
                        dispatch({type: "RESET_FILTERS"});
                        setTimeout(() => refreshTransactions(), 0);
                    }}
                />
            </Box>

            {scanning && (
                <Box className={styles.scanProgress}>
                    <Typography variant="caption" sx={{color: '#8899AA', fontSize: '0.65rem', whiteSpace: 'nowrap'}}>
                        {scanStage}
                    </Typography>
                    <LinearProgress
                        sx={{
                            flex: 1,
                            height: 2,
                            borderRadius: 2,
                            backgroundColor: '#29384D',
                            '& .MuiLinearProgress-bar': {backgroundColor: '#7b68ee'},
                        }}
                    />
                </Box>
            )}

            <DateModal
                title={"Scan Emails"}
                isOpen={dateModalState}
                onSubmit={(dates) => {
                    setDateModalState(false);
                    triggerEmailCheck(dates.to, dates.from, false).then((r) => {
                        if (r.status === 202 && r.data.scan_id) {
                            startPolling(r.data.scan_id);
                        }
                    }).catch(() => {
                        setPayload({
                            type: "error",
                            message: "Error while triggering email scan.",
                        });
                    });
                }}
                onCancel={() => setDateModalState(false)}
            />
        </Box>
    );
};

export default TransactionSummary;
