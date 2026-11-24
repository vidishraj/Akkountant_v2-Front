import {useEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import {fetchInvestmentEmails, fetchEmailBody} from "../../services/investmentService.ts";
import {InvestmentEmail} from "../../utils/interfaces.ts";
import {containsAccountId, maskAccountIds} from "../../utils/maskAccountIds.ts";
import {withEmailBodyCsp} from "../../utils/emailSandbox.ts";
import useModalA11y from "../../hooks/useModalA11y.ts";
import style from "./InvestmentEmails.module.scss";

/**
 * Investment emails tab (all asset pages). ak-fexn:
 * - Account IDs in subjects / extraction summaries are masked by default
 *   (utils/maskAccountIds); "Reveal IDs" shows them for this mount only —
 *   component state, never persisted or logged.
 * - Rebuilt on Nocturne (design: Akkountant Redesign · Emails + DIALOGS ·
 *   email): `.table`, `.tag`, `.btn`, `.dialog*`; no MUI, no raw hex.
 * - Email body dialog: Extracted row, loading skeleton, sandbox footnote.
 *   The body is fetched only on open and cleared on close.
 */

interface InvestmentEmailsProps {
    category?: string;
    serviceTypeFilter?: string;
    categories?: string[];
    customBadgeClass?: Record<string, string>;
    customCategoryLabel?: Record<string, string>;
    emptyMessage?: string;
}

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
        const amount = first.amount ? `₹${Number(first.amount).toLocaleString("en-IN")}` : "";
        const qty = first.quantity ? `${first.quantity} units` : "";
        const parts = [label, qty, amount].filter(Boolean);
        const extra = investments.length > 1 ? ` +${investments.length - 1} more` : "";
        return parts.join(" - ") + extra;
    }

    if (summary.service_type) return summary.service_type;
    return `${email.items_extracted} item(s)`;
};

