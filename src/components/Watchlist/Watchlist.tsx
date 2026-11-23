import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useKite} from "../../contexts/KiteContext.tsx";
import {useMessage} from "../../contexts/MessageContext.tsx";
import SymbolSearchInput from "../SymbolSearchInput/SymbolSearchInput.tsx";
import ConfirmationDialog from "../ConfirmationDialogComponent.tsx";
import {
    addWatchlistItem,
    fetchWatchlist,
    fetchWatchlistLtp,
    removeWatchlistItem,
    updateWatchlistNote,
} from "../../services/watchlistService.ts";
import {formatCurrency} from "../WealthDigest/formatters.ts";
import type {
    KiteInstrumentSearchResult,
    WatchlistItem,
    WatchlistLtpTick,
} from "../../utils/interfaces.ts";
import style from "./Watchlist.module.scss";

/**
 * ak-i0zq (FE companion to ak-05af BE + ak-v55t BE):
 *
 * Persistent watchlist section for the Investments landing page. Mounts
 * below the Kite monitoring card, above Fixed-return & physical. Hidden
 * entirely when Kite isn't connected (same posture as KiteMonitoring).
 *
 * Capabilities:
 *   - List watched symbols (/watchlist) — grid of cards.
 *   - Add new symbol via SymbolSearchInput (/kite/instruments/search).
 *   - Remove a symbol (single-delete, low-stakes per bead §23 #5 — a
 *     small confirm dialog guards the click, not an EXACT-match gate).
 *   - Edit / clear the per-item note.
 *   - Live LTP refresh every 30s (polls /watchlist/ltp batch). This is
 *     the stated FALLBACK until the WebSocket bead (ak-vue6) lands. The
 *     interval is cleared on unmount + on disconnect; a successful
 *     re-connect transitions back into polling without user action.
 *
 * Day change: /watchlist/ltp returns Kite's `.ltp()` shape which is
 * typically `{instrument_token, last_price}`. Some SDK versions also
 * embed `ohlc.close`. When present we render day change against it;
 * when absent we render "—" (unknown, not flat — same §23 #3 posture
 * as the MSNHome hero's dayChangeKnown gate). A future bead can either
 * swap BE to `.ohlc()` or move the surface to WebSocket ticks.
 *
 * §23 posture: #1 preserved · #2 CONSUME (BE shapes verbatim) ·
 *   #5 single-delete low-stakes (small confirm, not EXACT-match) ·
 *   #6 preserved (en-IN currency, oklch signed money).
 */

const POLL_INTERVAL_MS = 30_000;

// Signed-money palette (shared across Investments surfaces).
const CLR_GAIN = "oklch(0.80 0.13 155)";
const CLR_LOSS = "oklch(0.74 0.15 25)";

function num(v: unknown): number | null {
    return typeof v === "number" && Number.isFinite(v) ? v : null;
}

// Build the Kite-native batch key from a watchlist row. Mirrors the
// BE's keying convention exactly ("EXCHANGE:TRADINGSYMBOL") so the
// lookup against the /watchlist/ltp response is a direct dict read.
function tickKey(item: WatchlistItem): string {
    return `${item.exchange}:${item.tradingsymbol}`;
}

