import {useCallback, useEffect, useState} from "react";
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
 * FE-9 (ak-55ks) shell + ak-zyli Invoices-hub consolidation.
 *
 * Pre-ak-zyli: 7 top-level tabs (Dashboard / Create / Manage / Sign /
 * Sign Doc / Export / Customers). Brief 06 §7 IA restructure asks
 * for the 4 invoice-specific flows to collapse into a single
 * "Invoices" tab with a sub-nav; this file delivers that.
 *
 * Post-ak-zyli top-level IA (4 tabs instead of 7):
 *
 *   Dashboard   → FreelanceDashboard
 *   Invoices    → sub-nav for Create / Manage / Sign / Sign Doc
 *   Export      → InvoiceExporter
 *   Customers   → CustomerManager
 *
 * Deep-link contract (bead ask):
 *   ?tab=invoices&sub=create|manage|signer|docsigner
 * `?sub=` alone implies `?tab=invoices`. Explicit `?tab=` wins when
 * both are present. URL is kept in sync on every tab/sub change via
 * history.replaceState (no router dep, no history-stack pollution).
 *
 * §23 cross-cutting (self-check): identical posture to ak-55ks — the
 * shell owns no money math, no PII, no charts; it routes state and
 * the sub-nav. Children are unchanged; the handful of
 * `setActiveTab("create" | "manage")` legacy call sites move to
 * `navigate("invoices", <sub>)` to reach the same destination
 * through the new IA.
 *
 * Scope note (ak-zyli): per the bead headline "consolidation" is the
 * primary deliverable + the bead's own "keeps the 4 code paths intact
 * behind one tab" clause, child-component Nocturne rewrites are
 * deferred to per-child follow-up beads flagged in the ak-zyli
 * handoff comment. 3,844 lines of children in a single commit would
 * carry non-trivial regression risk; the IA restructure is both
 * immediately user-visible and safe.
 */

type TopTabType = "dashboard" | "invoices" | "export" | "customers";
type InvoiceSubType = "create" | "manage" | "signer" | "docsigner";

interface TopTabDef {
    key: TopTabType;
    label: string;
    icon: string; // phosphor ph-* class name
}

interface InvoiceSubDef {
    key: InvoiceSubType;
    label: string;
    icon: string;
}

const TOP_TABS: TopTabDef[] = [
    {key: "dashboard", label: "Dashboard", icon: "ph-chart-pie-slice"},
    {key: "invoices", label: "Invoices", icon: "ph-receipt"},
    {key: "export", label: "Export", icon: "ph-download-simple"},
    {key: "customers", label: "Customers", icon: "ph-users-three"},
];

const INVOICE_SUBS: InvoiceSubDef[] = [
    {key: "create", label: "Create", icon: "ph-note-pencil"},
    {key: "manage", label: "Manage", icon: "ph-list-checks"},
    {key: "signer", label: "Sign invoice", icon: "ph-signature"},
    {key: "docsigner", label: "Sign doc", icon: "ph-file-text"},
];

const TOP_TAB_KEYS: TopTabType[] = ["dashboard", "invoices", "export", "customers"];
const INVOICE_SUB_KEYS: InvoiceSubType[] = ["create", "manage", "signer", "docsigner"];

const isTopTab = (v: unknown): v is TopTabType =>
    typeof v === "string" && (TOP_TAB_KEYS as string[]).includes(v);
const isInvoiceSub = (v: unknown): v is InvoiceSubType =>
    typeof v === "string" && (INVOICE_SUB_KEYS as string[]).includes(v);

/**
 * Read initial state from URL. Called once at mount time via `useState`
 * initializer. Explicit `?tab=` wins; otherwise a `?sub=` implies
 * `?tab=invoices`.
 */
function readInitialStateFromUrl(): {top: TopTabType; sub: InvoiceSubType} {
    if (typeof window === "undefined") return {top: "dashboard", sub: "create"};
    const params = new URLSearchParams(window.location.search);
    const rawSub = params.get("sub");
    const sub = isInvoiceSub(rawSub) ? rawSub : "create";
    const rawTop = params.get("tab");
    if (isTopTab(rawTop)) return {top: rawTop, sub};
    if (isInvoiceSub(rawSub)) return {top: "invoices", sub};
    return {top: "dashboard", sub};
}

