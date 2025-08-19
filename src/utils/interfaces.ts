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

export interface Job {
    DueTime: string;
    Failures: number;
    Result: string;
    Status: string;
    Title: string;
}

export interface JobsResponse {
    results: Job[];
    page: number;
    jobs: Record<string, string>;
}

// Freelance and Invoice Interfaces
export interface InvoiceItem {
    description: string;
    quantity: number;
    rate: number;
    amount: number;
}

export interface PaymentBreakdown {
    [key: string]: number;
}

export interface PaymentInfo {
    paymentMethod: string;
    amountReceived: number;
    breakdown: PaymentBreakdown;
    paymentDate?: string;
    notes?: string;
}

export interface CustomField {
    key: string;
    value: string;
    hidden?: boolean; // If key starts with *, this will be true
}

export interface InvoiceData {
    invoiceNumber: string;
    projectName: string;
    issueDate: string;
    dueDate: string;
    customerId?: string;
    currency: 'USD' | 'INR' | 'GBP' | 'EUR' | 'AUD';
    from: {
        name: string;
        email: string;
        address: string;
        phone?: string;
    };
    to: {
        name: string;
        email: string;
        address: string;
        company?: string;
    };
    customFields?: CustomField[];
    hiddenCoreFields?: { [key: string]: boolean }; // For hiding core fields like emails/phones
    items: InvoiceItem[];
    subtotal: number;
    tax?: {
        rate: number;
        amount: number;
    };
    total: number;
    notes?: string;
    terms?: string;
    status?: 'draft' | 'sent' | 'paid' | 'overdue';
    payment?: PaymentInfo;
    createdAt?: string;
    updatedAt?: string;
}

export interface FreelanceEarning {
    date: string;
    clientName: string;
    projectName: string;
    amount: number;
    paidAmount?: number; // Amount paid in base currency (INR)
    currency?: string; // Original invoice currency
    invoiceNumber: string;
    status: 'paid' | 'pending' | 'overdue';
}

export interface UnpaidByCurrency {
    currency: string;
    amount: number;
    count: number;
}

export interface FreelanceDashboard {
    totalEarnings: number; // Total paid earnings in base currency (INR)
    monthlyEarnings: number; // Monthly paid earnings in base currency (INR)
    pendingAmount: number; // Total unpaid amount (multi-currency, estimated in INR)
    completedProjects: number;
    activeClients: number;
    earningsByMonth: { month: string; earnings: number }[]; // Paid earnings by month in INR
    earningsByClient: { client: string; earnings: number }[]; // Paid earnings by client in INR
    recentInvoices: FreelanceEarning[];
    unpaidByCurrency?: UnpaidByCurrency[]; // Unpaid invoices breakdown by currency
}

export interface SignatureData {
    signatureUrl: string; // Data URL for the signature image
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface Customer {
    id: string;
    name: string;
    email: string;
    company?: string;
    address: string;
    phone?: string;
    defaultTemplate?: Partial<InvoiceData>;
    totalEarnings: number;
    projectCount: number;
    lastInvoiceDate?: string;
    createdAt: string;
    updatedAt: string;
}

// Freelance API Request/Response Types
export interface CreateInvoiceRequest {
    invoiceData: InvoiceData;
}

export interface CreateInvoiceResponse {
    invoiceId: string;
    message: string;
}

export interface UpdateInvoiceRequest {
    invoiceData: InvoiceData;
}

export interface UpdateInvoiceResponse {
    message: string;
}

export interface DeleteInvoiceResponse {
    message: string;
}

export interface FetchInvoicesResponse {
    invoices: InvoiceData[];
    page: number;
    page_size: number;
    total_count: number;
}

export interface FetchCustomersResponse {
    customers: Customer[];
    page: number;
    page_size: number;
    total_count: number;
}

export interface CreateCustomerRequest {
    name: string;
    email: string;
    company?: string;
    address: string;
    phone?: string;
}

export interface CreateCustomerResponse {
    message: string;
    customer: Customer;
}

export interface UpdateCustomerRequest {
    name: string;
    email: string;
    company?: string;
    address: string;
    phone?: string;
}

export interface UpdateCustomerResponse {
    message: string;
}

export interface DeleteCustomerResponse {
    message: string;
}

export interface UpdateCustomerTemplateRequest {
    template: Partial<InvoiceData>;
}

export interface UpdateCustomerTemplateResponse {
    message: string;
}

export interface InvoiceTemplate {
    id: string;
    name: string;
    templateData: InvoiceData;
    customerId?: string;
    createdAt: string;
    updatedAt: string;
}

export interface CreateTemplateRequest {
    name: string;
    templateData: InvoiceData;
    customerId?: string;
}

export interface CreateTemplateResponse {
    message: string;
    template: InvoiceTemplate;
}

export interface UpdateTemplateRequest {
    name?: string;
    templateData?: InvoiceData;
    customerId?: string;
}

export interface UpdateTemplateResponse {
    message: string;
}

export interface DeleteTemplateResponse {
    message: string;
}

export interface Signature {
    id: string;
    name: string;
    signature_data: string; // Base64 encoded image data
    signature_type: string; // 'image'
    is_default: boolean;
    user_id: string;
    created_at: string;
    updated_at: string;
}

export interface UploadSignatureResponse {
    id: string;
    name: string;
    signature_data: string; // Base64 encoded image data
    signature_type: string; // 'image'
    is_default: boolean;
    user_id: string;
    created_at: string;
    updated_at: string;
    message?: string;
}

export interface DeleteSignatureResponse {
    message: string;
}

// Kite Connect API Interfaces
export interface KiteLoginUrlResponse {
    login_url: string;
}

export interface KiteSessionRequest {
    request_token: string;
}

export interface KiteSessionResponse {
    access_token: string;
    user_id: string;
    user_name: string;
    message: string;
}

export interface KiteHolding {
    tradingsymbol: string;
    exchange: string;
    isin: string;
    quantity: number;
    t1_quantity: number;
    realised_quantity: number;
    collateral_quantity: number;
    product: string;
    price: number;
    last_price: number;
    pnl: number;
    close_price: number;
    average_price: number;
    day_change: number;
    day_change_percentage: number;
    instrument_token: string;
    authorised_date?: string;
    authorised_quantity?: number;
}

export interface KitePosition {
    tradingsymbol: string;
    exchange: string;
    instrument_token: string;
    product: string;
    quantity: number;
    overnight_quantity: number;
    multiplier: number;
    average_price: number;
    close_price: number;
    last_price: number;
    value: number;
    pnl: number;
    m2m: number;
    unrealised: number;
    realised: number;
    buy_quantity: number;
    buy_price: number;
    buy_value: number;
    sell_quantity: number;
    sell_price: number;
    sell_value: number;
    day_buy_quantity: number;
    day_buy_price: number;
    day_buy_value: number;
    day_sell_quantity: number;
    day_sell_price: number;
    day_sell_value: number;
}

export interface KiteHoldingsResponse {
    holdings: KiteHolding[];
}

export interface KitePositionsResponse {
    net: KitePosition[];
    day: KitePosition[];
}

export interface KiteSyncResponse {
    message: string;
    holdings_synced: number;
}
