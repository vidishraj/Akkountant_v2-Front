import React, {createContext, useContext, useReducer} from "react";
import {Transaction} from "../services/transactionService.ts";
import {SortType} from "./FileFilterContext.tsx";

// Define the filter state type
interface FilterState {
    searchTerm: string;
    startDate: string;
    endDate: string;
    bank: string;
    month: string;
    sortBy: SortType;
    limit: number;
    transactions: Transaction[];
    page: number;
    transactionCount: number;
}

// Initial state
const initialState: FilterState = {
    searchTerm: "",
    startDate: "",
    endDate: "",
    bank: "",
    sortBy: {
        sortBy: 'date',
        sortDirection: 'desc'
    },
    limit: 100,
    month: "",
    transactions: [],
    page: 0,
    transactionCount: 0,
};

// In FilterContext
type FilterAction =
    | { type: "SET_SEARCH_TERM"; payload: string }
    | { type: "SET_START_DATE"; payload: string }
    | { type: "SET_END_DATE"; payload: string }
    | { type: "SET_BANK"; payload: string }
    | { type: "SET_SORT_BY"; payload: SortType }
    | { type: "SET_LIMIT"; payload: number }
    | { type: "SET_MONTH"; payload: string }
    | { type: "SET_PAGE"; payload: number }
    | { type: "SET_TRANSACTIONS"; payload: Transaction[] }
    | { type: "SET_TRANSACTION_COUNT"; payload: number }
    | { type: "APPLY" };

const filterReducer = (state: FilterState, action: FilterAction): FilterState => {
    switch (action.type) {
        case "SET_SEARCH_TERM":
            return {...state, searchTerm: action.payload};
        case "SET_START_DATE":
            return {...state, startDate: action.payload};
        case "SET_END_DATE":
            return {...state, endDate: action.payload};
        case "SET_BANK":
            return {...state, bank: action.payload};
        case "SET_MONTH":
            return {...state, month: action.payload};
        case "SET_PAGE":
            return {...state, page: action.payload};
        case "SET_TRANSACTIONS":
            return {...state, transactions: action.payload};
        case "SET_TRANSACTION_COUNT":
            return {...state, transactionCount: action.payload};
        case "SET_SORT_BY":
            return {...state, sortBy: action.payload};
        case "SET_LIMIT":
            return {...state, limit: action.payload};
        default:
            throw new Error(`Unknown action type: ${action}`);
    }
};

// Create Context
const FilterContext = createContext<{
    state: FilterState;
    dispatch: React.Dispatch<FilterAction>;
}>({
    state: initialState,
    dispatch: () => undefined,
});

// Provider component
export const FilterProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [state, dispatch] = useReducer(filterReducer, initialState);

    return (
        <FilterContext.Provider value={{state, dispatch}}>
            {children}
        </FilterContext.Provider>
    );
};

// Custom hook to use FilterContext
export const useFilterContext = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error("useFilterContext must be used within a FilterProvider");
    }
    return context;
};
