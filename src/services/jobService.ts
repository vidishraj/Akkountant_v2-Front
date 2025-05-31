import axios from './AxiosConfig.tsx';
import { queueRequest } from './AxiosQueueManager.tsx';

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
 * Fetches jobs with pagination
 */
export async function fetchJobs(page: number, limit: number): Promise<JobsResponse> {
    const options = withRequestId('api/jobs', {
        params: { page, limit }
    });

    const response = await queueRequest(() => 
        axios.get('job-applications', options)
    );
    return response.data;
}

/**
 * Updates multiple job fields
 */
export async function updateJobs(updates: JobUpdate[]): Promise<void> {
    const options = withRequestId('api/jobs/update', {});

    await queueRequest(() => 
        axios.post('/api/jobs/update', { updates }, options)
    );
} 