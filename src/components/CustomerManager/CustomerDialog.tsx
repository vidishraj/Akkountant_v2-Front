import { useEffect, useRef } from "react";
import styles from "../../pages/Freelance/Freelance.module.scss";
import ownStyles from "./CustomerManager.module.scss";

interface CustomerFormData {
  name: string;
  email: string;
  company: string;
  address: string;
  phone: string;
}

interface CustomerDialogProps {
  open: boolean;
  mode: "add" | "edit";
  formData: CustomerFormData;
  onFormChange: (data: CustomerFormData) => void;
  onSubmit: () => void;
  onCancel: () => void;
  loading: boolean;
  editingName?: string;
}

const CustomerDialog = ({
  open,
  mode,
  formData,
  onFormChange,
  onSubmit,
  onCancel,
  loading,
  editingName,
}: CustomerDialogProps) => {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (contentRef.current && !contentRef.current.contains(e.target as Node)) {
      onCancel();
    }
  };

  if (!open) return null;

  const updateField = (field: keyof CustomerFormData, value: string) => {
    onFormChange({ ...formData, [field]: value });
  };

  return (
    <div className={styles.modal} onClick={handleBackdropClick}>
      <div className={styles.modalContent} ref={contentRef} style={{ maxWidth: "560px" }}>
        <h3>
          {mode === "add" ? "Add New Customer" : `Edit Customer: ${editingName}`}
        </h3>

        <div className={ownStyles.dialogFormGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Name *</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.name}
              onChange={(e) => updateField("name", e.target.value)}
              placeholder="Customer name"
              autoFocus
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Email</label>
            <input
              type="email"
              className={styles.formInput}
              value={formData.email}
              onChange={(e) => updateField("email", e.target.value)}
              placeholder="customer@email.com"
            />
          </div>
        </div>

        <div className={ownStyles.dialogFormGrid}>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Company</label>
            <input
              type="text"
              className={styles.formInput}
              value={formData.company}
              onChange={(e) => updateField("company", e.target.value)}
              placeholder="Company name"
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.formLabel}>Phone</label>
            <input
              type="tel"
              className={styles.formInput}
              value={formData.phone}
              onChange={(e) => updateField("phone", e.target.value)}
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
            onChange={(e) => updateField("address", e.target.value)}
            placeholder="Customer address"
            style={{ resize: "vertical" }}
          />
        </div>

        <div className={styles.modalActions}>
          <button
            className={styles.secondaryBtn}
            onClick={onCancel}
            disabled={loading}
            style={{ padding: "10px 20px" }}
          >
            Cancel
          </button>
          <button
            className={styles.primaryBtn}
            onClick={onSubmit}
            disabled={loading || !formData.name.trim()}
            style={{ padding: "10px 20px" }}
          >
            {loading
              ? mode === "add"
                ? "Adding..."
                : "Updating..."
              : mode === "add"
              ? "Add Customer"
              : "Update Customer"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomerDialog;
