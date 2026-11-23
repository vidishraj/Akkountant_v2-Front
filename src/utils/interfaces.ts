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
    // ak-p3id (BE) / ak-5rg0 (FE): canonical positive-magnitude money
    // fields. `in_sum` (≥ 0) + `out_sum` (≥ 0) + signed `net`
    // (in_sum − out_sum). Pre-ak-p3id the FE would re-derive
    // `net = credit_sum - debit_sum`, but `credit_sum` was a
    // signed (NEGATIVE) magnitude of inflows — the subtraction
    // flipped the sign and rendered "+In" as negative on the Home
    // ledger + Transactions header. Legacy `credit_sum` /
    // `debit_sum` kept as backcompat fields; FE CONSUMEs the new
    // canonical fields verbatim.
    in_sum: number;
    out_sum: number;
    net: number;
    credit_sum: number;  // Legacy backcompat; do not use for new code
    debit_sum: number;   // Legacy backcompat; do not use for new code
    total_count: number;
}

export interface FileDetails {
    fileID: string; // File ID
    uploadDate: string; // Upload date of the file
    fileName: string; // Name of the file
    fileSize?: string; // Size of the file
    statementCount: number; // Number of statements/items in the file
    bank: string; // Bank associated with the file
    user: string; // User ID who uploaded the file
    category?: string; // Email category (e.g. "bank_statement", "investment")
    items_extracted?: number; // Number of items extracted
    extraction_summary?: Record<string, any>; // Detailed extraction summary
    summary_text?: string; // Human-readable summary string
    status?: string; // Processing status: processed/skipped/failed
    subject?: string; // Email subject line
    sender?: string; // Email sender
    has_pdf?: boolean; // Whether PDF file exists on disk
    email_date?: string; // Original email date
    period_start?: string; // Statement period start date
    period_end?: string; // Statement period end date
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
    error?: string; // Set by backend (e.g. "API_FAILED") when live price fetch failed; lastPrice is unreliable.

    [key: string]: any;
}

export interface MSNListResponse {
    buyID: number | string; // The ID of the buy transaction, inferred as number or string
    buyCode: string; // Security code of the transaction
    // Statement-derived average cost basis, from user's Zerodha tradebook uploads.
    //
    // POLICY CHAIN (three anchors — read this before touching buyPrice authority):
    //   1. **Pre-2026-09-04** (ak-w4p era): statement-derived buyPrice was
    //      authoritative; Kite's `average_price` was a cross-check hint only.
    //      Under this policy, T+1 shares had no cost basis (statement pipeline
    //      generates rows post-settlement) — including them in P&L would book
    //      their whole market value as phantom profit.
    //   2. **2026-09-04** (flatten-on-sync policy): Overseer accepted Kite's
    //      `average_price` as broker-canonical for the fields we sync from
    //      Kite. Broker view starts flattening our internal state on each sync.
    //   3. **2026-09-11** (ak-yz9c T+1 fold-in, Path A stamped): Kite avg is
    //      now authoritative for cost basis on the Kite-view screen — folded
    //      fields (`invested`, `unrealized_pnl`, `current_value`,
    //      `day_change_amount`) are computed server-side off Kite's blended
    //      avg. `buyPrice` remains DB-authoritative for the statement pipeline
    //      (`sync_kite_holdings_to_db` still preserves it) but is display-
    //      advisory on this screen.
    //
    // CONSEQUENCE ACCEPTED BY OVERSEER: on holdings with corporate actions
    // (splits/rights/dividend adjustments), Kite's broker-blended avg diverges
    // from statement-derived per-share cost. The Kite-view screen shows broker's
    // number, not out-of-pocket per share. Statement history keeps populating
    // DB but stops driving the Kite-view display.
    buyPrice: number;
    buyQuant: number; // Settled/demat quantity we hold (broker `quantity`, EXCLUDING T+1)
    schemeCode: string; // Code representing the security type or scheme
    serviceType: string; // Type of service (investment type)
    date: string; // Date in "YYYY-MM-DD" format
    info: MSNRateResponse
    stockCode?: string;
    name?: string;
    schemeName?: string;
    id?: string

