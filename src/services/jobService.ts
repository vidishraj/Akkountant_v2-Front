import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {withCacheCleared} from "./transactionService.ts";

// Types
export interface JobData {
    id: string;
    email_date: string;
    employer: string;
    role: string;
    email_body: string;
    verdict: 1 | 2 | 3;
}

export interface JobsResponse {
    items: JobData[];
    pagination: {
        has_next: boolean;
        has_prev: boolean;
        next_page: number | null;
        page: number;
        per_page: number;
        prev_page: number | null;
        total: number;
        total_pages: number;
    };
}

export interface JobUpdate {
    jobId: string;
    field: string;
    value: string;
}


/**
 * Helper to add request ID for tracking or cache invalidation.
 */
function withRequestId(endpoint: string, options: Record<string, any> = {}): Record<string, any> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

/**
 * Process emails
 */
export async function processEmails(dateTo: string, dateFrom: string,
                                    clearCache = false): Promise<JobsResponse> {
    const options = withRequestId('api/jobs', clearCache ? withCacheCleared() : {
        params: {},
    });
    const response = await queueRequest(() =>
        axios.post(`processJobEmails?dateFrom=${dateFrom}&dateTo=${dateTo}`, options)
    );
    return response.data;
}

/**
 * Fetches jobs with pagination, filters, and sorting
 */
export async function fetchJobs(
    page: number, 
    limit: number,
    clearCache = false,
    filters: Record<string, any> = {},
    sortBy = 'due_date',
    sortOrder = 'desc'
): Promise<JobsResponse> {
    // Build query parameters
    const params = new URLSearchParams({
        page: page.toString(),
        per_page: limit.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
        ...Object.fromEntries(
            Object.entries(filters).filter(([_, v]) => v !== null && v !== '' && v !== undefined)
        )
    });

    const options = withRequestId('api/jobs', clearCache ? withCacheCleared() : {
        params: Object.fromEntries(params),
    });
    
    const response = await queueRequest(() =>
        axios.get(`getsJobs?${params}`, options)
    );
    return response.data;
}

/**
 * Updates multiple job fields
 */
export async function updateJobs(updates: JobUpdate[]): Promise<void> {
    const options = withRequestId('api/jobs/update', {});

    await queueRequest(() =>
        axios.post('jobUpdate', {updates}, options)
    );
} 