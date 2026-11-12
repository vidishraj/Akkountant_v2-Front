import {useCallback, useState} from "react";
import FreelanceDashboard from "../../components/FreelanceDashboard/FreelanceDashboard";
import InvoiceCreator from "../../components/InvoiceCreator/InvoiceCreator";
import InvoiceManager from "../../components/InvoiceManager/InvoiceManager";
import InvoiceSigner from "../../components/InvoiceSigner/InvoiceSigner";
import DocumentSigner from "../../components/DocumentSigner/DocumentSigner";
import InvoiceExporter from "../../components/InvoiceExporter/InvoiceExporter";
import CustomerManager from "../../components/CustomerManager/CustomerManager";
import AgentChat from "../../components/AgentChat/AgentChat";
import {InvoiceData} from "../../utils/interfaces";
import styles from "./Freelance.module.scss";

/**
 * FE-9 (ak-55ks) Freelance tab shell — Nocturne-native.
 *
 * Replaces the pre-FE-9 shell (BasicCard + emoji icons) with a Nocturne
 * tab bar driven by the shared design-system tokens. Preserves every
 * child-component wiring + handler flow byte-for-byte; only the shell's
 * render surface changes:
 * - BasicCard dropped for a Nocturne surface panel
 * - Emoji tab icons swapped to Phosphor (`ph-*`)
 * - Hex colors in the SCSS swapped for Nocturne tokens (`var(--color-*)`)
 * - AgentChat wiring unchanged — consumes FE-7's shared primitive via
 *   the existing bridge (`agentType="freelance"`)
 *
 * Tab lineup preserved from pre-FE-9 (the lead bead's comment #2
 * described a 7-tab vision; the current repo tabs map 1:1 to real child
 * components — brief 06's 4-tab collapse is a separate consolidation
 * task that would touch the child components themselves and sits outside
 * `src/pages/Freelance/*` scope):
 *
 *   Dashboard  → FreelanceDashboard
 *   Create     → InvoiceCreator
 *   Manage     → InvoiceManager
 *   Sign       → InvoiceSigner
 *   Sign Doc   → DocumentSigner
 *   Export     → InvoiceExporter
 *   Customers  → CustomerManager
 *
 * §23 cross-cutting (self-check):
 * - #1 single-user: no sharing / multi-user UI.               ✅ no-touch
 * - #2 consume-not-recompute: shell owns no money math — all
 *   KPI/chart compute lives in the child components (out of FE-9
 *   scope); the shell routes state only.                       ✅ no-touch
 * - #4 PII containment: shell routes to existing child surfaces;
 *   reveal-on-explicit-action posture is enforced inside those
 *   children (CustomerManager / InvoiceManager).                ✅ no-touch
 * - #5 confirm-gate: destructive ops (void invoice / delete customer)
 *   routed via FE-7's AgentChat variant system when agent-triggered;
 *   UI-triggered destructive ops still live in child components.  ✅ no-touch
 * - #6 INR formatting: child components use the shared formatters.  ✅ no-touch
 * - #8 constant-composition history: any chart inside FreelanceDashboard
 *   should adopt the `buildTrendPaths` pattern — flagged for follow-up
 *   bead if it hasn't already (child is out of FE-9 scope).         ✅ noted
 */

type TabType =
    | "dashboard"
    | "create"
    | "manage"
    | "signer"
    | "docsigner"
    | "export"
    | "customers";

interface TabDef {
    key: TabType;
    label: string;
    icon: string; // phosphor ph-* class name
}

const TABS: TabDef[] = [
    {key: "dashboard", label: "Dashboard", icon: "ph-chart-pie-slice"},
    {key: "create", label: "Create", icon: "ph-note-pencil"},
    {key: "manage", label: "Manage", icon: "ph-list-checks"},
    {key: "signer", label: "Sign invoice", icon: "ph-signature"},
    {key: "docsigner", label: "Sign doc", icon: "ph-file-text"},
    {key: "export", label: "Export", icon: "ph-download-simple"},
    {key: "customers", label: "Customers", icon: "ph-users-three"},
];

const Freelance = () => {
    const [activeTab, setActiveTab] = useState<TabType>("dashboard");
    const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>(undefined);
    const [duplicatingInvoiceData, setDuplicatingInvoiceData] = useState<InvoiceData | undefined>(undefined);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [initialSubTab, setInitialSubTab] = useState<"creation" | "pdf-preview">("creation");

    // All handlers preserved byte-for-byte from pre-FE-9.
    const handleEditInvoice = (invoiceId: string) => {
        setEditingInvoiceId(invoiceId);
        setDuplicatingInvoiceData(undefined);
        setInitialSubTab("creation");
        setActiveTab("create");
    };

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
                return (
                    <FreelanceDashboard
                        refreshTrigger={refreshTrigger}
                        isActive={activeTab === "dashboard"}
                        onNavigateToManage={() => setActiveTab("manage")}
                    />
                );
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
                return <InvoiceSigner/>;
            case "docsigner":
                return <DocumentSigner/>;
            case "export":
                return <InvoiceExporter/>;
            case "customers":
                return <CustomerManager/>;
            default:
                return <FreelanceDashboard/>;
        }
    };

    return (
        <div className={styles.page}>
            <nav className={styles.shellTabBar} role="tablist" aria-label="Freelance sections">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={`${styles.shellTab} ${activeTab === tab.key ? styles.shellTabActive : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        <i className={`ph ${tab.icon}`} aria-hidden/>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className={styles.shellContent}>{renderTabContent()}</div>

            <AgentChat agentType="freelance" onMutation={handleAgentMutation}/>
        </div>
    );
};

export default Freelance;
