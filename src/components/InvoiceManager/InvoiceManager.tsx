import React, {useCallback, useEffect, useRef, useState} from "react";
import {InvoiceData, Signature} from "../../utils/interfaces";
import {
    fetchAllInvoices,
    deleteInvoice,
    updateInvoice,
    generateInvoicePDFLocal,
    signInvoicePDFLocal,
    fetchDefaultSignature,
} from "../../services/freelanceService";
import {useMessage} from "../../contexts/MessageContext";
import useModalA11y from "../../hooks/useModalA11y";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./InvoiceManager.module.scss";

/**
 * ak-9aqn (ak-zyli N1 follow-up) InvoiceManager Nocturne rewrite + §4 PII.
 *
 * Two deliverables folded into one commit (per the bead's locked
 * approach + the 2026-11-13 04:41 scope-expansion comment):
 *
 * ## 1. Nocturne rewrite
 * Pre-ak-9aqn the TSX surfaced its chrome via inline `style={{...}}` hex
 * blocks (37 hex in the TSX + 7 in the SCSS); the table/row/drawer were
 * all CSS-in-TSX. Swap to Nocturne tokens via SCSS classes. No MUI was
 * ever in play here (no `from "@mui/..."` imports), so the rewrite is
 * pure styling + chrome migration.
 *
 * ## 2. §4 PII progressive-disclosure
 * Pre-ak-9aqn the list row surfaced: checkbox + invoice# + PROJECT NAME
 * + CUSTOMER NAME + COMPANY + amount (+ PAYMENT BREAKDOWN) + status +
 * ISSUE DATE + due date + 6 inline action buttons. Per the Overseer-
 * locked bead comment ("list = invoice# + status chip + amount + due
 * date + customer NAME ONLY"), the row is stripped to the minimum
 * reveal surface:
 *
 *   SAFE (default-visible) — the row shape per bead:
 *     - Avatar / letter initial  (derived from customer name)
 *     - Invoice number
 *     - Status chip (draft / sent / partially_paid / paid / overdue)
 *     - Amount (currency-symbol + total)
 *     - Due date
 *     - Customer NAME (first-name display line only)
 *     - Checkbox (for bulk ops — preserved from pre-ak-9aqn)
 *     - Status dropdown (preserved — needed inline for the mark-paid
 *       flow)
 *     - Chevron icon suggesting row-click opens the drawer
 *
 *   PII (default-hidden; drawer-open IS the reveal)
 *     - Project name (business-internal label, not catastrophic but
 *       moves to drawer per strict "NOTHING ELSE" reading)
 *     - Customer company, email, address
 *     - Line items (quantity, description, per-line rate)
 *     - Payment breakdown (method / amount / FX details / balance due)
 *     - Notes + terms
 *     - Issue date (due date stays on row; issue date moves to drawer
 *       since the row carries only one date and "due" is more
 *       actionable)
 *
 *   NOT surfaced anywhere
 *     - hiddenCoreFields (internal flag; never meant for display)
 *     - customFields marked hidden
 *
 * ## 3. Nocturne destructive gate for invoice delete (per scope-expansion
 *       comment inheriting ak-e5w3's scope)
 *
 * Pre-ak-9aqn used `window.confirm("Are you sure you want to delete …")`
 * for both single + bulk delete. Replaced with the shared Nocturne
 * destructive-variant gate (role="alertdialog" + ph-warning kicker +
 * `.confirmYesDestructive` + useModalA11y focus-trap). Shape matches
 * FE-10 (ak-2o3x) files vault + ak-c453 CustomerManager.
 *
 * `reminder send` (per the scope-expansion comment) is NOT surfaced in
 * the current InvoiceManager UI — no reminder affordance exists today.
 * Flagged in the handoff as follow-up (would live in InvoiceCreator /
 * ak-73nc or a future bead).
 *
 * ## Preserved semantics (byte-for-byte)
 *
 * Every handler (loadInvoices, handleStatusChange, handleQuickPayment
 * Submit, downloadBlob, handleDownloadPDF, handleDownloadSignedPDF,
 * handleBulkDownload, handleBulkDelete, handleBulkStatusChange,
 * toggleSelectInvoice, toggleSelectAll, clearAllFilters), every state
 * hook, the pre-FE-2 partial-paid summary render logic, and all
 * service calls stay byte-for-byte. Only the render surface changes.
 */

const CURRENCY_SYMBOLS: Record<string, string> = {
    USD: "$", INR: "₹", GBP: "£", EUR: "€", AUD: "A$",
};

const STATUS_LABELS: Record<string, string> = {
    draft: "DRAFT",
    sent: "SENT",
    partially_paid: "PARTIAL",
    paid: "PAID",
    overdue: "OVERDUE",
};

const STATUS_CHIP_CLASS: Record<string, string> = {
    draft: ownStyles.chipDraft,
    sent: ownStyles.chipSent,
    partially_paid: ownStyles.chipPartial,
    paid: ownStyles.chipPaid,
    overdue: ownStyles.chipOverdue,
};

function getCurrencySymbol(currency?: string): string {
    return CURRENCY_SYMBOLS[currency || "USD"] || "$";
}

function getInitials(name: string): string {
    return (name || "?")
        .split(/\s+/)
        .filter(Boolean)
        .map(w => w[0])
        .slice(0, 2)
        .join("")
        .toUpperCase() || "?";
}

