import {useCallback, useEffect, useMemo, useState} from "react";
import TransactionFilters from "../../components/TransactionFilterComponent/TransactionFilters.tsx";
import {
    deleteFile,
    downloadFile,
    fetchFileDetails,
    fetchOptedBanks,
    fetchTransactions,
} from "../../services/transactionService.ts";
import {useFilterContext} from "../../contexts/FilterContext.tsx";
import CalendarComponent from "../../components/CalendarComponent/Calendar.tsx";
import FieldSelector from "../../components/ModeSelectorComponent/FieldSelector.tsx";
import {useUser} from "../../contexts/GlobalContext.tsx";
import {useFileFilterContext} from "../../contexts/FileFilterContext.tsx";
import FileDetailsCard from "../../components/FileDetailsCardComponent/FileDetailsCard.tsx";
import FileFilterCompact from "../../components/FileFilterComponent/FileFilterCompact.tsx";
import SortedBy from "../../components/SortComponent.tsx";
import FileSummary from "../../components/FileSummaryComponent/FileSummary.tsx";
import GoogleComponent from "../../components/GoogleComponent/GoogleComponent.tsx";
import AgentChat from "../../components/AgentChat/AgentChat.tsx";
import useModalA11y from "../../hooks/useModalA11y.ts";
import {useMessage} from "../../contexts/MessageContext.tsx";
import {formatCompact, formatCurrency} from "../../components/WealthDigest/formatters.ts";
import {formatDateString} from "../../utils/util.tsx";
import type {FileDetails, Transaction} from "../../utils/interfaces.ts";
import style from "./Transaction.module.scss";
import "react-toastify/dist/ReactToastify.css";
import React, {useRef} from "react";

/**
 * FE-8 (ak-ko52) Transactions page — Nocturne-native shell.
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
 * - Mode switching (transaction vs file ingestion) via FieldSelector.
 * - CalendarComponent / GoogleComponent / FieldSelector / FileDetailsCard
 *   / FileFilterCompact / SortedBy / FileSummary / TransactionFilters
 *   / AgentChat all untouched (FE-8 scope is `src/pages/Transactions/*`
 *   only).
 *
 * §23 rules honored:
 * - §2 CONSUME-not-recompute: Credit/Debit/Net hero reads `credits`/
 *   `debits` directly from `FilterContext.state.transactions` — no FE
 *   re-derivation. Net = credit - debit (same convention as pre-FE-8
 *   `TransactionSummary.tsx`).
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

const BANK_LABEL: Record<string, string> = {
    HDFC_DEBIT: "HDFC",
    Millenia_Credit: "Millennia",
    HDFC_REGALIA: "Regalia",
    BOI: "BOI",
    YES_BANK_DEBIT: "Yes Bank",
    YES_BANK_ACE: "Yes Ace",
    ICICI_AMAZON_PAY: "ICICI Pay",
};

const ALLOWED_BANKS = [
    "HDFC_DEBIT",
    "Millenia_Credit",
    "HDFC_REGALIA",
    "BOI",
    "YES_BANK_DEBIT",
    "YES_BANK_ACE",
    "ICICI_AMAZON_PAY",
];

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

const Transactions = () => {
    const {state, dispatch} = useFilterContext();
    const {state: fileState, dispatch: fileDispatch} = useFileFilterContext();
    const {transactionModeSelection, setTransactionMode, setOptedBanks, user} = useUser();
    const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
    const [detailTx, setDetailTx] = useState<Transaction | null>(null);
    const {setPayload} = useMessage();

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
                source: state.source || undefined,
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
                        credits: result.credit_sum,
                        debits: result.debit_sum,
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
    // Convention preserved from pre-FE-8 TransactionSummary.
    const credit = state.transactions.credits;
    const debit = state.transactions.debits;
    const net = credit - debit;

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

    const renderTransactionMode = () => (
        <>
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
            </section>

            <div className={style.transactionFilters}>
                <TransactionFilters
                    isMobile={isMobile}
                    setDrawerState={() => setSidebarOpen(true)}
                    apply={refreshTransactions}
                />
            </div>

            {state.transactions.transaction.length === 0 ? (
                <div className={style.emptyPanel}>
                    <span className={style.emptyPrimary}>No transactions found</span>
                    <span className={style.emptySub}>
                        Trigger an email check from the sidebar, or widen your filters.
                    </span>
                </div>
            ) : (
                <div className={style.txnList} role="table" aria-label="Transactions">
                    <div className={style.txnHeader} role="row">
                        <span role="columnheader">Date</span>
                        <span role="columnheader">Description</span>
                        <span role="columnheader">Bank</span>
                        <span role="columnheader">Category</span>
                        <span role="columnheader" className={style.txnColAmount}>Amount</span>
                    </div>
                    {state.transactions.transaction.map((txn: Transaction) => {
                        const amount = parseFloat(txn.amount);
                        const isCredit = amount >= 0;
                        return (
                            <button
                                key={txn.referenceID}
                                type="button"
                                role="row"
                                className={style.txnRow}
                                onClick={() => setDetailTx(txn)}
                            >
                                <span role="cell" className={style.txnColDate}>
                                    {formatDateString(txn.date)}
                                </span>
                                <span role="cell" className={style.txnColDesc}>
                                    {txn.details || "—"}
                                </span>
                                <span role="cell" className={style.txnColBank}>
                                    {BANK_LABEL[txn.bank] ?? txn.bank ?? "—"}
                                </span>
                                <span role="cell" className={style.txnColCategory}>
                                    {/* FE-8 placeholder slot per bead — BE not yet enriched. */}
                                    {txn.tag ? (
                                        <span className={style.txnCategoryChip}>{txn.tag}</span>
                                    ) : (
                                        <span className={style.txnCategoryPlaceholder}>—</span>
                                    )}
                                </span>
                                <span
                                    role="cell"
                                    className={style.txnColAmount}
                                    style={{color: isCredit ? CLR_GAIN : CLR_LOSS}}
                                >
                                    {isCredit ? "+" : "−"}₹{formatCurrency(Math.abs(amount))}
                                </span>
                            </button>
                        );
                    })}
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
        </>
    );

    const filteredFiles = useMemo(
        () => fileState.fileDetails.filter((f: FileDetails) => ALLOWED_BANKS.includes(f.bank)),
        [fileState.fileDetails],
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

    // Sidebar block — rendered as an actual column on desktop or inside a
    // Nocturne-skinned mobile overlay (MUI Drawer dropped).
    const sidebarContent = (
        <div className={style.sidebarInner}>
            <CalendarComponent/>
            <GoogleComponent/>
            <FieldSelector setTransactionMode={setTransactionMode}/>
        </div>
    );

    return (
        <div className={style.page}>
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

            <main className={style.main}>
                {transactionModeSelection ? renderTransactionMode() : renderFileMode()}
            </main>

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
                                <dd>{BANK_LABEL[detailTx.bank] ?? detailTx.bank ?? "—"}</dd>
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
