import axios from './AxiosConfig.tsx';
import {
    EPGResponse,
    FileUploadParams,
    FileUploadResponse,
    InsertEPGRequest,
    JobsResponse,
    MSNListResponse,
    MSNRateResponse,
    MSNSummaryResponse,
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

    return queueRequest(() => axios.get('deleteAllInvestments', options));
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
    clearCache = false
): Promise<JobsResponse> {
    const options = withRequestId(
        'fetchJobsTable',
        clearCache
            ? withCacheCleared({ params: { page } })
            : { params: { page } }
    );

    const response= await queueRequest(() => axios.get('/getsJobs', options));
    return response.data;
}

export async function startJob(
    jobId: string,
  ): Promise<string> {

    const response = await queueRequest(() =>
      axios.get('/startJob', { params: { jobId } })
    );
    return response.data;
  }
