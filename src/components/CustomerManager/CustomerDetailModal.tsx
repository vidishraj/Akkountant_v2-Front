import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Customer, InvoiceData, CustomerEmailLink } from '../../utils/interfaces';
import { fetchAllInvoices, fetchCustomerEmails, unlinkEmailFromCustomer } from '../../services/freelanceService';
import { fetchEmailBody } from '../../services/investmentService';
import EmailLinkModal from './EmailLinkModal';
import styles from './CustomerManager.module.scss';

interface CustomerDetailModalProps {
    customer: Customer | null;
    open: boolean;
    onClose: () => void;
}

const CustomerDetailModal: React.FC<CustomerDetailModalProps> = ({ customer, open, onClose }) => {
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [totalInvoices, setTotalInvoices] = useState(0);
    const [activeTab, setActiveTab] = useState<'invoices' | 'emails'>('invoices');
    const [emails, setEmails] = useState<CustomerEmailLink[]>([]);
    const [emailsLoading, setEmailsLoading] = useState(false);
    const [unlinking, setUnlinking] = useState<number | null>(null);
    const [showLinkModal, setShowLinkModal] = useState(false);
    const contentRef = useRef<HTMLDivElement>(null);

    // Email viewer state
    const [viewingEmail, setViewingEmail] = useState<CustomerEmailLink | null>(null);
    const [emailBodyHtml, setEmailBodyHtml] = useState<string | null>(null);
    const [emailBodyText, setEmailBodyText] = useState<string | null>(null);
    const [bodyLoading, setBodyLoading] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const emailViewerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (open && customer) {
            loadInvoices();
            loadEmails();
            setActiveTab('invoices');
        } else {
            setInvoices([]);
            setTotalInvoices(0);
            setEmails([]);
            setViewingEmail(null);
        }
    }, [open, customer]);

    // Auto-resize iframe when HTML body loads
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe || !emailBodyHtml) return;

        const handleLoad = () => {
            try {
                const doc = iframe.contentDocument;
                if (doc?.body) {
                    iframe.style.height = doc.body.scrollHeight + 20 + 'px';
                }
            } catch {
                // cross-origin restriction — ignore
            }
        };

        iframe.addEventListener('load', handleLoad);
        return () => iframe.removeEventListener('load', handleLoad);
    }, [emailBodyHtml]);

    const loadInvoices = async () => {
        if (!customer) return;
        try {
            setLoading(true);
            const result = await fetchAllInvoices(1, 50, undefined, undefined, undefined, undefined, customer.id);
            setInvoices(result.invoices);
            setTotalInvoices(result.total_count);
        } catch (error) {
            console.error('Error loading customer invoices:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadEmails = async () => {
        if (!customer) return;
        try {
            setEmailsLoading(true);
            const result = await fetchCustomerEmails(customer.id);
            setEmails(result);
        } catch (error) {
            console.error('Error loading customer emails:', error);
        } finally {
            setEmailsLoading(false);
        }
    };

    const handleUnlink = async (emailId: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!customer) return;
        try {
            setUnlinking(emailId);
            await unlinkEmailFromCustomer(customer.id, emailId);
            setEmails(prev => prev.filter(e => e.email_id !== emailId));
        } catch (error) {
            console.error('Error unlinking email:', error);
        } finally {
            setUnlinking(null);
        }
    };

    const handleViewEmail = useCallback(async (link: CustomerEmailLink) => {
        if (!link.email?.gmail_id) return;
        setViewingEmail(link);
        setEmailBodyHtml(null);
        setEmailBodyText(null);
        setBodyLoading(true);
        try {
            const data = await fetchEmailBody(link.email.gmail_id);
            setEmailBodyHtml(data.body_html);
            setEmailBodyText(data.body_text);
        } catch {
            setEmailBodyText('Failed to load email body.');
        } finally {
            setBodyLoading(false);
        }
    }, []);

    const closeEmailViewer = () => {
        setViewingEmail(null);
        setEmailBodyHtml(null);
        setEmailBodyText(null);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
            onClose();
        }
    };

    const handleEmailViewerBackdropClick = (e: React.MouseEvent) => {
        if (emailViewerRef.current && !emailViewerRef.current.contains(e.target as Node)) {
            closeEmailViewer();
        }
    };

    if (!open || !customer) return null;

    const getInitials = (name: string) =>
        name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const currencySymbol: Record<string, string> = { USD: '$', INR: '\u20B9', GBP: '\u00A3', EUR: '\u20AC', AUD: 'A$' };

    const formatCurrency = (amount: number, currency: string) =>
        `${currencySymbol[currency] || currency + ' '}${amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    return createPortal(
        <div className={styles.detailModal} onClick={handleBackdropClick}>
            <div className={styles.detailModalContent} ref={contentRef}>
                {/* Header */}
                <div className={styles.detailHeader}>
                    <div className={styles.customerAvatar}>{getInitials(customer.name)}</div>
                    <div className={styles.detailHeaderInfo}>
                        <h3>{customer.name}</h3>
                        {customer.company && <div className={styles.detailCompany}>{customer.company}</div>}
                    </div>
                    <button className={styles.detailCloseBtn} onClick={onClose}>&times;</button>
                </div>

                {/* Body */}
                <div className={styles.detailBody}>
                    {/* Contact Info */}
                    <div className={styles.detailContactGrid}>
                        <div className={styles.detailContactItem}>
                            <span className={styles.contactLabel}>Email</span>
                            <span className={styles.contactValue}>{customer.email || '—'}</span>
                        </div>
                        <div className={styles.detailContactItem}>
                            <span className={styles.contactLabel}>Phone</span>
                            <span className={styles.contactValue}>{customer.phone || '—'}</span>
                        </div>
                        <div className={styles.detailContactItem}>
                            <span className={styles.contactLabel}>Address</span>
                            <span className={styles.contactValue}>{customer.address || '—'}</span>
                        </div>
                        <div className={styles.detailContactItem}>
                            <span className={styles.contactLabel}>Since</span>
                            <span className={styles.contactValue}>{new Date(customer.createdAt).toLocaleDateString()}</span>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className={styles.detailStatsBar}>
                        <div className={`${styles.detailStat} ${styles.green}`}>
                            <div className={styles.statValue}>
                                {'\u20B9'}{customer.totalEarnings.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </div>
                            <div className={styles.statLabel}>Total Earnings</div>
                        </div>
                        <div className={styles.detailStat}>
                            <div className={styles.statValue}>{customer.projectCount}</div>
                            <div className={styles.statLabel}>Projects</div>
                        </div>
                        <div className={styles.detailStat}>
                            <div className={styles.statValue}>{totalInvoices}</div>
                            <div className={styles.statLabel}>Invoices</div>
                        </div>
                        {customer.lastInvoiceDate && (
                            <div className={styles.detailStat}>
                                <div className={styles.statValue} style={{ fontSize: '1rem' }}>
                                    {new Date(customer.lastInvoiceDate).toLocaleDateString()}
                                </div>
                                <div className={styles.statLabel}>Last Invoice</div>
                            </div>
                        )}
                    </div>

                    {/* Tab Switcher */}
                    <div className={styles.detailTabBar}>
                        <button
                            className={`${styles.detailTab} ${activeTab === 'invoices' ? styles.activeDetailTab : ''}`}
                            onClick={() => setActiveTab('invoices')}
                        >
                            Invoices ({totalInvoices})
                        </button>
                        <button
                            className={`${styles.detailTab} ${activeTab === 'emails' ? styles.activeDetailTab : ''}`}
                            onClick={() => setActiveTab('emails')}
                        >
                            Emails ({emails.length})
                        </button>
                    </div>

                    {/* Invoice History */}
                    {activeTab === 'invoices' && (
                        <div className={styles.detailInvoiceSection}>
                            {loading ? (
                                <div className={styles.detailLoading}>Loading invoices...</div>
                            ) : invoices.length === 0 ? (
                                <div className={styles.detailEmpty}>No invoices found for this customer.</div>
                            ) : (
                                <div className={styles.detailInvoiceTableWrapper}>
                                    <table className={styles.detailInvoiceTable}>
                                        <thead>
                                            <tr>
                                                <th>Invoice #</th>
                                                <th>Project</th>
                                                <th>Date</th>
                                                <th>Amount</th>
                                                <th>Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {invoices.map(inv => (
                                                <tr key={inv.invoiceNumber}>
                                                    <td>{inv.invoiceNumber}</td>
                                                    <td>{inv.projectName}</td>
                                                    <td>{new Date(inv.issueDate).toLocaleDateString()}</td>
                                                    <td>{formatCurrency(inv.total, inv.currency)}</td>
                                                    <td>
                                                        <span className={`${styles.statusBadge} ${inv.status ? styles[inv.status] : ''}`}>
                                                            {inv.status || 'draft'}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Emails Tab */}
                    {activeTab === 'emails' && (
                        <div className={styles.detailInvoiceSection}>
                            <div className={styles.emailTabHeader}>
                                <button
                                    className={styles.linkEmailBtn}
                                    onClick={() => setShowLinkModal(true)}
                                >
                                    + Link Email
                                </button>
                            </div>

                            {emailsLoading ? (
                                <div className={styles.detailLoading}>Loading emails...</div>
                            ) : emails.length === 0 ? (
                                <div className={styles.detailEmpty}>No emails linked to this customer yet.</div>
                            ) : (
                                <div className={styles.emailList}>
                                    {emails.map(link => (
                                        <div
                                            key={link.id}
                                            className={styles.emailCard}
                                            style={{ cursor: link.email?.gmail_id ? 'pointer' : 'default' }}
                                            onClick={() => link.email?.gmail_id && handleViewEmail(link)}
                                        >
                                            <div className={styles.emailCardInfo}>
                                                <div className={styles.emailCardSubject}>
                                                    {link.email?.subject || '(No subject)'}
                                                </div>
                                                <div className={styles.emailCardMeta}>
                                                    <span>{link.email?.sender}</span>
                                                    {link.email?.received_date && (
                                                        <span>{new Date(link.email.received_date).toLocaleDateString()}</span>
                                                    )}
                                                    {link.email?.category && (
                                                        <span className={styles.emailCategoryBadge}>
                                                            {link.email.category.replace(/_/g, ' ')}
                                                        </span>
                                                    )}
                                                    <span className={`${styles.linkedByBadge} ${styles[link.linked_by]}`}>
                                                        {link.linked_by}
                                                    </span>
                                                </div>
                                            </div>
                                            <button
                                                className={styles.unlinkBtn}
                                                onClick={(e) => handleUnlink(link.email_id, e)}
                                                disabled={unlinking === link.email_id}
                                                title="Unlink email"
                                            >
                                                {unlinking === link.email_id ? '...' : '\u00D7'}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Email Link Modal */}
            {showLinkModal && (
                <EmailLinkModal
                    customerId={customer.id}
                    open={showLinkModal}
                    onClose={() => setShowLinkModal(false)}
                    onLinked={() => loadEmails()}
                />
            )}

            {/* Email Viewer Modal */}
            {viewingEmail && (
                <div className={styles.emailViewerOverlay} onClick={handleEmailViewerBackdropClick}>
                    <div className={styles.emailViewerContent} ref={emailViewerRef}>
                        <div className={styles.emailViewerHeader}>
                            <span>{viewingEmail.email?.subject || 'Email Details'}</span>
                            <button onClick={closeEmailViewer}>&times;</button>
                        </div>
                        <div className={styles.emailViewerBody}>
                            <div className={styles.emailMetaRow}>
                                <span className={styles.emailMetaKey}>From</span>
                                <span>{viewingEmail.email?.sender}</span>
                            </div>
                            <div className={styles.emailMetaRow}>
                                <span className={styles.emailMetaKey}>Date</span>
                                <span>
                                    {viewingEmail.email?.received_date
                                        ? new Date(viewingEmail.email.received_date).toLocaleString()
                                        : '—'}
                                </span>
                            </div>
                            {viewingEmail.email?.category && (
                                <div className={styles.emailMetaRow}>
                                    <span className={styles.emailMetaKey}>Category</span>
                                    <span className={styles.emailCategoryBadge}>
                                        {viewingEmail.email.category.replace(/_/g, ' ')}
                                    </span>
                                </div>
                            )}
                            <div className={styles.emailBodyArea}>
                                {bodyLoading ? (
                                    <div className={styles.emailBodyLoader}>Loading email...</div>
                                ) : emailBodyHtml ? (
                                    <iframe
                                        ref={iframeRef}
                                        srcDoc={emailBodyHtml}
                                        className={styles.emailIframe}
                                        sandbox="allow-same-origin"
                                        title="Email content"
                                    />
                                ) : emailBodyText ? (
                                    <pre className={styles.emailTextPre}>{emailBodyText}</pre>
                                ) : (
                                    <div className={styles.emailBodyLoader}>No email content available.</div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>,
        document.body
    );
};

export default CustomerDetailModal;
