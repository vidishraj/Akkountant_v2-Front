import {useState, useEffect, useCallback} from "react";
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
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./InvoiceManager.module.scss";

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

    const handleRefresh = () => {
        loadInvoices();
        onInvoiceUpdated?.();
    };

    const handleDeleteInvoice = async (invoiceId: string, invoiceNumber: string) => {
        if (!window.confirm(`Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`)) return;
        try {
            setLoading(true);
            const result = await deleteInvoice(invoiceId);
            setPayload({type: "success", message: result.message});
            await loadInvoices();
            onInvoiceUpdated?.();
        } catch (error) {
            setPayload({type: "error", message: "Failed to delete invoice"});
            console.error("Error deleting invoice:", error);
        } finally {
            setLoading(false);
        }
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

    const handleBulkDelete = async () => {
        const count = selectedInvoices.size;
        if (!window.confirm(`Delete ${count} selected invoice(s)? This cannot be undone.`)) return;
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
        if (failCount === 0) setPayload({type: "success", message: `Deleted ${successCount} invoice(s)`});
        else setPayload({type: "error", message: `Deleted ${successCount}, failed ${failCount}`});
        await loadInvoices();
        onInvoiceUpdated?.();
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
                await updateInvoice(invoiceNumber, {...invoice, status: newStatus as any});
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

    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = {USD: "$", INR: "\u20B9", GBP: "\u00A3", EUR: "\u20AC", AUD: "A$"};
        return symbols[currency] || "$";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid": return "#4ADE80";
            // Arc A / FE-4 — distinct color for the new partially_paid state:
            // teal-ish so it reads as "some but not all", between paid (green)
            // and sent (amber). Backend sets this when totalPaidINR > 0 and
            // < total_in_inr.
            case "partially_paid": return "#22C6AC";
            case "sent": return "#F59E0B";
            case "overdue": return "#EF4444";
            default: return "#94A3B8";
        }
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
                        placeholder="Invoice #, project, client..."
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
            <div className={styles.filterBar} style={{marginTop: "-12px"}}>
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
                <div style={{marginLeft: "auto", display: "flex", alignItems: "center", gap: "10px"}}>
                    <span style={{color: "#B0B0B0", fontSize: "0.85rem"}}>
                        {filteredInvoices.length} of {totalInvoices}
                    </span>
                    <button className={styles.secondaryBtn} onClick={handleRefresh} disabled={loading}
                            style={{padding: "6px 12px", fontSize: "0.85rem"}}>
                        {loading ? "..." : "Refresh"}
                    </button>
                </div>
            </div>

            {/* Bulk Action Bar */}
            {selectedInvoices.size > 0 && (
                <div className={ownStyles.bulkActionBar}>
                    <span className={ownStyles.bulkInfo}>{selectedInvoices.size} selected</span>
                    <button className={styles.secondaryBtn} onClick={() => handleBulkStatusChange('draft')}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Draft</button>
                    <button className={styles.secondaryBtn} onClick={() => handleBulkStatusChange('sent')}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Sent</button>
                    <button className={styles.secondaryBtn} onClick={() => handleBulkStatusChange('paid')}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Paid</button>
                    <button className={ownStyles.downloadBtn} onClick={() => handleBulkDownload(false)}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Download All</button>
                    {defaultSignature && (
                        <button className={ownStyles.downloadBtn} onClick={() => handleBulkDownload(true)}
                                disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Download Signed</button>
                    )}
                    <button className={styles.dangerBtn} onClick={handleBulkDelete}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>
                        {bulkLoading ? 'Processing...' : `Delete (${selectedInvoices.size})`}
                    </button>
                    <button className={styles.secondaryBtn} onClick={() => setSelectedInvoices(new Set())}
                            disabled={bulkLoading} style={{padding: '6px 12px', fontSize: '0.85rem'}}>Deselect</button>
                </div>
            )}

            {/* Invoice List */}
            <div className={styles.invoiceForm}>
                {loading ? (
                    <div className={styles.loadingSpinner}><div>Loading invoices...</div></div>
                ) : filteredInvoices.length === 0 ? (
                    <div className={styles.emptyState}>No invoices found. Create your first invoice!</div>
                ) : (
                    <div style={{overflowX: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse", minWidth: "900px"}}>
                            <thead>
                            <tr style={{borderBottom: "2px solid #5B5B7B"}}>
                                <th className={ownStyles.checkboxCell} style={{padding: "12px"}}>
                                    <input type="checkbox"
                                           checked={selectedInvoices.size === filteredInvoices.length && filteredInvoices.length > 0}
                                           onChange={toggleSelectAll} title="Select all" />
                                </th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "left"}}>Invoice #</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "left"}}>Project</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "left"}}>Client</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "right"}}>Amount</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "center"}}>Status</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "left"}}>Issue Date</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "left"}}>Due Date</th>
                                <th style={{color: "#FAFAFA", padding: "12px", textAlign: "center"}}>Actions</th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredInvoices.map((invoice, index) => (
                                <tr key={invoice.invoiceNumber} style={{
                                    borderBottom: "1px solid rgba(91, 91, 123, 0.3)",
                                    backgroundColor: selectedInvoices.has(invoice.invoiceNumber)
                                        ? "rgba(123, 104, 238, 0.1)"
                                        : index % 2 === 1 ? "rgba(91, 91, 123, 0.1)" : "transparent",
                                }}>
                                    <td className={ownStyles.checkboxCell} style={{padding: "12px"}}>
                                        <input type="checkbox" checked={selectedInvoices.has(invoice.invoiceNumber)}
                                               onChange={() => toggleSelectInvoice(invoice.invoiceNumber)} />
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px", fontWeight: "bold"}}>{invoice.invoiceNumber}</td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>{invoice.projectName}</td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>
                                        <div>{invoice.to.name}</div>
                                        {invoice.to.company && <div style={{fontSize: "0.8rem", color: "#B0B0B0"}}>{invoice.to.company}</div>}
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px", textAlign: "right", fontWeight: "bold"}}>
                                        <div>{getCurrencySymbol(invoice.currency || "USD")}{invoice.total.toFixed(2)}</div>
                                        {/* Arc A / FE-2 + FE-5 — paid + partially_paid summary using
                                            BE-authoritative fields. For non-INR invoices we show the
                                            original-currency amount alongside its INR equivalent + the
                                            capture rate; for INR invoices we just show the ₹ figure.
                                            Falls back to the legacy amountReceived label when the new
                                            fx fields aren't present (legacy payments before Arc A). */}
                                        {(invoice.status === "paid" || invoice.status === "partially_paid") && invoice.payment && (
                                            <div style={{fontSize: "0.8rem", color: "#4ADE80", fontWeight: "normal", marginTop: "2px"}}>
                                                {/* Every `!= null` guard below catches BOTH JSON null (SQL
                                                    NULL from the backfill's half-populated legacy rows —
                                                    original_currency filled, fx audit fields still NULL)
                                                    AND absent (undefined for pre-Arc-A payments). Previous
                                                    `!== undefined` guards let `null.toFixed()` crash the
                                                    freelance dashboard for Overseer post-backfill. */}
                                                {typeof invoice.payment.originalAmount === "number" && invoice.payment.originalCurrency ? (
                                                    <>
                                                        Paid: {getCurrencySymbol(invoice.payment.originalCurrency)}{invoice.payment.originalAmount.toFixed(2)}
                                                        {invoice.payment.originalCurrency !== "INR" && typeof invoice.payment.inrAmount === "number" && (
                                                            <div style={{fontSize: "0.7rem", color: "#B0B0B0", fontWeight: "normal"}}>
                                                                = {getCurrencySymbol("INR")}{invoice.payment.inrAmount.toFixed(2)}
                                                                {typeof invoice.payment.fxRate === "number" && (
                                                                    <> @ {invoice.payment.fxRate.toFixed(4)}</>
                                                                )}
                                                                {invoice.payment.fxRateSource && (
                                                                    <> ({invoice.payment.fxRateSource})</>
                                                                )}
                                                            </div>
                                                        )}
                                                    </>
                                                ) : invoice.payment.amountReceived ? (
                                                    // Legacy pre-Arc-A path — original currency and FX
                                                    // fields absent; render what the old data has.
                                                    <>Paid: {getCurrencySymbol("INR")}{invoice.payment.amountReceived.toFixed(2)}</>
                                                ) : null}
                                            </div>
                                        )}
                                        {/* balance_due surfaces only when the server explicitly reports
                                            a non-zero remainder (partially_paid state). Guard uses
                                            typeof-number so a JSON null from BE doesn't render as "0.00". */}
                                        {invoice.status === "partially_paid" && typeof invoice.balanceDueINR === "number" && invoice.balanceDueINR > 0 && (
                                            <div style={{fontSize: "0.75rem", color: "#F59E0B", fontWeight: "normal", marginTop: "2px"}}>
                                                Balance: {getCurrencySymbol("INR")}{invoice.balanceDueINR.toFixed(2)}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{padding: "12px", textAlign: "center"}}>
                                        <select className={styles.formInput} value={invoice.status || "draft"}
                                                onChange={(e) => handleStatusChange(invoice, e.target.value)}
                                                style={{
                                                    fontSize: "0.75rem", padding: "4px 8px",
                                                    backgroundColor: getStatusColor(invoice.status || "draft"),
                                                    color: "#FFFFFF", border: "none", borderRadius: "4px",
                                                    fontWeight: "bold", cursor: "pointer", minWidth: "80px",
                                                }} disabled={loading}>
                                            <option value="draft" style={{color: "#000"}}>DRAFT</option>
                                            <option value="sent" style={{color: "#000"}}>SENT</option>
                                            {/* Read-only state — BE sets it based on the paid-to-total
                                                ratio, not the user picking it. Kept in the option list
                                                so the current status renders correctly when the invoice
                                                is already partially_paid. */}
                                            {invoice.status === "partially_paid" && (
                                                <option value="partially_paid" style={{color: "#000"}}>PARTIAL</option>
                                            )}
                                            <option value="paid" style={{color: "#000"}}>PAID</option>
                                            <option value="overdue" style={{color: "#000"}}>OVERDUE</option>
                                        </select>
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>{new Date(invoice.issueDate).toLocaleDateString()}</td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>{new Date(invoice.dueDate).toLocaleDateString()}</td>
                                    <td style={{padding: "12px", textAlign: "center"}}>
                                        <div style={{display: "flex", gap: "3px", justifyContent: "center", flexWrap: "wrap"}}>
                                            <button className={styles.secondaryBtn} onClick={() => onPreviewInvoice?.(invoice.invoiceNumber)}
                                                    style={{padding: "3px 6px", fontSize: "0.7rem"}} disabled={loading}>Preview</button>
                                            <button className={styles.secondaryBtn} onClick={() => onEditInvoice?.(invoice.invoiceNumber)}
                                                    style={{padding: "3px 6px", fontSize: "0.7rem"}} disabled={loading}>Edit</button>
                                            <button className={styles.secondaryBtn} onClick={() => onDuplicateInvoice?.(invoice)}
                                                    style={{padding: "3px 6px", fontSize: "0.7rem"}} disabled={loading}>Dup</button>
                                            <button className={ownStyles.downloadBtn} onClick={() => handleDownloadPDF(invoice)}
                                                    disabled={downloadingId === invoice.invoiceNumber}>
                                                {downloadingId === invoice.invoiceNumber ? "..." : "PDF"}
                                            </button>
                                            {defaultSignature && (
                                                <button className={ownStyles.downloadBtn} onClick={() => handleDownloadSignedPDF(invoice)}
                                                        disabled={downloadingId === invoice.invoiceNumber + "-signed"}>
                                                    {downloadingId === invoice.invoiceNumber + "-signed" ? "..." : "Signed"}
                                                </button>
                                            )}
                                            <button className={styles.dangerBtn}
                                                    onClick={() => handleDeleteInvoice(invoice.invoiceNumber, invoice.invoiceNumber)}
                                                    style={{padding: "3px 6px", fontSize: "0.7rem"}} disabled={loading}>Del</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div style={{display: "flex", justifyContent: "center", gap: "10px", marginTop: "20px"}}>
                    <button className={styles.secondaryBtn} onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1 || loading}>Previous</button>
                    <span style={{color: "#FAFAFA", padding: "8px 16px", display: "flex", alignItems: "center"}}>
                        Page {currentPage} of {totalPages} &bull; {totalInvoices} total
                    </span>
                    <button className={styles.secondaryBtn} onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages || loading}>Next</button>
                </div>
            )}
            {/* Quick Payment Dialog */}
            {paymentDialog && (
                <div className={ownStyles.paymentOverlay} onClick={() => setPaymentDialog(null)}>
                    <div className={ownStyles.paymentDialog} onClick={(e) => e.stopPropagation()}>
                        <h3 style={{color: '#FAFAFA', margin: '0 0 12px'}}>
                            Mark {paymentDialog.invoice.invoiceNumber} as Paid
                        </h3>
                        <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
                            <div>
                                <label style={{color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '4px'}}>Payment Method *</label>
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
                                {/* Arc A / FE-2 — label matches the semantic of what the user
                                    is typing (invoice currency), not INR. The backend converts
                                    to INR at record time using the current FX rate and stores
                                    both the original amount and the conversion in the payment
                                    row. Prior "Amount Received (INR)" label invited users to
                                    manually pre-convert, which then double-converted server-side. */}
                                <label style={{color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '4px'}}>
                                    Amount Received ({paymentDialog.invoice.currency || "USD"}) *
                                </label>
                                <input type="number" className={styles.formInput} value={quickPayment.amount}
                                       onChange={(e) => setQuickPayment(p => ({...p, amount: parseFloat(e.target.value) || 0}))}
                                       min={0} step="0.01" />
                                {paymentDialog.invoice.currency && paymentDialog.invoice.currency !== "INR" && (
                                    <div style={{color: "#94A3B8", fontSize: "0.7rem", marginTop: "4px"}}>
                                        Will be converted to INR at the current FX rate and recorded on the payment.
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{color: '#aaa', fontSize: '0.8rem', display: 'block', marginBottom: '4px'}}>Payment Date</label>
                                <input type="date" className={styles.formInput} value={quickPayment.date}
                                       onChange={(e) => setQuickPayment(p => ({...p, date: e.target.value}))} />
                            </div>
                        </div>
                        <div style={{display: 'flex', gap: '10px', marginTop: '16px', justifyContent: 'flex-end'}}>
                            <button className={styles.secondaryBtn} onClick={() => setPaymentDialog(null)}>Cancel</button>
                            <button className={styles.primaryBtn} onClick={handleQuickPaymentSubmit}
                                    disabled={!quickPayment.method || quickPayment.amount <= 0}>
                                Mark as Paid
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default InvoiceManager;
