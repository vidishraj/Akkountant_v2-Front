import React, {createContext, useContext, useReducer} from "react";

// Define the filter state type
interface FilterState {
    searchTerm: string;
    startDate: string;
    endDate: string;
    bank: string;
    month: string;
}

// Initial state
const initialState: FilterState = {
    searchTerm: "",
    startDate: "",
    endDate: "",
    bank: "",
    month: "",
};

// Define action types
type FilterAction =
    | { type: "SET_SEARCH_TERM"; payload: string }
    | { type: "SET_START_DATE"; payload: string }
    | { type: "SET_END_DATE"; payload: string }
    | { type: "SET_BANK"; payload: string }
    | { type: "SET_MONTH"; payload: string }
    | { type: "APPLY"; };

// Reducer function
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
