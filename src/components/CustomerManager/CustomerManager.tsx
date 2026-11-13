import {useState, useEffect, useCallback, useRef} from "react";
import {Customer} from "../../utils/interfaces";
import {
    fetchCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    batchRelinkEmails,
} from "../../services/freelanceService";
import {useMessage} from "../../contexts/MessageContext";
import useModalA11y from "../../hooks/useModalA11y";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./CustomerManager.module.scss";
import CustomerDialog from "./CustomerDialog";
import CustomerDetailModal from "./CustomerDetailModal";

/**
 * ak-c453 CustomerManager — PII-contained Nocturne rewrite.
 *
 * Pre-ak-c453 the list row surfaced name + company + email + phone
 * inline on every card. The Overseer's brief 06 §7 PII-containment
 * rule (confirmed on 2026-11-13) says those fields are default-hidden
 * on the list; they only appear in the detail drawer, which IS the
 * explicit reveal action (§4 rule #4 "reveal-on-explicit-action").
 *
 * Current list row shape (strict per bead comment: "NOTHING ELSE"):
 *   - Avatar (initials — no raw PII; initials of the display name)
 *   - Customer name
 *   - Activity-status chip (Recent / Moderate / Dormant — derived from
 *     lastInvoiceDate recency; no raw dates leak unless the Dormant
 *     chip IS the date)
 *   - Lifetime earnings total (₹)
 *   - Last-invoice date
 *
 * Deliberately NOT in the list row (PII-default-hidden):
 *   - Email, phone, mailing address
 *   - Company name (corporate affiliation — identifying by inference)
 *   - GSTIN / tax ID / any free-text contact
 *
 * The drawer-open (click the card) IS the explicit user action that
 * reveals the full PII record. See CustomerDetailModal for the full
 * surface.
 *
 * Edit/Delete moved OFF the list row for two reasons:
 *   1. Keeps the list card maximally compact + PII-free.
 *   2. Both actions require the user to have already identified the
 *      correct customer; the drawer context makes that explicit
 *      (right-click/hover-on-list to find X is replaced by a
 *      deliberate click-to-open).
 *
 * Delete → full Nocturne destructive-variant gate here (useModalA11y
 * focus-trap + ph-warning + role="alertdialog" + .confirmYesDestructive).
 * The bead comment flagged ak-e5w3 as the sibling follow-up that would
 * add the gate styling; this bead delivers the styling directly since
 * all the primitives already exist (FE-7 / ak-6lyp / ak-zl3o).
 */

type ActivityBucket = "recent" | "moderate" | "dormant" | "none";

