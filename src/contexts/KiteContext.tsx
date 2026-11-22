import React, {createContext, useCallback, useContext, useEffect, useReducer, useRef, ReactNode} from 'react';
import {KiteAlert, KiteGtt, KiteHolding, KiteMarginsResponse, KitePosition, KiteTrade} from '../utils/interfaces';
import {
    fetchKiteAlerts,
    fetchKiteGtts,
    fetchKiteHoldings,
    fetchKiteMargins,
    fetchKitePositions,
    fetchKiteTrades,
    syncKiteHoldings,
    getKiteStatus,
    getKiteLoginUrl,
} from '../services/investmentService';
import {useMessage} from './MessageContext';

// ak-u60: ReconnectInfo is the FE's view of the BE's /kite/status payload.
// Default shape = "haven't checked yet" (all null / false) — the affordance
// stays hidden until the first successful fetch so we don't flash a
// reconnect pill on cold load before we know.
interface ReconnectInfo {
    checked: boolean;            // true once /kite/status has resolved at least once
    reconnectRequired: boolean;  // BE authoritative — surface the affordance when true
    reason: string | null;
    expiresAt: string | null;
    loginUrl: string | null;     // cached OAuth URL — used on click; re-fetched if null
}

// ak-oc5s: MarginsInfo caches the /kite/margins response + fetch state.
// `checked` disambiguates "not fetched yet" from "fetched but empty".
// The renderer shows a placeholder when `data === null` (either not
// connected or not yet fetched) and the live breakdown only when data
// is present. Transport errors never toast; the reducer's SET_MARGINS_FAILED
// branch leaves `data=null, loading=false, checked=true` so the renderer
// resolves to state (d) "Margins unavailable — retry on refresh" rather
// than spinning forever.
interface MarginsInfo {
    data: KiteMarginsResponse | null;
    loading: boolean;
    checked: boolean;
}

// ak-2k93: Today's Kite trades state slice. LAZY fetch pattern —
// `checked` starts false until the first `refreshTrades()` resolves
// (or fails). Component is expected to trigger refresh on section
// expand, not on mount; the section is default-collapsed so not
// everyone opens it. Cleared on disconnect to prevent stale trades
// surviving a session change.
interface TradesInfo {
    data: KiteTrade[] | null;
    loading: boolean;
    checked: boolean;
}

// ak-166j: GTT (Good-Till-Triggered) orders + price alerts state
// slices for the Kite monitoring card. Same symmetric {data, loading,
// checked} shape as margins / trades so one error-path discipline
// covers all Kite sub-slices. Both lazy — fired by the monitoring
// card on sub-tab activation. Cleared on disconnect.
interface GttsInfo {
    data: KiteGtt[] | null;
    loading: boolean;
    checked: boolean;
}

interface AlertsInfo {
    data: KiteAlert[] | null;
    loading: boolean;
    checked: boolean;
}

// Kite Context State Interface
interface KiteState {
    holdings: KiteHolding[];
    positions: {
        net: KitePosition[];
        day: KitePosition[];
    };
    isAuthenticated: boolean;
    loading: {
        holdings: boolean;
        positions: boolean;
        sync: boolean;
        auth: boolean;
    };
    lastSyncTime: string | null;
    error: string | null;
    // ak-u60: daily-reconnect affordance state. Lives alongside
    // `isAuthenticated` — the two overlap in practice (a reconnect-required
    // response means not-authenticated) but the source of truth is
    // different: `isAuthenticated` reacts to any fetch failure, whereas
    // `reconnect` is driven by the BE's explicit status payload.
    reconnect: ReconnectInfo;
    // ak-oc5s: Kite /kite/margins payload for the Available-funds tile.
    // Auto-fired once on provider-mount transition into connected=true;
    // cleared when `isAuthenticated` flips false (disconnect / token
    // expiry).
    margins: MarginsInfo;
    // ak-2k93: Today's trades slice. LAZY — not fetched on provider mount.
    trades: TradesInfo;
    // ak-166j: Monitoring surfaces — both LAZY, both cleared on disconnect.
    gtts: GttsInfo;
    alerts: AlertsInfo;
}

