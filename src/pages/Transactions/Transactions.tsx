import {bankMonogram, bankName, isStatementRecord} from "../../utils/bankLabels.ts";
import {useCallback, useEffect, useMemo, useState} from "react";
import TransactionFilters from "../../components/TransactionFilterComponent/TransactionFilters.tsx";
import {
    checkGoogleStatus,
    deleteFile,
    downloadFile,
    fetchFileDetails,
    fetchOptedBanks,
    fetchTransactions,
} from "../../services/transactionService.ts";
import {makeDriveInitialRequest, makeInitialRequest} from "../../services/GoogleApiUtils.tsx";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import CalendarComponent from "../../components/CalendarComponent/Calendar.tsx";
import {useUser} from "../../contexts/GlobalContext.tsx";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import FileDetailsCard from "../../components/FileDetailsCardComponent/FileDetailsCard.tsx";
import FileFilterCompact from "../../components/FileFilterComponent/FileFilterCompact.tsx";
import SortedBy from "../../components/SortComponent.tsx";
import FileSummary from "../../components/FileSummaryComponent/FileSummary.tsx";
import AgentChat from "../../components/AgentChat/AgentChat.tsx";
import useModalA11y from "../../hooks/useModalA11y.ts";
import {useAgentChatBridge} from "../../contexts/AgentChatBridgeContext.tsx";
import {useMessage} from "../../contexts/MessageContext.tsx";
import {formatCompact, formatCurrency} from "../../components/WealthDigest/formatters.ts";
import {formatDateString} from "../../utils/util.tsx";
import type {FileDetails, Transaction} from "../../utils/interfaces.ts";
import style from "./Transaction.module.scss";
import "react-toastify/dist/ReactToastify.css";
import React, {useRef} from "react";

/**
 * FE-8 (ak-ko52) Transactions page — Nocturne-native shell.
 * FE-14 (ak-4qgd) sidebar overhaul: moved LEFT → RIGHT, mode switcher +
 * GoogleComponent removed from sidebar, three new cards added
 * (Spend-by-category / Recurring / Ingestion connected-status).
 * FE-16 (ak-inli) ledger polish: columns reordered to Bank / Description
 * (+ inline Category chip) / Date / Amount; BankChip monospace component;
 * column-level hide-amounts privacy toggle (blur + click-to-reveal);
 * detail-drawer "Links" section (Attach from Files + Link investment)
 * and "Find similar with assistant" CTA. The three new drawer actions
 * dispatch through the AgentChatBridge with pre-filled payloads — the
 * agent handles the actual linking/search behavior, so this is a UI-
 * surface wire with no new BE contract.
 * FE-15 (ak-v1f5) prompt strip + '+ Add' consolidation: on-page agent-
 * prompt strip ("Ask the Transactions assistant") sits at the top of
 * the main content with 3 sample prompt pills; '+ Add' menu in the
 * filter bar consolidates Scan / Import / Sync Email ingestion
 * triggers. All pills + menu options dispatch via AgentChatBridge
 * (same pattern as the ak-inli drawer Links — single bridge contract
 * handles discovery/attach/trigger intents). ModeSelectorComponent's
 * FieldSelector.tsx deleted (orphan after ak-4qgd's ModeToggle).
 *
 * Replaces the pre-FE-8 composition (MUI Drawer + TablePagination + MUI
 * TransactionCard). The row rendering is inlined so FE-8 can hit its
 * density target (brief 05 pain point: 11.5K-row surface needs tight
 * rows) + wire row-click to the new transaction detail drawer + carry a
 * Category/Tag placeholder slot without touching the TransactionCard
 * component (out of scope).
 *
 * Preserved wiring (no regression):
 * - `refreshTransactions` / `refreshFileDetails` / `handleAgentMutation`
 *   logic byte-identical to pre-FE-8 — only the render surface changes.
 * - Mode switching (transaction vs file ingestion) preserved — the toggle
 *   moved from sidebar FieldSelector to a compact Nocturne segment
 *   control at the top of the main content (ak-4qgd requirement: mode
 *   switcher is NOT in the sidebar per design, but file mode must stay
 *   accessible).
 * - CalendarComponent / FileDetailsCard / FileFilterCompact / SortedBy /
 *   FileSummary / TransactionFilters / AgentChat all untouched.
 *
 * §23 rules honored:
 * - §2 CONSUME-not-recompute: Credit/Debit/Net hero reads `credits`/
 *   `debits` directly from `FilterContext.state.transactions` — no FE
 *   re-derivation. Net = credit - debit (same convention as pre-FE-8
 *   `TransactionSummary.tsx`). The Spend-by-category + Recurring cards
 *   are SAMPLE data per ak-4qgd (BE not yet enriched) — explicitly
 *   labeled with "Sample" chips per the FE-3 stub convention.
 * - §4 PII containment: the detail drawer surfaces amount + bank + date
 *   + details string + reference ID only. **Raw email body / receipt
 *   contents are NOT rendered by default.** Any future "View email"
 *   affordance is reveal-on-explicit-action (not inlined here).
 * - §5 confirm-gate: File-mode delete flows through the same message
 *   payload pattern pre-FE-8 used; destructive-tool confirms are owned
 *   by FE-7's AgentChat variant system.
 * - §6 INR formatting: shared `formatCurrency`/`formatCompact` + SCSS
 *   tabular-nums.
 * - §10 receipts / auto-export: no auto-copy / auto-export of raw
 *   contents. The pre-FE-8 Download flow (file-mode) is preserved
 *   unchanged — it only downloads what the user explicitly clicked.
 */

// ak-5aw4: bank labels + the statements allow-list come from
// utils/bankLabels (shared map incl. the ak-iu8i banks); no local copies.

const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";

/**
 * Nocturne-native pagination — replaces MUI `<TablePagination>`. Same
 * contract (page/count/rowsPerPage/onPageChange/onRowsPerPageChange).
 */