    // --- Broker (Kite) holdings passthrough — ak-9we / backend ak-w4p / ak-yz9c ---
    // All optional: absent for non-Kite securities (MF / NPS / manually added stocks)
    // and absent on pre-Kite-sync rows. Read them through `utils/holdings.ts` rather
    // than inline so the contract stays in one place.
    //
    // FIELD SEMANTIC (ak-yz9c fold-in):
    // - `buyQuant` remains DB/statement-truthed settled qty (unchanged).
    // - `settled_qty` is the Kite-view settled qty on Kite-enriched rows — typically
    //   equals `buyQuant` on the happy path, but sourced from Kite for broker-view
    //   consumers.
    // - `t1_qty` is bought-but-unsettled (T+1 window). Renamed from the earlier
    //   `t1_quantity` for symmetry with `settled_qty`.
    // - `total_qty` = `settled_qty + t1_qty` (blended). BE-emitted single source of
    //   truth for the blended position; readers should prefer it over recomputing.
    // - `invested`, `current_value`, `unrealized_pnl`, `day_change_amount` are the
    //   server-computed fold-in money-math values. See BE ak-yz9c for the exact
    //   computation semantics (Kite-canonical avg on Path A).
    settled_qty?: number;            // Kite settled qty view
    t1_qty?: number;                 // bought, pending demat settlement (T+1 window)
    total_qty?: number;              // blended (settled + T+1)
    invested?: number;               // server-computed: avg × total_qty
    current_value?: number;          // server-computed: last_price × total_qty
    unrealized_pnl?: number;         // server-computed: current_value − invested
    day_change_amount?: number;      // server-computed: total_qty × (last_price − close_price)
    realised_quantity?: number;      // broker realised quantity
    collateral_quantity?: number;    // quantity pledged as collateral
    authorised_quantity?: number;    // quantity authorised for sale
    day_change?: number;             // absolute per-share day change (₹), broker-computed
    day_change_percentage?: number;  // day change (%), broker-computed
    // Explicit known/unknown discriminator from BE OHLC enrichment (ak-4o41).
    // BE sets this true when today_open (preferred) or close_price (fallback)
    // was available to compute day change; false when neither was — in which
    // case `day_change_amount`/`day_change` are 0 by convention but that 0
    // MEANS "unknown", NOT "flat today". Renderers must check this flag
    // before displaying a ₹0 day change. Absent field → legacy row (pre
    // ak-4o41), assume known for backward-compat.
    day_change_known?: boolean;
    close_price?: number;            // previous close, broker-provided
    // Broker-computed cost basis. **NOW AUTHORITATIVE for the Kite-view P&L
    // math** (2026-09-11 ak-yz9c fold-in, per 2026-09-04 flatten-on-sync
    // policy — see the `buyPrice` policy-chain comment above for the full
    // three-anchor history). BE uses this to compute the row-level
    // `invested` / `unrealized_pnl` / `current_value` / `day_change_amount`
    // folded values. Pre-2026-09-11 this was cross-check-only;
    // `getCostBasisDivergence` still surfaces the delta vs `buyPrice` as a
    // visible hint on rows where broker and statement diverge (informational
    // only — doesn't feed math).
    average_price?: number;
    // Broker's own price. DO NOT RENDER — the live NSE feed (`info.lastPrice`) remains
    // the pricing source; this exists purely for backend-side comparison until the
    // pricing-source swap is decided on its own bead.
    last_price?: number;
    // On the wire but not rendered. MTF is margin-funded quantity; we have no
    // confirmation the Overseer uses it, so showing it would add row weight for a
    // figure that is always zero. Wire them up only once that is confirmed.
    collateral_type?: string;
    mtf_quantity?: number;
    mtf_average_price?: number;
}