// Kite Actions
type KiteAction =
    | {type: 'SET_LOADING'; payload: {key: keyof KiteState['loading']; value: boolean}}
    | {type: 'SET_HOLDINGS'; payload: KiteHolding[]}
    | {type: 'SET_POSITIONS'; payload: {net: KitePosition[]; day: KitePosition[]}}
    | {type: 'SET_AUTHENTICATED'; payload: boolean}
    | {type: 'SET_ERROR'; payload: string | null}
    | {type: 'SET_LAST_SYNC_TIME'; payload: string}
    | {type: 'SET_RECONNECT'; payload: ReconnectInfo}
    | {type: 'CLEAR_RECONNECT'}  // called after a successful reconnect handshake
    // ak-oc5s: /kite/margins actions
    | {type: 'SET_MARGINS_LOADING'; payload: boolean}
    | {type: 'SET_MARGINS'; payload: KiteMarginsResponse}
    | {type: 'SET_MARGINS_FAILED'}  // transport error — mark checked without data
    | {type: 'CLEAR_MARGINS'}
    // ak-2k93: Today's trades actions
    | {type: 'SET_TRADES_LOADING'; payload: boolean}
    | {type: 'SET_TRADES'; payload: KiteTrade[]}
    | {type: 'SET_TRADES_FAILED'}  // transport error — mark checked without data
    | {type: 'CLEAR_TRADES'}
    // ak-166j: GTT actions
    | {type: 'SET_GTTS_LOADING'; payload: boolean}
    | {type: 'SET_GTTS'; payload: KiteGtt[]}
    | {type: 'SET_GTTS_FAILED'}
    | {type: 'CLEAR_GTTS'}
    // ak-166j: Alert actions
    | {type: 'SET_ALERTS_LOADING'; payload: boolean}
    | {type: 'SET_ALERTS'; payload: KiteAlert[]}
    | {type: 'SET_ALERTS_FAILED'}
    | {type: 'CLEAR_ALERTS'}
    | {type: 'RESET_STATE'};

// Initial state
const initialReconnect: ReconnectInfo = {
    checked: false,
    reconnectRequired: false,
    reason: null,
    expiresAt: null,
    loginUrl: null,
};

// ak-oc5s: initial margins state — not yet checked.
const initialMargins: MarginsInfo = {
    data: null,
    loading: false,
    checked: false,
};

// ak-2k93: initial Today's trades state — not yet checked.
const initialTrades: TradesInfo = {
    data: null,
    loading: false,
    checked: false,
};

// ak-166j: initial GTT + alerts state — both not yet checked.
const initialGtts: GttsInfo = {
    data: null,
    loading: false,
    checked: false,
};

const initialAlerts: AlertsInfo = {
    data: null,
    loading: false,
    checked: false,
};

const initialState: KiteState = {
    holdings: [],
    positions: {
        net: [],
        day: [],
    },
    isAuthenticated: false,
    loading: {
        holdings: false,
        positions: false,
        sync: false,
        auth: false,
    },
    lastSyncTime: null,
    error: null,
    reconnect: initialReconnect,
    margins: initialMargins,
    trades: initialTrades,
    gtts: initialGtts,
    alerts: initialAlerts,
};

