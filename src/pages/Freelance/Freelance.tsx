import { useCallback, useState } from "react";
import BasicCard from "../../components/BasicCard";
import styles from "./Freelance.module.scss";
import FreelanceDashboard from "../../components/FreelanceDashboard/FreelanceDashboard";
import InvoiceCreator from "../../components/InvoiceCreator/InvoiceCreator";
import InvoiceManager from "../../components/InvoiceManager/InvoiceManager";
import InvoiceSigner from "../../components/InvoiceSigner/InvoiceSigner";
import DocumentSigner from "../../components/DocumentSigner/DocumentSigner";
import CustomerManager from "../../components/CustomerManager/CustomerManager";
import AgentChat from "../../components/AgentChat/AgentChat";
import { InvoiceData } from "../../utils/interfaces";

type TabType = "dashboard" | "create" | "manage" | "signer" | "docsigner" | "customers";

const Freelance = () => {
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>(
    undefined
  );
  const [duplicatingInvoiceData, setDuplicatingInvoiceData] = useState<InvoiceData | undefined>(undefined);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleEditInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    setDuplicatingInvoiceData(undefined);
    setInitialSubTab("creation");
    setActiveTab("create");
  };

  const [initialSubTab, setInitialSubTab] = useState<"creation" | "pdf-preview">("creation");

  const handlePreviewInvoice = (invoiceId: string) => {
    setEditingInvoiceId(invoiceId);
    setDuplicatingInvoiceData(undefined);
    setInitialSubTab("pdf-preview");
    setActiveTab("create");
  };

  const handleDuplicateInvoice = (invoice: InvoiceData) => {
    setEditingInvoiceId(undefined);
    setDuplicatingInvoiceData(invoice);
    setActiveTab("create");
  };

  const handleEditComplete = () => {
    setEditingInvoiceId(undefined);
    setDuplicatingInvoiceData(undefined);
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("manage");
  };

  const handleDuplicateComplete = () => {
    setDuplicatingInvoiceData(undefined);
    setRefreshTrigger((prev) => prev + 1);
    setActiveTab("manage");
  };

  const handleInvoiceUpdated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  const handleAgentMutation = useCallback(() => {
    setRefreshTrigger((prev) => prev + 1);
  }, []);

  const renderTabContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <FreelanceDashboard refreshTrigger={refreshTrigger} isActive={activeTab === "dashboard"} onNavigateToManage={() => setActiveTab("manage")} />;
      case "create":
        return (
          <InvoiceCreator
            editingInvoiceId={editingInvoiceId}
            duplicatingInvoiceData={duplicatingInvoiceData}
            onEditComplete={handleEditComplete}
            onInvoiceUpdated={handleInvoiceUpdated}
            onDuplicateComplete={handleDuplicateComplete}
            initialSubTab={initialSubTab}
          />
        );
      case "manage":
        return (
          <InvoiceManager
            onEditInvoice={handleEditInvoice}
            onPreviewInvoice={handlePreviewInvoice}
            onDuplicateInvoice={handleDuplicateInvoice}
            refreshTrigger={refreshTrigger}
            onInvoiceUpdated={handleInvoiceUpdated}
            isActive={activeTab === "manage"}
          />
        );
      case "signer":
        return <InvoiceSigner />;
      case "docsigner":
        return <DocumentSigner />;
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
    { key: "docsigner" as TabType, label: "Sign Document", icon: "📄" },
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
      <AgentChat agentType="freelance" onMutation={handleAgentMutation} />
    </div>
  );
};

export default Freelance;
