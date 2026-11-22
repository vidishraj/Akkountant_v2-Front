import React, {createContext, useCallback, useContext, useEffect, useReducer, ReactNode} from 'react';
import {KiteHolding, KitePosition} from '../utils/interfaces';
import {
    fetchKiteHoldings,
    fetchKitePositions,
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
    | {type: 'RESET_STATE'};

// Initial state
const initialReconnect: ReconnectInfo = {
    checked: false,
    reconnectRequired: false,
    reason: null,
    expiresAt: null,
    loginUrl: null,
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