const Watchlist = () => {
    const {state: kiteState} = useKite();
    const {setPayload} = useMessage();
    const [items, setItems] = useState<WatchlistItem[] | null>(null);
    const [listLoading, setListLoading] = useState(false);
    const [listErrored, setListErrored] = useState(false);

    const [ticks, setTicks] = useState<Record<string, WatchlistLtpTick>>({});
    const [adding, setAdding] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);
    const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
    const [noteDraft, setNoteDraft] = useState("");

    const pollTimerRef = useRef<number | null>(null);
    const pollInFlightRef = useRef(false);

    // ── Initial list fetch when Kite connects / on mount ────────────
    useEffect(() => {
        if (!kiteState.isAuthenticated) {
            setItems(null);
            setTicks({});
            return;
        }
        let cancelled = false;
        setListLoading(true);
        setListErrored(false);
        fetchWatchlist()
            .then((res) => {
                if (cancelled) return;
                setItems(Array.isArray(res?.items) ? res.items : []);
            })
            .catch(() => {
                if (cancelled) return;
                setListErrored(true);
                setItems([]);
            })
            .finally(() => {
                if (!cancelled) setListLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [kiteState.isAuthenticated]);

    // ── LTP polling loop ───────────────────────────────────────────
    // Runs every POLL_INTERVAL_MS whenever we're connected AND the
    // list has resolved. A separate `pollInFlightRef` prevents a slow
    // response from lapping itself (overlapping fetches would double
    // the Kite quota burn for no benefit).
    const pollLtp = useCallback(async () => {
        if (pollInFlightRef.current) return;
        pollInFlightRef.current = true;
        try {
            const res = await fetchWatchlistLtp(true);
            setTicks(res?.ltp && typeof res.ltp === "object" ? res.ltp : {});
        } catch {
            // Leave the last successful tick in place; next tick retries.
        } finally {
            pollInFlightRef.current = false;
        }
    }, []);

    useEffect(() => {
        if (!kiteState.isAuthenticated) {
            if (pollTimerRef.current !== null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
            return;
        }
        if (items === null) return;  // list hasn't resolved yet
        // Empty list → still schedule the interval so a freshly-added
        // item starts getting ticks immediately. BE short-circuits
        // empty watchlists to `{ltp:{}, count:0}` without hitting Kite.
        void pollLtp();
        pollTimerRef.current = window.setInterval(() => {
            void pollLtp();
        }, POLL_INTERVAL_MS);
        return () => {
            if (pollTimerRef.current !== null) {
                window.clearInterval(pollTimerRef.current);
                pollTimerRef.current = null;
            }
        };
    }, [kiteState.isAuthenticated, items, pollLtp]);

    // ── Add flow ───────────────────────────────────────────────────
    const handlePick = useCallback(
        async (r: KiteInstrumentSearchResult) => {
            if (adding) return;
            setAdding(true);
            try {
                const res = await addWatchlistItem({
                    instrument_token: r.instrument_token,
                    tradingsymbol: r.tradingsymbol,
                    exchange: r.exchange ?? "",
                });
                if (res?.item) {
                    setItems((prev) => {
                        const base = prev ?? [];
                        if (res.idempotent) {
                            // Already there — bubble to top so the
                            // user visually sees it. Same order
                            // semantics as a fresh add.
                            const rest = base.filter((it) => it.id !== res.item.id);
                            return [res.item, ...rest];
                        }
                        return [res.item, ...base];
                    });
                    if (res.idempotent) {
                        setPayload({
                            message: `${r.tradingsymbol} is already on your watchlist.`,
                            type: "info",
                        });
                    }
                    // Poll immediately so the new row gets a tick on
                    // the current render rather than waiting 30s.
                    void pollLtp();
                }
            } catch (e: any) {
                const msg =
                    e?.response?.data?.error ||
                    e?.message ||
                    "Could not add to watchlist.";
                setPayload({message: msg, type: "error"});
            } finally {
                setAdding(false);
            }
        },
        [adding, pollLtp, setPayload],
    );

    // ── Delete flow ────────────────────────────────────────────────
    const handleRequestDelete = useCallback((id: number) => {
        setDeletingId(id);
    }, []);

    const handleConfirmDelete = useCallback(async () => {
        if (deletingId === null) return;
        const id = deletingId;
        setDeletingId(null);
        try {
            await removeWatchlistItem(id);
            setItems((prev) => (prev ?? []).filter((it) => it.id !== id));
        } catch (e: any) {
            const msg =
                e?.response?.data?.error ||
                e?.message ||
                "Could not remove from watchlist.";
            setPayload({message: msg, type: "error"});
        }
    }, [deletingId, setPayload]);

    // ── Note edit flow ─────────────────────────────────────────────
    const openNoteEditor = useCallback((item: WatchlistItem) => {
        setEditingNoteId(item.id);
        setNoteDraft(item.note ?? "");
    }, []);

    const closeNoteEditor = useCallback(() => {
        setEditingNoteId(null);
        setNoteDraft("");
    }, []);

    const saveNote = useCallback(
        async (id: number) => {
            const trimmed = noteDraft.trim();
            const noteVal = trimmed.length === 0 ? null : trimmed;
            try {
                const updated = await updateWatchlistNote(id, noteVal);
                setItems((prev) =>
                    (prev ?? []).map((it) => (it.id === id ? updated : it)),
                );
                closeNoteEditor();
            } catch (e: any) {
                const msg =
                    e?.response?.data?.error ||
                    e?.message ||
                    "Could not save note.";
                setPayload({message: msg, type: "error"});
            }
        },
        [noteDraft, closeNoteEditor, setPayload],
    );

    // ── Derived rendering state ────────────────────────────────────
    const deletingItem = useMemo(
        () => (items ?? []).find((it) => it.id === deletingId) ?? null,
        [items, deletingId],
    );

    // Hide the entire section when Kite isn't connected — the
    // watchlist is useless without live quotes. Reconnect affordance
    // in the Investments shell owns the recovery flow.
    if (!kiteState.isAuthenticated) return null;

    return (
        <section className={style.section}>
            <div className={style.sectionHeader}>
                <h4 className={style.sectionTitle}>My Watchlist</h4>
                <span className={style.sectionSub}>
                    Live LTP · 30s polling{" "}
                    <span className={style.wsHint}>(WebSocket upgrade pending)</span>
                </span>
            </div>

            <div className={style.addBar}>
                <SymbolSearchInput
                    onSelect={handlePick}
                    placeholder="Add a symbol — search by trading symbol or company name"
                    disabled={adding}
                    externalStatus={adding ? "Adding to watchlist…" : null}
                />
            </div>

            {listLoading && items === null && (
                <div className={style.empty}>Loading watchlist…</div>
            )}

            {listErrored && (
                <div className={style.empty}>
                    Could not load the watchlist. It'll retry on next page load.
                </div>
            )}

            {items !== null && items.length === 0 && !listLoading && !listErrored && (
                <div className={style.empty}>
                    Nothing on your watchlist yet. Search above to add a symbol.
                </div>
            )}

            {items !== null && items.length > 0 && (
                <div className={style.grid}>
                    {items.map((item) => {
                        const key = `wl-${item.id}`;
                        const tick = ticks[tickKey(item)];
                        const ltp = num(tick?.last_price);
                        const close = num(tick?.ohlc?.close);
                        const dayChange =
                            ltp !== null && close !== null && close !== 0
                                ? ltp - close
                                : null;
                        const dayChangePct =
                            dayChange !== null && close !== null && close !== 0
                                ? (dayChange / close) * 100
                                : null;
                        const dayColor =
                            dayChange === null
                                ? "var(--color-neutral-500)"
                                : dayChange >= 0
                                ? CLR_GAIN
                                : CLR_LOSS;
                        const isEditing = editingNoteId === item.id;
                        return (
                            <article key={key} className={style.card}>
                                <header className={style.cardHeader}>
                                    <div className={style.cardHeaderLeft}>
                                        <span className={style.cardSymbol}>
                                            {item.tradingsymbol}
                                        </span>
                                        <span className={style.cardExchange}>
                                            {item.exchange}
                                        </span>
                                    </div>
                                    <button
                                        type="button"
                                        className={style.deleteBtn}
                                        aria-label={`Remove ${item.tradingsymbol} from watchlist`}
                                        onClick={() => handleRequestDelete(item.id)}
                                    >
                                        <i className="ph ph-trash" aria-hidden="true"/>
                                    </button>
                                </header>
                                <div className={style.cardBody}>
                                    <div className={style.ltpRow}>
                                        <span className={style.ltpLabel}>LTP</span>
                                        <span className={style.ltpValue}>
                                            {ltp !== null ? `₹${formatCurrency(ltp)}` : "—"}
                                        </span>
                                    </div>
                                    <div className={style.dayRow}>
                                        <span className={style.dayLabel}>Day</span>
                                        <span
                                            className={style.dayValue}
                                            style={{color: dayColor}}
                                            title={
                                                dayChange === null
                                                    ? "Previous close unavailable — WebSocket upgrade will supply day change"
                                                    : undefined
                                            }
                                        >
                                            {dayChange === null
                                                ? "—"
                                                : `${dayChange >= 0 ? "+" : "−"}₹${formatCurrency(Math.abs(dayChange))}`}
                                            {dayChangePct !== null && (
                                                <span className={style.dayPct}>
                                                    {" "}({dayChangePct >= 0 ? "+" : "−"}
                                                    {Math.abs(dayChangePct).toFixed(2)}%)
                                                </span>
                                            )}
                                        </span>
                                    </div>
                                </div>
                                <footer className={style.cardFooter}>
                                    {isEditing ? (
                                        <div className={style.noteEditor}>
                                            <textarea
                                                autoFocus
                                                className={style.noteInput}
                                                maxLength={500}
                                                placeholder="Note (max 500 chars) — leave blank to clear"
                                                value={noteDraft}
                                                onChange={(e) => setNoteDraft(e.target.value)}
                                            />
                                            <div className={style.noteActions}>
                                                <button
                                                    type="button"
                                                    className={style.noteBtn}
                                                    onClick={() => void saveNote(item.id)}
                                                >
                                                    Save
                                                </button>
                                                <button
                                                    type="button"
                                                    className={`${style.noteBtn} ${style.noteBtnGhost}`}
                                                    onClick={closeNoteEditor}
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            className={style.noteDisplay}
                                            onClick={() => openNoteEditor(item)}
                                            title="Click to edit note"
                                        >
                                            {item.note && item.note.length > 0 ? (
                                                <span className={style.noteText}>{item.note}</span>
                                            ) : (
                                                <span className={style.notePlaceholder}>
                                                    <i className="ph ph-pencil-simple" aria-hidden="true"/>
                                                    {" "}Add a note
                                                </span>
                                            )}
                                        </button>
                                    )}
                                </footer>
                            </article>
                        );
                    })}
                </div>
            )}

            <ConfirmationDialog
                open={deletingId !== null}
                onCancel={() => setDeletingId(null)}
                onSubmit={() => void handleConfirmDelete()}
                message={
                    deletingItem
                        ? `Remove ${deletingItem.tradingsymbol} from your watchlist?`
                        : "Remove from watchlist?"
                }
            />
        </section>
    );
};

export default Watchlist;