// Reducer
const kiteReducer = (state: KiteState, action: KiteAction): KiteState => {
    switch (action.type) {
        case 'SET_LOADING':
            return {
                ...state,
                loading: {
                    ...state.loading,
                    [action.payload.key]: action.payload.value,
                },
            };
        case 'SET_HOLDINGS':
            return {
                ...state,
                holdings: action.payload,
                error: null,
            };
        case 'SET_POSITIONS':
            return {
                ...state,
                positions: action.payload,
                error: null,
            };
        case 'SET_AUTHENTICATED':
            return {
                ...state,
                isAuthenticated: action.payload,
                error: action.payload ? null : state.error,
            };
        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload,
            };
        case 'SET_LAST_SYNC_TIME':
            return {
                ...state,
                lastSyncTime: action.payload,
            };
        case 'SET_RECONNECT':
            return {
                ...state,
                reconnect: action.payload,
            };
        case 'CLEAR_RECONNECT':
            // Explicit clear after a successful OAuth handshake — flips the
            // pill off immediately instead of waiting for the next
            // getKiteStatus() tick.
            return {
                ...state,
                reconnect: {
                    ...initialReconnect,
                    checked: true,  // we know it's clear
                },
                isAuthenticated: true,
            };
        // ak-oc5s: /kite/margins reducer handlers
        case 'SET_MARGINS_LOADING':
            return {
                ...state,
                margins: {...state.margins, loading: action.payload},
            };
        case 'SET_MARGINS':
            return {
                ...state,
                margins: {
                    data: action.payload,
                    loading: false,
                    checked: true,
                },
            };
        case 'SET_MARGINS_FAILED':
            // ak-oc5s reviewer MAJOR: on transport error, flip `checked:true`
            // so the InvestmentsLanding tile renderer resolves to state (d)
            // "Margins unavailable — retry on refresh" instead of being stuck
            // on (b) "Loading margins…" forever. Without this, the renderer's
            // precedence `loadingFirst = connected && (loading || !checked)`
            // evaluates true after a failed fetch (loading=false, checked=
            // false) and the (d) fallback becomes dead code.
            return {
                ...state,
                margins: {data: null, loading: false, checked: true},
            };
        case 'CLEAR_MARGINS':
            return {
                ...state,
                margins: initialMargins,
            };
        // ak-2k93: Today's trades reducer handlers
        case 'SET_TRADES_LOADING':
            return {
                ...state,
                trades: {...state.trades, loading: action.payload},
            };
        case 'SET_TRADES':
            return {
                ...state,
                trades: {data: action.payload, loading: false, checked: true},
            };
        case 'SET_TRADES_FAILED':
            // Transport error — mark checked so the consumer can render a
            // fallback ("Trades unavailable") rather than an endless spinner.
            return {
                ...state,
                trades: {data: null, loading: false, checked: true},
            };
        case 'CLEAR_TRADES':
            return {
                ...state,
                trades: initialTrades,
            };
        // ak-166j: GTT reducer handlers
        case 'SET_GTTS_LOADING':
            return {
                ...state,
                gtts: {...state.gtts, loading: action.payload},
            };
        case 'SET_GTTS':
            return {
                ...state,
                gtts: {data: action.payload, loading: false, checked: true},
            };
        case 'SET_GTTS_FAILED':
            // Same error-path discipline as margins/trades: flip
            // checked:true so the consumer renders a terminal fallback
            // rather than an endless spinner.
            return {
                ...state,
                gtts: {data: null, loading: false, checked: true},
            };
        case 'CLEAR_GTTS':
            return {
                ...state,
                gtts: initialGtts,
            };
        // ak-166j: Alert reducer handlers
        case 'SET_ALERTS_LOADING':
            return {
                ...state,
                alerts: {...state.alerts, loading: action.payload},
            };
        case 'SET_ALERTS':
            return {
                ...state,
                alerts: {data: action.payload, loading: false, checked: true},
            };
        case 'SET_ALERTS_FAILED':
            return {
                ...state,
                alerts: {data: null, loading: false, checked: true},
            };
        case 'CLEAR_ALERTS':
            return {
                ...state,
                alerts: initialAlerts,
            };
        case 'RESET_STATE':
            return initialState;
        default:
            return state;
    }
};

