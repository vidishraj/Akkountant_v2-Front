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

// FileUpload.types.ts

// Response from the Flask API
export interface FileUploadResponse {
    file_count: string; // or number if you prefer to parse it
}

// Error response from the Flask API
export interface FileUploadError {
    error: string;
}

// Request parameters (if any, such as serviceType)
export interface FileUploadParams {
    serviceType: string;
}

export interface MSNSummaryResponse {
    totalValue: number; // Represents Decimal, mapped to number
    currentValue: number; // Represents Decimal, mapped to number
    changePercent: number; // Represents Decimal, mapped to number
    changeAmount: number | string; // Represents Decimal, mapped to number
    count: number; // Represents Integer, must be greater than 0
    marketStatus: boolean; // Represents Boolean
}

export interface MSNRateResponse {
    symbol: string; // Represents String
    companyName: string; // Represents String
    industry: string; // Represents String
    lastPrice: number; // Represents Decimal, must be >= 0
    change: number; // Represents Decimal
    pChange: number; // Represents Decimal
    previousClose: number; // Represents Decimal, must be >= 0
    open: number; // Represents Decimal, must be >= 0
    close: number; // Represents Decimal, must be >= 0
    dayHigh: number; // Represents Decimal, must be >= 0
    dayLow: number; // Represents Decimal, must be >= 0
    pfm_name?: string;
    nav?: string;
    yesterday?: string;
    lastWeek?: string;
    sixMonthsAgo?: string;
    schemeType?: string;
    name?: string;

    [key: string]: any;
}

export interface MSNListResponse {
    buyID: number | string; // The ID of the buy transaction, inferred as number or string
    buyCode: string; // Security code of the transaction
    buyPrice: number; // Quantity of securities purchased
    buyQuant: number; // Quantity of securities purchased
    schemeCode: string; // Code representing the security type or scheme
    serviceType: string; // Type of service (investment type)
    date: string; // Date in "YYYY-MM-DD" format
    info: MSNRateResponse
    stockCode?: string;
    name?: string;
    schemeName?: string;
    id?: string
}


interface Deposit {
    amount: number;
    buyId: string;
    date: string; // ISO or GMT string format
    description: string;
}

interface TransactionEPG {
    amount: number;
    date: string; // YYYY-MM format
    description?: string;
    interest: number;
    goldType?: string;
    quant?: number;
}

export interface EPGResponse {
    deposits: Deposit[];
    net: any;
    netProfit: any;
    transactions: TransactionEPG[];
    unAccountedProfit: any;
}


export interface InsertEPGRequest {
    date: string;
    description?: string;
    amount: number;
    quantity?: number;
    schemeCode?: any;
    goldType?: string;
}

export interface GlobalSummaryInterface {
    totalInvestment: number;
    currentValue: number;
    profit: number;
    profitPercentage: number;
}

export interface SecuritiesRead {
    [key: string]: boolean;
}

export interface OptedBankPasswordsRequestBody {
    banks: {
      [key: string]: string; 
    };
  }

  export interface JobResponseBody {
    Name: string;
    result: string;
    status: string;
    dueTime: string;
    executionTime: string | null;
  }
  