const InvestmentEmails = ({category, serviceTypeFilter, categories, customBadgeClass, customCategoryLabel, emptyMessage}: InvestmentEmailsProps) => {
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
    const panelRef = useRef<HTMLDivElement | null>(null);
    const closeRef = useRef<HTMLButtonElement | null>(null);
    // ak-fexn: masked by default; reveal lives in component state only.
    const [revealIds, setRevealIds] = useState(false);
    const shown = (text: string | null | undefined): string =>
        revealIds ? (text ?? "") : maskAccountIds(text);

    useModalA11y({
        open: !!selectedEmail,
        panelRef: panelRef as React.RefObject<HTMLElement>,
        firstFocusableRef: closeRef as React.RefObject<HTMLElement>,
    });

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
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

    useEffect(() => {
        if (!selectedEmail) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") handleClose();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [selectedEmail]);

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
    const badgeClass = (cat: string) => `tag tag-accent ${style.badge} ${customBadgeClass?.[cat] ?? ""}`;

    if (loading) {
        return <div className={style.emptyState}>Loading emails…</div>;
    }

    if (emails.length === 0) {
        return <div className={style.emptyState}>{emptyMessage || "No emails found."}</div>;
    }

    const anyIds = emails.some(
        (e) => containsAccountId(e.subject) || containsAccountId(formatSummary(e)),
    );

    return (
        <div className={style.container}>
            <div className={style.privacyBar}>
                <i className="ph ph-lock-simple" aria-hidden/>
                <span>Account IDs masked · bodies fetched only when you open one</span>
                {anyIds && (
                    <button
                        type="button"
                        className={`btn btn-ghost ${style.revealBtn}`}
                        onClick={() => setRevealIds((v) => !v)}
                        aria-pressed={revealIds}
                    >
                        {revealIds ? "Mask IDs" : "Reveal IDs"}
                    </button>
                )}
            </div>

            <div className={style.tableWrap}>
                <table className={`table ${style.table}`}>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Subject</th>
                            <th>Category</th>
                            <th>Details</th>
                        </tr>
                    </thead>
                    <tbody>
                        {emails.map((email) => (
                            <tr
                                key={email.id}
                                className={style.row}
                                tabIndex={0}
                                onClick={() => handleRowClick(email)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter" || e.key === " ") {
                                        e.preventDefault();
                                        void handleRowClick(email);
                                    }
                                }}
                            >
                                <td className={style.date}>{email.email_date || "—"}</td>
                                <td className={style.subject}>{shown(email.subject) || "—"}</td>
                                <td>
                                    <span className={badgeClass(email.category)}>
                                        {categoryLabel[email.category] || email.category}
                                    </span>
                                </td>
                                <td className={style.details}>{shown(formatSummary(email))}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {totalPages > 1 && (
                <div className={style.pagination}>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={page <= 1}
                        onClick={() => loadEmails(page - 1)}
                    >
                        Prev
                    </button>
                    <span className={style.pageLabel}>{page} / {totalPages}</span>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        disabled={page >= totalPages}
                        onClick={() => loadEmails(page + 1)}
                    >
                        Next
                    </button>
                </div>
            )}

            {selectedEmail && createPortal(
                <div className={`dialog-backdrop ${style.backdrop}`} onMouseDown={handleClose} role="presentation">
                    <div
                        ref={panelRef}
                        className={`dialog ${style.dialog}`}
                        role="dialog"
                        aria-modal="true"
                        aria-label={shown(selectedEmail.subject) || "Email details"}
                        onMouseDown={(e) => e.stopPropagation()}
                    >
                        <div className={style.dialogHead}>
                            <div className={`dialog-title ${style.dialogTitle}`}>
                                {shown(selectedEmail.subject) || "Email details"}
                            </div>
                            <button
                                ref={closeRef}
                                type="button"
                                className="btn btn-icon"
                                onClick={handleClose}
                                aria-label="Close"
                            >
                                <i className="ph ph-x" aria-hidden/>
                            </button>
                        </div>
                        <div className={style.meta}>
                            <span className={style.metaKey}>From</span>
                            <span>{selectedEmail.sender || "—"}</span>
                            <span className={style.metaKey}>Date</span>
                            <span>{selectedEmail.email_date || "—"}</span>
                            <span className={style.metaKey}>Category</span>
                            <span>
                                <span className={badgeClass(selectedEmail.category)}>
                                    {categoryLabel[selectedEmail.category] || selectedEmail.category}
                                </span>
                            </span>
                            <span className={style.metaKey}>Extracted</span>
                            <span>{shown(formatSummary(selectedEmail))}</span>
                        </div>
                        <div className={style.bodyBox}>
                            {bodyLoading ? (
                                <div className={style.skeleton} aria-busy="true">
                                    <span className={style.skeletonLabel}>
                                        <i className={`ph ph-circle-notch ${style.spin}`} aria-hidden/>
                                        Loading email…
                                    </span>
                                    <span className={style.skeletonLine} style={{width: "92%"}}/>
                                    <span className={style.skeletonLine} style={{width: "78%"}}/>
                                    <span className={style.skeletonLine} style={{width: "85%"}}/>
                                </div>
                            ) : emailBodyHtml ? (
                                <iframe
                                    ref={iframeRef}
                                    // ak-36mz: CSP blocks remote images / tracking pixels / remote CSS.
                                    srcDoc={withEmailBodyCsp(emailBodyHtml)}
                                    className={style.emailIframe}
                                    sandbox="allow-same-origin"
                                    title="Email content"
                                />
                            ) : emailBodyText ? (
                                <pre className={style.emailTextPre}>{emailBodyText}</pre>
                            ) : (
                                <span className={style.muted}>No email content available.</span>
                            )}
                        </div>
                        <span className={style.footnote}>
                            The body is fetched only when you open an email, rendered sandboxed, and not kept afterwards.
                        </span>
                    </div>
                </div>,
                document.body,
            )}
        </div>
    );
};

export default InvestmentEmails;
