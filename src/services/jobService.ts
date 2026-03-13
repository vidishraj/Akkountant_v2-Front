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

export interface JobSummary {
    title: string;
    priority: string;
    pending_count: number;
    overdue_count: number;
    completed_count: number;
    failed_count: number;
    is_disabled: boolean;
}

export interface JobDetail {
    id: number;
    title: string;
    result: string;
    priority: string;
    status: 'Pending' | 'Overdue' | 'Completed' | 'Failed';
    due_date: string;
    failures: number;
    user_id: string;
    job_type_disabled: boolean;
}

export interface JobSummaryResponse {
    status: string;
    data: JobSummary[];
}

export interface JobDetailResponse {
    status: string;
    data: {
        jobs: JobDetail[];
        pagination: {
            page: number;
            per_page: number;
            total: number;
            pages: number;
            has_next: boolean;
            has_prev: boolean;
        };
    };
}

export interface CancelJobResponse {
    status: string;
    message: string;
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

/**
 * Fetch jobs summary for all job types
 */
export async function fetchJobsSummary(clearCache = false): Promise<JobSummaryResponse> {
    const options = withRequestId('api/jobs/summary', clearCache ? withCacheCleared() : {});
    
    const response = await queueRequest(() =>
        axios.get('jobs/summary', options)
    );
    return response.data;
}

/**
 * Fetch jobs by title and status with pagination
 */
export async function fetchJobsByTitleStatus(
    title: string,
    status: string,
    page = 1,
    perPage = 10,
    clearCache = false
): Promise<JobDetailResponse> {
    const params = new URLSearchParams({
        title,
        status,
        page: page.toString(),
        per_page: perPage.toString()
    });

    const options = withRequestId('api/jobs/by-title-status', clearCache ? withCacheCleared() : {
        params: Object.fromEntries(params),
    });
    
    const response = await queueRequest(() =>
        axios.get(`jobs/by-title-status?${params}`, options)
    );
    return response.data;
}

/**
 * Cancel a single job
 */
// { title: { "2026-03-13": { Completed: 5, Failed: 1 }, ... } }
export type DailyHistory = Record<string, Record<string, Record<string, number>>>;

export interface DailyHistoryResponse {
    status: string;
    data: DailyHistory;
}

/**
 * Fetch day-by-day status history for all job types
 */
export async function fetchJobsDailyHistory(days = 90, clearCache = false): Promise<DailyHistoryResponse> {
    const params = new URLSearchParams({ days: days.toString() });
    const options = withRequestId('api/jobs/daily-history', clearCache ? withCacheCleared() : {
        params: { days },
    });

    const response = await queueRequest(() =>
        axios.get(`jobs/daily-history?${params}`, options)
    );
    return response.data;
}

export async function cancelJob(jobId: number): Promise<CancelJobResponse> {
    const options = withRequestId(`api/jobs/${jobId}/cancel`, {});
    
    const response = await queueRequest(() =>
        axios.delete(`jobs/${jobId}/cancel`, options)
    );
    return response.data;
}

/**
 * Cancel multiple jobs at once
 */
export async function cancelJobsBulk(jobIds: number[]): Promise<CancelJobResponse> {
    const options = withRequestId('api/jobs/cancel-bulk', {});
    
    const response = await queueRequest(() =>
        axios.post('jobs/cancel-bulk', { job_ids: jobIds }, options)
    );
    return response.data;
} 