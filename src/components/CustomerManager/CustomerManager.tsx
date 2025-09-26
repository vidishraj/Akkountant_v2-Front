import { useState, useEffect } from "react";
import { Customer } from "../../utils/interfaces";
import {
  fetchCustomers,
  createCustomer,
  updateCustomer,
  deleteCustomer,
} from "../../services/freelanceService";
import { useMessage } from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";

const CustomerManager = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCustomers, setTotalCustomers] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "earnings" | "lastInvoice">(
    "name"
  );
  const [loading, setLoading] = useState(false);
  const { setPayload } = useMessage();

  const itemsPerPage = 10;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    company: "",
    address: "",
    phone: "",
  });

  useEffect(() => {
    loadCustomers();
  }, [currentPage]);

  const loadCustomers = async () => {
    try {
      setLoading(true);
      const response = await fetchCustomers(currentPage, itemsPerPage);
      setCustomers(response.customers);
      setTotalCustomers(response.total_count);
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to load customers",
      });
      console.error("Error loading customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddCustomer = async () => {
    if (!formData.name.trim()) {
      setPayload({
        type: "error",
        message: "Name is required",
      });
      return;
    }

    try {
      setLoading(true);
      const customerData = {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        address: formData.address,
        phone: formData.phone,
      };

      const result = await createCustomer(customerData);

      setFormData({ name: "", email: "", company: "", address: "", phone: "" });
      setShowAddForm(false);

      setPayload({
        type: "success",
        message: result.message,
      });

      // Reload customers to get the updated list
      await loadCustomers();
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to add customer",
      });
      console.error("Error adding customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditCustomer = async () => {
    if (!editingCustomer || !formData.name.trim()) {
      setPayload({
        type: "error",
        message: "Name is required",
      });
      return;
    }

    try {
      setLoading(true);
      const customerData = {
        name: formData.name,
        email: formData.email,
        company: formData.company,
        address: formData.address,
        phone: formData.phone,
      };

      const result = await updateCustomer(editingCustomer.id, customerData);

      setEditingCustomer(null);
      setShowEditForm(false);
      setFormData({ name: "", email: "", company: "", address: "", phone: "" });

      setPayload({
        type: "success",
        message: result.message,
      });

      // Reload customers to get the updated list
      await loadCustomers();
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to update customer",
      });
      console.error("Error updating customer:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCustomer = async (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    if (
      window.confirm(
        `Are you sure you want to delete customer "${customer.name}"?`
      )
    ) {
      try {
        setLoading(true);
        const result = await deleteCustomer(customerId);

        setPayload({
          type: "success",
          message: result.message,
        });

        // Reload customers to get the updated list
        await loadCustomers();
      } catch (error) {
        setPayload({
          type: "error",
          message: "Failed to delete customer",
        });
        console.error("Error deleting customer:", error);
      } finally {
        setLoading(false);
      }
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
    setShowEditForm(true);
  };

  const filteredCustomers = customers
    .filter(
      (customer) =>
        customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (customer.company &&
          customer.company.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "earnings":
          return b.totalEarnings - a.totalEarnings;
        case "lastInvoice":
          return (b.lastInvoiceDate || "").localeCompare(
            a.lastInvoiceDate || ""
          );
        default:
          return a.name.localeCompare(b.name);
      }
    });

  const resetForm = () => {
    setFormData({ name: "", email: "", company: "", address: "", phone: "" });
    setShowAddForm(false);
    setShowEditForm(false);
    setEditingCustomer(null);
  };

  return (
    <div>
      {/* Filter Controls */}
      <div className={styles.invoiceForm} style={{ marginBottom: "20px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "15px",
          }}
        >
          <h3 style={{ color: "#FAFAFA", margin: 0 }}>
            👥 Customer Management
          </h3>
          <button
            className={styles.primaryBtn}
            onClick={() => setShowAddForm(!showAddForm)}
            disabled={loading}
          >
            {loading ? "Loading..." : showAddForm ? "Cancel" : "+ Add Customer"}
          </button>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 2 }}>
            <label className={styles.formLabel}>Search Customers</label>
            <input
              type="text"
              className={styles.formInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, email, or company..."
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Sort by</label>
            <select
              className={styles.formInput}
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "name" | "earnings" | "lastInvoice")
              }
            >
              <option value="name">Name (A-Z)</option>
              <option value="earnings">Total Earnings</option>
              <option value="lastInvoice">Last Invoice Date</option>
            </select>
          </div>
          <div
            style={{ display: "flex", alignItems: "end", paddingBottom: "2px" }}
          >
            <span
              style={{
                color: "#B0B0B0",
                fontSize: "0.9rem",
                whiteSpace: "nowrap",
              }}
            >
              {filteredCustomers.length} customer
              {filteredCustomers.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Add Customer Form */}
      {showAddForm && (
        <div className={styles.invoiceForm}>
          <h3 style={{ color: "#FAFAFA", marginBottom: "20px" }}>
            Add New Customer
          </h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name *</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Customer name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                className={styles.formInput}
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="customer@email.com"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Company</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.company}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="Company name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phone</label>
              <input
                type="tel"
                className={styles.formInput}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Address</label>
            <textarea
              className={styles.formInput}
              rows={3}
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Customer address"
            />
          </div>

          <div className={styles.actionButtons}>
            <button
              className={styles.primaryBtn}
              onClick={handleAddCustomer}
              disabled={loading}
            >
              {loading ? "Adding..." : "Add Customer"}
            </button>
            <button className={styles.secondaryBtn} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Edit Customer Form */}
      {showEditForm && editingCustomer && (
        <div className={styles.invoiceForm}>
          <h3 style={{ color: "#FAFAFA", marginBottom: "20px" }}>
            Edit Customer: {editingCustomer.name}
          </h3>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Name *</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Customer name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Email</label>
              <input
                type="email"
                className={styles.formInput}
                value={formData.email}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, email: e.target.value }))
                }
                placeholder="customer@email.com"
              />
            </div>
          </div>

          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Company</label>
              <input
                type="text"
                className={styles.formInput}
                value={formData.company}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, company: e.target.value }))
                }
                placeholder="Company name"
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Phone</label>
              <input
                type="tel"
                className={styles.formInput}
                value={formData.phone}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, phone: e.target.value }))
                }
                placeholder="+1 (555) 123-4567"
              />
            </div>
          </div>

          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Address</label>
            <textarea
              className={styles.formInput}
              rows={3}
              value={formData.address}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, address: e.target.value }))
              }
              placeholder="Customer address"
            />
          </div>

          <div className={styles.actionButtons}>
            <button
              className={styles.primaryBtn}
              onClick={handleEditCustomer}
              disabled={loading}
            >
              {loading ? "Updating..." : "Update Customer"}
            </button>
            <button className={styles.secondaryBtn} onClick={resetForm}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Customer List */}
      <div className={styles.invoiceForm}>
        <h3 style={{ color: "#FAFAFA", marginBottom: "20px" }}>
          Customers ({filteredCustomers.length})
        </h3>

        {filteredCustomers.length === 0 ? (
          <div className={styles.emptyState}>
            {customers.length === 0
              ? "No customers yet. Add your first customer!"
              : "No customers match your search."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "15px" }}>
            {filteredCustomers.map((customer) => (
              <div
                key={customer.id}
                style={{
                  padding: "20px",
                  backgroundColor: "#29384D",
                  borderRadius: "8px",
                  border: "1px solid #5B5B7B",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "15px",
                  }}
                >
                  <div>
                    <h4
                      style={{
                        color: "#FAFAFA",
                        margin: "0 0 5px 0",
                        fontSize: "1.1rem",
                      }}
                    >
                      {customer.name}
                      {customer.company && (
                        <span
                          style={{ color: "#B0B0B0", fontWeight: "normal" }}
                        >
                          {" "}
                          - {customer.company}
                        </span>
                      )}
                    </h4>
                    <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                      <div>{customer.email}</div>
                      {customer.phone && <div>{customer.phone}</div>}
                    </div>
                  </div>
                  <div
                    style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}
                  >
                    <button
                      className={styles.secondaryBtn}
                      onClick={() => startEdit(customer)}
                      style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                      disabled={loading}
                    >
                      Edit
                    </button>
                    <button
                      className={styles.dangerBtn}
                      onClick={() => handleDeleteCustomer(customer.id)}
                      style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    padding: "15px",
                    backgroundColor: "#121c24",
                    borderRadius: "4px",
                    border: "1px solid #5B5B7B",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                      gap: "15px",
                    }}
                  >
                    <div>
                      <span
                        style={{
                          color: "#7B68EE",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                        }}
                      >
                        Address:
                      </span>
                      <div
                        style={{
                          color: "#B0B0B0",
                          fontSize: "0.9rem",
                          whiteSpace: "pre-line",
                        }}
                      >
                        {customer.address || "No address provided"}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#7B68EE",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                        }}
                      >
                        Stats:
                      </span>
                      <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                        <div>
                          Total Earnings: ${customer.totalEarnings.toFixed(2)}
                        </div>
                        <div>Projects: {customer.projectCount}</div>
                        {customer.lastInvoiceDate && (
                          <div>
                            Last Invoice:{" "}
                            {new Date(
                              customer.lastInvoiceDate
                            ).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <span
                        style={{
                          color: "#7B68EE",
                          fontSize: "0.8rem",
                          fontWeight: "500",
                        }}
                      >
                        Template:
                      </span>
                      <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                        {customer.defaultTemplate ? (
                          <span style={{ color: "#32CD32" }}>
                            ✅ Has template
                          </span>
                        ) : (
                          <span style={{ color: "#B0B0B0" }}>
                            ❌ No template
                          </span>
                        )}
                      </div>
                      {customer.defaultTemplate && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#7B68EE",
                            marginTop: "2px",
                          }}
                        >
                          Template can be managed in Create Invoice tab
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalCustomers > itemsPerPage && (
          <div style={{
            marginTop: '20px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '10px',
            padding: '15px'
          }}>
            <button
              className={styles.secondaryBtn}
              onClick={() => setCurrentPage(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Previous
            </button>
            
            <span style={{ color: '#FAFAFA', fontSize: '0.9rem' }}>
              Page {currentPage} of {Math.ceil(totalCustomers / itemsPerPage)} 
              ({totalCustomers} total customers)
            </span>
            
            <button
              className={styles.secondaryBtn}
              onClick={() => setCurrentPage(currentPage + 1)}
              disabled={currentPage >= Math.ceil(totalCustomers / itemsPerPage) || loading}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Instructions */}
      {/* <div style={{ 
                marginTop: '20px', 
                padding: '15px', 
                backgroundColor: '#29384D', 
                borderRadius: '6px',
                border: '1px solid #5B5B7B'
            }}>
                <h4 style={{ color: '#FAFAFA', marginBottom: '10px', fontSize: '0.95rem' }}>Customer Management Features:</h4>
                <ul style={{ color: '#B0B0B0', fontSize: '0.8rem', lineHeight: '1.4', margin: 0, paddingLeft: '18px' }}>
                    <li><strong>Add Customers:</strong> Store customer information for easy reuse in invoices</li>
                    <li><strong>View Templates:</strong> See which customers have default invoice templates</li>
                    <li><strong>Track Earnings:</strong> Monitor total earnings and project count per customer</li>
                    <li><strong>Search & Sort:</strong> Find customers quickly and organize by different criteria</li>
                    <li><strong>Edit & Delete:</strong> Manage customer information as needed</li>
                </ul>
            </div> */}
    </div>
  );
};

export default CustomerManager;
