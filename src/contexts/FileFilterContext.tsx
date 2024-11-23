import React, {createContext, useContext, useReducer} from "react";
import {FileDetails} from "../services/transactionService.ts";

export interface SortType {
    sortBy: string;
    sortDirection: 'asc' | 'desc';
}

// Define the filter state type
interface FileFilterState {
    fileName: string; // Filter by file name
    startDate: string; // Filter by start date
    endDate: string; // Filter by end date
    bank: string; // Filter by bank
    sortBy: SortType;
    limit: number;
    fileDetails: FileDetails[],
    filePage: number;
    fileCount: number;
}

// Initial state
const initialState: FileFilterState = {
    fileName: "",
    startDate: "",
    endDate: "",
    bank: "",
    sortBy: {
        sortBy: 'uploadDate',
        sortDirection: 'desc'
    },
    limit: 100,
    fileDetails: [],
    filePage: 0,
    fileCount: 0
};

// In FileFilterContext
type FileFilterAction =
    | { type: "SET_FILE_NAME"; payload: string }
    | { type: "SET_START_DATE"; payload: string }
    | { type: "SET_END_DATE"; payload: string }
    | { type: "SET_BANK"; payload: string }
    | { type: "SET_SORT_BY"; payload: SortType }
    | { type: "SET_LIMIT"; payload: number }
    | { type: "SET_FILE_PAGE"; payload: number }
    | { type: "SET_FILE_DETAILS"; payload: FileDetails[] }
    | { type: "SET_FILE_COUNT"; payload: number }
    | { type: "RESET_FILTERS" };

const fileFilterReducer = (state: FileFilterState, action: FileFilterAction): FileFilterState => {
    switch (action.type) {
        case "SET_FILE_NAME":
            return {...state, fileName: action.payload};
        case "SET_START_DATE":
            return {...state, startDate: action.payload};
        case "SET_END_DATE":
            return {...state, endDate: action.payload};
        case "SET_BANK":
            return {...state, bank: action.payload};
        case "SET_FILE_PAGE":
            return {...state, filePage: action.payload};
        case "SET_FILE_DETAILS":
            return {...state, fileDetails: action.payload};
        case "SET_FILE_COUNT":
            return {...state, fileCount: action.payload};
        case "SET_SORT_BY":
            return {...state, sortBy: action.payload};
        case "SET_LIMIT":
            return {...state, limit: action.payload};
        default:
            throw new Error(`Unknown action type: ${action}`);
    }
};


// Create Context
const FileFilterContext = createContext<{
    state: FileFilterState;
    dispatch: React.Dispatch<FileFilterAction>;
}>({
    state: initialState,
    dispatch: () => undefined,
});

// Provider component
export const FileFilterProvider: React.FC<{ children: React.ReactNode }> = ({children}) => {
    const [state, dispatch] = useReducer(fileFilterReducer, initialState);

    return (
        <FileFilterContext.Provider value={{state, dispatch}}>
            {children}
        </FileFilterContext.Provider>
    );
};

// Custom hook to use FileFilterContext
export const useFileFilterContext = () => {
    const context = useContext(FileFilterContext);
    if (!context) {
        throw new Error("useFileFilterContext must be used within a FileFilterProvider");
    }
    return context;
};
