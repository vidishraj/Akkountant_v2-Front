import {useEffect, useRef, useState} from "react";
import {
    Button,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Box,
    Dialog,
    DialogTitle,
    DialogContent,
    IconButton,
    CircularProgress,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import {fetchInvestmentEmails, fetchEmailBody} from "../../services/investmentService.ts";
import {InvestmentEmail} from "../../utils/interfaces.ts";
import style from "./InvestmentEmails.module.scss";

interface InvestmentEmailsProps {
    category?: string;
    serviceTypeFilter?: string;
    categories?: string[];
    customBadgeClass?: Record<string, string>;
    customCategoryLabel?: Record<string, string>;
    emptyMessage?: string;
}

const defaultBadgeClass: Record<string, string> = {
    investment_confirmation: style.badgeInvestment,
    epf_passbook: style.badgeEpf,
    gold_receipt: style.badgeGold,
    nps_statement: style.badgeNps,
};

const defaultCategoryLabel: Record<string, string> = {
    investment_confirmation: "Investment",
    epf_passbook: "EPF",
    gold_receipt: "Gold",
    nps_statement: "NPS",
};

const formatSummary = (email: InvestmentEmail): string => {
    const summary = email.extraction_summary;
    if (!summary) return `${email.items_extracted} item(s)`;

    const investments = summary.investments || summary.purchases || [];
    if (investments.length > 0) {
        const first = investments[0];
        const label = first.scheme_code || first.description || summary.service_type || "";
        const amount = first.amount ? `\u20B9${Number(first.amount).toLocaleString("en-IN")}` : "";
        const qty = first.quantity ? `${first.quantity} units` : "";
        const parts = [label, qty, amount].filter(Boolean);
        const extra = investments.length > 1 ? ` +${investments.length - 1} more` : "";
        return parts.join(" - ") + extra;
    }

    if (summary.service_type) return summary.service_type;
    return `${email.items_extracted} item(s)`;
};

const InvestmentEmails = ({category, serviceTypeFilter, categories, customBadgeClass, customCategoryLabel, emptyMessage}: InvestmentEmailsProps) => {
    const categoryBadgeClass = {...defaultBadgeClass, ...customBadgeClass};
    const categoryLabel = {...defaultCategoryLabel, ...customCategoryLabel};
    const [emails, setEmails] = useState<InvestmentEmail[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 50;
    const [loading, setLoading] = useState(false);
    const [selectedEmail, setSelectedEmail] = useState<InvestmentEmail | null>(null);
    const [emailBodyHtml, setEmailBodyHtml] = useState<string | null>(null);
    const [emailBodyText, setEmailBodyText] = useState<string | null>(null);
    const [bodyLoading, setBodyLoading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    const loadEmails = async (p: number) => {
        setLoading(true);
        try {
            const data = await fetchInvestmentEmails(category, p, pageSize, serviceTypeFilter, categories);
            setEmails(data.emails);
            setTotal(data.total);
            setPage(p);
        } catch {
            setEmails([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadEmails(1);
    }, [category, serviceTypeFilter, categories]);

    const handleRowClick = async (email: InvestmentEmail) => {
        setSelectedEmail(email);
        setEmailBodyHtml(null);
        setEmailBodyText(null);
        setBodyLoading(true);
        try {
            const data = await fetchEmailBody(email.gmail_id);
            setEmailBodyHtml(data.body_html);
            setEmailBodyText(data.body_text);
        } catch {
            setEmailBodyText("Failed to load email body.");
        } finally {
            setBodyLoading(false);
        }
    };

    const handleClose = () => {
        setSelectedEmail(null);
        setEmailBodyHtml(null);
        setEmailBodyText(null);
    };

    // Auto-resize iframe to fit content
    useEffect(() => {
        if (!emailBodyHtml || !iframeRef.current) return;
        const iframe = iframeRef.current;
        const handleLoad = () => {
            try {
                const doc = iframe.contentDocument;
                if (doc) {
                    iframe.style.height = doc.documentElement.scrollHeight + "px";
                }
            } catch { /* cross-origin guard */ }
        };
        iframe.addEventListener("load", handleLoad);
        return () => iframe.removeEventListener("load", handleLoad);
    }, [emailBodyHtml]);

    const totalPages = Math.ceil(total / pageSize);

    if (loading) {
        return (
            <Box className={style.emptyState}>
                <Typography variant="body2">Loading emails...</Typography>
            </Box>
        );
    }

    if (emails.length === 0) {
        return (
            <Box className={style.emptyState}>
                <Typography variant="body2">{emptyMessage || "No emails found."}</Typography>
            </Box>
        );
    }

    return (
        <div className={style.container}>
            <TableContainer component={Paper} className={style.tableContainer}>
                <Table stickyHeader size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell><b>Date</b></TableCell>
                            <TableCell><b>Subject</b></TableCell>
                            <TableCell><b>Category</b></TableCell>
                            <TableCell><b>Details</b></TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {emails.map((email) => (
                            <TableRow
                                key={email.id}
                                className={style.clickableRow}
                                onClick={() => handleRowClick(email)}
                            >
                                <TableCell style={{whiteSpace: "nowrap"}}>
                                    {email.email_date || "\u2014"}
                                </TableCell>
                                <TableCell
                                    style={{maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"}}
                                >
                                    {email.subject || "\u2014"}
                                </TableCell>
                                <TableCell>
                                    <span className={`${style.badge} ${categoryBadgeClass[email.category] || style.badgeDefault}`}>
                                        {categoryLabel[email.category] || email.category}
                                    </span>
                                </TableCell>
                                <TableCell>
                                    <span className={style.summaryText}>
                                        {formatSummary(email)}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {totalPages > 1 && (
                <div className={style.pagination}>
                    <Button
                        className={style.paginationButton}
                        disabled={page <= 1}
                        onClick={() => loadEmails(page - 1)}
                    >
                        Prev
                    </Button>
                    <span>{page} / {totalPages}</span>
                    <Button
                        className={style.paginationButton}
                        disabled={page >= totalPages}
                        onClick={() => loadEmails(page + 1)}
                    >
                        Next
                    </Button>
                </div>
            )}

            <Dialog
                open={!!selectedEmail}
                onClose={handleClose}
                maxWidth="md"
                fullWidth
                PaperProps={{className: style.dialogPaper}}
            >
                {selectedEmail && (
                    <>
                        <DialogTitle className={style.dialogTitle}>
                            <span>{selectedEmail.subject || "Email Details"}</span>
                            <IconButton size="small" onClick={handleClose} className={style.dialogClose}>
                                <CloseIcon fontSize="small"/>
                            </IconButton>
                        </DialogTitle>
                        <DialogContent className={style.dialogContent}>
                            <div className={style.detailRow}>
                                <span className={style.detailKey}>From</span>
                                <span>{selectedEmail.sender}</span>
                            </div>
                            <div className={style.detailRow}>
                                <span className={style.detailKey}>Date</span>
                                <span>{selectedEmail.email_date}</span>
                            </div>
                            <div className={style.detailRow}>
                                <span className={style.detailKey}>Category</span>
                                <span className={`${style.badge} ${categoryBadgeClass[selectedEmail.category] || style.badgeDefault}`}>
                                    {categoryLabel[selectedEmail.category] || selectedEmail.category}
                                </span>
                            </div>
                            <div className={style.emailBodySection}>
                                {bodyLoading ? (
                                    <Box className={style.bodyLoader}>
                                        <CircularProgress size={24} sx={{color: "#7a7d85"}}/>
                                        <Typography variant="body2" sx={{color: "#7a7d85", ml: 1}}>
                                            Loading email...
                                        </Typography>
                                    </Box>
                                ) : emailBodyHtml ? (
                                    <iframe
                                        ref={iframeRef}
                                        srcDoc={emailBodyHtml}
                                        className={style.emailIframe}
                                        sandbox="allow-same-origin"
                                        title="Email content"
                                    />
                                ) : emailBodyText ? (
                                    <pre className={style.emailTextPre}>{emailBodyText}</pre>
                                ) : (
                                    <Typography variant="body2" sx={{color: "#7a7d85"}}>
                                        No email content available.
                                    </Typography>
                                )}
                            </div>
                        </DialogContent>
                    </>
                )}
            </Dialog>
        </div>
    );
};

export default InvestmentEmails;
