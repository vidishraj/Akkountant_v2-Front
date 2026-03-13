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
                setPayload({
                    type: "error",
                    message: `Cannot mark invoice ${invoice.invoiceNumber} as paid. Please add payment information first by editing the invoice.`,
                });
                return;
            }
        }
        try {
            const updatedInvoice = {...invoice, status: newStatus as "draft" | "sent" | "paid" | "overdue"};
            await updateInvoice(invoice.invoiceNumber, updatedInvoice);
            setPayload({type: "success", message: `Invoice ${invoice.invoiceNumber} status updated to ${newStatus}`});
            await loadInvoices();
            onInvoiceUpdated?.();
        } catch (error) {
            setPayload({type: "error", message: "Failed to update invoice status"});
            console.error("Error updating invoice status:", error);
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
                                        {invoice.status === "paid" && invoice.payment?.amountReceived && (
                                            <div style={{fontSize: "0.8rem", color: "#4ADE80", fontWeight: "normal", marginTop: "2px"}}>
                                                Paid: {getCurrencySymbol("INR")}{invoice.payment.amountReceived.toFixed(2)}
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
        </div>
    );
};

export default InvoiceManager;