function bucketFromLastInvoice(lastInvoiceDate?: string): ActivityBucket {
    if (!lastInvoiceDate) return "none";
    const days = Math.floor(
        (Date.now() - new Date(lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24),
    );
    if (!Number.isFinite(days)) return "none";
    if (days < 30) return "recent";
    if (days < 90) return "moderate";
    return "dormant";
}

function bucketLabel(b: ActivityBucket): string {
    switch (b) {
        case "recent": return "Recent";
        case "moderate": return "Moderate";
        case "dormant": return "Dormant";
        case "none": return "New";
    }
}

function bucketClass(b: ActivityBucket): string {
    switch (b) {
        case "recent": return ownStyles.chipRecent;
        case "moderate": return ownStyles.chipModerate;
        case "dormant": return ownStyles.chipDormant;
        case "none": return ownStyles.chipNew;
    }
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((w) => w[0] || "")
        .slice(0, 2)
        .join("")
        .toUpperCase();
}

const CustomerManager = () => {
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [dialogMode, setDialogMode] = useState<"add" | "edit" | null>(null);
    const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCustomers, setTotalCustomers] = useState(0);
    const [searchTerm, setSearchTerm] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");
    const [sortBy, setSortBy] = useState<"name" | "earnings" | "lastInvoice">("name");
    const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
    const [loading, setLoading] = useState(false);
    const [detailCustomer, setDetailCustomer] = useState<Customer | null>(null);

    // ak-c453: destructive delete gate state. useModalA11y adds focus-
    // trap + focus-restore to the opening trigger.
    const [deleteConfirmCustomer, setDeleteConfirmCustomer] = useState<Customer | null>(null);
    const deleteDialogRef = useRef<HTMLDivElement>(null);
    useModalA11y({
        open: deleteConfirmCustomer !== null,
        panelRef: deleteDialogRef as React.RefObject<HTMLElement>,
    });

    const {setPayload} = useMessage();

    const itemsPerPage = 10;

    const [formData, setFormData] = useState({
        name: "",
        email: "",
        company: "",
        address: "",
        phone: "",
    });

    // Debounce search
    useEffect(() => {
        const timer = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 300);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Reset page when search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [debouncedSearch]);

    const loadCustomers = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetchCustomers(currentPage, itemsPerPage, debouncedSearch);
            setCustomers(response.customers);
            setTotalCustomers(response.total_count);
        } catch (error) {
            setPayload({type: "error", message: "Failed to load customers"});
            console.error("Error loading customers:", error);
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, debouncedSearch, setPayload]);

    useEffect(() => {
        void loadCustomers();
    }, [loadCustomers]);

    const handleAddCustomer = async () => {
        if (!formData.name.trim()) {
            setPayload({type: "error", message: "Name is required"});
            return;
        }
        try {
            setLoading(true);
            const result = await createCustomer({
                name: formData.name,
                email: formData.email,
                company: formData.company,
                address: formData.address,
                phone: formData.phone,
            });
            resetForm();
            setPayload({type: "success", message: result.message});
            await loadCustomers();
        } catch (error) {
            setPayload({type: "error", message: "Failed to add customer"});
            console.error("Error adding customer:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEditCustomer = async () => {
        if (!editingCustomer || !formData.name.trim()) {
            setPayload({type: "error", message: "Name is required"});
            return;
        }
        try {
            setLoading(true);
            const result = await updateCustomer(editingCustomer.id, {
                name: formData.name,
                email: formData.email,
                company: formData.company,
                address: formData.address,
                phone: formData.phone,
            });
            resetForm();
            setPayload({type: "success", message: result.message});
            await loadCustomers();
        } catch (error) {
            setPayload({type: "error", message: "Failed to update customer"});
            console.error("Error updating customer:", error);
        } finally {
            setLoading(false);
        }
    };

    // ak-c453: delete flow is a two-step confirm-gate now.
    //   1. openDeleteConfirm(customer) → sets deleteConfirmCustomer,
    //      triggering the Nocturne destructive-variant modal below.
    //   2. confirmDelete() → runs the actual deleteCustomer() API call.
    // The pre-ak-c453 native window.confirm() path is retired.
    const openDeleteConfirm = (customer: Customer) => {
        setDeleteConfirmCustomer(customer);
    };

    const confirmDelete = async () => {
        const customer = deleteConfirmCustomer;
        setDeleteConfirmCustomer(null);
        if (!customer) return;
        try {
            setLoading(true);
            const result = await deleteCustomer(customer.id);
            setPayload({type: "success", message: result.message});
            // Close the drawer if the deleted customer was open there.
            setDetailCustomer((prev) => (prev && prev.id === customer.id ? null : prev));
            await loadCustomers();
        } catch (error) {
            setPayload({type: "error", message: "Failed to delete customer"});
            console.error("Error deleting customer:", error);
        } finally {
            setLoading(false);
        }
    };

    const startEdit = (customer: Customer) => {
        setEditingCustomer(customer);
        setFormData({
            name: customer.name,
            email: customer.email,
            company: customer.company || "",
            address: customer.address,
            phone: customer.phone || "",
        });
        setDialogMode("edit");
    };

    const openAddDialog = () => {
        setFormData({name: "", email: "", company: "", address: "", phone: ""});
        setEditingCustomer(null);
        setDialogMode("add");
    };

    const resetForm = () => {
        setFormData({name: "", email: "", company: "", address: "", phone: ""});
        setDialogMode(null);
        setEditingCustomer(null);
    };

    // Client-side sort (backend returns paginated, so sort within page).
    const sortedCustomers = [...customers].sort((a, b) => {
        const dir = sortOrder === "asc" ? 1 : -1;
        switch (sortBy) {
            case "earnings":
                return (a.totalEarnings - b.totalEarnings) * dir;
            case "lastInvoice":
                return (a.lastInvoiceDate || "").localeCompare(b.lastInvoiceDate || "") * dir;
            default:
                return a.name.localeCompare(b.name) * dir;
        }
    });

    const hasActiveFilters = searchTerm !== "" || sortBy !== "name" || sortOrder !== "asc";

    const clearFilters = () => {
        setSearchTerm("");
        setSortBy("name");
        setSortOrder("asc");
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
                        placeholder="Search by name, email, company…"
                    />
                </div>
                <div className={styles.filterGroup}>
                    <label>Sort By</label>
                    <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)}>
                        <option value="name">Name</option>
                        <option value="earnings">Total Earnings</option>
                        <option value="lastInvoice">Last Invoice</option>
                    </select>
                </div>
                <div className={styles.filterGroup} style={{minWidth: "100px"}}>
                    <label>Order</label>
                    <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}>
                        <option value="asc">Ascending</option>
                        <option value="desc">Descending</option>
                    </select>
                </div>
                {hasActiveFilters && (
                    <button className={styles.clearFiltersBtn} onClick={clearFilters}>
                        Clear Filters
                    </button>
                )}
                <button
                    className={styles.secondaryBtn}
                    onClick={async () => {
                        try {
                            setLoading(true);
                            const result = await batchRelinkEmails();
                            setPayload({type: "success", message: result.message});
                        } catch {
                            setPayload({type: "error", message: "Failed to sync emails"});
                        } finally {
                            setLoading(false);
                        }
                    }}
                    disabled={loading}
                    style={{padding: "8px 16px", marginLeft: "auto"}}
                >
                    Sync Emails
                </button>
                <button
                    className={styles.primaryBtn}
                    onClick={openAddDialog}
                    disabled={loading}
                    style={{padding: "8px 16px"}}
                >
                    + Add Customer
                </button>
            </div>

            {/* Customer Dialog (add/edit) */}
            <CustomerDialog
                open={dialogMode !== null}
                mode={dialogMode || "add"}
                formData={formData}
                onFormChange={setFormData}
                onSubmit={dialogMode === "edit" ? handleEditCustomer : handleAddCustomer}
                onCancel={resetForm}
                loading={loading}
                editingName={editingCustomer?.name}
            />

            {/* Customer Count */}
            <div className={ownStyles.customerCountStrip}>
                <span className={ownStyles.customerCountText}>
                    {totalCustomers} customer{totalCustomers !== 1 ? "s" : ""}
                    {debouncedSearch && ` matching "${debouncedSearch}"`}
                </span>
            </div>

            {/* ak-c453: PII-contained customer list.
                Each card renders ONLY: avatar + name + activity-status
                chip + lifetime earnings + last-invoice date. Click the
                card to open the detail drawer, which is the explicit
                PII-reveal surface. */}
            {loading && customers.length === 0 ? (
                <div className={styles.loadingSpinner}>
                    <div>Loading customers…</div>
                </div>
            ) : sortedCustomers.length === 0 ? (
                <div className={styles.emptyState}>
                    {totalCustomers === 0 ? "No customers yet. Add your first customer!" : "No customers match your search."}
                </div>
            ) : (
                <div className={ownStyles.customerGrid}>
                    {sortedCustomers.map((customer) => {
                        const bucket = bucketFromLastInvoice(customer.lastInvoiceDate);
                        return (
                            <button
                                type="button"
                                key={customer.id}
                                className={ownStyles.customerCard}
                                onClick={() => setDetailCustomer(customer)}
                                aria-label={`Open details for ${customer.name}`}
                            >
                                <div className={ownStyles.customerCardRow}>
                                    <div className={ownStyles.customerAvatar} aria-hidden>
                                        {getInitials(customer.name)}
                                    </div>
                                    <div className={ownStyles.customerPrimary}>
                                        <div className={ownStyles.customerName}>{customer.name}</div>
                                        <div className={ownStyles.customerMetaRow}>
                                            <span className={`${ownStyles.statusChip} ${bucketClass(bucket)}`}>
                                                {bucketLabel(bucket)}
                                            </span>
                                            <span className={ownStyles.lifetimeEarnings}>
                                                {"₹"}
                                                {customer.totalEarnings.toLocaleString("en-IN", {
                                                    minimumFractionDigits: 0,
                                                    maximumFractionDigits: 0,
                                                })}
                                                <span className={ownStyles.lifetimeEarningsLabel}>lifetime</span>
                                            </span>
                                            <span className={ownStyles.lastInvoiceCell}>
                                                {customer.lastInvoiceDate
                                                    ? `Last: ${new Date(customer.lastInvoiceDate).toLocaleDateString()}`
                                                    : "No invoices yet"}
                                            </span>
                                        </div>
                                    </div>
                                    <i className={`ph ph-caret-right ${ownStyles.cardChevron}`} aria-hidden/>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Customer Detail Modal — the explicit PII-reveal surface.
                Edit + Delete moved into the drawer (see CustomerDetailModal). */}
            <CustomerDetailModal
                customer={detailCustomer}
                open={detailCustomer !== null}
                onClose={() => setDetailCustomer(null)}
                onEdit={(c) => {
                    setDetailCustomer(null);
                    startEdit(c);
                }}
                onDelete={(c) => {
                    openDeleteConfirm(c);
                }}
            />

            {/* ak-c453: Nocturne destructive-variant confirm-gate for
                customer delete. Replaces the pre-ak-c453 window.confirm()
                path. Shape matches FE-10 (ak-2o3x) files-vault destructive
                gate: role="alertdialog" + ph-warning kicker + useModalA11y
                focus-trap. The ak-e5w3 sibling bead was flagged to add
                this styling but all primitives were already available
                from FE-7/zl3o/cqfn, so it ships here directly. */}
            {deleteConfirmCustomer && (
                <>
                    <div
                        className={ownStyles.dialogBackdrop}
                        onClick={() => setDeleteConfirmCustomer(null)}
                        role="presentation"
                    />
                    <div
                        ref={deleteDialogRef}
                        className={ownStyles.confirmDialog}
                        role="alertdialog"
                        aria-modal="true"
                        aria-label="Confirm delete customer"
                        tabIndex={-1}
                    >
                        <div className={ownStyles.confirmKicker}>
                            <i className="ph ph-warning" aria-hidden/>
                            <span>Destructive action</span>
                        </div>
                        <div className={ownStyles.confirmTitle}>
                            Delete customer "{deleteConfirmCustomer.name}"?
                        </div>
                        <div className={ownStyles.confirmBody}>
                            This permanently removes the customer record. Linked invoices
                            stay — only the customer record is deleted. This cannot be
                            undone.
                        </div>
                        <div className={ownStyles.confirmActions}>
                            <button
                                type="button"
                                className={styles.secondaryBtn}
                                onClick={() => setDeleteConfirmCustomer(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className={ownStyles.confirmYesDestructive}
                                onClick={() => void confirmDelete()}
                            >
                                Confirm delete
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Pagination */}
            {totalCustomers > itemsPerPage && (
                <div className={ownStyles.paginationStrip}>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1 || loading}
                        style={{padding: "6px 12px", fontSize: "0.85rem"}}
                    >
                        Previous
                    </button>
                    <span className={ownStyles.paginationLabel}>
                        Page {currentPage} of {Math.ceil(totalCustomers / itemsPerPage)} ({totalCustomers} total)
                    </span>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage >= Math.ceil(totalCustomers / itemsPerPage) || loading}
                        style={{padding: "6px 12px", fontSize: "0.85rem"}}
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
};

export default CustomerManager;
