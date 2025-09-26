import {useState, useEffect} from "react";
import {InvoiceData} from "../../utils/interfaces";
import {
    fetchAllInvoices,
    deleteInvoice,
    updateInvoice,
} from "../../services/freelanceService";
import {useMessage} from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";

interface InvoiceManagerProps {
    onEditInvoice?: (invoiceId: string) => void;
    onPreviewInvoice?: (invoiceId: string) => void;
    refreshTrigger?: number;
    onInvoiceUpdated?: () => void;
    isActive?: boolean;
}

const InvoiceManager = ({
                            onEditInvoice,
                            onPreviewInvoice,
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
    const [sortBy, setSortBy] = useState<"date" | "amount" | "status" | "client">(
        "date"
    );
    const {setPayload} = useMessage();

    const itemsPerPage = 10;

    useEffect(() => {
        loadInvoices();
    }, [currentPage, refreshTrigger]);

    useEffect(() => {
        if (isActive) {
            loadInvoices();
        }
    }, [isActive]);

    const handleRefresh = () => {
        loadInvoices();
        onInvoiceUpdated?.();
    };

    const loadInvoices = async () => {
        try {
            setLoading(true);
            const response = await fetchAllInvoices(currentPage, itemsPerPage);
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
    };

    const handleDeleteInvoice = async (
        invoiceId: string,
        invoiceNumber: string
    ) => {
        if (
            window.confirm(
                `Are you sure you want to delete invoice ${invoiceNumber}? This action cannot be undone.`
            )
        ) {
            try {
                setLoading(true);
                const result = await deleteInvoice(invoiceId);
                setPayload({
                    type: "success",
                    message: result.message,
                });
                // Reload invoices
                await loadInvoices();
                // Trigger dashboard refresh
                onInvoiceUpdated?.();
            } catch (error) {
                setPayload({
                    type: "error",
                    message: "Failed to delete invoice",
                });
                console.error("Error deleting invoice:", error);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleStatusChange = async (
        invoice: InvoiceData,
        newStatus: string
    ) => {
        // Validate payment info for paid status
        if (newStatus === "paid") {
            if (
                !invoice.payment ||
                !invoice.payment.paymentMethod ||
                invoice.payment.amountReceived <= 0
            ) {
                setPayload({
                    type: "error",
                    message: `Cannot mark invoice ${invoice.invoiceNumber} as paid. Please add payment information first by editing the invoice.`,
                });
                return;
            }
        }

        try {
            const updatedInvoice = {
                ...invoice,
                status: newStatus as "draft" | "sent" | "paid" | "overdue",
            };
            await updateInvoice(invoice.invoiceNumber, updatedInvoice);
            setPayload({
                type: "success",
                message: `Invoice ${invoice.invoiceNumber} status updated to ${newStatus}`,
            });
            // Reload invoices
            await loadInvoices();
            // Trigger dashboard refresh
            onInvoiceUpdated?.();
        } catch (error) {
            setPayload({
                type: "error",
                message: "Failed to update invoice status",
            });
            console.error("Error updating invoice status:", error);
        }
    };

    const getCurrencySymbol = (currency: string) => {
        const symbols: Record<string, string> = {
            USD: "$",
            INR: "₹",
            GBP: "£",
            EUR: "€",
            AUD: "A$",
        };
        return symbols[currency] || "$";
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case "paid":
                return "#32CD32";
            case "sent":
                return "#FFD700";
            case "overdue":
                return "#DC143C";
            default:
                return "#B0B0B0"; // draft
        }
    };

    const filteredInvoices = invoices
        .filter((invoice) => {
            const matchesSearch =
                searchTerm === "" ||
                invoice.invoiceNumber
                    .toLowerCase()
                    .includes(searchTerm.toLowerCase()) ||
                invoice.projectName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                invoice.to.name.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus =
                statusFilter === "all" || invoice.status === statusFilter;

            return matchesSearch && matchesStatus;
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "amount":
                    return b.total - a.total;
                case "status":
                    return (a.status || "draft").localeCompare(b.status || "draft");
                case "client":
                    return a.to.name.localeCompare(b.to.name);
                default: // date
                    return (
                        new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime()
                    );
            }
        });

    const totalPages = Math.ceil(totalInvoices / itemsPerPage);

    return (
        <div>
            {/* Filter Controls */}
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "15px",
                    }}
                >
                    <h3 style={{color: "#FAFAFA", margin: 0}}>📋 Invoice Management</h3>
                    <div style={{display: "flex", alignItems: "center", gap: "15px"}}>
            <span style={{color: "#B0B0B0", fontSize: "0.9rem"}}>
              {filteredInvoices.length} of {totalInvoices} invoices
            </span>
                        <button
                            className={styles.secondaryBtn}
                            onClick={handleRefresh}
                            disabled={loading}
                        >
                            {loading ? "Refreshing..." : "Refresh"}
                        </button>
                    </div>
                </div>

                <div className={styles.formRow}>
                    <div className={styles.formGroup} style={{flex: 2}}>
                        <label className={styles.formLabel}>Search Invoices</label>
                        <input
                            type="text"
                            className={styles.formInput}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by invoice number, project, or client..."
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Filter by Status</label>
                        <select
                            className={styles.formInput}
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="all">All Statuses</option>
                            <option value="draft">Draft</option>
                            <option value="sent">Sent</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                        </select>
                    </div>
                    <div className={styles.formGroup}>
                        <label className={styles.formLabel}>Sort by</label>
                        <select
                            className={styles.formInput}
                            value={sortBy}
                            onChange={(e) =>
                                setSortBy(
                                    e.target.value as "date" | "amount" | "status" | "client"
                                )
                            }
                        >
                            <option value="date">Issue Date</option>
                            <option value="amount">Amount</option>
                            <option value="status">Status</option>
                            <option value="client">Client Name</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Invoice List */}
            <div className={styles.invoiceForm}>
                {loading ? (
                    <div className={styles.loadingSpinner}>
                        <div>Loading invoices...</div>
                    </div>
                ) : filteredInvoices.length === 0 ? (
                    <div className={styles.emptyState}>
                        {invoices.length === 0
                            ? "No invoices found. Create your first invoice!"
                            : "No invoices match your search criteria."}
                    </div>
                ) : (
                    <div style={{overflowX: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse"}}>
                            <thead>
                            <tr style={{borderBottom: "2px solid #5B5B7"}}>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "left",
                                    }}
                                >
                                    Invoice #
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "left",
                                    }}
                                >
                                    Project
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "left",
                                    }}
                                >
                                    Client
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "right",
                                    }}
                                >
                                    Amount
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "center",
                                    }}
                                >
                                    Status
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "left",
                                    }}
                                >
                                    Issue Date
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "left",
                                    }}
                                >
                                    Due Date
                                </th>
                                <th
                                    style={{
                                        color: "#FAFAFA",
                                        padding: "12px",
                                        textAlign: "center",
                                    }}
                                >
                                    Actions
                                </th>
                            </tr>
                            </thead>
                            <tbody>
                            {filteredInvoices.map((invoice, index) => (
                                <tr
                                    key={invoice.invoiceNumber}
                                    style={{
                                        borderBottom: "1px solid #5B5B7",
                                        backgroundColor:
                                            index % 2 === 1
                                                ? "rgba(91, 91, 123, 0.1)"
                                                : "transparent",
                                    }}
                                >
                                    <td
                                        style={{
                                            color: "#FAFAFA",
                                            padding: "12px",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        {invoice.invoiceNumber}
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>
                                        {invoice.projectName}
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>
                                        <div>{invoice.to.name}</div>
                                        {invoice.to.company && (
                                            <div style={{fontSize: "0.8rem", color: "#B0B0B0"}}>
                                                {invoice.to.company}
                                            </div>
                                        )}
                                    </td>
                                    <td
                                        style={{
                                            color: "#FAFAFA",
                                            padding: "12px",
                                            textAlign: "right",
                                            fontWeight: "bold",
                                        }}
                                    >
                                        <div>
                                            {getCurrencySymbol(invoice.currency || "USD")}
                                            {invoice.total.toFixed(2)}
                                        </div>
                                        {invoice.status === "paid" && invoice.payment?.amountReceived && (
                                            <div style={{
                                                fontSize: "0.8rem",
                                                color: "#32CD32",
                                                fontWeight: "normal",
                                                marginTop: "2px"
                                            }}>
                                                Paid: {getCurrencySymbol("INR")}
                                                {invoice.payment.amountReceived.toFixed(2)}
                                            </div>
                                        )}
                                    </td>
                                    <td style={{padding: "12px", textAlign: "center"}}>
                                        <select
                                            className={styles.formInput}
                                            value={invoice.status || "draft"}
                                            onChange={(e) =>
                                                handleStatusChange(invoice, e.target.value)
                                            }
                                            style={{
                                                fontSize: "0.75rem",
                                                padding: "4px 8px",
                                                backgroundColor: getStatusColor(
                                                    invoice.status || "draft"
                                                ),
                                                color: "#FFFFFF",
                                                border: "none",
                                                borderRadius: "4px",
                                                fontWeight: "bold",
                                                cursor: "pointer",
                                                minWidth: "80px",
                                            }}
                                            disabled={loading}
                                        >
                                            <option value="draft" style={{color: "#000"}}>
                                                DRAFT
                                            </option>
                                            <option value="sent" style={{color: "#000"}}>
                                                SENT
                                            </option>
                                            <option value="paid" style={{color: "#000"}}>
                                                PAID
                                            </option>
                                            <option value="overdue" style={{color: "#000"}}>
                                                OVERDUE
                                            </option>
                                        </select>
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>
                                        {new Date(invoice.issueDate).toLocaleDateString()}
                                    </td>
                                    <td style={{color: "#FAFAFA", padding: "12px"}}>
                                        {new Date(invoice.dueDate).toLocaleDateString()}
                                    </td>
                                    <td style={{padding: "12px", textAlign: "center"}}>
                                        <div
                                            style={{
                                                display: "flex",
                                                gap: "4px",
                                                justifyContent: "center",
                                                flexWrap: "wrap",
                                            }}
                                        >
                                            <button
                                                className={styles.secondaryBtn}
                                                onClick={() =>
                                                    onPreviewInvoice?.(invoice.invoiceNumber)
                                                }
                                                style={{padding: "3px 6px", fontSize: "0.7rem"}}
                                                disabled={loading}
                                            >
                                                Preview
                                            </button>
                                            <button
                                                className={styles.secondaryBtn}
                                                onClick={() => onEditInvoice?.(invoice.invoiceNumber)}
                                                style={{padding: "3px 6px", fontSize: "0.7rem"}}
                                                disabled={loading}
                                            >
                                                Edit
                                            </button>
                                            <button
                                                className={styles.dangerBtn}
                                                onClick={() =>
                                                    handleDeleteInvoice(
                                                        invoice.invoiceNumber,
                                                        invoice.invoiceNumber
                                                    )
                                                }
                                                style={{padding: "3px 6px", fontSize: "0.7rem"}}
                                                disabled={loading}
                                            >
                                                Delete
                                            </button>
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
                <div
                    style={{
                        display: "flex",
                        justifyContent: "center",
                        gap: "10px",
                        marginTop: "20px",
                    }}
                >
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1 || loading}
                    >
                        Previous
                    </button>
                    <span
                        style={{
                            color: "#FAFAFA",
                            padding: "8px 16px",
                            display: "flex",
                            alignItems: "center",
                        }}
                    >
            Page {currentPage} of {totalPages}
          </span>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() =>
                            setCurrentPage((prev) => Math.min(prev + 1, totalPages))
                        }
                        disabled={currentPage === totalPages || loading}
                    >
                        Next
                    </button>
                </div>
            )}

            {/* Instructions */}
            {/* <div style={{
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#121C24',
                borderRadius: '6px',
                border: '1px solid white'
            }}>
                <h4 style={{ color: '#FAFAFA', marginBottom: '10px', fontSize: '0.95rem' }}>Invoice Management Features:</h4>
                <ul style={{ color: '#B0B0B0', fontSize: '0.8rem', lineHeight: '1.4', margin: 0, paddingLeft: '18px' }}>
                    <li><strong>View All Invoices:</strong> See all your created invoices with full details</li>
                    <li><strong>Search & Filter:</strong> Find invoices by number, project, client name, or status</li>
                    <li><strong>Sort Options:</strong> Organize invoices by date, amount, status, or client</li>
                    <li><strong>Edit Invoices:</strong> Modify existing invoices before sending</li>
                    <li><strong>Delete Invoices:</strong> Remove invoices that are no longer needed</li>
                    <li><strong>Status Tracking:</strong> Monitor invoice status from draft to paid</li>
                </ul>
            </div> */}
        </div>
    );
};

export default InvoiceManager;
