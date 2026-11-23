/**
 * ak-i0zq / ak-05af (BE) / ak-v55t (BE): Watchlist + instruments-search
 * service wrappers.
 *
 * Mirrors the posture of `investmentService.ts`:
 *   - queueRequest + withRequestId + optional withCacheCleared
 *   - axios from AxiosConfig (Firebase JWT via shared interceptor)
 *   - no toasts here; callers own user-facing error surfacing
 *
 * §23 posture:
 *   #1 preserved — new surface; no pre-existing contract changed.
 *   #2 CONSUME — BE emits Kite / DB shapes verbatim; callers render
 *     without re-deriving.
 *   #6 preserved (callers format en-IN with shared formatters).
 *
 * BE contracts:
 *   GET    /kite/instruments/search?q=&exchange=&limit=
 *   GET    /watchlist
 *   POST   /watchlist                          body: {instrument_token, tradingsymbol, exchange, note?}
 *   DELETE /watchlist/<id>
 *   PUT    /watchlist/<id>/note                body: {note?: string | null}
 *   GET    /watchlist/ltp
 */
import axios from "./AxiosConfig.tsx";
import {queueRequest} from "./AxiosQueueManager.tsx";
import type {
    KiteInstrumentSearchResponse,
    WatchlistAddResponse,
    WatchlistItem,
    WatchlistListResponse,
    WatchlistLtpResponse,
    WatchlistRemoveResponse,
} from "../utils/interfaces.ts";

// Local copies of the request-decorator helpers used in investmentService.
// Duplicated (not exported from that module) to keep this file
// standalone — if a third service repeats these, promote to a shared
// `services/_requestHelpers.ts` module.
function withCacheCleared(options: Record<string, any> = {}): Record<string, any> {
    return {
        ...options,
        params: {
            ...options.params,
            clearCacheEntry: true,
        },
    };
}

function withRequestId(endpoint: string, options: Record<string, any>): Record<string, any> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

// ────────────────── ak-v55t: instruments search ──────────────────

/**
 * Debounced autocomplete source for symbol pickers (watchlist, future
 * alert-creation, future order-ticket). Caller responsible for
 * debouncing input — this is the raw HTTP call.
 *
 * BE enforces non-empty `q` (400 on blank). Caller should early-return
 * on empty query rather than relying on a 400 bounce.
 */
export async function searchKiteInstruments(
    q: string,
    exchange?: string,
    limit = 20,
    clearCache = false,
): Promise<KiteInstrumentSearchResponse> {
    const params: Record<string, string> = {q, limit: String(limit)};
    if (exchange) params.exchange = exchange;
    const base: Record<string, any> = {params};
    const options = withRequestId(
        "kite/instruments/search",
        clearCache ? withCacheCleared(base) : base,
    );
    const response = await queueRequest(() =>
        axios.get("/kite/instruments/search", options),
    );
    return response.data;
}

// ────────────────── ak-05af: watchlist CRUD ──────────────────

/**
 * GET /watchlist — list the overseer's watched instruments newest-first.
 */
export async function fetchWatchlist(
    clearCache = false,
): Promise<WatchlistListResponse> {
    const options = withRequestId(
        "watchlist",
        clearCache ? withCacheCleared() : {},
    );
    const response = await queueRequest(() => axios.get("/watchlist", options));
    return response.data;
}

/**
 * POST /watchlist — add a symbol. Idempotent per `(user, instrument_token)`:
 * BE returns 200 + `{idempotent:true, item:<existing>}` when already watched,
 * 201 + `{idempotent:false, item:<new>}` on fresh insert. Note in the
 * idempotent branch is NOT overwritten (per bead spec).
 */
export async function addWatchlistItem(payload: {
    instrument_token: number;
    tradingsymbol: string;
    exchange: string;
    note?: string | null;
}): Promise<WatchlistAddResponse> {
    const response = await queueRequest(() =>
        axios.post("/watchlist", payload),
    );
    return response.data;
}

/**
 * DELETE /watchlist/<id> — remove a symbol. Single-delete is low-stakes
 * per bead §23 #5 (no destructive-gate confirmation required at this
 * scale — the overseer can re-add via the search bar in seconds).
 */
export async function removeWatchlistItem(
    id: number,
): Promise<WatchlistRemoveResponse> {
    const response = await queueRequest(() => axios.delete(`/watchlist/${id}`));
    return response.data;
}

/**
 * PUT /watchlist/<id>/note — set or clear the stored note.
 *
 * Passing `null` / empty string clears the note (BE sets DB column to
 * NULL). Non-empty input is truncated at 500 chars server-side.
 */
export async function updateWatchlistNote(
    id: number,
    note: string | null,
): Promise<WatchlistItem> {
    const body = note === null ? {note: null} : {note};
    const response = await queueRequest(() =>
        axios.put(`/watchlist/${id}/note`, body),
    );
    return response.data;
}

/**
 * GET /watchlist/ltp — batch last-traded-price for every watched symbol.
 *
 * Empty watchlist returns `{ltp:{}, count:0}` WITHOUT hitting Kite —
 * caller can safely poll even when the list is empty without burning
 * Kite quota.
 *
 * KiteAuthError (401 `reconnect_required:true`) is handled at the shared
 * axios interceptor; the Kite reconnect-flow owns recovery. Transport
 * errors here surface as rejected promises — the Watchlist component
 * leaves the last successful tick in place and schedules the next poll.
 */
export async function fetchWatchlistLtp(
    clearCache = false,
): Promise<WatchlistLtpResponse> {
    // Always bypass axios-cache-interceptor for the polled surface —
    // we WANT fresh prices, not a 30s-stale cache hit.
    const base: Record<string, any> = {};
    const options = withRequestId(
        "watchlist/ltp",
        clearCache ? withCacheCleared(base) : base,
    );
    const response = await queueRequest(() =>
        axios.get("/watchlist/ltp", options),
    );
    return response.data;
}