interface Deposit {
    amount: number;
    buyId: string;
    date: string; // ISO or GMT string format
    description: string;
    employeeAmount?: number;
    employerAmount?: number;
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

export interface InsertSecurityTransactionRequest {
    serviceType: "Mutual_Funds" | "Stocks" | "NPS";
    schemeCode: string;
    date: string; // Format: YYYY-MM-DD
    quantity: number;
    amount: number;
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
    // ── Arc A (ak-lvu) server-authoritative FX fields ─────────────────────
    // Populated by BE on POST/PUT — never client-supplied. FE reads these
    // for audit display (list row + detail) and to render the currency-
    // aware "Paid" summary. Absent on legacy payments (before Arc A).
    originalAmount?: number;      // Amount in the invoice's own currency
    originalCurrency?: string;    // e.g. "USD"
    inrAmount?: number;           // Stored INR value after FX conversion
    fxRate?: number;              // 1 originalCurrency → fxRate INR
    fxRateSource?: string;        // e.g. "openexchangerates"
    convertedAt?: string;         // ISO 8601 UTC — when the rate was captured
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
    // subtotal / tax.amount / total are SERVER-AUTHORITATIVE (Arc A / ak-lvu):
    // FE computes them during typing for immediate preview only; on save, the
    // freelanceService layer strips them from the payload and the backend
    // returns the recomputed 2dp values. Rendering must read these fields
    // as they came back from the server, never from a fresh client compute.
    subtotal: number;
    tax?: {
        rate: number;
        amount: number;
    };
    total: number;
    notes?: string;
    terms?: string;
    // Wave-added `partially_paid` status alongside the existing set. BE sets
    // this when totalPaidINR > 0 but < total_in_inr.
    status?: 'draft' | 'sent' | 'paid' | 'overdue' | 'partially_paid';
    payment?: PaymentInfo;
    // ── Arc A settlement summary (server-computed) ────────────────────────
    // totalPaidINR = Σ payments in INR. balanceDueINR = total_in_inr - that.
    // Both are absent on legacy invoices; when present they carry the
    // authoritative view and the FE renders them verbatim.
    totalPaidINR?: number;
    balanceDueINR?: number;
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
    // ak-p3id (BE) / ak-5rg0 (FE): canonical FY-scoped earnings +
    // FY bounds. Home "Freelance paid · this FY" tile + Freelance
    // dashboard "PAID THIS FY" tile both bind `fyEarnings` so the
    // two surfaces agree by construction (same BE aggregation,
    // same INR normalization via `get_earnings_in_inr`). Pre-
    // ak-p3id the Home tile was pulling from `totalEarnings` (all-
    // time) and the Freelance dashboard computed its own FY sum —
    // the ~70% divergence that triggered this bead.
    fyEarnings?: number;
    fyStart?: string; // YYYY-MM-DD, Asia/Kolkata-canonical FY start
    fyEnd?: string;   // YYYY-MM-DD, Asia/Kolkata-canonical FY end
    completedProjects: number;
    activeClients: number;
    earningsByMonth: { month: string; earnings: number }[]; // Paid earnings by month in INR
    earningsByClient: { client: string; earnings: number }[]; // Paid earnings by client in INR
    earningsByClientCombined: { client: string; earnings: number }[]; // All client earnings converted to INR
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

export interface ProcessedEmail {
    id: number;
    gmail_id?: string;
    subject: string;
    sender: string;
    received_date: string;
    category: string;
    extraction_summary: Record<string, unknown> | null;
}

export interface CustomerEmailLink {
    id: number;
    customer_id: string;
    email_id: number;
    linked_by: 'auto' | 'manual';
    created_at: string;
    email?: ProcessedEmail;
}

// Freelance API Request/Response Types
export interface CreateInvoiceRequest {
    invoiceData: InvoiceData;
}

export interface CreateInvoiceResponse {
    invoiceId: string;
    message: string;
    // Arc A: server returns the persisted invoice with authoritative
    // subtotal/tax/total/payment.fx fields. Callers should replace their
    // local copy with this rather than trust their pre-send state.
    invoice?: InvoiceData;
}

export interface UpdateInvoiceRequest {
    invoiceData: InvoiceData;
}

export interface UpdateInvoiceResponse {
    message: string;
    invoice?: InvoiceData;   // Arc A — same rationale as CreateInvoiceResponse
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

// ak-u60: GET /kite/status payload from ak-w4p. The BE emits this on
// every /kite/* 401 (as the response body) as well as from a dedicated
// GET /kite/status endpoint. Reconnect is a DAILY 6AM IST state — FE
// treats it as a normal affordance, not an error.
export interface KiteStatusResponse {
    connected: boolean;
    reconnect_required: boolean;
    reason: string | null;
    expires_at: string | null;   // ISO; next token-expiry boundary
    login_url: string | null;    // ready-to-redirect OAuth URL when reconnect_required
}

// ak-2k93 / ak-zai2 Bundle 2 (2026-11-12): BE pass-through of Kite SDK's
// `k.trades()`. BE wraps as `{trades: [...]}`. Every field is
// defensive-optional because BE forwards Kite's own shape with light
// wrapping only; Kite drift reaches FE uncoerced. Readers must null-check.
export interface KiteTrade {
    trade_id?: string;
    order_id?: string;
    exchange_order_id?: string;
    tradingsymbol?: string;
    exchange?: string;
    transaction_type?: string;        // "BUY" | "SELL" — treat as raw string for drift safety
    product?: string;                 // "CNC" | "MIS" | "NRML" | ...
    order_type?: string;
    instrument_token?: number;
    quantity?: number;
    price?: number;                   // avg fill price per Kite
    average_price?: number;           // alias in some Kite SDK versions
    fill_timestamp?: string;          // ISO-like datetime string
    exchange_timestamp?: string;
    order_timestamp?: string;
}

export interface KiteTradesResponse {
    trades: KiteTrade[];
}

// ak-ws2q / ak-zi54 (BE 2026-11-22): today's full order book from Kite
// — complements /kite/trades (filled only) with every order placed
// today across all statuses. BE passthrough of `k.orders()` wrapped
// as `{orders: [...]}`. Every field defensive-optional (same posture
// as KiteTrade — Kite SDK drift reaches FE uncoerced).
export interface KiteOrder {
    order_id?: string;
    exchange_order_id?: string | null;
    parent_order_id?: string | null;
    tradingsymbol?: string;
    exchange?: string;
    status?: string;                 // OPEN / COMPLETE / CANCELLED / REJECTED / TRIGGER_PENDING ...
    status_message?: string | null;
    status_message_raw?: string | null;
    transaction_type?: string;       // BUY / SELL
    order_type?: string;             // MARKET / LIMIT / SL / SL-M
    product?: string;                // CNC / MIS / NRML
    variety?: string;                // regular / amo / co / bo / iceberg / auction
    validity?: string;
    quantity?: number;
    filled_quantity?: number;
    pending_quantity?: number;
    cancelled_quantity?: number;
    disclosed_quantity?: number;
    price?: number;
    trigger_price?: number;
    average_price?: number;
    instrument_token?: number;
    order_timestamp?: string;
    exchange_timestamp?: string | null;
    exchange_update_timestamp?: string | null;
    guid?: string;
    tag?: string | null;
    placed_by?: string;
}

export interface KiteOrdersResponse {
    orders: KiteOrder[];
}

// ak-ue5q / ak-l8a7 (BE 2026-11-22): per-order drill-down shapes.
//
// `order_history` returns an ARRAY of state snapshots (one row per
// status transition — placed → open → trigger_pending → complete
// etc.). Each row is shaped like `KiteOrder` but represents a point
// in time; the `order_timestamp` moves forward across rows while
// identifying fields (order_id, tradingsymbol) stay constant.
//
// `order_trades` returns an array of the individual fills that
// matched against the order — same shape as `KiteTrade`.
export type KiteOrderHistoryEntry = KiteOrder;

export interface KiteOrderHistoryResponse {
    history: KiteOrderHistoryEntry[];
}

export interface KiteOrderTradesResponse {
    trades: KiteTrade[];
}

// ak-oc5s: GET /kite/margins payload from ak-zai2 (Kite Bundle 2).
// Thin wrap of Kite's user-margins API — equity + commodity segments,
// each with available + utilised breakdowns. All numeric fields are
// optional/defensive because (a) BE passes the Kite response through
// with light transform, so Kite's own field drift reaches us
// uncoerced, and (b) commodity may be entirely absent for equity-only
// users. Renderers must guard every field; `typeof ===  "number"` +
// finite check both.
export interface KiteMarginsSegment {
    enabled?: boolean;
    net?: number;
    available?: {
        adhoc_margin?: number;
        cash?: number;
        collateral?: number;
        intraday_payin?: number;
        live_balance?: number;
        opening_balance?: number;
    };
    utilised?: {
        debits?: number;
        exposure?: number;
        m2m_realised?: number;
        m2m_unrealised?: number;
        option_premium?: number;
        payout?: number;
        span?: number;
        holding_sales?: number;
        turnover?: number;
        liquid_collateral?: number;
        stock_collateral?: number;
    };
}

export interface KiteMarginsResponse {
    equity?: KiteMarginsSegment;
    commodity?: KiteMarginsSegment;
}

// ak-166j / ak-dx98 Bundle 3 (2026-11-12): GTT (Good-Till-Triggered)
// order monitors + price alerts + per-alert trigger history. Every
// field is defensive-optional for the same Kite-pass-through reason
// margins/trades are — BE enriches minimally (GTT gets a `monitor`
// block appended; alerts/history are near-raw).
export interface KiteGttCondition {
    exchange?: string;
    tradingsymbol?: string;
    trigger_values?: number[];
    last_price?: number;
    instrument_token?: number;
}

export interface KiteGttOrder {
    exchange?: string;
    tradingsymbol?: string;
    transaction_type?: string;        // "BUY" | "SELL"
    quantity?: number;
    price?: number;
    product?: string;
    order_type?: string;
}

// `monitor` is BE-computed (`_enrich_gtts_with_ltp`) and takes one of
// three shapes: null (non-active GTT), a success payload with current_ltp
// + distance_pct, or an error object with error_class + message.
export interface KiteGttMonitorSuccess {
    current_ltp?: number;
    // Single-leg GTT → scalar; OCO two-leg GTT → list of 2 scalars.
    // Either leg can be null (BE emits null when trigger_value === 0).
    distance_pct?: number | Array<number | null> | null;
}

export interface KiteGttMonitorError {
    error_class?: string;             // "ohlc_fetch_failed" | "quote_unavailable"
    message?: string | null;
}

export type KiteGttMonitor =
    | KiteGttMonitorSuccess
    | KiteGttMonitorError
    | null;

export interface KiteGtt {
    id?: number;
    status?: string;                  // "active" | "triggered" | "cancelled" | "expired"
    type?: string;                    // "single" | "two-leg"
    condition?: KiteGttCondition;
    orders?: KiteGttOrder[];
    created_at?: string;
    updated_at?: string;
    user_id?: string;
    monitor?: KiteGttMonitor;
}

export interface KiteGttsResponse {
    gtts: KiteGtt[];
}

// Kite alerts — "simple" (notification only) or "ato" (auto-place
// order on trigger). Every field optional for drift safety. Operator
// is a raw string ("<=" / ">=" / "<" / ">" / "==") — FE renders
// verbatim rather than mapping to a fixed enum.
export interface KiteAlert {
    uuid?: string;
    user_id?: string;
    type?: string;                    // "simple" | "ato"
    status?: string;                  // "enabled" | "disabled"
    name?: string;
    lhs_exchange?: string;
    lhs_tradingsymbol?: string;
    lhs_attribute?: string;           // "LastTradedPrice" | "OIDay" | etc.
    operator?: string;
    rhs_type?: string;
    rhs_constant?: number;
    rhs_exchange?: string;
    rhs_tradingsymbol?: string;
    basket?: unknown;                 // for "ato" alerts — opaque order blueprint
    created_at?: string;
    updated_at?: string;
    disabled_reason?: string;
}

export interface KiteAlertsResponse {
    alerts: KiteAlert[];
}

export interface KiteAlertHistoryEntry {
    triggered_at?: string;
    meta?: unknown;                   // lhs value at trigger — shape varies by alert type
    order_result?: unknown;           // for "ato" alerts — placed-order outcome
    uuid?: string;
}

export interface KiteAlertHistoryResponse {
    history: KiteAlertHistoryEntry[];
}

// ak-ktf4 / ak-h1mq (BE 2026-11-22): mutual-fund page BE passthroughs.
// BE wraps as `{holdings: [...]}` / `{orders: [...]}` / `{sips: [...]}`
// with Kite's native MF shapes forwarded unmodified (§23 #2 CONSUME).
// Every field is defensive-optional — Kite SDK drift reaches FE
// uncoerced (same posture as KiteTrade / KiteGtt / KiteAlert). Readers
// null-check before formatting.

// Kite `k.mf_holdings()` — one row per scheme the user currently holds.
// `pnl`/`last_price`/`quantity` power the Holdings render; `fund` is
// the display name, `tradingsymbol` the Kite ISIN-like identifier.
export interface KiteMFHolding {
    folio?: string;
    fund?: string;
    tradingsymbol?: string;
    average_price?: number;
    last_price?: number;
    last_price_date?: string;
    pledged_quantity?: number;
    quantity?: number;
    pnl?: number;
}

// Kite `k.mf_orders()` — 7-day window per Kite API. One row per
// placed order; status flows "RECEIVED" → "VALIDATED" → "OPEN" →
// "COMPLETE" (or "CANCELLED" / "REJECTED"). Both `amount` and
// `quantity` can be present depending on `purchase_type` (SIP
// installments typically have `amount`, lumpsum buys can have either).
export interface KiteMFOrder {
    order_id?: string;
    exchange_order_id?: string;
    tradingsymbol?: string;
    status?: string;                  // "COMPLETE" | "OPEN" | "CANCELLED" | "REJECTED" | ...
    status_message?: string;
    folio?: string;
    fund?: string;
    order_timestamp?: string;
    exchange_timestamp?: string;
    settlement_id?: string;
    transaction_type?: string;        // "BUY" | "SELL"
    variety?: string;                 // "regular" | "amo"
    purchase_type?: string;           // "FRESH" | "ADDITIONAL" | ...
    quantity?: number;
    amount?: number;
    last_price?: number;
    average_price?: number;
    placed_by?: string;
    tag?: string | null;
}

// Kite `k.mf_sips()` — active + completed SIP schedules. The bead
// scope is READ-ONLY; Pause/Edit/Cancel are deferred to a separate
// SIP-management bead (see ak-h1mq FE scope). `status` is typically
// "ACTIVE" | "PAUSED" | "CANCELLED" (raw string for drift safety).
export interface KiteMFSip {
    sip_id?: string;
    tradingsymbol?: string;
    fund?: string;
    dividend_type?: string;
    transaction_type?: string;
    status?: string;                  // "ACTIVE" | "PAUSED" | "CANCELLED" | ...
    sip_type?: string;
    created?: string;                 // ISO-ish start timestamp
    frequency?: string;               // "weekly" | "monthly" | ...
    instalment_amount?: number;
    instalments?: number;             // target total; -1 is "until cancelled" in Kite
    last_instalment?: string;
    pending_instalments?: number;
    next_instalment?: string;         // next scheduled debit date
    trigger_price?: number;
    step_up?: unknown;                // opaque config block
    tag?: string | null;
}

export interface KiteMFHoldingsResponse {
    holdings: KiteMFHolding[];
}

export interface KiteMFOrdersResponse {
    orders: KiteMFOrder[];
}

export interface KiteMFSipsResponse {
    sips: KiteMFSip[];
}

// F&O Interfaces
export interface FOContract {
    symbol: string;
    underlying: string;
    expiry_date: string;
    strike_price: number;
    option_type: string;
    buy_qty: number;
    sell_qty: number;
    buy_value: number;
    sell_value: number;
    pnl: number;
}

export interface FOSummaryResponse {
    totalContracts: number;
    netPnL: number;
    totalPremiumPaid: number;
    totalPremiumReceived: number;
    profitableContracts: number;
    losingContracts: number;
    tradeCount: number;
    contracts: FOContract[];
}

export interface FOTrade {
    tradeId: string;
    symbol: string;
    underlying: string;
    expiryDate: string;
    strikePrice: number;
    optionType: string;
    tradeDate: string;
    tradeType: string;
    quantity: number;
    price: number;
    value: number;
    orderId: string;
}

export interface InvestmentEmail {
    id: number;
    gmail_id: string;
    sender: string;
    subject: string;
    email_date: string;
    category: string;
    items_extracted: number;
    extraction_summary: Record<string, any> | null;
    status: string;
}

export interface InvestmentEmailsResponse {
    emails: InvestmentEmail[];
    total: number;
    page: number;
    pageSize: number;
}

export interface RealizedTrade {
    sellID: number;
    symbol: string;
    buyPrice: number;
    sellPrice: number;
    quantity: number;
    sellDate: string;
    profit: number;
    buyID: string;
}

export interface RealizedPnLResponse {
    totalRealizedProfit: number;
    totalRealizedLoss: number;
    netRealizedPnL: number;
    tradeCount: number;
    trades: RealizedTrade[];
}

export interface UserFileData {
    id: string;
    original_filename: string;
    file_type: string;
    file_extension: string;
    file_size: number;
    label: string | null;
    thumbnail: string | null;
    folder_id: string | null;
    created_at: string;
    updated_at: string;
}

export interface UserFolderData {
    id: string;
    name: string;
    parent_folder_id: string | null;
    created_at: string;
    updated_at: string;
}

// ak-iqa6 (ak-kxdr companion FE): trashed file surface. Extends
// `UserFileData` with the `days_remaining` counter BE computes as
// `VAULT_RETENTION_DAYS - (now - deleted_at).days`, clamped to
// [0, VAULT_RETENTION_DAYS]. 0 = retention expired (BE sweeps it
// next); the FE renders a terminal "0 days — awaiting purge" chip.
// Also carries `deleted_at` (ISO string) so the card can show
// "Trashed {N days ago}" where useful.
export interface TrashedFileData extends UserFileData {
    days_remaining: number;
    deleted_at?: string | null;
}

export interface TrashListResponse {
    files: TrashedFileData[];
    count: number;
}

// ────────────────── ak-i0zq / ak-v55t + ak-05af ──────────────────
// Instruments search + watchlist. Both consume Kite-sourced BE
// surfaces; shapes match the BE commit comments on those beads.

// ak-v55t: GET /kite/instruments/search → one result per matching
// instrument. All F&O-ish fields are optional because equity rows
// don't carry them (BE emits DECIMAL columns as nullable).
export interface KiteInstrumentSearchResult {
    instrument_token: number;
    tradingsymbol: string;
    name: string | null;
    exchange: string | null;
    segment: string | null;
    instrument_type: string | null;
    lot_size: number | null;
    tick_size: number | null;
    last_price: number | null;
    expiry: string | null;    // ISO date or null
    strike: number | null;
}

export interface KiteInstrumentSearchResponse {
    results: KiteInstrumentSearchResult[];
    count: number;
    query: string;
    exchange: string | null;
}

// ak-05af: watchlist CRUD + LTP batch. One row per watched
// instrument_token. Note is user-editable, truncated to 500 chars
// server-side.
export interface WatchlistItem {
    id: number;
    instrument_token: number | null;
    tradingsymbol: string;
    exchange: string;
    added_at: string | null;   // ISO datetime
    note: string | null;
}

export interface WatchlistListResponse {
    items: WatchlistItem[];
    count: number;
}

export interface WatchlistAddResponse {
    item: WatchlistItem;
    idempotent: boolean;
}

export interface WatchlistRemoveResponse {
    id: number;
    removed: boolean;
}

// ak-05af: /watchlist/ltp batch. Key is "EXCHANGE:TRADINGSYMBOL"
// (BE builds the Kite-native key form so the response is
// self-describing). Kite's .ltp() emits `{instrument_token,
// last_price}`; some SDK versions also embed an `ohlc` block
// with previous-day close — rendered through the day-change
// fallback when present. All inner fields optional for drift
// safety.
export interface WatchlistLtpTick {
    instrument_token?: number;
    last_price?: number;
    ohlc?: {
        open?: number;
        high?: number;
        low?: number;
        close?: number;
    };
}

export interface WatchlistLtpResponse {
    ltp: Record<string, WatchlistLtpTick>;
    count: number;
}

// ────────────────── ak-j8tc / ak-cipj (BE) ──────────────────
// Reconciliation issues — Overseer's trade-reconcile delta surface.
// BE (ak-cipj) writes rows to `ReconciliationIssue` when the daily
// ReconcileTradesTask (ak-zai2) finds a Kite trade that doesn't
// match any local TradeAssociation.
//
// `discrepancy_detail` is JSON-parsed BE-side so the FE reads a
// plain object (not a string). Shape varies by discrepancy_type —
// kept as `Record<string, unknown>` so UI renders defensively via
// per-field null-checks rather than depending on a brittle schema.

export interface ReconciliationIssue {
    id: number;
    kite_trade_id: string;
    discrepancy_type: string;
    discrepancy_detail: Record<string, unknown> | null;
    detected_at: string;                  // ISO
    resolved_at: string | null;           // ISO or null
    resolution_note: string | null;       // free-text, <= 500 chars server-side
}

export type ReconciliationIssueStatus = "open" | "resolved" | "all";

export interface ReconciliationIssuesResponse {
    issues: ReconciliationIssue[];
    count: number;
    status: ReconciliationIssueStatus;
}

export interface ReconciliationResolveResponse {
    id: number;
    idempotent: boolean;
    resolved_at: string | null;
    resolution_note: string | null;
}
