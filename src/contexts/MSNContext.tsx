import React, {createContext, useContext, useReducer, ReactNode} from 'react';
import {MSNListResponse, MSNSummaryResponse} from "../utils/interfaces.ts";

interface SelectedCard {
    mf: boolean;
    stocks: boolean;
    nps: boolean;
}

interface SummaryContext {
    mf: MSNSummaryResponse;
    stocks: MSNSummaryResponse;
    nps: MSNSummaryResponse;
}

interface ListContext {
    mf: MSNListResponse[];
    stocks: MSNListResponse[];
    nps: MSNListResponse[];
}

// Define the shape of the state
interface MSNState {
    stockFileUpload: boolean;
    selectedCard: SelectedCard
    summaries: SummaryContext
    lists: ListContext

}

// Define the shape of the actions
type MSNAction =
    | { type: 'OpenStockFileUpload', payload: boolean }
    | { type: 'CardSelector', payload: SelectedCard }
    | { type: 'ResetCardSelector' }
    | { type: 'MSNSummarySetter', payload: any }
    | { type: 'MSNListSetter', payload: ListContext };

// Initial state
const initalSummaryState: MSNSummaryResponse = {
    totalValue: 0,
    currentValue: 0,
    changePercent: 0,
    changeAmount: 0,
    count: 0,
    marketStatus: false,
};

const initialState: MSNState = {
    stockFileUpload: false,
    selectedCard: {
        mf: false,
        stocks: false,
        nps: false,
    },
    summaries: {
        mf: initalSummaryState,
        stocks: initalSummaryState,
        nps: initalSummaryState,
    },
    lists: {
        mf: [],
        stocks: [],
        nps: [],
    },
};

// Reducer function to manage state transitions
const msnReducer = (state: MSNState, action: MSNAction): MSNState => {
    switch (action.type) {
        case 'OpenStockFileUpload':
            return {...state, stockFileUpload: action.payload};
        case 'CardSelector':
            return {...state, selectedCard: action.payload};
        case 'ResetCardSelector':
            return {...state, selectedCard: {mf: false, stocks: false, nps: false}};
        case 'MSNSummarySetter':
            return {...state, summaries: {...state.summaries, ...action.payload}};
        case 'MSNListSetter':
            return {...state, lists: action.payload};
        default:
            return state;
    }
};

// Define the shape of the context value
interface MSNContextType {
    state: MSNState;
    dispatch: React.Dispatch<MSNAction>;
    showAlert: (message: string) => void;
    logToConsole: (message: string) => void;
    multiplyNumbers: (a: number, b: number) => number;
}

// Create the context
const MSNContext = createContext<MSNContextType | undefined>(undefined);

// Define the provider component
interface MSNProviderProps {
    children: ReactNode;
}

export const MSNProvider: React.FC<MSNProviderProps> = ({children}) => {
    const [state, dispatch] = useReducer(msnReducer, initialState);

    // Example functions to include in the context
    const showAlert = (message: string) => {
        alert(message);
    };

    const logToConsole = (message: string) => {
        console.log(message);
    };

    const multiplyNumbers = (a: number, b: number): number => {
        return a * b;
    };

    // Object containing the state, dispatch, and functions to expose
    const contextValue: MSNContextType = {
        state,
        dispatch,
        showAlert,
        logToConsole,
        multiplyNumbers,
    };

    return (
        <MSNContext.Provider value={contextValue}>
            {children}
        </MSNContext.Provider>
    );
};

// Custom hook to use the context in child components
export const useMSNContext = (): MSNContextType => {
    const context = useContext(MSNContext);
    if (context === undefined) {
        throw new Error('useMSNContext must be used within a MSNProvider');
    }
    return context;
};