// Context interface
interface KiteContextType {
    state: KiteState;
    dispatch: React.Dispatch<KiteAction>;
    fetchHoldings: (clearCache?: boolean) => Promise<void>;
    fetchPositions: (clearCache?: boolean) => Promise<void>;
    syncHoldings: () => Promise<void>;
    // ak-u60 additions
    refreshStatus: () => Promise<void>;
    beginReconnect: () => Promise<void>;
    // ak-oc5s: capital-visibility
    refreshMargins: (clearCache?: boolean) => Promise<void>;
    // ak-2k93: refresh Today's trades (lazy — called on section expand).
    refreshTrades: (clearCache?: boolean) => Promise<void>;
    // ak-166j: monitoring surfaces (lazy — called on sub-tab activation).
    refreshGtts: (clearCache?: boolean) => Promise<void>;
    refreshAlerts: (clearCache?: boolean) => Promise<void>;
    getTotalPortfolioValue: () => number;
    getTotalPnL: () => number;
    getDayPnL: () => number;
}

// Create context
const KiteContext = createContext<KiteContextType | undefined>(undefined);

// ak-u60: inspect a caught error object (from axios) and determine
// whether the BE emitted a reconnect-required payload. BE contract per
// ak-w4p: 401 + body `{reconnect_required: true, login_url: "..."}`.
//
// Critical: a reconnect_required 401 is NOT "your app session expired".
// FE must NOT bounce to login on that path — see bead "critical
// distinction" clause. The response-interceptor in AxiosConfig only
// rejects (no auto-redirect), so the caller owns the handling.
function extractReconnectHintFromError(error: unknown): ReconnectInfo | null {
    // Axios error shape — defensive access since error could be anything.
    const err = error as {
        response?: {
            status?: number;
            data?: Partial<{
                reconnect_required: boolean;
                reason: string | null;
                expires_at: string | null;
                login_url: string | null;
                connected: boolean;
            }>;
        };
    };
    const resp = err?.response;
    if (!resp || resp.status !== 401) return null;
    const data = resp.data ?? {};
    if (!data.reconnect_required) return null;
    return {
        checked: true,
        reconnectRequired: true,
        reason: typeof data.reason === 'string' ? data.reason : null,
        expiresAt: typeof data.expires_at === 'string' ? data.expires_at : null,
        loginUrl: typeof data.login_url === 'string' ? data.login_url : null,
    };
}

