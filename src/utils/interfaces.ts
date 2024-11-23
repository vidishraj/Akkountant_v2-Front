// Shared interfaces for requests and responses
export interface DateRange {
    dateFrom?: string;
    dateTo?: string;

    [key: string]: any;
}

export interface Filter {
    bank?: string;
    details?: string;
    tag?: string;
    dateRange?: DateRange;

    [key: string]: any;
}

export interface GoogleStatusResponse {
    Message?: string;
    auth?: string;
}

export interface TransactionRequestBody {
    Page: number;
    Filter: Filter;
}

export interface FileDetailsRequestBody {
    Page: number;
    Filter: {
        bank?: string;
        fileName?: string;
        dateRange?: DateRange;
    };
}

export interface Transaction {
    amount: string; // Transaction amount, stored as a string for precision
    bank: string; // The bank associated with the transaction
    date: string; // Date of the transaction in string format
    details: string; // Detailed description of the transaction
    fileID: string; // File identifier associated with the transaction
    referenceID: string; // Unique reference ID for the transaction
    source: string; // Source of the transaction data
    tag: string; // Any tag associated with the transaction (optional, can be empty)
    user: string; // User ID associated with the transaction,
    [key: string]: any; // Index signature to allow additional string-based properties
}

export interface TransactionResponse {
    results: Transaction[];
    page: number;
    credit_sum: number;
    debit_sum: number;
    total_count: number;
}

export interface FileDetails {
    fileID: string; // File ID
    uploadDate: string; // Upload date of the file
    fileName: string; // Name of the file
    fileSize: string; // Size of the file
    statementCount: number; // Number of statements in the file
    bank: string; // Bank associated with the file
    user: string; // User ID who uploaded the file
}

export interface FileDetailsResponse {
    total_count: number;
    page: number;
    page_size: number;
    results: FileDetails[];
}
