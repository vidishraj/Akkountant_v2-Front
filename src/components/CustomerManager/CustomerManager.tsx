import { useState, useEffect, useCallback } from "react";
import { Customer } from "../../utils/interfaces";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  batchRelinkEmails,
} from "../../services/freelanceService";
import { useMessage } from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./CustomerManager.module.scss";
import CustomerDialog from "./CustomerDialog";
import CustomerDetailModal from "./CustomerDetailModal";

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
  const { setPayload } = useMessage();

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

  useEffect(() => {
    loadCustomers();
  }, [currentPage, debouncedSearch]);

  const loadCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetchCustomers(currentPage, itemsPerPage, debouncedSearch);
      setCustomers(response.customers);
      setTotalCustomers(response.total_count);
    } catch (error) {
      setPayload({ type: "error", message: "Failed to load customers" });
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, debouncedSearch]);

  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      setPayload({ type: "error", message: "Name is required" });
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
      setPayload({ type: "success", message: result.message });
      await loadCustomers();
    } catch (error) {
      setPayload({ type: "error", message: "Failed to add customer" });
      console.error("Error adding customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer || !formData.name.trim()) {
      setPayload({ type: "error", message: "Name is required" });
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
      setPayload({ type: "success", message: result.message });
      await loadCustomers();
    } catch (error) {
      setPayload({ type: "error", message: "Failed to update customer" });
      console.error("Error updating customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;
    if (!window.confirm(`Are you sure you want to delete customer "${customer.name}"?`)) return;
    try {
      setLoading(true);
      const result = await deleteCustomer(customerId);
      setPayload({ type: "success", message: result.message });
      await loadCustomers();
    } catch (error) {
      setPayload({ type: "error", message: "Failed to delete customer" });
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
    setFormData({ name: "", email: "", company: "", address: "", phone: "" });
    setEditingCustomer(null);
    setDialogMode("add");
  };

  const resetForm = () => {
    setFormData({ name: "", email: "", company: "", address: "", phone: "" });
    setDialogMode(null);
    setEditingCustomer(null);
  };

  const getActivityClass = (customer: Customer) => {
    if (!customer.lastInvoiceDate) return ownStyles.activityOld;
    const daysSince = Math.floor(
      (Date.now() - new Date(customer.lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince < 30) return ownStyles.activityRecent;
    if (daysSince < 90) return ownStyles.activityModerate;
    return ownStyles.activityOld;
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Client-side sort (backend returns paginated, so sort within page)
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
        <div className={styles.filterGroup} style={{ flex: 2 }}>
          <label>Search</label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, company..."
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
        <div className={styles.filterGroup} style={{ minWidth: "100px" }}>
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
              setPayload({ type: "success", message: result.message });
            } catch {
              setPayload({ type: "error", message: "Failed to sync emails" });
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
          style={{ padding: "8px 16px", marginLeft: "auto" }}
        >
          Sync Emails
        </button>
        <button
          className={styles.primaryBtn}
          onClick={openAddDialog}
          disabled={loading}
          style={{ padding: "8px 16px" }}
        >
          + Add Customer
        </button>
      </div>

      {/* Customer Dialog */}
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
          {totalCustomers} customer{totalCustomers !== 1 ? "s" : ""}
          {debouncedSearch && ` matching "${debouncedSearch}"`}
        </span>
      </div>

      {/* Customer Grid */}
      {loading && customers.length === 0 ? (
        <div className={styles.loadingSpinner}>
          <div>Loading customers...</div>
        </div>
      ) : sortedCustomers.length === 0 ? (
        <div className={styles.emptyState}>
          {totalCustomers === 0 ? "No customers yet. Add your first customer!" : "No customers match your search."}
        </div>
      ) : (
        <div className={ownStyles.customerGrid}>
          {sortedCustomers.map((customer) => (
            <div key={customer.id} className={`${ownStyles.customerCard} ${getActivityClass(customer)}`} onClick={() => setDetailCustomer(customer)}>
              <div className={ownStyles.customerCardHeader}>
                <div className={ownStyles.customerAvatar}>{getInitials(customer.name)}</div>
                <div className={ownStyles.customerInfo}>
                  <h4>{customer.name}</h4>
                  {customer.company && (
                    <div className={ownStyles.customerCompany}>{customer.company}</div>
                  )}
                  <div className={ownStyles.customerContact}>
                    {customer.email}
                    {customer.phone && ` | ${customer.phone}`}
                  </div>
                </div>
                <div className={ownStyles.customerActions}>
                  <button
                    className={styles.secondaryBtn}
                    onClick={(e) => { e.stopPropagation(); startEdit(customer); }}
                    style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                    disabled={loading}
                  >
                    Edit
                  </button>
                  <button
                    className={styles.dangerBtn}
                    onClick={(e) => { e.stopPropagation(); handleDeleteCustomer(customer.id); }}
                    style={{ padding: "4px 10px", fontSize: "0.78rem" }}
                    disabled={loading}
                  >
                    Delete
                  </button>
                </div>
              </div>

              <div className={ownStyles.customerStats}>
                <span className={`${ownStyles.customerStatBadge} ${ownStyles.earnings}`}>
                  <strong>
                    {"\u20B9"}
                    {customer.totalEarnings.toLocaleString("en-IN", {
                      minimumFractionDigits: 0,
                      maximumFractionDigits: 0,
                    })}
                  </strong>
                  earned
                </span>
                <span className={ownStyles.customerStatBadge}>
                  <strong>{customer.projectCount}</strong> projects
                </span>
                {customer.lastInvoiceDate && (
                  <span className={ownStyles.customerStatBadge}>
                    Last: <strong>{new Date(customer.lastInvoiceDate).toLocaleDateString()}</strong>
                  </span>
                )}
                {customer.defaultTemplate && (
                  <span className={`${ownStyles.customerStatBadge} ${ownStyles.templateBadge}`}>
                    <strong>Template</strong>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        customer={detailCustomer}
        open={detailCustomer !== null}
        onClose={() => setDetailCustomer(null)}
      />

      {/* Pagination */}
      {totalCustomers > itemsPerPage && (
        <div
          style={{
            marginTop: "20px",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: "10px",
            padding: "15px",
          }}
        >
          <button
            className={styles.secondaryBtn}
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={currentPage === 1 || loading}
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
          >
            Previous
          </button>
          <span style={{ color: "#FAFAFA", fontSize: "0.9rem" }}>
            Page {currentPage} of {Math.ceil(totalCustomers / itemsPerPage)} ({totalCustomers} total)
          </span>
          <button
            className={styles.secondaryBtn}
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalCustomers / itemsPerPage) || loading}
            style={{ padding: "6px 12px", fontSize: "0.85rem" }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CustomerManager;