// Provider component
export const KiteProvider: React.FC<{children: ReactNode}> = ({children}) => {
    const [state, dispatch] = useReducer(kiteReducer, initialState);
    const {setPayload} = useMessage();

    // ak-u60: GET /kite/status — the authoritative daily-reconnect check.
    // Called once on mount + on demand (e.g. after a sync failure or
    // before showing a surface that needs fresh Kite data). Errors here
    // are SILENT by design — a transient /kite/status failure should NOT
    // toast; it just means we don't know, which is the pre-ak-u60 state.
    const refreshStatus = useCallback(async () => {
        try {
            const status = await getKiteStatus();
            dispatch({
                type: 'SET_RECONNECT',
                payload: {
                    checked: true,
                    reconnectRequired: !!status.reconnect_required,
                    reason: status.reason ?? null,
                    expiresAt: status.expires_at ?? null,
                    loginUrl: status.login_url ?? null,
                },
            });
            // Sync `isAuthenticated` to `connected` so other surfaces
            // that still consume `state.isAuthenticated` reflect the BE
            // truth without each needing to re-query.
            dispatch({type: 'SET_AUTHENTICATED', payload: !!status.connected});
        } catch {
            // Silent — reconnect state stays as last known. Bead rule:
            // "do NOT show a red error banner".
        }
    }, []);

    // ak-u60: open the Zerodha OAuth URL. Uses the cached loginUrl when
    // available (saves a round-trip); falls back to /kite/login-url if
    // the status response omitted it (defensive). The redirect replaces
    // the current page — on return App.tsx's existing OAuth callback
    // handler takes over (generateKiteSession + syncHoldings).
    const beginReconnect = useCallback(async () => {
        try {
            dispatch({type: 'SET_LOADING', payload: {key: 'auth', value: true}});
            let loginUrl = state.reconnect.loginUrl;
            if (!loginUrl) {
                const res = await getKiteLoginUrl();
                loginUrl = res.login_url;
            }
            if (loginUrl) {
                window.location.href = loginUrl;
                return;
            }
            setPayload({
                type: 'error',
                message: 'Could not get a Kite login URL — try again shortly.',
            });
        } catch {
            setPayload({
                type: 'error',
                message: 'Could not start the Kite reconnect flow.',
            });
        } finally {
            dispatch({type: 'SET_LOADING', payload: {key: 'auth', value: false}});
        }
    }, [state.reconnect.loginUrl, setPayload]);

    // Auto-fire the status check once per session on provider mount.
    // Deliberately NOT polled — the daily cycle is 24h; one-shot on mount
    // + on-demand after a Kite op is the explicit bead design.
    useEffect(() => {
        void refreshStatus();
    }, [refreshStatus]);

    // ak-oc5s: fetch /kite/margins. Silent on transport failures; the
    // Available-funds tile falls back to its "Margins unavailable — retry
    // on refresh" terminal state via SET_MARGINS_FAILED (which flips
    // `checked:true` so the tile renderer's state (d) branch activates
    // instead of being stuck on the (b) "Loading margins…" spinner-text).
    // Fires once per session when Kite is connected (via the auto-effect
    // below) + on demand when the caller passes clearCache=true.
    const refreshMargins = useCallback(async (clearCache = false) => {
        try {
            dispatch({type: 'SET_MARGINS_LOADING', payload: true});
            const data = await fetchKiteMargins(clearCache);
            dispatch({type: 'SET_MARGINS', payload: data});
        } catch {
            // Silent — bead rule: "no error toast; the overall page keeps
            // working". Reviewer MAJOR (post-cb880a8): we must flip
            // `checked:true` on the error path or the tile renderer stays
            // stuck on "Loading…" forever — SET_MARGINS_FAILED does both
            // (clears loading + marks checked) so the renderer resolves
            // to state (d) "Margins unavailable — retry on refresh".
            dispatch({type: 'SET_MARGINS_FAILED'});
        }
    }, []);

    // ak-oc5s: auto-fire refreshMargins on the connected=false→true
    // transition, and CLEAR_MARGINS on the connected=true→false
    // transition. Prevents a repeated fetch while connected stays true
    // (useRef-tracked edge detection) and keeps the Available-funds tile
    // honest about stale data when the daily 6AM token expiry kicks in
    // mid-session.
    const prevAuthForMarginsRef = useRef<boolean>(false);
    useEffect(() => {
        const was = prevAuthForMarginsRef.current;
        const is = state.isAuthenticated;
        prevAuthForMarginsRef.current = is;
        if (!was && is) {
            void refreshMargins(false);
        } else if (was && !is) {
            dispatch({type: 'CLEAR_MARGINS'});
        }
    }, [state.isAuthenticated, refreshMargins]);

    // ak-2k93: fetch Today's trades. LAZY by design — the consumer
    // (Investments page "Today's trades" section) calls this on section
    // expand, not on provider mount, because the section is default-
    // collapsed. Idempotent on `checked` — callers can safely re-trigger
    // from the expand handler; it's cheap but no need to hammer Kite.
    // Transport errors are SILENT (no toast) and dispatch SET_TRADES_FAILED
    // so the consumer renders a terminal fallback rather than a spinner.
    const refreshTrades = useCallback(async (clearCache = false) => {
        try {
            dispatch({type: 'SET_TRADES_LOADING', payload: true});
            const res = await fetchKiteTrades(clearCache);
            const trades = Array.isArray(res?.trades) ? res.trades : [];
            dispatch({type: 'SET_TRADES', payload: trades});
        } catch {
            // Silent — mirrors the margins / status transport-error pattern.
            // Consumer still gets a terminal state via `checked:true`.
            dispatch({type: 'SET_TRADES_FAILED'});
        }
    }, []);

    // ak-2k93: clear trades on disconnect so a stale list doesn't persist
    // across session changes (reconnect could be a different Kite account).
    // Uses an edge-detected ref so we only clear on true→false transitions,
    // not on every render where isAuthenticated stays false.
    const prevAuthForTradesRef = useRef<boolean>(false);
    useEffect(() => {
        const was = prevAuthForTradesRef.current;
        const is = state.isAuthenticated;
        prevAuthForTradesRef.current = is;
        if (was && !is) {
            dispatch({type: 'CLEAR_TRADES'});
        }
    }, [state.isAuthenticated]);

    // ak-166j: fetch active GTT monitors. LAZY — the monitoring section
    // calls this on first sub-tab activation. Transport errors silent
    // (SET_GTTS_FAILED flips checked:true so the consumer renders a
    // terminal fallback instead of an endless spinner).
    const refreshGtts = useCallback(async (clearCache = false) => {
        try {
            dispatch({type: 'SET_GTTS_LOADING', payload: true});
            const res = await fetchKiteGtts(clearCache);
            const gtts = Array.isArray(res?.gtts) ? res.gtts : [];
            dispatch({type: 'SET_GTTS', payload: gtts});
        } catch {
            dispatch({type: 'SET_GTTS_FAILED'});
        }
    }, []);

    // ak-166j: fetch active price alerts. LAZY — the monitoring section
    // calls this on first sub-tab activation.
    const refreshAlerts = useCallback(async (clearCache = false) => {
        try {
            dispatch({type: 'SET_ALERTS_LOADING', payload: true});
            const res = await fetchKiteAlerts(clearCache);
            const alerts = Array.isArray(res?.alerts) ? res.alerts : [];
            dispatch({type: 'SET_ALERTS', payload: alerts});
        } catch {
            dispatch({type: 'SET_ALERTS_FAILED'});
        }
    }, []);

    // ak-166j: clear gtts + alerts on disconnect. Same edge-detection
    // pattern as margins / trades so we only clear on actual
    // isAuthenticated true→false transitions.
    const prevAuthForMonitoringRef = useRef<boolean>(false);
    useEffect(() => {
        const was = prevAuthForMonitoringRef.current;
        const is = state.isAuthenticated;
        prevAuthForMonitoringRef.current = is;
        if (was && !is) {
            dispatch({type: 'CLEAR_GTTS'});
            dispatch({type: 'CLEAR_ALERTS'});
        }
    }, [state.isAuthenticated]);

    // Fetch holdings
    const fetchHoldings = async (clearCache = false) => {
        try {
            dispatch({type: 'SET_LOADING', payload: {key: 'holdings', value: true}});
            dispatch({type: 'SET_ERROR', payload: null});

            const response = await fetchKiteHoldings(clearCache);
            dispatch({type: 'SET_HOLDINGS', payload: response.holdings});
            dispatch({type: 'SET_AUTHENTICATED', payload: true});

            // Fresh data means the token is still valid — opportunistic
            // clear of any lingering reconnect-required pill (e.g. after
            // the user reconnected from another tab).
            if (state.reconnect.reconnectRequired) {
                dispatch({type: 'CLEAR_RECONNECT'});
            }

        } catch (error) {
            // ak-u60: 401 + reconnect_required: true is NOT an error toast.
            // It's the expected daily state — surface the affordance via
            // ReconnectInfo and stay silent.
            const hint = extractReconnectHintFromError(error);
            if (hint) {
                dispatch({type: 'SET_RECONNECT', payload: hint});
                dispatch({type: 'SET_AUTHENTICATED', payload: false});
                // No setPayload — pill IS the user feedback.
                return;
            }

            const anyErr = error as {response?: {data?: {message?: string}; status?: number}};
            const errorMessage = anyErr?.response?.data?.message || 'Failed to fetch holdings';
            dispatch({type: 'SET_ERROR', payload: errorMessage});

            if (anyErr?.response?.status === 401) {
                dispatch({type: 'SET_AUTHENTICATED', payload: false});
            }

            setPayload({
                type: 'error',
                message: errorMessage,
            });
        } finally {
            dispatch({type: 'SET_LOADING', payload: {key: 'holdings', value: false}});
        }
    };

    // Fetch positions
    const fetchPositions = async (clearCache = false) => {
        try {
            dispatch({type: 'SET_LOADING', payload: {key: 'positions', value: true}});
            dispatch({type: 'SET_ERROR', payload: null});

            const response = await fetchKitePositions(clearCache);
            dispatch({type: 'SET_POSITIONS', payload: {net: response.net, day: response.day}});
            dispatch({type: 'SET_AUTHENTICATED', payload: true});

            if (state.reconnect.reconnectRequired) {
                dispatch({type: 'CLEAR_RECONNECT'});
            }

        } catch (error) {
            const hint = extractReconnectHintFromError(error);
            if (hint) {
                dispatch({type: 'SET_RECONNECT', payload: hint});
                dispatch({type: 'SET_AUTHENTICATED', payload: false});
                return;
            }

            const anyErr = error as {response?: {data?: {message?: string}; status?: number}};
            const errorMessage = anyErr?.response?.data?.message || 'Failed to fetch positions';
            dispatch({type: 'SET_ERROR', payload: errorMessage});

            if (anyErr?.response?.status === 401) {
                dispatch({type: 'SET_AUTHENTICATED', payload: false});
            }

            setPayload({
                type: 'error',
                message: errorMessage,
            });
        } finally {
            dispatch({type: 'SET_LOADING', payload: {key: 'positions', value: false}});
        }
    };

    // Sync holdings to database
    const syncHoldings = async () => {
        try {
            dispatch({type: 'SET_LOADING', payload: {key: 'sync', value: true}});
            dispatch({type: 'SET_ERROR', payload: null});

            const response = await syncKiteHoldings();
            dispatch({type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString()});

            // Sync succeeded ⇒ token still valid ⇒ any lingering
            // reconnect pill was stale. Clear it in the same tick so the
            // header affordance disappears immediately (don't wait for
            // the next refreshStatus cycle).
            if (state.reconnect.reconnectRequired) {
                dispatch({type: 'CLEAR_RECONNECT'});
            }

            setPayload({
                type: 'success',
                message: response.message,
            });

        } catch (error) {
            const hint = extractReconnectHintFromError(error);
            if (hint) {
                dispatch({type: 'SET_RECONNECT', payload: hint});
                dispatch({type: 'SET_AUTHENTICATED', payload: false});
                return;
            }

            const anyErr = error as {response?: {data?: {message?: string}}};
            const errorMessage = anyErr?.response?.data?.message || 'Failed to sync holdings';
            dispatch({type: 'SET_ERROR', payload: errorMessage});

            setPayload({
                type: 'error',
                message: errorMessage,
            });
        } finally {
            dispatch({type: 'SET_LOADING', payload: {key: 'sync', value: false}});
        }
    };

    // Calculate total portfolio value
    const getTotalPortfolioValue = (): number => {
        return state.holdings.reduce((total, holding) => {
            return total + (holding.last_price * holding.quantity);
        }, 0);
    };

    // Calculate total P&L
    const getTotalPnL = (): number => {
        return state.holdings.reduce((total, holding) => {
            return total + holding.pnl;
        }, 0);
    };

    // Calculate day P&L
    const getDayPnL = (): number => {
        return state.holdings.reduce((total, holding) => {
            return total + (holding.day_change * holding.quantity);
        }, 0);
    };

    const contextValue: KiteContextType = {
        state,
        dispatch,
        fetchHoldings,
        fetchPositions,
        syncHoldings,
        refreshStatus,
        beginReconnect,
        refreshMargins,
        refreshTrades,
        refreshGtts,
        refreshAlerts,
        getTotalPortfolioValue,
        getTotalPnL,
        getDayPnL,
    };

    return (
        <KiteContext.Provider value={contextValue}>
            {children}
        </KiteContext.Provider>
    );
};

// Custom hook to use Kite context
export const useKite = (): KiteContextType => {
    const context = useContext(KiteContext);
    if (!context) {
        throw new Error('useKite must be used within a KiteProvider');
    }
    return context;
};
