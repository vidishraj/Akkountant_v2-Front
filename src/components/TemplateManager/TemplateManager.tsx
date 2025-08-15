import { useState, useEffect } from "react";
import { InvoiceTemplate, InvoiceData } from "../../utils/interfaces";
import {
  fetchInvoiceTemplates,
  updateInvoiceTemplate,
  deleteInvoiceTemplate,
} from "../../services/freelanceService";
import { useMessage } from "../../contexts/MessageContext";
import styles from "../../pages/Freelance/Freelance.module.scss";

interface TemplateManagerProps {
  onLoadTemplate?: (template: InvoiceTemplate) => void;
  refreshTrigger?: number;
}

const TemplateManager = ({
  onLoadTemplate,
  refreshTrigger,
}: TemplateManagerProps) => {
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<InvoiceTemplate | null>(null);
  const [editName, setEditName] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "date">("date");
  const { setPayload } = useMessage();

  useEffect(() => {
    loadTemplates();
  }, [refreshTrigger]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const templatesData = await fetchInvoiceTemplates();
      setTemplates(templatesData);
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to load templates. Backend connection required.",
      });
      console.error("Error loading templates:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !editName.trim()) {
      setPayload({
        type: "error",
        message: "Template name is required",
      });
      return;
    }

    try {
      setLoading(true);
      const result = await updateInvoiceTemplate(editingTemplate.id, {
        name: editName,
      });
      setPayload({
        type: "success",
        message: result.message,
      });
      setEditingTemplate(null);
      setEditName("");
      await loadTemplates();
    } catch (error) {
      setPayload({
        type: "error",
        message: "Failed to update template",
      });
      console.error("Error updating template:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (
    templateId: string,
    templateName: string
  ) => {
    if (
      window.confirm(
        `Are you sure you want to delete template "${templateName}"? This action cannot be undone.`
      )
    ) {
      try {
        setLoading(true);
        const result = await deleteInvoiceTemplate(templateId);
        setPayload({
          type: "success",
          message: result.message,
        });
        await loadTemplates();
      } catch (error) {
        setPayload({
          type: "error",
          message: "Failed to delete template",
        });
        console.error("Error deleting template:", error);
      } finally {
        setLoading(false);
      }
    }
  };

  const startEdit = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setEditName(template.name);
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setEditName("");
  };

  const filteredTemplates = templates
    .filter(
      (template) =>
        searchTerm === "" ||
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (template.customerId &&
          template.customerId.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        default: // date
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

  const formatTemplateData = (templateData: InvoiceData) => {
    return {
      projectName: templateData.projectName || "N/A",
      clientName: templateData.to?.name || "N/A",
      itemCount: templateData.items?.length || 0,
      totalAmount: templateData.total || 0,
    };
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
            📋 Template Management
          </h3>
          <button
            className={styles.secondaryBtn}
            onClick={loadTemplates}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup} style={{ flex: 2 }}>
            <label className={styles.formLabel}>Search Templates</label>
            <input
              type="text"
              className={styles.formInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by template name or customer..."
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Sort by</label>
            <select
              className={styles.formInput}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "name" | "date")}
            >
              <option value="date">Creation Date</option>
              <option value="name">Template Name</option>
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
              {filteredTemplates.length} template
              {filteredTemplates.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Template List */}
      <div className={styles.invoiceForm}>
        {loading ? (
          <div className={styles.loadingSpinner}>
            <div>Loading templates...</div>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className={styles.emptyState}>
            {templates.length === 0
              ? "No templates found. Save your first invoice as a template!"
              : "No templates match your search criteria."}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "15px" }}>
            {filteredTemplates.map((template) => {
              const templateInfo = formatTemplateData(template.templateData);
              const isEditing = editingTemplate?.id === template.id;

              return (
                <div
                  key={template.id}
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
                    <div style={{ flex: 1 }}>
                      {isEditing ? (
                        <div
                          style={{
                            display: "flex",
                            gap: "10px",
                            alignItems: "center",
                            marginBottom: "10px",
                          }}
                        >
                          <input
                            type="text"
                            className={styles.formInput}
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Template name..."
                            style={{ maxWidth: "300px" }}
                          />
                          <button
                            className={styles.primaryBtn}
                            onClick={handleUpdateTemplate}
                            disabled={loading}
                            style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          >
                            Save
                          </button>
                          <button
                            className={styles.secondaryBtn}
                            onClick={cancelEdit}
                            disabled={loading}
                            style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <h4
                          style={{
                            color: "#FAFAFA",
                            margin: "0 0 5px 0",
                            fontSize: "1.1rem",
                          }}
                        >
                          {template.name}
                        </h4>
                      )}

                      <div
                        style={{
                          color: "#B0B0B0",
                          fontSize: "0.9rem",
                          marginBottom: "10px",
                        }}
                      >
                        Created:{" "}
                        {new Date(template.createdAt).toLocaleDateString()}
                        {template.updatedAt !== template.createdAt && (
                          <span>
                            {" "}
                            • Updated:{" "}
                            {new Date(template.updatedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    {!isEditing && (
                      <div
                        style={{
                          display: "flex",
                          gap: "10px",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          className={styles.primaryBtn}
                          onClick={() => onLoadTemplate?.(template)}
                          style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          disabled={loading}
                        >
                          Load
                        </button>
                        <button
                          className={styles.secondaryBtn}
                          onClick={() => startEdit(template)}
                          style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          className={styles.dangerBtn}
                          onClick={() =>
                            handleDeleteTemplate(template.id, template.name)
                          }
                          style={{ padding: "5px 10px", fontSize: "0.8rem" }}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    )}
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
                          Project:
                        </span>
                        <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                          {templateInfo.projectName}
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
                          Client:
                        </span>
                        <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                          {templateInfo.clientName}
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
                          Items:
                        </span>
                        <div style={{ color: "#B0B0B0", fontSize: "0.9rem" }}>
                          {templateInfo.itemCount} line item
                          {templateInfo.itemCount !== 1 ? "s" : ""}
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
                          Total:
                        </span>
                        <div
                          style={{
                            color: "#B0B0B0",
                            fontSize: "0.9rem",
                            fontWeight: "bold",
                          }}
                        >
                          ${templateInfo.totalAmount.toFixed(2)}
                        </div>
                      </div>
                    </div>

                    {template.customerId && (
                      <div
                        style={{
                          marginTop: "10px",
                          padding: "8px",
                          backgroundColor: "rgba(123, 104, 238, 0.1)",
                          borderRadius: "4px",
                        }}
                      >
                        <span style={{ color: "#7B68EE", fontSize: "0.8rem" }}>
                          🔗 Customer Template
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Instructions */}
      <div
        style={{
          marginTop: "30px",
          padding: "20px",
          backgroundColor: "#29384D",
          borderRadius: "8px",
          border: "1px solid #5B5B7B",
        }}
      >
        <h4 style={{ color: "#FAFAFA", marginBottom: "15px" }}>
          Template Management Features:
        </h4>
        <ul style={{ color: "#B0B0B0", fontSize: "0.9rem", lineHeight: "1.6" }}>
          <li>
            <strong>View All Templates:</strong> See all your saved invoice
            templates
          </li>
          <li>
            <strong>Load Templates:</strong> Quick-start invoice creation using
            saved templates
          </li>
          <li>
            <strong>Edit Templates:</strong> Update template names and
            properties
          </li>
          <li>
            <strong>Delete Templates:</strong> Remove templates that are no
            longer needed
          </li>
          <li>
            <strong>Customer Templates:</strong> Special templates linked to
            specific customers
          </li>
          <li>
            <strong>Search & Sort:</strong> Find templates quickly by name or
            creation date
          </li>
        </ul>
      </div>
    </div>
  );
};

export default TemplateManager;
