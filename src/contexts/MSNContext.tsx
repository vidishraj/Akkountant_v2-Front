import React, {createContext, ReactNode, useContext, useReducer} from 'react';
import {EPGResponse, MSNListResponse, MSNSummaryResponse} from "../utils/interfaces";
import {
    deleteAll,
    fetchCompleteEPG,
    fetchSecuritiesList, fetchSecurityTransactions,
    fetchSummary,
    fetchUserSecurities
} from "../services/investmentService";
import {useMessage} from "./MessageContext";

// Define interfaces for selected card, summary context, list context, loader, loading state, and MSN state

interface SelectedCard {
    mf: boolean;
    stocks: boolean;
    nps: boolean;
    epf: boolean;
    ppf: boolean;
    gold: boolean;
}

interface SummaryContext {
    mf: MSNSummaryResponse;
    stocks: MSNSummaryResponse;
    nps: MSNSummaryResponse;
    epf: EPGResponse;
    gold: EPGResponse;
    ppf: EPGResponse;

    [key: string]: any;
}

interface ListContext {
    mf: MSNListResponse[];
    stocks: MSNListResponse[];
    nps: MSNListResponse[];
}

interface TransactionContext {
    mf: [];
    stocks: [];
    nps: [];
}

interface MSNLoader {
    summary: boolean;
    list: boolean;
    transactions: boolean;
}

interface LoadingState {
    stocks: MSNLoader;
    mf: MSNLoader;
    nps: MSNLoader;
    epf: MSNLoader;
    ppf: MSNLoader;
    gold: MSNLoader;
}

// Define the shape of the state
interface MSNState {
    stockFileUpload: boolean;
    selectedCard: SelectedCard;
    summaries: SummaryContext;
    lists: ListContext;
    transactions: TransactionContext;
    loadingState: LoadingState;
}

// Define the shape of the actions
type MSNAction =
    | { type: 'OpenStockFileUpload'; payload: boolean }
    | { type: 'CardSelector'; payload: SelectedCard }
    | { type: 'ResetCardSelector' }
    | { type: 'MSNSummarySetter'; payload: SummaryContext }
    | { type: 'MSNTransactionSetter'; payload: TransactionContext }
    | { type: 'MSNListSetter'; payload: ListContext }
    | { type: 'MSNLoaderSetter'; payload: any };

// Initial state
const initialSummaryState: MSNSummaryResponse = {
    totalValue: 0,
    currentValue: 0,
    changePercent: 0,
    changeAmount: 0,
    count: 0,
    marketStatus: false,
};

const initialEPGSummaryState: EPGResponse = {
    deposits: [],
    net: 0,
    netProfit: 0,
    transactions: [],
    unAccountedProfit: undefined
};

const initialLoadingState: MSNLoader = {
    summary: false,
    list: false,
    transactions: false
};
const initalSelectedCard = {
    mf: false,
    stocks: false,
    nps: false,
    epf: false,
    ppf: false,
    gold: false
}

const initialState: MSNState = {
    stockFileUpload: false,
    selectedCard: initalSelectedCard,
    summaries: {
        mf: initialSummaryState,
        stocks: initialSummaryState,
        nps: initialSummaryState,
        epf: initialEPGSummaryState,
        gold: initialEPGSummaryState,
        ppf: initialEPGSummaryState,
    },
    lists: {
        mf: [],
        stocks: [],
        nps: [],
    },
    transactions: {
        mf: [],
        stocks: [],
        nps: [],
    },
    loadingState: {
        stocks: initialLoadingState,
        mf: initialLoadingState,
        nps: initialLoadingState,
        epf: initialLoadingState,
        ppf: initialLoadingState,
        gold: initialLoadingState
    }
};

// Reducer function to manage state transitions
const msnReducer = (state: MSNState, action: MSNAction): MSNState => {
    switch (action.type) {
        case 'OpenStockFileUpload':
            return {...state, stockFileUpload: action.payload};
        case 'CardSelector':
            return {...state, selectedCard: action.payload};
        case 'ResetCardSelector':
            return {...state, selectedCard: initalSelectedCard};
        case 'MSNSummarySetter':
            return {...state, summaries: {...state.summaries, ...action.payload}};
        case 'MSNListSetter':
            return {...state, lists: action.payload};
        case 'MSNTransactionSetter':
            return {...state, transactions: {...state.transactions, ...action.payload}};
        case 'MSNLoaderSetter':
            return {...state, loadingState: {...state.loadingState, ...action.payload}};
        default:
            return state;
    }
};

// Define the shape of the context value
interface MSNContextType {
    state: MSNState;
    dispatch: React.Dispatch<MSNAction>;
    fetchAndSetSummary: (serviceType: string, clearCache: boolean) => void;
    fetchAndSetSearchItems: () => Promise<MSNListResponse[]>;
    fetchAndSetUserSecurities: () => void;
    deleteComplete: () => void;
    AllInfoForEpf: (serviceType: string, clearCache: boolean) => void;
    getServiceType: () => string;
    getContextKey: () => string;
    fetchTransactions: (serviceType: string, clearCache: boolean) => void;
}

// Create the context
const MSNContext = createContext<MSNContextType | undefined>(undefined);

// Define the provider component
interface MSNProviderProps {
    children: ReactNode;
}