interface NocturnePagerProps {
    page: number;
    count: number;
    rowsPerPage: number;
    onPageChange: (page: number) => void;
    onRowsPerPageChange: (rows: number) => void;
}

const NocturnePager: React.FC<NocturnePagerProps> = ({
    page,
    count,
    rowsPerPage,
    onPageChange,
    onRowsPerPageChange,
}) => {
    const totalPages = Math.max(1, Math.ceil(count / Math.max(rowsPerPage, 1)));
    const curPage = Math.min(page, totalPages - 1);
    const fromRow = count === 0 ? 0 : curPage * rowsPerPage + 1;
    const toRow = Math.min(count, (curPage + 1) * rowsPerPage);
    return (
        <div className={style.pager}>
            <label className={style.pagerSize}>
                <span>Rows</span>
                <select
                    value={rowsPerPage}
                    onChange={(e) => onRowsPerPageChange(Number(e.target.value) || 100)}
                    className={style.pagerSelect}
                >
                    {[25, 50, 100, 200, 500].map((n) => (
                        <option key={n} value={n}>{n}</option>
                    ))}
                </select>
            </label>
            <span className={style.pagerRange}>
                {fromRow.toLocaleString("en-IN")} – {toRow.toLocaleString("en-IN")} of {count.toLocaleString("en-IN")}
            </span>
            <div className={style.pagerNav}>
                <button
                    type="button"
                    className={`btn btn-icon ${style.pagerBtn}`}
                    onClick={() => onPageChange(Math.max(0, curPage - 1))}
                    disabled={curPage <= 0}
                    aria-label="Previous page"
                >
                    <i className="ph ph-caret-left"/>
                </button>
                <span className={style.pagerPos}>
                    Page {curPage + 1} / {totalPages}
                </span>
                <button
                    type="button"
                    className={`btn btn-icon ${style.pagerBtn}`}
                    onClick={() => onPageChange(Math.min(totalPages - 1, curPage + 1))}
                    disabled={curPage >= totalPages - 1}
                    aria-label="Next page"
                >
                    <i className="ph ph-caret-right"/>
                </button>
            </div>
        </div>
    );
};

/**
 * ak-4qgd: Spend-by-category mini bar chart. SAMPLE DATA per bead —
 * BE enrichment (tagging / category inference over the Transaction
 * table) is not yet wired. Shows the design's intent + ratio shapes
 * so a future BE wire can drop in without card-chrome changes.
 * Labeled with the Nocturne "Sample" chip convention established in
 * FE-3 (ak-ff9r Investments stub chips).
 */
const SAMPLE_CATEGORIES: {label: string; share: number; color: string}[] = [
    {label: "Food & dining",   share: 28, color: "var(--color-accent-500)"},
    {label: "Transport",       share: 18, color: "var(--color-accent-700)"},
    {label: "Bills & rent",    share: 24, color: "var(--color-accent-300)"},
    {label: "Shopping",        share: 12, color: "var(--color-accent-2-500)"},
    {label: "Other",           share: 18, color: "var(--color-neutral-500)"},
];

const SpendByCategoryCard: React.FC = () => (
    <div className={style.sideCard}>
        <div className={style.sideCardHeader}>
            <h5 className={style.sideCardTitle}>Spend by category</h5>
            <span className={style.sampleChip}>Sample</span>
        </div>
        <div className={style.catChart} role="list" aria-label="Spend breakdown by category">
            {SAMPLE_CATEGORIES.map((c) => (
                <div key={c.label} className={style.catRow} role="listitem">
                    <div className={style.catLabel}>
                        <span className={style.catSwatch} style={{background: c.color}}/>
                        <span className={style.catLabelText}>{c.label}</span>
                        <span className={style.catPct}>{c.share}%</span>
                    </div>
                    <div className={style.catBar}>
                        <div
                            className={style.catBarFill}
                            style={{width: `${c.share}%`, background: c.color}}
                        />
                    </div>
                </div>
            ))}
        </div>
        <span className={style.sideCardHint}>
            Last 30 days · BE tagging pending
        </span>
    </div>
);

/**
 * ak-4qgd: Recurring-tx candidate list. SAMPLE DATA per bead — BE
 * recurring-detector pass is not yet wired. Three illustrative rows
 * (vendor / cadence / next billing / amount) so the card shape is
 * carved out; swap sample array for BE list when the detector lands.
 */
const SAMPLE_RECURRING: {vendor: string; cadence: string; nextAt: string; amount: number}[] = [
    {vendor: "Netflix",          cadence: "Monthly", nextAt: "5 Dec",   amount: 649},
    {vendor: "Rent · landlord",  cadence: "Monthly", nextAt: "1 Dec",   amount: 42000},
    {vendor: "AWS",              cadence: "Monthly", nextAt: "12 Dec",  amount: 1820},
];

const RecurringCard: React.FC = () => (
    <div className={style.sideCard}>
        <div className={style.sideCardHeader}>
            <h5 className={style.sideCardTitle}>Recurring</h5>
            <span className={style.sampleChip}>Sample</span>
        </div>
        <ul className={style.recurList}>
            {SAMPLE_RECURRING.map((r) => (
                <li key={r.vendor} className={style.recurItem}>
                    <div className={style.recurLeft}>
                        <span className={style.recurVendor}>{r.vendor}</span>
                        <span className={style.recurMeta}>{r.cadence} · next {r.nextAt}</span>
                    </div>
                    <span className={style.recurAmount}>
                        ₹{formatCurrency(r.amount)}
                    </span>
                </li>
            ))}
        </ul>
        <span className={style.sideCardHint}>
            Candidate recurring debits · BE detector pending
        </span>
    </div>
);

