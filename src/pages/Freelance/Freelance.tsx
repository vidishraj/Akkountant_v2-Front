import { useState } from "react";
import BasicCard from "../../components/BasicCard";
import styles from "./Freelance.module.scss";
import FreelanceDashboard from "../../components/FreelanceDashboard/FreelanceDashboard";
import InvoiceCreator from "../../components/InvoiceCreator/InvoiceCreator";
import InvoiceManager from "../../components/InvoiceManager/InvoiceManager";
import InvoiceSigner from "../../components/InvoiceSigner/InvoiceSigner";
import CustomerManager from "../../components/CustomerManager/CustomerManager";

type TabType = "dashboard" | "create" | "manage" | "signer" | "customers";

const Freelance = () => {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>(
    undefined
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEditInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    setActiveTab("create");
  };

  const handlePreviewInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    setActiveTab("create");
    // Switch to PDF preview sub-tab after a short delay to allow data loading
    setTimeout(() => {
      const pdfTab = document.querySelector(
        '[data-tab="pdf-preview"]'
      ) as HTMLElement;
      if (pdfTab) pdfTab.click();
    }, 100);
  };

  const handleEditComplete = () => {
    setEditingInvoiceId(undefined);
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("manage");
  };

  const handleInvoiceUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <FreelanceDashboard refreshTrigger={refreshTrigger} isActive={activeTab === "dashboard"} />;
      case "create":
        return (
          <InvoiceCreator
            editingInvoiceId={editingInvoiceId}
            onEditComplete={handleEditComplete}
            onInvoiceUpdated={handleInvoiceUpdated}
          />
        );
      case "manage":
        return (
          <InvoiceManager
            onEditInvoice={handleEditInvoice}
            onPreviewInvoice={handlePreviewInvoice}
            refreshTrigger={refreshTrigger}
            onInvoiceUpdated={handleInvoiceUpdated}
            isActive={activeTab === "manage"}
          />
        );
      case "signer":
        return <InvoiceSigner />;
      case "customers":
        return <CustomerManager />;
      default:
        return <FreelanceDashboard />;
    }
  };

  const tabs = [
    { key: "dashboard" as TabType, label: "Dashboard", icon: "📊" },
    { key: "create" as TabType, label: "Create Invoice", icon: "📝" },
    { key: "manage" as TabType, label: "Manage Invoices", icon: "📋" },
    { key: "signer" as TabType, label: "Sign Invoices", icon: "✍️" },
    { key: "customers" as TabType, label: "Customers", icon: "👥" },
  ];

  return (
    <div className={styles.freelanceContainer}>
      <BasicCard className={styles.fullPageCard}>
        <div className={styles.tabContainer}>
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tab} ${
                activeTab === tab.key ? styles.active : ""
              }`}
              onClick={() => setActiveTab(tab.key)}
            >
              <span style={{ marginRight: "8px" }}>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <div className={styles.tabContent}>{renderTabContent()}</div>
      </BasicCard>
    </div>
  );
};

export default Freelance;