export const MSNProvider: React.FC<MSNProviderProps> = ({children}) => {
    const [state, dispatch] = useReducer(msnReducer, initialState);

    const getServiceType = (): string => (
        state.selectedCard.mf ? "Mutual_Funds" :
            state.selectedCard.stocks ? "Stocks" :
                state.selectedCard.ppf ? "PF" :
                    state.selectedCard.gold ? "Gold" :
                        state.selectedCard.epf ? "EPF" : "NPS"
    );

    const getContextFromService = (serviceType: string): keyof SummaryContext => {
        switch (serviceType) {
            case "Mutual_Funds":
                return "mf";
            case "Stocks":
                return "stocks";
            case "EPF":
                return "epf";
            case "Gold":
                return "gold";
            case "PF":
                return "ppf";
            case "NPS":
            default:
                return "nps";
        }
    };

    const getContextKey = (): keyof ListContext => (
        state.selectedCard.mf ? "mf" :
            state.selectedCard.stocks ? "stocks" : "nps"
    );

    const serviceType = getServiceType();
    const contextKey = getContextKey();
    const {setPayload} = useMessage();

    const fetchAndSetSummary = (serviceType: string, clearCache: boolean): void => {
        const context = getContextFromService(serviceType);
        dispatch({
            type: "MSNLoaderSetter",
            payload: {[context]: {...state.loadingState[context], summary: true}}
        });

        fetchSummary(serviceType, clearCache)
            .then((response) => {
                dispatch({
                    type: "MSNSummarySetter",
                    payload: {[context]: response.data},
                });
            })
            .catch((err) => {
                setPayload({
                    type: "error",
                    message: `Error fetching summary for ${serviceType}. Please try again!`
                });
                console.error(`Error fetching ${serviceType} summary:`, err);
            })
            .finally(() => {
                dispatch({
                    type: "MSNLoaderSetter",
                    payload: {[context]: {...state.loadingState[context], summary: false}}
                });
            });
    };

    const fetchAndSetUserSecurities = async (): Promise<void> => {
        dispatch({
            type: "MSNLoaderSetter",
            payload: {...state.loadingState, [contextKey]: {...state.loadingState[contextKey], list: true}}
        });

        try {
            fetchUserSecurities(serviceType)
                .then((response) => {
                    dispatch({
                        type: "MSNListSetter",
                        payload: {...state.lists, [contextKey]: response.data},
                    });
                })
                .finally(() => {
                    dispatch({
                        type: "MSNLoaderSetter",
                        payload: {...state.loadingState, [contextKey]: {...state.loadingState[contextKey], list: false}}
                    });
                });
        } catch (error) {
            setPayload({
                type: "error",
                message: `Error fetching list for ${serviceType}. Please try again!`
            });
            console.error(`Error fetching user securities for ${serviceType}:`, error);
        }
    };

    const fetchAndSetSearchItems = async (): Promise<MSNListResponse[]> => {
        try {
            const response = await fetchSecuritiesList(serviceType);
            if (response.status === 200 && Array.isArray(response.data.data)) {
                return response.data.data.map((item: MSNListResponse, index: number) => ({
                    id: index,
                    name: contextKey === "stocks" ? item.stockCode : contextKey === "nps" ? item.name : item.schemeName,
                    code: contextKey === "mf" ? item.schemeCode : contextKey === 'nps' ? item.id : undefined,
                }));
            } else {
                setPayload({
                    type: "error",
                    message: `Error fetching info for ${serviceType}. Please try again!`
                });
            }
            return [];
        } catch (error) {
            setPayload({
                type: "error",
                message: `Error fetching info for ${serviceType}. Please try again!`
            });
            console.error(`Error fetching securities list for ${serviceType}:`, error);
            return [];
        }
    };

    const deleteComplete = async (): Promise<void> => {
        deleteAll(serviceType)
            .then((response) => {
                if (response.status === 200 && response.data.message.startsWith("Successfully deleted all")) {
                    setPayload({
                        type: "success",
                        message: `Successfully deleted all ${serviceType}.`
                    });
                }
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: `Error deleting all ${serviceType}. Please try again!`
                });
            });
    };

    const AllInfoForEpf = async (serviceTy: string, clearCache: boolean): Promise<void> => {
        const serviceType = getContextFromService(serviceTy);
        fetchCompleteEPG(serviceTy, clearCache)
            .then((response) => {
                if (response.status === 200) {
                    dispatch({
                        type: "MSNSummarySetter",
                        payload: {[serviceType]: response.data}
                    });
                }
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: `Error fetching EPG ${serviceType}. Please try again!`
                });
            });
    };
    const fetchTransactions = async (serviceTy: string, clearCache: boolean): Promise<void> => {
        const serviceType = getContextFromService(serviceTy);
        fetchSecurityTransactions(serviceTy, clearCache)
            .then((response) => {
                if (response.status === 200) {
                    dispatch({
                        type: "MSNTransactionSetter",
                        payload: {[contextKey]: response.data}
                    });
                }
            })
            .catch(() => {
                setPayload({
                    type: "error",
                    message: `Error fetching EPG ${serviceType}. Please try again!`
                });
            });
    };

    const contextValue: MSNContextType = {
        state,
        dispatch,
        fetchAndSetSummary,
        fetchAndSetSearchItems,
        fetchAndSetUserSecurities,
        deleteComplete,
        AllInfoForEpf,
        getServiceType,
        getContextKey,
        fetchTransactions
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
