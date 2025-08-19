import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { KiteHolding, KitePosition } from '../utils/interfaces';
import { fetchKiteHoldings, fetchKitePositions, syncKiteHoldings } from '../services/investmentService';
import { useMessage } from './MessageContext';

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
}

// Kite Actions
type KiteAction =
    | { type: 'SET_LOADING'; payload: { key: keyof KiteState['loading']; value: boolean } }
    | { type: 'SET_HOLDINGS'; payload: KiteHolding[] }
    | { type: 'SET_POSITIONS'; payload: { net: KitePosition[]; day: KitePosition[] } }
    | { type: 'SET_AUTHENTICATED'; payload: boolean }
    | { type: 'SET_ERROR'; payload: string | null }
    | { type: 'SET_LAST_SYNC_TIME'; payload: string }
    | { type: 'RESET_STATE' };

// Initial state
const initialState: KiteState = {
    holdings: [],
    positions: {
        net: [],
        day: []
    },
    isAuthenticated: false,
    loading: {
        holdings: false,
        positions: false,
        sync: false,
        auth: false
    },
    lastSyncTime: null,
    error: null
};

// Reducer
const kiteReducer = (state: KiteState, action: KiteAction): KiteState => {
    switch (action.type) {
        case 'SET_LOADING':
            return {
                ...state,
                loading: {
                    ...state.loading,
                    [action.payload.key]: action.payload.value
                }
            };
        case 'SET_HOLDINGS':
            return {
                ...state,
                holdings: action.payload,
                error: null
            };
        case 'SET_POSITIONS':
            return {
                ...state,
                positions: action.payload,
                error: null
            };
        case 'SET_AUTHENTICATED':
            return {
                ...state,
                isAuthenticated: action.payload,
                error: action.payload ? null : state.error
            };
        case 'SET_ERROR':
            return {
                ...state,
                error: action.payload
            };
        case 'SET_LAST_SYNC_TIME':
            return {
                ...state,
                lastSyncTime: action.payload
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
    getTotalPortfolioValue: () => number;
    getTotalPnL: () => number;
    getDayPnL: () => number;
}

// Create context
const KiteContext = createContext<KiteContextType | undefined>(undefined);

// Provider component
export const KiteProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [state, dispatch] = useReducer(kiteReducer, initialState);
    const { setPayload } = useMessage();

    // Fetch holdings
    const fetchHoldings = async (clearCache = false) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: { key: 'holdings', value: true } });
            dispatch({ type: 'SET_ERROR', payload: null });

            const response = await fetchKiteHoldings(clearCache);
            dispatch({ type: 'SET_HOLDINGS', payload: response.holdings });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to fetch holdings';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            
            // If unauthorized, set authenticated to false
            if (error.response?.status === 401) {
                dispatch({ type: 'SET_AUTHENTICATED', payload: false });
            }
            
            setPayload({
                type: 'error',
                message: errorMessage
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'holdings', value: false } });
        }
    };

    // Fetch positions
    const fetchPositions = async (clearCache = false) => {
        try {
            dispatch({ type: 'SET_LOADING', payload: { key: 'positions', value: true } });
            dispatch({ type: 'SET_ERROR', payload: null });

            const response = await fetchKitePositions(clearCache);
            dispatch({ type: 'SET_POSITIONS', payload: { net: response.net, day: response.day } });
            dispatch({ type: 'SET_AUTHENTICATED', payload: true });

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to fetch positions';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            
            // If unauthorized, set authenticated to false
            if (error.response?.status === 401) {
                dispatch({ type: 'SET_AUTHENTICATED', payload: false });
            }

            setPayload({
                type: 'error',
                message: errorMessage
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'positions', value: false } });
        }
    };

    // Sync holdings to database
    const syncHoldings = async () => {
        try {
            dispatch({ type: 'SET_LOADING', payload: { key: 'sync', value: true } });
            dispatch({ type: 'SET_ERROR', payload: null });

            const response = await syncKiteHoldings();
            dispatch({ type: 'SET_LAST_SYNC_TIME', payload: new Date().toISOString() });
            
            setPayload({
                type: 'success',
                message: response.message
            });

        } catch (error: any) {
            const errorMessage = error.response?.data?.message || 'Failed to sync holdings';
            dispatch({ type: 'SET_ERROR', payload: errorMessage });

            setPayload({
                type: 'error',
                message: errorMessage
            });
        } finally {
            dispatch({ type: 'SET_LOADING', payload: { key: 'sync', value: false } });
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
        getTotalPortfolioValue,
        getTotalPnL,
        getDayPnL
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