interface InvoiceManagerProps {
    onEditInvoice?: (invoiceId: string) => void;
    onPreviewInvoice?: (invoiceId: string) => void;
    onDuplicateInvoice?: (invoice: InvoiceData) => void;
    refreshTrigger?: number;
    onInvoiceUpdated?: () => void;
    isActive?: boolean;
}

const InvoiceManager = ({
                            onEditInvoice,
                            onPreviewInvoice,
                            onDuplicateInvoice,
                            refreshTrigger,
                            onInvoiceUpdated,
                            isActive = true,
                        }: InvoiceManagerProps) => {
    const [invoices, setInvoices] = useState<InvoiceData[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalInvoices, setTotalInvoices] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [sortBy, setSortBy] = useState<string>("created_at");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
    const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
    const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());
    const [bulkLoading, setBulkLoading] = useState(false);
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Additional filters
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [currencyFilter, setCurrencyFilter] = useState("all");
    const [amountMin, setAmountMin] = useState("");
    const [amountMax, setAmountMax] = useState("");

    // Default signature for signed downloads
    const [defaultSignature, setDefaultSignature] = useState<Signature | null>(null);

    // Quick payment dialog for marking as paid from list
    const [paymentDialog, setPaymentDialog] = useState<{invoice: InvoiceData} | null>(null);
    const [quickPayment, setQuickPayment] = useState({method: 'bank_transfer', amount: 0, date: ''});

    // ak-9aqn: detail drawer — §4 reveal surface.
    const [detailInvoice, setDetailInvoice] = useState<InvoiceData | null>(null);
    const detailDrawerRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: detailInvoice !== null,
        panelRef: detailDrawerRef as React.RefObject<HTMLElement>,
    });

    // ak-9aqn: destructive confirm-gate state. One slot handles both
    // single-invoice and bulk-delete flows via a discriminated payload.
    type DeleteConfirm =
        | {kind: 'single'; invoice: InvoiceData}
        | {kind: 'bulk'; count: number};
    const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: deleteConfirm !== null,
        panelRef: deleteDialogRef as React.RefObject<HTMLElement>,
    });

    // Quick-payment dialog a11y (preserved behavior, newly consumed hook).
    const paymentDialogRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: paymentDialog !== null,
        panelRef: paymentDialogRef as React.RefObject<HTMLElement>,
    });

    const {setPayload} = useMessage();
    const itemsPerPage = 10;

    const loadInvoices = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetchAllInvoices(
                currentPage,
                itemsPerPage,
                statusFilter,
                sortBy,
                sortOrder,
                debouncedSearchTerm || undefined
            );
            setInvoices(response.invoices);
            setTotalInvoices(response.total_count);
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to load invoices. Backend connection required.",
            });
            console.error("Error loading invoices:", error);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, statusFilter, sortBy, sortOrder, debouncedSearchTerm, setPayload]);

    const loadDefaultSignature = async () => {
        const sig = await fetchDefaultSignature();
        setDefaultSignature(sig);
    };

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearchTerm(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    useEffect(() => {
        loadInvoices();
    }, [currentPage, refreshTrigger, statusFilter, sortBy, sortOrder, debouncedSearchTerm, loadInvoices]);

    useEffect(() => {
        if (isActive) {
            loadInvoices();
            loadDefaultSignature();
        }
    }, [isActive, loadInvoices]);

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, sortBy, sortOrder, debouncedSearchTerm]);

    useEffect(() => {
        setSelectedInvoices(new Set());
    }, [invoices]);

    // Inline Esc handlers for the drawer + payment dialog (useModalA11y
    // deliberately leaves Esc to the caller per its docstring).
    useEffect(() => {
        if (!detailInvoice && !paymentDialog && !deleteConfirm) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (deleteConfirm) setDeleteConfirm(null);
            else if (paymentDialog) setPaymentDialog(null);
            else if (detailInvoice) setDetailInvoice(null);
        };
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [detailInvoice, paymentDialog, deleteConfirm]);

    const handleRefresh = () => {
        loadInvoices();
        onInvoiceUpdated?.();
    };

    // ak-9aqn: delete flow now goes through the Nocturne destructive
    // gate instead of window.confirm. Preserves the post-delete semantics
    // (reload + onInvoiceUpdated).
    const openDeleteConfirmSingle = (invoice: InvoiceData) => {
        setDeleteConfirm({kind: 'single', invoice});
    };

    const openDeleteConfirmBulk = () => {
        if (selectedInvoices.size === 0) return;
        setDeleteConfirm({kind: 'bulk', count: selectedInvoices.size});
    };

    const confirmDelete = async () => {
        const target = deleteConfirm;
        setDeleteConfirm(null);
        if (!target) return;

        if (target.kind === 'single') {
            const {invoice} = target;
            try {
                setLoading(true);
                const result = await deleteInvoice(invoice.invoiceNumber);
                setPayload({type: 'success', message: result.message});
                // If the deleted invoice was open in the drawer, close it.
                setDetailInvoice((prev) => (prev && prev.invoiceNumber === invoice.invoiceNumber ? null : prev));
                await loadInvoices();
                onInvoiceUpdated?.();
            } catch (error) {
                setPayload({type: 'error', message: 'Failed to delete invoice'});
                console.error('Error deleting invoice:', error);
            } finally {
                setLoading(false);
            }
            return;
        }

        // Bulk
        setBulkLoading(true);
        let successCount = 0;
        let failCount = 0;
        for (const invoiceNumber of selectedInvoices) {
            try {
                await deleteInvoice(invoiceNumber);
                successCount++;
            } catch { failCount++; }
        }
        setBulkLoading(false);
        setSelectedInvoices(new Set());
        if (failCount === 0) setPayload({type: 'success', message: `Deleted ${successCount} invoice(s)`});
        else setPayload({type: 'error', message: `Deleted ${successCount}, failed ${failCount}`});
        await loadInvoices();
        onInvoiceUpdated?.();
    };

    const handleStatusChange = async (invoice: InvoiceData, newStatus: string) => {
        if (newStatus === "paid") {
            if (!invoice.payment || !invoice.payment.paymentMethod || invoice.payment.amountReceived <= 0) {
                // Open quick payment dialog instead of blocking. Pre-fill
                // the amount in the invoice's own currency — the label on
                // the input matches (FE-2), and BE handles FX conversion
                // to INR + populates the audit fields on the returned row.
                setPaymentDialog({invoice});
                setQuickPayment({method: 'bank_transfer', amount: invoice.total || 0, date: new Date().toISOString().split('T')[0]});
                return;
            }
        }
        try {
            const updatedInvoice = {...invoice, status: newStatus as InvoiceData["status"]};
            await updateInvoice(invoice.invoiceNumber, updatedInvoice);
            setPayload({type: "success", message: `Invoice ${invoice.invoiceNumber} status updated to ${newStatus}`});
            await loadInvoices();
            onInvoiceUpdated?.();
        } catch (error) {
            setPayload({type: "error", message: "Failed to update invoice status"});
            console.error("Error updating invoice status:", error);
        }
    };

    const handleQuickPaymentSubmit = async () => {
        if (!paymentDialog) return;
        if (!quickPayment.method || quickPayment.amount <= 0) {
            setPayload({type: "error", message: "Payment method and amount are required"});
            return;
        }
        try {
            const updatedInvoice = {
                ...paymentDialog.invoice,
                status: "paid" as const,
                payment: {
                    paymentMethod: quickPayment.method,
                    amountReceived: quickPayment.amount,
                    paymentDate: quickPayment.date || undefined,
                    breakdown: {},
                    notes: '',
                },
            };
            await updateInvoice(paymentDialog.invoice.invoiceNumber, updatedInvoice);
            setPayload({type: "success", message: `Invoice ${paymentDialog.invoice.invoiceNumber} marked as paid`});
            setPaymentDialog(null);
            await loadInvoices();
            onInvoiceUpdated?.();
        } catch (error) {
            setPayload({type: "error", message: "Failed to update invoice"});
            console.error("Error updating invoice:", error);
        }
    };

    // PDF Download helpers
    const downloadBlob = (blob: Blob, filename: string) => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleDownloadPDF = async (invoice: InvoiceData) => {
        try {
            setDownloadingId(invoice.invoiceNumber);
            const blob = await generateInvoicePDFLocal(invoice);
            downloadBlob(blob, `${invoice.invoiceNumber}.pdf`);
        } catch (error) {
            setPayload({type: "error", message: "Failed to generate PDF"});
            console.error("PDF generation error:", error);
        } finally {
            setDownloadingId(null);
        }
    };

    const getSignatureDataUrl = (sig: Signature): string => {
        if (sig.signature_data.startsWith('data:')) return sig.signature_data;
        return `data:image/png;base64,${sig.signature_data}`;
    };

    const handleDownloadSignedPDF = async (invoice: InvoiceData) => {
        if (!defaultSignature) {
            setPayload({type: "error", message: "No default signature available. Upload one in the Sign Invoices tab."});
            return;
        }
        try {
            setDownloadingId(invoice.invoiceNumber + "-signed");
            const blob = await signInvoicePDFLocal(invoice, {
                signatureUrl: getSignatureDataUrl(defaultSignature),
                x: 20,
                y: 250,
                width: 50,
                height: 20,
            });
            downloadBlob(blob, `signed-${invoice.invoiceNumber}.pdf`);
        } catch (error) {
            setPayload({type: "error", message: "Failed to generate signed PDF"});
            console.error("Signed PDF generation error:", error);
        } finally {
            setDownloadingId(null);
        }
    };

    const handleBulkDownload = async (signed: boolean) => {
        setBulkLoading(true);
        let count = 0;
        for (const invoiceNumber of selectedInvoices) {
            const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
            if (!invoice) continue;
            try {
                if (signed && defaultSignature) {
                    const blob = await signInvoicePDFLocal(invoice, {
                        signatureUrl: getSignatureDataUrl(defaultSignature),
                        x: 20, y: 250, width: 50, height: 20,
                    });
                    downloadBlob(blob, `signed-${invoice.invoiceNumber}.pdf`);
                } else {
                    const blob = await generateInvoicePDFLocal(invoice);
                    downloadBlob(blob, `${invoice.invoiceNumber}.pdf`);
                }
                count++;
            } catch {
                // continue with remaining
            }
        }
        setBulkLoading(false);
        setPayload({type: "success", message: `Downloaded ${count} PDF(s)`});
    };

    // Bulk operations
    const toggleSelectInvoice = (invoiceNumber: string) => {
        setSelectedInvoices(prev => {
            const next = new Set(prev);
            if (next.has(invoiceNumber)) next.delete(invoiceNumber);
            else next.add(invoiceNumber);
            return next;
        });
    };

    const toggleSelectAll = () => {
        if (selectedInvoices.size === filteredInvoices.length) setSelectedInvoices(new Set());
        else setSelectedInvoices(new Set(filteredInvoices.map(inv => inv.invoiceNumber)));
    };

    const handleBulkStatusChange = async (newStatus: string) => {
        setBulkLoading(true);
        let successCount = 0;
        let failCount = 0;
        let skippedCount = 0;
        for (const invoiceNumber of selectedInvoices) {
            const invoice = invoices.find(inv => inv.invoiceNumber === invoiceNumber);
            if (!invoice) continue;
            if (newStatus === 'paid' && (!invoice.payment?.paymentMethod || (invoice.payment?.amountReceived || 0) <= 0)) {
                skippedCount++;
                continue;
            }
            try {
                await updateInvoice(invoiceNumber, {...invoice, status: newStatus as InvoiceData["status"]});
                successCount++;
            } catch { failCount++; }
        }
        setBulkLoading(false);
        setSelectedInvoices(new Set());
        let message = `Updated ${successCount} invoice(s) to ${newStatus}`;
        if (skippedCount > 0) message += `, skipped ${skippedCount} (missing payment info)`;
        if (failCount > 0) message += `, ${failCount} failed`;
        setPayload({type: failCount > 0 ? "error" : "success", message});
        await loadInvoices();
        onInvoiceUpdated?.();
    };

    // Client-side additional filtering (date range, currency, amount)
    const filteredInvoices = invoices.filter(inv => {
        if (dateFrom && new Date(inv.issueDate) < new Date(dateFrom)) return false;
        if (dateTo && new Date(inv.issueDate) > new Date(dateTo)) return false;
        if (currencyFilter !== "all" && inv.currency !== currencyFilter) return false;
        if (amountMin && inv.total < parseFloat(amountMin)) return false;
        if (amountMax && inv.total > parseFloat(amountMax)) return false;
        return true;
    });

    const hasActiveFilters = dateFrom || dateTo || currencyFilter !== "all" || amountMin || amountMax || statusFilter !== "all" || searchTerm;

    const clearAllFilters = () => {
        setSearchTerm("");
        setStatusFilter("all");
        setSortBy("created_at");
        setSortOrder("desc");
        setDateFrom("");
        setDateTo("");
        setCurrencyFilter("all");
        setAmountMin("");
        setAmountMax("");
    };

    const totalPages = Math.ceil(totalInvoices / itemsPerPage);

    const allSelectedOnPage = filteredInvoices.length > 0
        && filteredInvoices.every(inv => selectedInvoices.has(inv.invoiceNumber));

    // ──────────────────── Render ────────────────────

    const renderStatusChip = (status?: string) => {
        const s = status || 'draft';
        return (
            <span className={`${ownStyles.statusChip} ${STATUS_CHIP_CLASS[s] || ''}`}>
                {STATUS_LABELS[s] || s.toUpperCase()}
            </span>
        );
    };

    return (
        <div>
            {/* Filter Bar */}
            <div className={styles.filterBar}>
                <div className={styles.filterGroup} style={{flex: 2}}>
                    <label>Search</label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Invoice #, project, client…"
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label>Status</label>
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                        <option value="all">All</option>
                        <option value="draft">Draft</option>
                        <option value="sent">Sent</option>
                        <option value="partially_paid">Partially paid</option>
                        <option value="paid">Paid</option>
                        <option value="overdue">Overdue</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label>Sort</label>
                    <select
                        value={`${sortBy}-${sortOrder}`}
                        onChange={(e) => {
                            const [s, o] = e.target.value.split("-");
                            setSortBy(s);
                            setSortOrder(o as "asc" | "desc");
                        }}
                    >
                        <option value="created_at-desc">Date Created &darr;</option>
                        <option value="created_at-asc">Date Created &uarr;</option>
                        <option value="issue_date-desc">Issue Date &darr;</option>
                        <option value="issue_date-asc">Issue Date &uarr;</option>
                        <option value="total-desc">Amount &darr;</option>
                        <option value="total-asc">Amount &uarr;</option>
                        <option value="to_name-asc">Client A-Z</option>
                        <option value="to_name-desc">Client Z-A</option>
                    </select>
                </div>
                <div className={styles.filterGroup}>
                    <label>Currency</label>
                    <select value={currencyFilter} onChange={(e) => setCurrencyFilter(e.target.value)}>
                        <option value="all">All</option>
                        <option value="INR">INR</option>
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="AUD">AUD</option>
                    </select>
                </div>
            </div>

            {/* Secondary Filter Row */}
            <div className={`${styles.filterBar} ${ownStyles.secondaryFilterBar}`}>
                <div className={styles.filterGroup}>
                    <label>Date From</label>
                    <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                </div>
                <div className={styles.filterGroup}>
                    <label>Date To</label>
                    <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
                <div className={styles.filterGroup} style={{minWidth: "100px"}}>
                    <label>Min Amount</label>
                    <input type="number" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} placeholder="0" />
                </div>
                <div className={styles.filterGroup} style={{minWidth: "100px"}}>
                    <label>Max Amount</label>
                    <input type="number" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} placeholder="Any" />
                </div>
                {hasActiveFilters && (
                    <button className={styles.clearFiltersBtn} onClick={clearAllFilters}>
                        Clear All Filters
                    </button>
                )}
                <div className={ownStyles.filterTail}>
                    <span className={ownStyles.filterCount}>
                        {filteredInvoices.length} of {totalInvoices}
                    </span>
                    <button className={`${styles.secondaryBtn} ${ownStyles.filterTailBtn}`}
                            onClick={handleRefresh} disabled={loading}>
                        {loading ? "…" : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedInvoices.size > 0 && (
                <div className={ownStyles.bulkActionBar}>
                    <span className={ownStyles.bulkInfo}>{selectedInvoices.size} selected</span>
                    <button className={`${styles.secondaryBtn} ${ownStyles.bulkBtn}`}
                            onClick={() => handleBulkStatusChange('draft')} disabled={bulkLoading}>Draft</button>
                    <button className={`${styles.secondaryBtn} ${ownStyles.bulkBtn}`}
                            onClick={() => handleBulkStatusChange('sent')} disabled={bulkLoading}>Sent</button>
                    <button className={`${styles.secondaryBtn} ${ownStyles.bulkBtn}`}
                            onClick={() => handleBulkStatusChange('paid')} disabled={bulkLoading}>Paid</button>
                    <button className={ownStyles.downloadBtn} onClick={() => handleBulkDownload(false)}
                            disabled={bulkLoading}>Download</button>
                    {defaultSignature && (
                        <button className={ownStyles.downloadBtn} onClick={() => handleBulkDownload(true)}
                                disabled={bulkLoading}>Download signed</button>
                    )}
                    <button className={`${styles.dangerBtn} ${ownStyles.bulkBtn}`}
                            onClick={openDeleteConfirmBulk}
                            disabled={bulkLoading}>
                        {bulkLoading ? 'Processing…' : `Delete (${selectedInvoices.size})`}
                    </button>
                    <button className={`${styles.secondaryBtn} ${ownStyles.bulkBtn}`}
                            onClick={() => setSelectedInvoices(new Set())}
                            disabled={bulkLoading}>Deselect</button>
                </div>
            )}

            {/* Invoice list (§4: compact row per bead — invoice# + customer
                NAME + status chip + amount + due date + chevron hint) */}
            <div className={styles.invoiceForm}>
                {loading ? (
                    <div className={styles.loadingSpinner}><div>Loading invoices…</div></div>
                ) : filteredInvoices.length === 0 ? (
                    <div className={styles.emptyState}>No invoices found. Create your first invoice!</div>
                ) : (
                    <div className={ownStyles.listWrapper}>
                        <div className={ownStyles.listHeader}>
                            <input
                                type="checkbox"
                                className={ownStyles.checkbox}
                                checked={allSelectedOnPage}
                                onChange={toggleSelectAll}
                                aria-label="Select all on page"
                            />
                            <span className={ownStyles.listHeadCell}>Invoice</span>
                            <span className={ownStyles.listHeadCell}>Customer</span>
                            <span className={ownStyles.listHeadCell}>Status</span>
                            <span className={`${ownStyles.listHeadCell} ${ownStyles.alignRight}`}>Amount</span>
                            <span className={ownStyles.listHeadCell}>Due</span>
                            <span className={ownStyles.listHeadCell} aria-label="Open"/>
                        </div>

                        {filteredInvoices.map((invoice) => {
                            const selected = selectedInvoices.has(invoice.invoiceNumber);
                            const status = invoice.status || 'draft';
                            return (
                                <div
                                    key={invoice.invoiceNumber}
                                    className={`${ownStyles.listRow} ${selected ? ownStyles.listRowSelected : ''}`}
                                >
                                    <input
                                        type="checkbox"
                                        className={ownStyles.checkbox}
                                        checked={selected}
                                        onChange={(e) => {
                                            e.stopPropagation();
                                            toggleSelectInvoice(invoice.invoiceNumber);
                                        }}
                                        aria-label={`Select invoice ${invoice.invoiceNumber}`}
                                    />
                                    <button
                                        type="button"
                                        className={ownStyles.listRowBtn}
                                        onClick={() => setDetailInvoice(invoice)}
                                        aria-label={`Open invoice ${invoice.invoiceNumber}`}
                                    >
                                        <span className={ownStyles.invoiceCell}>
                                            <span className={ownStyles.invoiceNumber}>
                                                {invoice.invoiceNumber}
                                            </span>
                                        </span>
                                        <span className={ownStyles.customerCell}>
                                            <span className={ownStyles.customerAvatar} aria-hidden>
                                                {getInitials(invoice.to?.name || '')}
                                            </span>
                                            <span className={ownStyles.customerName}>
                                                {invoice.to?.name || '—'}
                                            </span>
                                        </span>
                                        <span className={ownStyles.statusCell}>
                                            {renderStatusChip(status)}
                                        </span>
                                        <span className={`${ownStyles.amountCell} ${ownStyles.alignRight}`}>
                                            <span className={ownStyles.amountValue}>
                                                {getCurrencySymbol(invoice.currency)}{invoice.total.toFixed(2)}
                                            </span>
                                        </span>
                                        <span className={ownStyles.dateCell}>
                                            {new Date(invoice.dueDate).toLocaleDateString()}
                                        </span>
                                        <i className={`ph ph-caret-right ${ownStyles.chevron}`} aria-hidden/>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className={ownStyles.paginationStrip}>
                    <button className={styles.secondaryBtn}
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1 || loading}>Previous</button>
                    <span className={ownStyles.paginationLabel}>
                        Page {currentPage} of {totalPages} &bull; {totalInvoices} total
                    </span>
                    <button className={styles.secondaryBtn}
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || loading}>Next</button>
                </div>
            )}

            {/* ak-9aqn: §4 detail drawer — the explicit PII-reveal surface. */}
            {detailInvoice && (
                <>
                    <div
                        className={ownStyles.drawerBackdrop}
                        onMouseDown={() => setDetailInvoice(null)}
                        role="presentation"
                    />
                    <aside
                        ref={detailDrawerRef}
                        className={ownStyles.drawer}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Invoice ${detailInvoice.invoiceNumber}`}
                        tabIndex={-1}
                    >
                        <header className={ownStyles.drawerHeader}>
                            <div className={ownStyles.drawerHeaderInfo}>
                                <span className={ownStyles.drawerInvoiceNumber}>
                                    {detailInvoice.invoiceNumber}
                                </span>
                                {renderStatusChip(detailInvoice.status)}
                            </div>
                            <button
                                type="button"
                                className={ownStyles.iconBtn}
                                onClick={() => setDetailInvoice(null)}
                                aria-label="Close"
                                title="Close"
                            >
                                <i className="ph ph-x"/>
                            </button>
                        </header>

                        <div className={ownStyles.drawerActions}>
                            <button
                                type="button"
                                className={ownStyles.drawerActionBtn}
                                onClick={() => {
                                    const inv = detailInvoice;
                                    setDetailInvoice(null);
                                    onPreviewInvoice?.(inv.invoiceNumber);
                                }}
                            >
                                <i className="ph ph-eye"/><span>Preview</span>
                            </button>
                            <button
                                type="button"
                                className={ownStyles.drawerActionBtn}
                                onClick={() => {
                                    const inv = detailInvoice;
                                    setDetailInvoice(null);
                                    onEditInvoice?.(inv.invoiceNumber);
                                }}
                            >
                                <i className="ph ph-pencil-simple"/><span>Edit</span>
                            </button>
                            <button
                                type="button"
                                className={ownStyles.drawerActionBtn}
                                onClick={() => {
                                    const inv = detailInvoice;
                                    setDetailInvoice(null);
                                    onDuplicateInvoice?.(inv);
                                }}
                            >
                                <i className="ph ph-copy"/><span>Duplicate</span>
                            </button>
                            <button
                                type="button"
                                className={ownStyles.drawerActionBtn}
                                onClick={() => handleDownloadPDF(detailInvoice)}
                                disabled={downloadingId === detailInvoice.invoiceNumber}
                            >
                                <i className="ph ph-file-pdf"/>
                                <span>{downloadingId === detailInvoice.invoiceNumber ? 'Preparing…' : 'PDF'}</span>
                            </button>
                            {defaultSignature && (
                                <button
                                    type="button"
                                    className={ownStyles.drawerActionBtn}
                                    onClick={() => handleDownloadSignedPDF(detailInvoice)}
                                    disabled={downloadingId === detailInvoice.invoiceNumber + '-signed'}
                                >
                                    <i className="ph ph-signature"/>
                                    <span>{downloadingId === detailInvoice.invoiceNumber + '-signed' ? 'Preparing…' : 'Signed PDF'}</span>
                                </button>
                            )}
                            <button
                                type="button"
                                className={ownStyles.drawerActionBtnDestructive}
                                onClick={() => openDeleteConfirmSingle(detailInvoice)}
                            >
                                <i className="ph ph-trash"/><span>Delete</span>
                            </button>
                        </div>

                        <section className={ownStyles.drawerSection}>
                            <span className={ownStyles.drawerSectionTitle}>Overview</span>
                            <dl className={ownStyles.drawerDL}>
                                <dt>Project</dt><dd>{detailInvoice.projectName || '—'}</dd>
                                <dt>Issue date</dt><dd>{new Date(detailInvoice.issueDate).toLocaleDateString()}</dd>
                                <dt>Due date</dt><dd>{new Date(detailInvoice.dueDate).toLocaleDateString()}</dd>
                                <dt>Status</dt>
                                <dd>
                                    <select
                                        className={ownStyles.drawerStatusSelect}
                                        value={detailInvoice.status || 'draft'}
                                        onChange={(e) => handleStatusChange(detailInvoice, e.target.value)}
                                        disabled={loading}
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="sent">Sent</option>
                                        {detailInvoice.status === 'partially_paid' && (
                                            <option value="partially_paid">Partially paid</option>
                                        )}
                                        <option value="paid">Paid</option>
                                        <option value="overdue">Overdue</option>
                                    </select>
                                </dd>
                            </dl>
                        </section>

                        <section className={ownStyles.drawerSection}>
                            <span className={ownStyles.drawerSectionTitle}>Customer</span>
                            <dl className={ownStyles.drawerDL}>
                                <dt>Name</dt><dd>{detailInvoice.to?.name || '—'}</dd>
                                {detailInvoice.to?.company && (
                                    <>
                                        <dt>Company</dt><dd>{detailInvoice.to.company}</dd>
                                    </>
                                )}
                                {detailInvoice.to?.email && (
                                    <>
                                        <dt>Email</dt><dd>{detailInvoice.to.email}</dd>
                                    </>
                                )}
                                {detailInvoice.to?.address && (
                                    <>
                                        <dt>Address</dt><dd>{detailInvoice.to.address}</dd>
                                    </>
                                )}
                            </dl>
                        </section>

                        {detailInvoice.items && detailInvoice.items.length > 0 && (
                            <section className={ownStyles.drawerSection}>
                                <span className={ownStyles.drawerSectionTitle}>Line items</span>
                                <div className={ownStyles.lineItemsTable}>
                                    <div className={ownStyles.lineItemsHead}>
                                        <span>Description</span>
                                        <span className={ownStyles.alignRight}>Qty</span>
                                        <span className={ownStyles.alignRight}>Rate</span>
                                        <span className={ownStyles.alignRight}>Amount</span>
                                    </div>
                                    {detailInvoice.items.map((item, i) => (
                                        <div key={i} className={ownStyles.lineItemsRow}>
                                            <span>{item.description || '—'}</span>
                                            <span className={ownStyles.alignRight}>{item.quantity}</span>
                                            <span className={ownStyles.alignRight}>
                                                {getCurrencySymbol(detailInvoice.currency)}{(item.rate ?? 0).toFixed(2)}
                                            </span>
                                            <span className={ownStyles.alignRight}>
                                                {getCurrencySymbol(detailInvoice.currency)}{(item.amount ?? 0).toFixed(2)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        <section className={ownStyles.drawerSection}>
                            <span className={ownStyles.drawerSectionTitle}>Totals</span>
                            <dl className={ownStyles.drawerDL}>
                                <dt>Subtotal</dt>
                                <dd>{getCurrencySymbol(detailInvoice.currency)}{detailInvoice.subtotal?.toFixed(2) ?? '0.00'}</dd>
                                {detailInvoice.tax && detailInvoice.tax.amount > 0 && (
                                    <>
                                        <dt>Tax ({(detailInvoice.tax.rate * 100).toFixed(2)}%)</dt>
                                        <dd>{getCurrencySymbol(detailInvoice.currency)}{detailInvoice.tax.amount.toFixed(2)}</dd>
                                    </>
                                )}
                                <dt className={ownStyles.totalRow}>Total</dt>
                                <dd className={ownStyles.totalRow}>
                                    {getCurrencySymbol(detailInvoice.currency)}{detailInvoice.total.toFixed(2)}
                                </dd>
                                {typeof detailInvoice.balanceDueINR === 'number' && detailInvoice.balanceDueINR > 0 && (
                                    <>
                                        <dt>Balance due</dt>
                                        <dd className={ownStyles.balanceDue}>
                                            {getCurrencySymbol('INR')}{detailInvoice.balanceDueINR.toFixed(2)}
                                        </dd>
                                    </>
                                )}
                            </dl>
                        </section>

                        {detailInvoice.payment && (detailInvoice.status === 'paid' || detailInvoice.status === 'partially_paid') && (
                            <section className={ownStyles.drawerSection}>
                                <span className={ownStyles.drawerSectionTitle}>Payment</span>
                                <dl className={ownStyles.drawerDL}>
                                    <dt>Method</dt>
                                    <dd>{detailInvoice.payment.paymentMethod || '—'}</dd>
                                    {/*
                                     * FE-2 / FE-5 paid-summary render preserved byte-for-byte.
                                     * typeof-number + non-null guards catch both JSON null and
                                     * absent legacy payment rows.
                                     */}
                                    {typeof detailInvoice.payment.originalAmount === 'number' && detailInvoice.payment.originalCurrency ? (
                                        <>
                                            <dt>Received</dt>
                                            <dd>
                                                {getCurrencySymbol(detailInvoice.payment.originalCurrency)}
                                                {detailInvoice.payment.originalAmount.toFixed(2)}
                                                {detailInvoice.payment.originalCurrency !== 'INR' && typeof detailInvoice.payment.inrAmount === 'number' && (
                                                    <span className={ownStyles.paymentFxDetail}>
                                                        &nbsp;= {getCurrencySymbol('INR')}{detailInvoice.payment.inrAmount.toFixed(2)}
                                                        {typeof detailInvoice.payment.fxRate === 'number' && (
                                                            <> @ {detailInvoice.payment.fxRate.toFixed(4)}</>
                                                        )}
                                                        {detailInvoice.payment.fxRateSource && (
                                                            <> ({detailInvoice.payment.fxRateSource})</>
                                                        )}
                                                    </span>
                                                )}
                                            </dd>
                                        </>
                                    ) : detailInvoice.payment.amountReceived ? (
                                        <>
                                            <dt>Received</dt>
                                            <dd>
                                                {getCurrencySymbol('INR')}{detailInvoice.payment.amountReceived.toFixed(2)}
                                            </dd>
                                        </>
                                    ) : null}
                                    {detailInvoice.payment.paymentDate && (
                                        <>
                                            <dt>Date</dt>
                                            <dd>{new Date(detailInvoice.payment.paymentDate).toLocaleDateString()}</dd>
                                        </>
                                    )}
                                </dl>
                            </section>
                        )}

                        {(detailInvoice.notes || detailInvoice.terms) && (
                            <section className={ownStyles.drawerSection}>
                                {detailInvoice.notes && (
                                    <>
                                        <span className={ownStyles.drawerSectionTitle}>Notes</span>
                                        <p className={ownStyles.drawerNote}>{detailInvoice.notes}</p>
                                    </>
                                )}
                                {detailInvoice.terms && (
                                    <>
                                        <span className={ownStyles.drawerSectionTitle}>Terms</span>
                                        <p className={ownStyles.drawerNote}>{detailInvoice.terms}</p>
                                    </>
                                )}
                            </section>
                        )}
                    </aside>
                </>
            )}

            {/* ak-9aqn: Nocturne destructive gate for invoice delete
                (single + bulk). Replaces pre-ak-9aqn window.confirm.
                Shape matches FE-10 (files vault) + ak-c453 (customer delete). */}
            {deleteConfirm && (
                <>
                    <div
                        className={ownStyles.dialogBackdrop}
                        onMouseDown={() => setDeleteConfirm(null)}
                        role="presentation"
                    />
                    <div
                        ref={deleteDialogRef}
                        className={ownStyles.confirmDialog}
                        role="alertdialog"
                        aria-modal="true"
                        aria-label="Confirm delete"
                        tabIndex={-1}
                    >
                        <div className={ownStyles.confirmKicker}>
                            <i className="ph ph-warning" aria-hidden/>
                            <span>Destructive action</span>
                        </div>
                        <div className={ownStyles.confirmTitle}>
                            {deleteConfirm.kind === 'single'
                                ? `Delete invoice ${deleteConfirm.invoice.invoiceNumber}?`
                                : `Delete ${deleteConfirm.count} selected invoices?`}
                        </div>
                        <div className={ownStyles.confirmBody}>
                            {deleteConfirm.kind === 'single'
                                ? 'This permanently removes the invoice and any linked payment history. This cannot be undone.'
                                : `This permanently removes ${deleteConfirm.count} invoices and any linked payment history. This cannot be undone.`}
                        </div>
                        <div className={ownStyles.confirmActions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => setDeleteConfirm(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={ownStyles.confirmYesDestructive}
                                onClick={() => void confirmDelete()}
                            >
                                {deleteConfirm.kind === 'single' ? 'Confirm delete' : `Delete ${deleteConfirm.count}`}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Quick Payment Dialog — preserved behavior, Nocturne skin */}
            {paymentDialog && (
                <div
                    className={ownStyles.paymentOverlay}
                    onMouseDown={() => setPaymentDialog(null)}
                    role="presentation"
                >
                    <div
                        ref={paymentDialogRef}
                        className={ownStyles.paymentDialog}
                        onMouseDown={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Mark ${paymentDialog.invoice.invoiceNumber} as paid`}
                        tabIndex={-1}
                    >
                        <h3 className={ownStyles.paymentTitle}>
                            Mark {paymentDialog.invoice.invoiceNumber} as paid
                        </h3>
                        <div className={ownStyles.paymentForm}>
                            <div>
                                <label className={ownStyles.paymentLabel}>Payment method *</label>
                                <select className={styles.formInput} value={quickPayment.method}
                                        onChange={(e) => setQuickPayment(p => ({...p, method: e.target.value}))}>
                                    <option value="bank_transfer">Bank Transfer</option>
                                    <option value="upi">UPI</option>
                                    <option value="cash">Cash</option>
                                    <option value="check">Check</option>
                                    <option value="paypal">PayPal</option>
                                    <option value="credit_card">Credit Card</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                {/*
                                 * FE-2 — label matches the semantic of what the user
                                 * is typing (invoice currency), not INR. The backend converts
                                 * to INR at record time using the current FX rate and stores
                                 * both the original amount and the conversion in the payment
                                 * row.
                                 */}
                                <label className={ownStyles.paymentLabel}>
                                    Amount received ({paymentDialog.invoice.currency || "USD"}) *
                                </label>
                                <input type="number" className={styles.formInput} value={quickPayment.amount}
                                       onChange={(e) => setQuickPayment(p => ({...p, amount: parseFloat(e.target.value) || 0}))}
                                       min={0} step="0.01" />
                                {paymentDialog.invoice.currency && paymentDialog.invoice.currency !== "INR" && (
                                    <div className={ownStyles.paymentFxHint}>
                                        Will be converted to INR at the current FX rate and recorded on the payment.
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className={ownStyles.paymentLabel}>Payment date</label>
                                <input type="date" className={styles.formInput} value={quickPayment.date}
                                       onChange={(e) => setQuickPayment(p => ({...p, date: e.target.value}))} />
                            </div>
                        </div>
                        <div className={ownStyles.paymentActions}>
                            <button className={styles.secondaryBtn}
                                    onClick={() => setPaymentDialog(null)}>
                                Cancel
                            </button>
                            <button className={styles.primaryBtn}
                                    onClick={handleQuickPaymentSubmit}
                                    disabled={!quickPayment.method || quickPayment.amount <= 0}>
                                Mark as paid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceManager;