/**
 * ak-4qgd: Ingestion-sources connected-status card. Reads live state
 * via `/getGoogleStatus?serviceType={gmail|gdrive}` — the same endpoint
 * the pre-ak-4qgd GoogleComponent used (so this is a UI rebrand, not a
 * BE contract change). Disconnected rows expose a "Reconnect" button
 * that invokes the existing `makeInitialRequest` (gmail) /
 * `makeDriveInitialRequest` (gdrive) OAuth entrypoints, preserving the
 * reconnect affordance the removed GoogleComponent used to provide.
 */
type IngestionStatus = "success" | "error" | "loading";

const IngestionStatusCard: React.FC = () => {
    const [gmailStatus, setGmailStatus] = useState<IngestionStatus>("loading");
    const [gdriveStatus, setGdriveStatus] = useState<IngestionStatus>("loading");

    const check = useCallback(async (which: "gmail" | "gdrive") => {
        const setter = which === "gmail" ? setGmailStatus : setGdriveStatus;
        try {
            const response = await checkGoogleStatus(which);
            setter(response.Message === "Successful" ? "success" : "error");
        } catch {
            setter("error");
        }
    }, []);

    useEffect(() => {
        void check("gmail");
        void check("gdrive");
    }, [check]);

    const row = (
        which: "gmail" | "gdrive",
        label: string,
        status: IngestionStatus,
    ) => {
        const connected = status === "success";
        const loading = status === "loading";
        const chipColor = loading
            ? "var(--color-neutral-500)"
            : connected
                ? "oklch(0.80 0.13 155)"
                : "oklch(0.74 0.15 25)";
        const chipText = loading ? "Checking…" : connected ? "Connected" : "Expired";
        return (
            <div className={style.ingestRow} key={which}>
                <div className={style.ingestLabel}>
                    <i
                        className={`ph ${which === "gmail" ? "ph-envelope-simple" : "ph-file-text"}`}
                        aria-hidden="true"
                    />
                    <span>{label}</span>
                </div>
                <span
                    className={style.ingestChip}
                    style={{
                        color: chipColor,
                        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${chipColor} 35%, transparent)`,
                    }}
                >
                    {chipText}
                </span>
                {!loading && !connected && (
                    <button
                        type="button"
                        onClick={() => (which === "gmail" ? makeInitialRequest() : makeDriveInitialRequest())}
                        className={`btn btn-ghost ${style.ingestReconnectBtn}`}
                    >
                        Reconnect
                    </button>
                )}
            </div>
        );
    };

    return (
        <div className={style.sideCard}>
            <div className={style.sideCardHeader}>
                <h5 className={style.sideCardTitle}>Ingestion sources</h5>
            </div>
            <div className={style.ingestList}>
                {row("gmail", "Gmail inbox", gmailStatus)}
                {row("gdrive", "Statement parser", gdriveStatus)}
            </div>
            <span className={style.sideCardHint}>
                Gmail delivers receipts · statement parser ingests PDFs
            </span>
        </div>
    );
};

/**
 * ak-4qgd: compact Nocturne mode-toggle. Replaces the sidebar
 * FieldSelector (MUI IconButton pair) with a native segment control
 * at the top of the main content. Preserves the Transactions ↔ Files
 * switch per SAFE constraint (removing FieldSelector from the sidebar
 * would strand the file-ingestion view otherwise).
 */
/**
 * ak-f5vf: bank monogram tile for the ledger's first column (design:
 * 26px mono tile; full bank name sits under the description).
 */
const BankMono: React.FC<{bank: string | null | undefined}> = ({bank}) => (
    <span className={style.bankMono} title={bankName(bank)}>
        {bankMonogram(bank)}
    </span>
);

/**
 * ak-f5vf: ledger date per design — "Thu, Oct 1, 2026". `yyyy-mm-dd` is
 * a calendar date, so it is formatted in UTC to avoid a timezone shift;
 * any other shape falls back to the shared formatter.
 */
const LEDGER_DATE_FMT = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
});
function formatLedgerDate(date: string | null | undefined): string {
    if (!date) return "—";
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(date);
    if (m) {
        const d = new Date(`${m[1]}T00:00:00Z`);
        if (!Number.isNaN(d.getTime())) return LEDGER_DATE_FMT.format(d);
    }
    return formatDateString(date);
}

/**
 * ak-v1f5 → ak-f5vf: assistant omni bar (design: one input + prompt
 * chips on a single surface, first on the page). Enter or a chip sends
 * the text through the shared AgentChatBridge (same imperative-bridge
 * pattern as the drawer Links) — zero new BE contract.
 */
const SAMPLE_PROMPTS: string[] = [
    "What did I spend on groceries last month?",
    "Show my unreconciled transactions.",
    "Flag likely recurring charges from the last 90 days.",
];

const AgentOmniBar: React.FC<{onSend: (payload: string) => void}> = ({onSend}) => {
    const [q, setQ] = useState("");
    const send = (text: string) => {
        const t = text.trim();
        if (!t) return;
        onSend(t);
        setQ("");
    };
    return (
        <section className={style.omni}>
            <i className={`ph ph-sparkle ${style.omniIcon}`} aria-hidden="true"/>
            <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") send(q);
                }}
                placeholder="Ask the Transactions assistant — it searches your whole ledger"
                aria-label="Ask the Transactions assistant"
                className={style.omniInput}
            />
            <div className={style.omniPills} role="group" aria-label="Sample prompts">
                {SAMPLE_PROMPTS.map((p) => (
                    <button
                        key={p}
                        type="button"
                        onClick={() => send(p)}
                        className={style.promptPill}
                        title={p}
                    >
                        {p.length > 34 ? `${p.slice(0, 32)}…` : p}
                    </button>
                ))}
            </div>
        </section>
    );
};

/**
 * ak-v1f5: '+ Add' consolidation menu.
 *
 * Replaces the FieldSelector + scattered scan/statement/email-sync
 * entrypoints with a single filter-bar button that opens a 3-option
 * menu. Each option dispatches via AgentChatBridge with a
 * pre-filled intent — the agent's tool-use layer handles the actual
 * scanner / upload / email-sync, so no new BE contract.
 *
 * Accessibility:
 * - `aria-haspopup="menu"` + `aria-expanded` on the trigger
 * - `role="menu"` on the panel, `role="menuitem"` on each option
 * - Click-outside close via document-level pointerdown listener while
 *   open, scoped by a ref so the trigger click isn't double-handled
 * - Esc-to-close inline
 */
interface AddMenuOption {
    label: string;
    icon: string;
    payload: string;
}
const ADD_MENU_OPTIONS: AddMenuOption[] = [
    {
        label: "Scan receipt",
        icon: "ph-camera",
        payload: "I'd like to scan a new receipt. Open the receipt scanner for me.",
    },
    {
        label: "Import statement",
        icon: "ph-file-arrow-up",
        payload: "I'd like to import a bank statement file. Trigger the statement importer.",
    },
    {
        label: "Sync email",
        icon: "ph-envelope-simple",
        payload: "Sync my Gmail inbox for new transactions from the last 30 days.",
    },
];

const AddMenu: React.FC<{onPick: (payload: string) => void}> = ({onPick}) => {
    const [open, setOpen] = useState<boolean>(false);
    const wrapRef = useRef<HTMLDivElement | null>(null);

    // Click-outside + Esc close. Only wired while open to keep idle
    // document listeners at zero — matches the detail-drawer pattern.
    useEffect(() => {
        if (!open) return;
        const onDoc = (e: Event) => {
            const target = e.target as Node | null;
            if (wrapRef.current && target && !wrapRef.current.contains(target)) {
                setOpen(false);
            }
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setOpen(false);
        };
        document.addEventListener("pointerdown", onDoc);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("pointerdown", onDoc);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div className={style.addMenuWrap} ref={wrapRef}>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className={`btn btn-primary ${style.addMenuBtn}`}
                aria-haspopup="menu"
                aria-expanded={open}
            >
                <i className="ph ph-plus" aria-hidden="true"/>
                <span>Add</span>
            </button>
            {open && (
                <div className={style.addMenuPanel} role="menu">
                    {ADD_MENU_OPTIONS.map((opt) => (
                        <button
                            key={opt.label}
                            type="button"
                            role="menuitem"
                            onClick={() => {
                                setOpen(false);
                                onPick(opt.payload);
                            }}
                            className={style.addMenuItem}
                        >
                            <i className={`ph ${opt.icon}`} aria-hidden="true"/>
                            <span>{opt.label}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

interface ModeToggleProps {
    transactionMode: boolean;
    onSet: (next: boolean) => void;
}
const ModeToggle: React.FC<ModeToggleProps> = ({transactionMode, onSet}) => (
    <div className={style.modeToggle} role="tablist" aria-label="View mode">
        <button
            type="button"
            role="tab"
            aria-selected={transactionMode}
            onClick={() => onSet(true)}
            className={`${style.modeToggleBtn} ${transactionMode ? style.modeToggleBtnActive : ""}`}
        >
            <i className="ph ph-receipt" aria-hidden="true"/>
            <span>Transactions</span>
        </button>
        <button
            type="button"
            role="tab"
            aria-selected={!transactionMode}
            onClick={() => onSet(false)}
            className={`${style.modeToggleBtn} ${!transactionMode ? style.modeToggleBtnActive : ""}`}
        >
            <i className="ph ph-files" aria-hidden="true"/>
            <span>Files</span>
        </button>
    </div>
);

const Transactions = () => {
    const {state, dispatch} = useFilterContext();
    const {state: fileState, dispatch: fileDispatch} = useFileFilterContext();
    const {transactionModeSelection, setTransactionMode, optedBanks, setOptedBanks, user} = useUser();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [detailTx, setDetailTx] = useState<Transaction | null>(null);
    const {setPayload} = useMessage();
    // ak-inli: AgentChatBridge handle — used by the three drawer actions
    // (Attach from Files / Link investment / Find similar with assistant)
    // to open the agent drawer with a pre-filled payload instead of
    // adding three bespoke endpoints.
    const {setCommand: setAgentCommand} = useAgentChatBridge();

    // ak-inli: column-level hide-amounts privacy toggle. Starts REVEALED
    // (default-visible) since the Transactions page is already behind the
    // auth gate; the toggle exists for over-the-shoulder / screen-share
    // scenarios. Click the Amount column header → blur all amount cells;
    // click again → reveal.
    const [amountsHidden, setAmountsHidden] = useState<boolean>(false);

    // Client-side mobile detection via resize — drops MUI's useMediaQuery.
    const [isMobile, setIsMobile] = useState<boolean>(
        typeof window !== "undefined" ? window.innerWidth <= 1000 : false,
    );
    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth <= 1000);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    const refreshTransactions = useCallback(() => {
        const requestBody = {
            Page: state.page + 1,
            Filter: {
                bank: state.bank || undefined,
                details: state.searchTerm || undefined,
                tag: state.month || undefined,
                // ak-f5vf: "all" → omit the clause (BE applies no source filter).
                source: state.source && state.source !== "all" ? state.source : undefined,
                dateRange: state.startDate || state.endDate
                    ? {
                        dateFrom: state.startDate,
                        dateTo: state.endDate,
                    }
                    : undefined,
                sorted: {
                    column: state.sortBy.sortBy,
                    order: state.sortBy.sortDirection,
                },
                limit: state.limit,
            },
        };

        fetchTransactions(requestBody)
            .then((result) => {
                dispatch({
                    type: "SET_TRANSACTIONS",
                    payload: {
                        transaction: result.results,
                        // ak-5rg0 (ak-p3id companion): bind to BE's
                        // canonical positive-magnitude fields instead
                        // of the legacy signed credit_sum/debit_sum.
                        // Pre-ak-p3id the Transactions header rendered
                        // "+In > Out" as a NEGATIVE net because
                        // credit_sum was signed-negative; the BE now
                        // emits `in_sum` (≥ 0), `out_sum` (≥ 0), and
                        // a signed `net = in_sum - out_sum`.
                        credits: result.in_sum,
                        debits: result.out_sum,
                        net: result.net,
                    },
                });
                dispatch({type: "SET_TRANSACTION_COUNT", payload: result.total_count});
            })
            .catch((error) => {
                setPayload({
                    type: "error",
                    message: "Failed to load transactions. Please try again!",
                });
                console.error("Error fetching transactions:", error);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, dispatch, setPayload]);

    const refreshFileDetails = useCallback(() => {
        const requestBody = {
            Page: fileState.filePage + 1,
            Filter: {
                bank: fileState.bank || undefined,
                fileName: fileState.fileName || undefined,
                dateRange: fileState.startDate || fileState.endDate
                    ? {
                        dateFrom: fileState.startDate,
                        dateTo: fileState.endDate,
                    }
                    : undefined,
                sorted: {
                    column: fileState.sortBy.sortBy,
                    order: fileState.sortBy.sortDirection,
                },
                limit: fileState.limit,
            },
        };

        fetchFileDetails(requestBody)
            .then((result) => {
                fileDispatch({type: "SET_FILE_DETAILS", payload: result.results});
                fileDispatch({type: "SET_FILE_COUNT", payload: result.total_count});
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: "Failed to fetch file details. Please try again!",
                });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileState, fileDispatch, setPayload]);

    const handleAgentMutation = useCallback(() => {
        refreshTransactions();
        refreshFileDetails();
    }, [refreshTransactions, refreshFileDetails]);

    useEffect(() => {
        refreshTransactions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state.page, state.sortBy, state.limit, state.source]);

    useEffect(() => {
        refreshFileDetails();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fileState.filePage, fileState.sortBy, fileState.limit]);

    useEffect(() => {
        fetchOptedBanks()
            .then((response) => {
                if (Array.isArray(response)) setOptedBanks(response);
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: "Failed to fetch opted banks. Please try again!",
                });
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user]);

    // Hero numbers — CONSUME directly from context; no FE re-derivation.
    // ak-5rg0 (ak-p3id companion): `net` is now the BE-authoritative
    // signed value (`in_sum - out_sum`) read verbatim from state,
    // NOT re-derived via `credit - debit`. Pre-ak-p3id the FE
    // subtraction flipped the sign because `credits` was itself
    // signed-NEGATIVE (the legacy credit_sum convention). Rendering
    // keeps the +/− prefix glyph but the magnitude comes from BE.
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
    const net = state.transactions.net;

    // Detail drawer a11y via FE-7's shared useModalA11y hook (focus-on-open,
    // focus-restore, tab-trap). Esc-to-close stays inline per the hook's
    // explicit design decision.
    const detailRef = useRef<HTMLDivElement | null>(null);
    useModalA11y({
        open: detailTx !== null,
        panelRef: detailRef as React.RefObject<HTMLElement>,
    });

    const closeDetail = () => setDetailTx(null);
    useEffect(() => {
        if (!detailTx) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") closeDetail();
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [detailTx]);

    // ak-cqfn: mobile-sidebar a11y. Same shared hook (focus-on-open to the
    // close button, focus-restore, tab-trap). The pre-ak-cqfn surface had
    // backdrop click-outside and role/aria presentation but NO focus
    // management and NO Esc handler. This makes the mobile overlay
    // keyboard-usable and matches the FE-7 modal contract.
    const sidebarRef = useRef<HTMLElement | null>(null);
    useModalA11y({
        open: sidebarOpen,
        panelRef: sidebarRef as React.RefObject<HTMLElement>,
    });
    useEffect(() => {
        if (!sidebarOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSidebarOpen(false);
        };
        document.addEventListener("keydown", onKey);
        return () => document.removeEventListener("keydown", onKey);
    }, [sidebarOpen]);

    // ak-v1f5: dispatch an agent prompt / menu option through the shared
    // AgentChatBridge. Mirrors the ak-inli drawer-Links dispatch shape.
    const dispatchAgent = useCallback((payload: string) => {
        setAgentCommand({
            type: "send_message",
            payload,
            timestamp: Date.now(),
        });
    }, [setAgentCommand]);

    // ak-f5vf: scope note beside the tiles ("Totals follow the filters
    // above"). Names the active scope so the totals are never ambiguous.
    const hasFilters = Boolean(
        state.searchTerm || state.startDate || state.endDate || state.bank || state.month,
    );
    const sourceScope = state.source === "statement"
        ? " · statements only"
        : state.source === "email"
            ? " · emails only"
            : "";
    const scopeLabel = `${hasFilters ? "Filtered view" : "All accounts · all time"}${sourceScope}`;

    const setSort = (column: string) => {
        const same = state.sortBy.sortBy === column;
        dispatch({
            type: "SET_SORT_BY",
            payload: {
                sortBy: column,
                sortDirection: same && state.sortBy.sortDirection === "desc" ? "asc" : "desc",
            },
        });
    };
    const sortIcon = (column: string) =>
        state.sortBy.sortBy === column
            ? (state.sortBy.sortDirection === "asc" ? "ph-arrow-up" : "ph-arrow-down")
            : "";

    // ak-f5vf: design order — (omni) → (toggle) → filter row → tiles.
    const renderTransactionTop = () => (
        <>
            <TransactionFilters
                isMobile={isMobile}
                setDrawerState={() => setSidebarOpen(true)}
                apply={refreshTransactions}
                trailing={<AddMenu onPick={dispatchAgent}/>}
            />

            <section className={style.hero}>
                <div className={style.heroTile}>
                    <span className={style.heroLabel}>Credit · in</span>
                    <span className={style.heroValue} style={{color: CLR_GAIN}}>
                        +₹{formatCompact(Math.abs(credit))}
                    </span>
                    <span className={style.heroSub} title={`₹${formatCurrency(Math.abs(credit))}`}>
                        ₹{formatCurrency(Math.abs(credit))}
                    </span>
                </div>
                <div className={style.heroTile}>
                    <span className={style.heroLabel}>Debit · out</span>
                    <span className={style.heroValue} style={{color: CLR_LOSS}}>
                        −₹{formatCompact(Math.abs(debit))}
                    </span>
                    <span className={style.heroSub} title={`₹${formatCurrency(Math.abs(debit))}`}>
                        ₹{formatCurrency(Math.abs(debit))}
                    </span>
                </div>
                <div className={`${style.heroTile} ${style.heroTileNet}`}>
                    <span className={style.heroLabel}>Net · in − out</span>
                    <span
                        className={style.heroValue}
                        style={{color: net >= 0 ? CLR_GAIN : CLR_LOSS}}
                    >
                        {net >= 0 ? "+" : "−"}₹{formatCompact(Math.abs(net))}
                    </span>
                    <span className={style.heroSub}>
                        {state.transactionCount.toLocaleString("en-IN")} rows in view
                    </span>
                </div>
                <div className={style.heroScope}>
                    <span className={style.heroScopeLabel}>
                        <i className="ph ph-funnel" aria-hidden="true"/>
                        {scopeLabel}
                    </span>
                    <span className={style.heroScopeNote}>Totals follow the filters above</span>
                </div>
            </section>
        </>
    );

    const renderLedger = () => (
        <section className={style.ledger}>
            <div className={style.ledgerHead}>
                <h4 className={style.ledgerTitle}>Ledger</h4>
                <span className={style.ledgerSub}>
                    Bank memo is the source of truth · categories are suggestions layered on top
                </span>
                <span className={style.ledgerSpacer}/>
                {/* ak-inli privacy toggle, moved from the Amount header into
                    the ledger head (design's head-right ghost action). */}
                <button
                    type="button"
                    onClick={() => setAmountsHidden((v) => !v)}
                    className={`btn btn-ghost ${style.ledgerHeadBtn}`}
                    aria-pressed={amountsHidden}
                >
                    <i className={`ph ${amountsHidden ? "ph-eye" : "ph-eye-slash"}`} aria-hidden="true"/>
                    {amountsHidden ? "Show amounts" : "Hide amounts"}
                </button>
            </div>

            {state.transactions.transaction.length === 0 ? (
                <div className={style.emptyPanel}>
                    <span className={style.emptyPrimary}>No transactions found</span>
                    <span className={style.emptySub}>
                        Pull new transactions from + Add, or widen your filters.
                    </span>
                </div>
            ) : (
                <div className={style.txnScroll}>
                    <div className={style.txnList} role="table" aria-label="Transactions">
                        <div className={style.txnHeader} role="row">
                            <span role="columnheader" aria-label="Bank"/>
                            <span role="columnheader">Description</span>
                            <span role="columnheader" className={style.txnColCategory}>Category</span>
                            <span role="columnheader">
                                <button type="button" className={style.sortBtn} onClick={() => setSort("date")}>
                                    Date
                                    {sortIcon("date") && <i className={`ph ${sortIcon("date")}`} aria-hidden="true"/>}
                                </button>
                            </span>
                            <span role="columnheader" className={style.txnColAmount}>
                                <button type="button" className={style.sortBtn} onClick={() => setSort("amount")}>
                                    Amount
                                    {sortIcon("amount") && <i className={`ph ${sortIcon("amount")}`} aria-hidden="true"/>}
                                </button>
                            </span>
                        </div>
                        {state.transactions.transaction.map((txn: Transaction) => {
                            const amount = parseFloat(txn.amount);
                            const isCredit = amount >= 0;
                            return (
                                <button
                                    key={txn.referenceID}
                                    type="button"
                                    role="row"
                                    className={`${style.txnRow} ${detailTx?.referenceID === txn.referenceID ? style.txnRowSelected : ""}`}
                                    onClick={() => setDetailTx(txn)}
                                >
                                    <span role="cell" className={style.txnColBank}>
                                        <BankMono bank={txn.bank}/>
                                    </span>
                                    <span role="cell" className={style.txnColDesc}>
                                        <span className={style.txnDescText}>
                                            {txn.details || "—"}
                                        </span>
                                        <span className={style.txnDescBank}>{bankName(txn.bank)}</span>
                                    </span>
                                    <span role="cell" className={style.txnColCategory}>
                                        {txn.tag ? (
                                            <span className={style.txnCategoryTag}>{txn.tag}</span>
                                        ) : (
                                            <span className={`${style.txnCategoryTag} ${style.txnCategoryNone}`}>
                                                Uncategorised
                                            </span>
                                        )}
                                    </span>
                                    <span role="cell" className={style.txnColDate}>
                                        {formatLedgerDate(txn.date)}
                                    </span>
                                    <span
                                        role="cell"
                                        className={`${style.txnColAmount} ${amountsHidden ? style.amountHidden : ""}`}
                                        style={{color: isCredit ? CLR_GAIN : CLR_LOSS}}
                                        aria-hidden={amountsHidden || undefined}
                                    >
                                        {isCredit ? "+" : "−"}₹{formatCurrency(Math.abs(amount))}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            <div className={style.paginationContainer}>
                <SortedBy
                    columns={["date", "amount", "bank", "tag"]}
                    column={state.sortBy.sortBy}
                    order={state.sortBy.sortDirection}
                    orderSetter={(order) =>
                        dispatch({type: "SET_SORT_BY", payload: {...state.sortBy, sortDirection: order}})
                    }
                    columnSetter={(column) =>
                        dispatch({type: "SET_SORT_BY", payload: {...state.sortBy, sortBy: column}})
                    }
                />
                <NocturnePager
                    page={state.page}
                    count={state.transactionCount}
                    rowsPerPage={state.limit}
                    onPageChange={(p) => dispatch({type: "SET_PAGE", payload: p})}
                    onRowsPerPageChange={(r) => dispatch({type: "SET_LIMIT", payload: r})}
                />
            </div>
        </section>
    );

    const filteredFiles = useMemo(
        // ak-5aw4: visibility by what the record is (category / extracted
        // rows / known bank), not a bank-id list; the old hardcoded 7-id list
        // hid new banks and "UNKNOWN"-stamped statements with transactions.
        () => fileState.fileDetails.filter((f: FileDetails) => isStatementRecord(f, optedBanks)),
        [fileState.fileDetails, optedBanks],
    );

    const renderFileMode = () => (
        <>
            <div className={style.transactionFilters}>
                <FileFilterCompact
                    isMobile={isMobile}
                    setDrawerState={() => setSidebarOpen(true)}
                    apply={refreshFileDetails}
                />
                <FileSummary files={filteredFiles}/>
            </div>
            <div className={style.fileGrid}>
                {filteredFiles.length === 0 ? (
                    <div className={style.emptyPanel}>
                        <span className={style.emptyPrimary}>No files found</span>
                        <span className={style.emptySub}>Trigger a statement scan from the sidebar.</span>
                    </div>
                ) : filteredFiles.map((file: FileDetails) => (
                    <FileDetailsCard
                        key={file.fileID}
                        bank={file.bank}
                        fileName={file.fileName}
                        uploadDate={file.uploadDate}
                        statementCount={file.statementCount}
                        category={file.category}
                        status={file.status}
                        summary_text={file.summary_text}
                        has_pdf={file.has_pdf}
                        email_date={file.email_date}
                        subject={file.subject}
                        sender={file.sender}
                        extraction_summary={file.extraction_summary}
                        period_start={file.period_start}
                        period_end={file.period_end}
                        onDownload={() => {
                            downloadFile(file.fileID)
                                .then((res: any) => {
                                    const url = window.URL.createObjectURL(new Blob([res.data]));
                                    const link = document.createElement("a");
                                    link.href = url;
                                    link.setAttribute("download", file.fileName);
                                    document.body.appendChild(link);
                                    link.click();
                                    setPayload({message: "Download started successfully", type: "success"});
                                    document.body.removeChild(link);
                                })
                                .catch(() => {
                                    setPayload({type: "error", message: "Error downloading file"});
                                });
                        }}
                        onDelete={() => {
                            deleteFile(file.fileID)
                                .then((r) => {
                                    if (r.status === 200) {
                                        setPayload({message: "File deleted successfully.", type: "success"});
                                        refreshFileDetails();
                                    }
                                })
                                .catch(() => {
                                    setPayload({type: "error", message: "Error deleting file"});
                                });
                        }}
                    />
                ))}
            </div>
            <div className={style.paginationContainer}>
                <SortedBy
                    columns={["uploadDate", "fileName", "bank"]}
                    column={fileState.sortBy.sortBy}
                    order={fileState.sortBy.sortDirection}
                    orderSetter={(order) =>
                        fileDispatch({
                            type: "SET_SORT_BY",
                            payload: {...fileState.sortBy, sortDirection: order},
                        })
                    }
                    columnSetter={(column) =>
                        fileDispatch({
                            type: "SET_SORT_BY",
                            payload: {...fileState.sortBy, sortBy: column},
                        })
                    }
                />
                <NocturnePager
                    page={fileState.filePage}
                    count={fileState.fileCount}
                    rowsPerPage={fileState.limit}
                    onPageChange={(p) => fileDispatch({type: "SET_FILE_PAGE", payload: p})}
                    onRowsPerPageChange={(r) => fileDispatch({type: "SET_LIMIT", payload: r})}
                />
            </div>
        </>
    );

    // ak-4qgd: Sidebar block — Calendar + 3 new cards (Spend-by-category,
    // Recurring, Ingestion connected-status). Mode switcher moved OUT of
    // the sidebar to the main content header (ModeToggle below).
    // Rendered as an actual RIGHT column on desktop (DOM-ordered after
    // <main> per grid-template-columns in Transaction.module.scss) or
    // inside a Nocturne-skinned mobile overlay (MUI Drawer dropped).
    const sidebarContent = (
        <div className={style.sidebarInner}>
            <CalendarComponent/>
            <SpendByCategoryCard/>
            <RecurringCard/>
            <IngestionStatusCard/>
        </div>
    );

    return (
        <div className={style.page}>
            {/* ak-f5vf: full-width top stack per design — omni → toggle →
                (ledger mode) filters → tiles; the rail starts beside the
                Ledger, not at the top of the page. */}
            <div className={style.pageTop}>
                <AgentOmniBar onSend={dispatchAgent}/>
                <ModeToggle
                    transactionMode={transactionModeSelection}
                    onSet={setTransactionMode}
                />
                {transactionModeSelection && renderTransactionTop()}
            </div>
            <div className={style.pageBody}>
            <main className={style.main}>
                {transactionModeSelection ? renderLedger() : renderFileMode()}
            </main>

            {/* ak-4qgd: sidebar moved RIGHT (DOM-ordered after <main> so
                the grid-template-columns in Transaction.module.scss can
                place it in the right column). Mobile overlay semantics
                unchanged — still slides in with a backdrop + useModalA11y. */}
            {isMobile ? (
                <>
                    {sidebarOpen && (
                        <>
                            <div
                                className={style.sidebarBackdrop}
                                onClick={() => setSidebarOpen(false)}
                                role="presentation"
                            />
                            <aside
                                ref={sidebarRef}
                                className={`${style.sidebar} ${style.sidebarMobile}`}
                                role="dialog"
                                aria-modal="true"
                                aria-label="Filters and ingestion"
                                tabIndex={-1}
                            >
                                <div className={style.sidebarHeader}>
                                    <span className={style.sidebarTitle}>Filters &amp; ingestion</span>
                                    <button
                                        type="button"
                                        onClick={() => setSidebarOpen(false)}
                                        className={`btn btn-icon ${style.sidebarCloseBtn}`}
                                        aria-label="Close sidebar"
                                    >
                                        <i className="ph ph-x"/>
                                    </button>
                                </div>
                                {sidebarContent}
                            </aside>
                        </>
                    )}
                </>
            ) : (
                <aside className={style.sidebar}>{sidebarContent}</aside>
            )}
            </div>

            {/* Transaction detail drawer (FE-8 brief 05 ask). PII posture:
                amount + bank + date + details + reference ID. Raw email
                body / receipt contents are NOT surfaced here — any future
                "View email" affordance would be reveal-on-explicit-action.
                a11y via FE-7's useModalA11y shared hook. */}
            {detailTx && (
                <>
                    <div
                        className={style.detailBackdrop}
                        onClick={closeDetail}
                        role="presentation"
                    />
                    <aside
                        className={style.detailDrawer}
                        ref={detailRef}
                        role="dialog"
                        aria-modal="true"
                        aria-label="Transaction detail"
                        tabIndex={-1}
                    >
                        <div className={style.detailHeader}>
                            <span className={style.detailKicker}>
                                {formatDateString(detailTx.date)}
                            </span>
                            <button
                                type="button"
                                onClick={closeDetail}
                                className={`btn btn-icon ${style.detailCloseBtn}`}
                                aria-label="Close detail"
                            >
                                <i className="ph ph-x"/>
                            </button>
                        </div>
                        <div className={style.detailAmountRow}>
                            <span
                                className={style.detailAmount}
                                style={{color: parseFloat(detailTx.amount) >= 0 ? CLR_GAIN : CLR_LOSS}}
                            >
                                {parseFloat(detailTx.amount) >= 0 ? "+" : "−"}₹
                                {formatCurrency(Math.abs(parseFloat(detailTx.amount)))}
                            </span>
                        </div>
                        <dl className={style.detailMeta}>
                            <div className={style.detailMetaRow}>
                                <dt>Description</dt>
                                <dd>{detailTx.details || "—"}</dd>
                            </div>
                            <div className={style.detailMetaRow}>
                                <dt>Bank</dt>
                                <dd>{bankName(detailTx.bank)}</dd>
                            </div>
                            <div className={style.detailMetaRow}>
                                <dt>Category / tag</dt>
                                <dd>
                                    {detailTx.tag ? (
                                        <span className={style.txnCategoryChip}>{detailTx.tag}</span>
                                    ) : (
                                        <span className={style.txnCategoryPlaceholder}>
                                            Not categorized yet
                                        </span>
                                    )}
                                </dd>
                            </div>
                            <div className={style.detailMetaRow}>
                                <dt>Source</dt>
                                <dd>{detailTx.source || "—"}</dd>
                            </div>
                            <div className={style.detailMetaRow}>
                                <dt>Reference ID</dt>
                                <dd className={style.detailRefId}>{detailTx.referenceID}</dd>
                            </div>
                        </dl>

                        {/* ak-inli: Links section + Find-similar CTA. All
                            three actions dispatch through the AgentChatBridge
                            with pre-filled payloads — the agent's existing
                            tool-use surface handles the actual behavior, so
                            no new BE contract is introduced. Drawer closes
                            after dispatch so the opened agent drawer isn't
                            layered under the detail drawer. */}
                        <div className={style.detailLinks}>
                            <div className={style.detailLinksLabel}>Links</div>
                            <div className={style.detailLinksRow}>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAgentCommand({
                                            type: "send_message",
                                            payload: `Attach a file from my Files vault to transaction ${detailTx.referenceID} (${detailTx.details ?? "no description"}, ₹${formatCurrency(Math.abs(parseFloat(detailTx.amount)))}).`,
                                            timestamp: Date.now(),
                                        });
                                        closeDetail();
                                    }}
                                    className={`btn btn-secondary ${style.detailLinkBtn}`}
                                >
                                    <i className="ph ph-paperclip" aria-hidden="true"/>
                                    <span>Attach from Files</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setAgentCommand({
                                            type: "send_message",
                                            payload: `Link transaction ${detailTx.referenceID} (${detailTx.details ?? "no description"}, ₹${formatCurrency(Math.abs(parseFloat(detailTx.amount)))}) to an investment holding.`,
                                            timestamp: Date.now(),
                                        });
                                        closeDetail();
                                    }}
                                    className={`btn btn-secondary ${style.detailLinkBtn}`}
                                >
                                    <i className="ph ph-chart-line-up" aria-hidden="true"/>
                                    <span>Link investment</span>
                                </button>
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    setAgentCommand({
                                        type: "send_message",
                                        payload: `Find similar transactions to ${detailTx.referenceID}: "${detailTx.details ?? ""}" on ${formatDateString(detailTx.date)} for ₹${formatCurrency(Math.abs(parseFloat(detailTx.amount)))}.`,
                                        timestamp: Date.now(),
                                    });
                                    closeDetail();
                                }}
                                className={`btn btn-primary ${style.detailFindSimilarBtn}`}
                            >
                                <i className="ph ph-sparkle" aria-hidden="true"/>
                                <span>Find similar with assistant</span>
                            </button>
                        </div>

                        <div className={style.detailFooter}>
                            {/* §10 receipts / auto-export: this surface intentionally
                                has NO auto-copy / auto-export affordance. Users can
                                select text with their mouse — explicit action only. */}
                            <span className={style.detailFooterNote}>
                                <i className="ph ph-shield-check" aria-hidden/>
                                Raw email / receipt contents are not displayed here.
                            </span>
                        </div>
                    </aside>
                </>
            )}

            <AgentChat agentType="transaction" onMutation={handleAgentMutation}/>
        </div>
    );
};

export default Transactions;
