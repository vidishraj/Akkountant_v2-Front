import axios from './AxiosConfig.tsx';
import {
    EPGResponse,
    FileUploadParams,
    FileUploadResponse,
    InsertEPGRequest,
    InsertSecurityTransactionRequest,
    InvestmentEmailsResponse,
    JobsResponse,
    MSNListResponse,
    MSNRateResponse,
    MSNSummaryResponse,
    KiteAlertHistoryResponse,
    KiteAlertsResponse,
    KiteGttsResponse,
    KiteLoginUrlResponse,
    KiteMarginsResponse,
    KiteStatusResponse,
    KiteSessionRequest,
    KiteSessionResponse,
    KiteHoldingsResponse,
    KitePositionsResponse,
    KiteSyncResponse,
    KiteTradesResponse,
    KiteMFHoldingsResponse,
    KiteMFOrdersResponse,
    KiteMFSipsResponse,
    KiteOrdersResponse,
    RealizedPnLResponse,
    FOSummaryResponse,
    FOTrade,
} from '../utils/interfaces.ts';
import {queueRequest} from './AxiosQueueManager.tsx';
import {CacheAxiosResponse} from 'axios-cache-interceptor';

/**
 * Helper to clear cache by adding the `cache-control: no-cache` header.
 * @param options - The existing request options to modify.
 * @returns The modified request options with cache bypass.
 */
function withCacheCleared(options: Record<string, any> = {}): Record<string, any> {
    return {
        ...options,
        params: {
            ...options.params,
            clearCacheEntry: true,
        },
    };
}

/**
 * Adds a unique `id` to the options for tracking or cache invalidation.
 * @param endpoint - The API endpoint being called.
 * @param options - The request options to modify.
 * @returns The modified request options with an `id`.
 */
function withRequestId(endpoint: string, options: Record<string, any>): Record<string, any> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

/**
 * Uploads a file to the server with additional parameters.
 */
export async function uploadFile(
    file: File,
    params: FileUploadParams
): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const options = withRequestId('uploadSecuritiesFile', {
        headers: {'Content-Type': 'multipart/form-data'},
        params,
    });

    return queueRequest(() => axios.post('uploadSecuritiesFile', formData, options));
}

/**
 * Fetches a list of securities based on the security type.
 */
export async function fetchSecuritiesList(
    securityType: string,
    clearCache = false
): Promise<CacheAxiosResponse<any>> {
    const options = withRequestId(
        'fetchSecurityList',
        clearCache
            ? withCacheCleared({params: {serviceType: securityType}})
            : {params: {serviceType: securityType}}
    );

    return queueRequest(() => axios.get('fetchSecurityList', options));
}

/**
 * Fetches a summary of a specific service type.
 */
