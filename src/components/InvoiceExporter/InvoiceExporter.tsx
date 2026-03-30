import {useState} from "react";
import * as XLSX from "xlsx";
import {fetchAllInvoices} from "../../services/freelanceService";
import {InvoiceData} from "../../utils/interfaces";
import {useMessage} from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";

const InvoiceExporter = () => {
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [loading, setLoading] = useState(false);
    const [filteredInvoices, setFilteredInvoices] = useState<InvoiceData[] | null>(null);
    const {setPayload} = useMessage();

    const handleFetch = async () => {
        if (!dateFrom || !dateTo) {
            setPayload({type: "error", message: "Select both dates"});
            return;
        }
        try {
            setLoading(true);
            // Fetch all invoices (paginate since backend caps at 100)
            let allInvoices: InvoiceData[] = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const resp = await fetchAllInvoices(page, 100, undefined, 'issue_date', 'asc');
                allInvoices = allInvoices.concat(resp.invoices);
                hasMore = allInvoices.length < resp.total_count;
                page++;
            }
            const invoices = allInvoices;
            const from = new Date(dateFrom);
            const to = new Date(dateTo);
            to.setHours(23, 59, 59, 999);

            const filtered = invoices.filter(inv => {
                const d = new Date(inv.issueDate);
                return d >= from && d <= to;
            });
            setFilteredInvoices(filtered);
            if (filtered.length === 0) {
                setPayload({type: "info", message: "No invoices found in this date range"});
            }
        } catch {
            setPayload({type: "error", message: "Failed to fetch invoices"});
        } finally {
            setLoading(false);
        }
    };

    const handleExport = () => {
        if (!filteredInvoices || filteredInvoices.length === 0) return;

        // Build summary rows — one row per invoice
        const summaryRows = filteredInvoices.map(inv => ({
            "Invoice #": inv.invoiceNumber,
            "Project": inv.projectName,
            "Status": inv.status || "draft",
            "Issue Date": inv.issueDate,
            "Due Date": inv.dueDate,
            "Currency": inv.currency,
            "From Name": inv.from.name,
            "From Email": inv.from.email,
            "From Address": inv.from.address,
            "From Phone": inv.from.phone || "",
            "To Name": inv.to.name,
            "To Email": inv.to.email,
            "To Company": inv.to.company || "",
            "To Address": inv.to.address,
            "Subtotal": inv.subtotal,
            "Tax Rate (%)": inv.tax?.rate || 0,
            "Tax Amount": inv.tax?.amount || 0,
            "Total": inv.total,
            "Payment Method": inv.payment?.paymentMethod || "",
            "Amount Received": inv.payment?.amountReceived || "",
            "Payment Date": inv.payment?.paymentDate || "",
            "Payment Notes": inv.payment?.notes || "",
            "Notes": inv.notes || "",
            "Terms": inv.terms || "",
        }));

        // Build line items — one row per item
        const itemRows: Record<string, string | number>[] = [];
        filteredInvoices.forEach(inv => {
            inv.items.forEach((item, idx) => {
                itemRows.push({
                    "Invoice #": inv.invoiceNumber,
                    "Project": inv.projectName,
                    "Currency": inv.currency,
                    "Item #": idx + 1,
                    "Description": item.description,
                    "Quantity": item.quantity,
                    "Rate": item.rate,
                    "Amount": item.amount,
                });
            });
        });

        // Build payment breakdown rows
        const paymentRows: Record<string, string | number>[] = [];
        filteredInvoices.forEach(inv => {
            if (inv.payment?.breakdown) {
                Object.entries(inv.payment.breakdown).forEach(([key, val]) => {
                    paymentRows.push({
                        "Invoice #": inv.invoiceNumber,
                        "Payment Component": key,
                        "Amount": val,
                        "Currency": inv.currency,
                    });
                });
            }
        });

        const wb = XLSX.utils.book_new();

        const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
        autoFitColumns(wsSummary, summaryRows);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Invoices");

        const wsItems = XLSX.utils.json_to_sheet(itemRows);
        autoFitColumns(wsItems, itemRows);
        XLSX.utils.book_append_sheet(wb, wsItems, "Line Items");

        if (paymentRows.length > 0) {
            const wsPayments = XLSX.utils.json_to_sheet(paymentRows);
            autoFitColumns(wsPayments, paymentRows);
            XLSX.utils.book_append_sheet(wb, wsPayments, "Payment Breakdown");
        }

        const filename = `invoices_${dateFrom}_to_${dateTo}.xlsx`;
        XLSX.writeFile(wb, filename);
        setPayload({type: "success", message: `Exported ${filteredInvoices.length} invoices to ${filename}`});
    };

    return (
        <div>
            <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                <h4 style={{color: "#FAFAFA", marginBottom: "15px"}}>Export Invoices to Excel</h4>
                <div style={{display: "flex", gap: "15px", flexWrap: "wrap"}}>
                    <div className={styles.formGroup} style={{flex: "1", minWidth: "150px"}}>
                        <label className={styles.formLabel}>From Date</label>
                        <input
                            type="date"
                            className={styles.formInput}
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setFilteredInvoices(null); }}
                        />
                    </div>
                    <div className={styles.formGroup} style={{flex: "1", minWidth: "150px"}}>
                        <label className={styles.formLabel}>To Date</label>
                        <input
                            type="date"
                            className={styles.formInput}
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setFilteredInvoices(null); }}
                        />
                    </div>
                </div>
                <div style={{marginTop: "15px"}}>
                    <button className={styles.primaryBtn} onClick={handleFetch} disabled={loading}>
                        {loading ? "Fetching..." : "Fetch Invoices"}
                    </button>
                </div>
            </div>

            {filteredInvoices && filteredInvoices.length > 0 && (
                <div className={styles.invoiceForm} style={{marginBottom: "20px"}}>
                    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "15px", flexWrap: "wrap", gap: "10px"}}>
                        <h4 style={{color: "#FAFAFA", margin: 0}}>
                            {filteredInvoices.length} Invoice{filteredInvoices.length !== 1 ? 's' : ''} Found
                        </h4>
                        <button className={styles.primaryBtn} onClick={handleExport}>
                            Download Excel
                        </button>
                    </div>
                    <div style={{overflowX: "auto"}}>
                        <table style={{width: "100%", borderCollapse: "collapse", fontSize: "0.85rem"}}>
                            <thead>
                                <tr style={{borderBottom: "1px solid #2a3a50"}}>
                                    {["Invoice #", "Project", "Client", "Date", "Currency", "Total", "Status"].map(h => (
                                        <th key={h} style={{padding: "8px 12px", textAlign: "left", color: "#B0B0B0", fontWeight: 600, whiteSpace: "nowrap"}}>{h}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filteredInvoices.map(inv => (
                                    <tr key={inv.invoiceNumber} style={{borderBottom: "1px solid #1e2a38"}}>
                                        <td style={{padding: "8px 12px", color: "#FAFAFA", whiteSpace: "nowrap"}}>{inv.invoiceNumber}</td>
                                        <td style={{padding: "8px 12px", color: "#FAFAFA"}}>{inv.projectName}</td>
                                        <td style={{padding: "8px 12px", color: "#FAFAFA"}}>{inv.to.name}</td>
                                        <td style={{padding: "8px 12px", color: "#B0B0B0", whiteSpace: "nowrap"}}>{inv.issueDate}</td>
                                        <td style={{padding: "8px 12px", color: "#B0B0B0"}}>{inv.currency}</td>
                                        <td style={{padding: "8px 12px", color: "#FAFAFA", textAlign: "right"}}>{inv.total.toFixed(2)}</td>
                                        <td style={{padding: "8px 12px"}}>
                                            <span style={{
                                                color: inv.status === "paid" ? "#4ADE80" : inv.status === "sent" ? "#F59E0B" : "#B0B0B0",
                                                textTransform: "capitalize",
                                            }}>
                                                {inv.status || "draft"}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

function autoFitColumns(ws: XLSX.WorkSheet, data: Record<string, unknown>[]) {
    if (data.length === 0) return;
    const cols = Object.keys(data[0]);
    ws['!cols'] = cols.map(key => {
        const maxLen = Math.max(
            key.length,
            ...data.map(row => String(row[key] ?? "").length)
        );
        return {wch: Math.min(maxLen + 2, 50)};
    });
}

export default InvoiceExporter;