const Freelance = () => {
    const initial = readInitialStateFromUrl();
    const [activeTopTab, setActiveTopTab] = useState<TopTabType>(initial.top);
    const [invoiceSub, setInvoiceSub] = useState<InvoiceSubType>(initial.sub);

    const [editingInvoiceId, setEditingInvoiceId] = useState<string | undefined>(undefined);
    const [duplicatingInvoiceData, setDuplicatingInvoiceData] = useState<InvoiceData | undefined>(undefined);
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [initialSubTab, setInitialSubTab] = useState<"creation" | "pdf-preview">("creation");

    // ak-zyli deep-link URL sync. Fires on every tab/sub change via the
    // dependency array so the URL always reflects the user's current
    // position. `replaceState` (not `pushState`) so each tab click
    // doesn't pollute the history stack with a new entry — the user
    // navigates via the tab bar, not back-arrow.
    useEffect(() => {
        if (typeof window === "undefined") return;
        const params = new URLSearchParams(window.location.search);
        params.set("tab", activeTopTab);
        if (activeTopTab === "invoices") {
            params.set("sub", invoiceSub);
        } else {
            params.delete("sub");
        }
        const next = params.toString();
        const url = window.location.pathname
            + (next ? `?${next}` : "")
            + window.location.hash;
        window.history.replaceState({}, "", url);
    }, [activeTopTab, invoiceSub]);

    // ak-zyli: cross-tab navigation helper used by every setActiveTab
    // call site that pre-ak-zyli targeted "create" / "manage" directly.
    // Now those destinations live under the Invoices hub, so the helper
    // sets both top + sub atomically.
    const goToInvoiceSub = useCallback((sub: InvoiceSubType) => {
        setActiveTopTab("invoices");
        setInvoiceSub(sub);
    }, []);

    // All handlers preserve their pre-ak-55ks behavior byte-for-byte;
    // only the destination plumbing swaps `setActiveTab("<legacy>")`
    // for the hub-aware `goToInvoiceSub(<sub>)`.
    const handleEditInvoice = (invoiceId: string) => {
        setEditingInvoiceId(invoiceId);
        setDuplicatingInvoiceData(undefined);
        setInitialSubTab("creation");
        goToInvoiceSub("create");
    };

    const handlePreviewInvoice = (invoiceId: string) => {
        setEditingInvoiceId(invoiceId);
        setDuplicatingInvoiceData(undefined);
        setInitialSubTab("pdf-preview");
        goToInvoiceSub("create");
    };

    const handleDuplicateInvoice = (invoice: InvoiceData) => {
        setEditingInvoiceId(undefined);
        setDuplicatingInvoiceData(invoice);
        goToInvoiceSub("create");
    };

    const handleEditComplete = () => {
        setEditingInvoiceId(undefined);
        setDuplicatingInvoiceData(undefined);
        setRefreshTrigger((prev) => prev + 1);
        goToInvoiceSub("manage");
    };

    const handleDuplicateComplete = () => {
        setDuplicatingInvoiceData(undefined);
        setRefreshTrigger((prev) => prev + 1);
        goToInvoiceSub("manage");
    };

    const handleInvoiceUpdated = () => {
        setRefreshTrigger((prev) => prev + 1);
    };

    const handleAgentMutation = useCallback(() => {
        setRefreshTrigger((prev) => prev + 1);
    }, []);

    // ak-zyli: sub-content renderer for the Invoices hub. Returns one
    // of the 4 consolidated child components by current sub-tab.
    const renderInvoiceSubContent = () => {
        switch (invoiceSub) {
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
                        isActive={activeTopTab === "invoices" && invoiceSub === "manage"}
                    />
                );
            case "signer":
                return <InvoiceSigner/>;
            case "docsigner":
                return <DocumentSigner/>;
            default:
                return null;
        }
    };

    const renderTopTabContent = () => {
        switch (activeTopTab) {
            case "dashboard":
                return (
                    <FreelanceDashboard
                        refreshTrigger={refreshTrigger}
                        isActive={activeTopTab === "dashboard"}
                        onNavigateToManage={() => goToInvoiceSub("manage")}
                    />
                );
            case "invoices":
                return (
                    <div className={styles.invoicesHub}>
                        <nav
                            className={styles.subTabBar}
                            role="tablist"
                            aria-label="Invoice sections"
                        >
                            {INVOICE_SUBS.map((sub) => (
                                <button
                                    key={sub.key}
                                    type="button"
                                    role="tab"
                                    aria-selected={invoiceSub === sub.key}
                                    className={`${styles.subTab} ${invoiceSub === sub.key ? styles.subTabActive : ""}`}
                                    onClick={() => setInvoiceSub(sub.key)}
                                >
                                    <i className={`ph ${sub.icon}`} aria-hidden/>
                                    <span>{sub.label}</span>
                                </button>
                            ))}
                        </nav>
                        <div className={styles.subContent}>
                            {renderInvoiceSubContent()}
                        </div>
                    </div>
                );
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
            <nav
                className={styles.shellTabBar}
                role="tablist"
                aria-label="Freelance sections"
            >
                {TOP_TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTopTab === tab.key}
                        className={`${styles.shellTab} ${activeTopTab === tab.key ? styles.shellTabActive : ""}`}
                        onClick={() => setActiveTopTab(tab.key)}
                    >
                        <i className={`ph ${tab.icon}`} aria-hidden/>
                        <span>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className={styles.shellContent}>{renderTopTabContent()}</div>

            <AgentChat agentType="freelance" onMutation={handleAgentMutation}/>
        </div>
    );
};

export default Freelance;