export async function fetchSummary(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<MSNSummaryResponse>> {
    const options = withRequestId(
        'fetchSummary',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchSummary', options));
}

/**
 * Fetches user-specific securities.
 */
export async function fetchUserSecurities(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<MSNListResponse[]>> {
    const options = withRequestId(
        'fetchUserSecurities',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchUserSecurities', options));
}

/**
 * Fetches a security scheme.
 */
export async function fetchSecurityScheme(
    serviceType: string,
    schemeCode: string,
    clearCache = false
): Promise<CacheAxiosResponse<MSNRateResponse>> {
    const options = withRequestId(
        'fetchSecurityScheme',
        clearCache
            ? withCacheCleared({params: {serviceType, schemeCode}})
            : {params: {serviceType, schemeCode}}
    );

    return queueRequest(() => axios.get('fetchSecurityScheme', options));
}

/**
 * Deletes all data for a specific investment type.
 */
export async function deleteAll(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<any>> {
    const options = withRequestId(
        'deleteAllInvestments',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.delete('deleteAllInvestments', options));
}

/**
 * Fetches the complete EPG for a specific service type.
 */
export async function fetchCompleteEPG(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<EPGResponse>> {
    const options = withRequestId(
        'fetchCompleteEPG',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchCompleteEPG', options));
}

/**
 * Inserts EPG data for a specific service type.
 */
export async function insertEPG(
    serviceType: string,
    body: InsertEPGRequest,
    clearCache = false
): Promise<CacheAxiosResponse<any>> {
    const options = withRequestId(
        'insertSecurityTransaction',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.post('insertSecurityTransaction', body, options));
}

/**
 * Fetches rates for a specific service type.
 */
export async function fetchRates(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<any>> {
    const options = withRequestId(
        'fetchRates',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchRates', options));
}

/**
 * Fetches rates for a specific service type.
 */
export async function fetchSecurityTransactions(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<any>> {
    const options = withRequestId(
        'fetchSecurityTransactions',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchSecurityTransactions', options));
}

export async function fetchJobsTable(
    page: number,
    clearCache = false,
    filters: Record<string, any> = {},
    sortBy = 'due_date',
    sortOrder = 'desc'
): Promise<JobsResponse> {
    // Build query parameters
    const params = new URLSearchParams({
        page: page.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== null && v !== '' && v !== undefined)
        )
    });

    const options = withRequestId(
        'fetchJobsTable',
        clearCache
            ? withCacheCleared({params: Object.fromEntries(params)})
            : {params: Object.fromEntries(params)}
    );

    const response = await queueRequest(() => axios.get(`/getsJobs?${params}`, options));
    return response.data;
}

export async function startJob(
    jobId: string,
): Promise<any> {

    const response = await queueRequest(() =>
        axios.get('/startJob', {params: {jobId}})
    );
    return response;
}

export async function getFileTimeStamps(
    clearCache = false
): Promise<JobsResponse> {
    const options = withRequestId(
        'getFileTimeStamps',
        clearCache
            ? withCacheCleared()
            : {}
    );

    const response = await queueRequest(() => axios.get('/fetchTimeStamps', options));
    return response.data;
}

/**
 * Fetches realized P&L and historical closed trades.
 */
export async function fetchRealizedPnL(
    serviceType: string,
    clearCache = false
): Promise<CacheAxiosResponse<RealizedPnLResponse>> {
    const options = withRequestId(
        'fetchRealizedPnL',
        clearCache
            ? withCacheCleared({params: {serviceType}})
            : {params: {serviceType}}
    );

    return queueRequest(() => axios.get('fetchRealizedPnL', options));
}

// F&O API Functions

/**
 * Fetches F&O P&L summary.
 */
export async function fetchFOSummary(
    clearCache = false
): Promise<CacheAxiosResponse<FOSummaryResponse>> {
    const options = withRequestId(
        'fetchFOSummary',
        clearCache ? withCacheCleared() : {}
    );

    return queueRequest(() => axios.get('fetchFOSummary', options));
}

/**
 * Fetches all individual F&O trades.
 */
export async function fetchFOTrades(
    clearCache = false
): Promise<CacheAxiosResponse<FOTrade[]>> {
    const options = withRequestId(
        'fetchFOTrades',
        clearCache ? withCacheCleared() : {}
    );

    return queueRequest(() => axios.get('fetchFOTrades', options));
}

// Kite Connect API Functions

/**
 * Get Kite login URL for authentication
 */
export async function getKiteLoginUrl(): Promise<KiteLoginUrlResponse> {
    const response = await queueRequest(() => axios.get('/kite/login-url'));
    return response.data;
}

/**
 * ak-u60: GET /kite/status — the authoritative source of truth for the
 * daily 6AM IST reconnect affordance. Returns
 * `{connected, reconnect_required, reason, expires_at, login_url}` per
 * BE bead ak-w4p. Never surfaces a user-facing error message on 4xx; the
 * caller (KiteContext) treats transport errors as "unknown — leave the
 * affordance state as last known" and does not toast.
 *
 * This is cheap + idempotent — safe to call on provider mount and on
 * demand (e.g. after a sync that fails). Do NOT poll in a tight loop:
 * the daily cycle is 24h, so once-per-session + on-demand suffices.
 */
export async function getKiteStatus(): Promise<KiteStatusResponse> {
    const response = await queueRequest(() => axios.get('/kite/status'));
    return response.data;
}

/**
 * ak-oc5s: GET /kite/margins — available + utilised margin breakdown
 * per segment (equity / commodity) from ak-zai2 (Kite Bundle 2). Thin
 * pass-through of Kite's user-margins API; caller treats this as
 * capital-visibility ONLY (not transactional). Silent on transport
 * failures — the renderer falls back to the placeholder tile.
 *
 * Fired once per session on provider mount (when Kite connected) and
 * again on reconnect success. BE caches ~5 min per ak-zai2's design
 * so clearCache=true is rarely needed; default false.
 */
export async function fetchKiteMargins(clearCache = false): Promise<KiteMarginsResponse> {
    const options = withRequestId(
        'kite/margins',
        clearCache ? withCacheCleared() : {},
    );
    const response = await queueRequest(() => axios.get('/kite/margins', options));
    return response.data;
}

/**
 * Generate Kite session using request token
 */
export async function generateKiteSession(
    requestToken: string
): Promise<KiteSessionResponse> {
    const body: KiteSessionRequest = {request_token: requestToken};
    const response = await queueRequest(() =>
        axios.post('/kite/generate-session', body)
    );
    return response.data;
}

/**
 * Fetch user's holdings from Kite
 */
export async function fetchKiteHoldings(
    clearCache = false
): Promise<KiteHoldingsResponse> {
    const options = withRequestId(
        'kite/holdings',
        clearCache ? withCacheCleared() : {}
    );

    const response = await queueRequest(() => axios.get('/kite/holdings', options));
    return response.data;
}

/**
 * Fetch user's positions from Kite
 */
export async function fetchKitePositions(
    clearCache = false
): Promise<KitePositionsResponse> {
    const options = withRequestId(
        'kite/positions',
        clearCache ? withCacheCleared() : {}
    );

    const response = await queueRequest(() => axios.get('/kite/positions', options));
    return response.data;
}

/**
 * ak-2k93 / ak-zai2 Bundle 2 (2026-11-12): fetch today's executed Kite
 * trades. BE pass-through of Kite SDK's `k.trades()` wrapped as
 * `{trades: [...]}`. Read-only, idempotent. FE consumer: Investments
 * page "Today's trades" collapsible section — fetch is LAZY (fires on
 * section expand, not on provider mount) per bead design.
 */
export async function fetchKiteTrades(
    clearCache = false
): Promise<KiteTradesResponse> {
    const options = withRequestId(
        'kite/trades',
        clearCache ? withCacheCleared() : {}
    );

    const response = await queueRequest(() => axios.get('/kite/trades', options));
    return response.data;
}

/**
 * ak-ws2q / ak-zi54 (BE 2026-11-22): GET /kite/orders — today's full
 * order book from Kite (every order placed today across all statuses
 * OPEN / COMPLETE / CANCELLED / REJECTED / TRIGGER_PENDING ...).
 * Complements /kite/trades (filled only).
 *
 * BE passthrough of Kite SDK's `k.orders()`, wrapped as
 * `{orders: [...]}`. Read-only, idempotent. LAZY FE consumer: fired
 * on "Today's orders" section expand (default collapsed), not on
 * provider mount.
 */
export async function fetchKiteOrders(
    clearCache = false
): Promise<KiteOrdersResponse> {
    const options = withRequestId(
        'kite/orders',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/orders', options));
    return response.data;
}

/**
 * ak-166j / ak-dx98 Bundle 3 (2026-11-12): GET /kite/gtts — active
 * Good-Till-Triggered orders enriched with current LTP + distance_pct
 * (BE `_enrich_gtts_with_ltp`). Read-only. 5-min BE cache per user.
 */
export async function fetchKiteGtts(
    clearCache = false
): Promise<KiteGttsResponse> {
    const options = withRequestId(
        'kite/gtts',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/gtts', options));
    return response.data;
}

/**
 * ak-ktf4 / ak-h1mq (BE): GET /kite/mf/holdings — current MF holdings
 * from Kite (Coin). Thin passthrough of Kite SDK's `k.mf_holdings()`
 * wrapped as `{holdings: [...]}`. Read-only, idempotent.
 *
 * Lazy fetch: FE fires once per tab mount (component-local state, no
 * context cache for this bead). Cache-cleared toggle supports a manual
 * refresh affordance if the MF Holdings tab adds one later.
 */
export async function fetchKiteMFHoldings(
    clearCache = false
): Promise<KiteMFHoldingsResponse> {
    const options = withRequestId(
        'kite/mf/holdings',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/mf/holdings', options));
    return response.data;
}

/**
 * ak-ktf4 / ak-h1mq (BE): GET /kite/mf/orders — MF buy/sell orders
 * placed within Kite's 7-day `mf_orders()` window. One row per order
 * with status / amount / units / NAV / timestamp. Status flows
 * RECEIVED → VALIDATED → OPEN → COMPLETE (or CANCELLED / REJECTED).
 */
export async function fetchKiteMFOrders(
    clearCache = false
): Promise<KiteMFOrdersResponse> {
    const options = withRequestId(
        'kite/mf/orders',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/mf/orders', options));
    return response.data;
}

/**
 * ak-ktf4 / ak-h1mq (BE): GET /kite/mf/sips — active + completed MF
 * SIPs for the user. READ-ONLY per bead scope; SIP pause / edit /
 * cancel actions deferred to a separate SIP-management bead.
 */
export async function fetchKiteMFSips(
    clearCache = false
): Promise<KiteMFSipsResponse> {
    const options = withRequestId(
        'kite/mf/sips',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/mf/sips', options));
    return response.data;
}

/**
 * ak-166j / ak-dx98 Bundle 3: GET /kite/alerts — price alerts for the
 * user. Read-only. 5-min BE cache per user. No LTP enrichment — alert
 * payload already contains the lhs instrument + operator + rhs value.
 */
export async function fetchKiteAlerts(
    clearCache = false
): Promise<KiteAlertsResponse> {
    const options = withRequestId(
        'kite/alerts',
        clearCache ? withCacheCleared() : {}
    );
    const response = await queueRequest(() => axios.get('/kite/alerts', options));
    return response.data;
}

/**
 * ak-166j / ak-dx98 Bundle 3: GET /kite/alerts/<uuid>/history — trigger
 * log for a single alert. No cache (drill-down view WANTS fresh data —
 * user is typically asking "did my alert just fire?"). URL-encodes the
 * uuid defensively even though Kite's uuids are already URL-safe.
 */
export async function fetchKiteAlertHistory(
    alertUuid: string
): Promise<KiteAlertHistoryResponse> {
    const options = withRequestId(
        `kite/alerts/${alertUuid}/history`,
        {}
    );
    const response = await queueRequest(() =>
        axios.get(`/kite/alerts/${encodeURIComponent(alertUuid)}/history`, options)
    );
    return response.data;
}

/**
 * Sync holdings to database
 */
export async function syncKiteHoldings(): Promise<KiteSyncResponse> {
    const response = await queueRequest(() => axios.get('/kite/sync-holdings'));
    return response.data;
}

/**
 * Sync transactions to database
 */
export async function syncKiteTransactions(): Promise<KiteSyncResponse> {
    const response = await queueRequest(() => axios.get('/kite/sync-transactions'));
    return response.data;
}

/**
 * Fetches investment-related emails from processedEmails.
 */
export async function fetchInvestmentEmails(
    category?: string,
    page: number = 1,
    pageSize: number = 50,
    serviceType?: string,
    categories?: string[],
): Promise<InvestmentEmailsResponse> {
    const params: Record<string, string> = { page: String(page), pageSize: String(pageSize) };
    if (category) params.category = category;
    if (serviceType) params.serviceType = serviceType;
    if (categories && categories.length > 0) params.categories = categories.join(',');

    const options = withRequestId(
        'fetchInvestmentEmails',
        { params }
    );

    const response = await queueRequest(() => axios.get('/fetchInvestmentEmails', options));
    return response.data;
}

/**
 * Fetches the full email body from Gmail for a given gmail_id.
 */
export async function fetchEmailBody(gmailId: string): Promise<{
    gmail_id: string;
    body_html: string | null;
    body_text: string | null;
}> {
    const options = withRequestId('fetchEmailBody', {params: {gmailId}});
    const response = await queueRequest(() => axios.get('/fetchEmailBody', options));
    return response.data;
}

/**
 * Insert a new security transaction (Mutual Fund, Stock, or NPS)
 */
export async function insertSecurityTransaction(
    transactionData: InsertSecurityTransactionRequest,
    clearCache = false
): Promise<CacheAxiosResponse<{Message: string}>> {
    const options = withRequestId(
        'insertSecurityTransaction',
        clearCache ? withCacheCleared() : {}
    );

    return queueRequest(() => axios.post('insertSecurityTransaction', transactionData, options));
}