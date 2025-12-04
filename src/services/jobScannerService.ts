import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {withCacheCleared} from './transactionService.ts';

// Types for Job Scanner
export interface JobEmail {
    id: string;
    company_name: string;
    job_title: string | null;
    application_status: 'applied' | 'interview_scheduled' | 'rejected' | 'offer' | 'status_update' | 'unknown';
    application_type: 'new_application' | 'status_update';
    date_received: string;
    sender_email: string;
    subject: string;
    email_body: string;
    is_read: boolean;
    gmail_link: string | null;
    extracted_metadata: Record<string, any>;
}

export interface JobEmailsResponse {
    status: string;
    data: {
        emails: JobEmail[];
        pagination: {
            page: number;
            per_page: number;
            total: number;
            pages: number;
        };
    };
}

export interface ScanEmailsRequest {
    date_from?: string;
    date_to?: string;
}

export interface ScanEmailsResponse {
    status: string;
    data: {
        processed_count: number;
        new_emails_count: number;
        updated_emails_count: number;
        scan_date: string;
    };
}

export interface EmailStatsResponse {
    status: string;
    data: {
        total_applications: number;
        interviews_scheduled: number;
        offers_received: number;
        rejections: number;
        pending_responses: number;
    };
}

export interface UpdateEmailRequest {
    company_name?: string;
    job_title?: string;
    application_status?: string;
    application_type?: string;
    is_read?: boolean;
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

// Fetch job emails with pagination and filters
export const fetchJobEmails = async (
    page: number = 1,
    perPage: number = 10,
    filters?: {
        company_name?: string;
        application_status?: string;
        application_type?: string;
        date_from?: string;
        date_to?: string;
        search?: string;
    },
    sortBy: string = 'date_received',
    sortOrder: 'asc' | 'desc' = 'desc',
    clearCache: boolean = false
): Promise<JobEmailsResponse['data']> => {
    const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
        sort_by: sortBy,
        sort_order: sortOrder,
    });

    if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
            if (value) {
                params.append(key, value);
            }
        });
    }

    const endpoint = `/job-scanner/emails?${params.toString()}`;
    const options = withRequestId(endpoint, clearCache ? withCacheCleared() : {});

    return queueRequest(async () => {
        const response = await axios.get(endpoint, options);
        return response.data;
    }).then((response: JobEmailsResponse) => response.data);
};

// Scan emails for job applications
export const scanEmails = async (request: ScanEmailsRequest): Promise<ScanEmailsResponse['data']> => {
    return queueRequest(async () => {
        const response = await axios.post('/job-scanner/scan', request);
        return response.data;
    }).then((response: ScanEmailsResponse) => response.data);
};

// Get email statistics
export const getEmailStats = async (clearCache: boolean = false): Promise<EmailStatsResponse['data']> => {
    const endpoint = '/job-scanner/stats';
    const options = withRequestId(endpoint, clearCache ? withCacheCleared() : {});
    
    return queueRequest(async () => {
        const response = await axios.get(endpoint, options);
        return response.data;
    }).then((response: EmailStatsResponse) => response.data);
};

// Update email details
export const updateEmailDetails = async (
    emailId: string,
    updates: UpdateEmailRequest
): Promise<JobEmail> => {
    return queueRequest(async () => {
        const response = await axios.patch(`/job-scanner/emails/${emailId}`, updates);
        return response.data;
    }).then((response: { status: string; data: JobEmail }) => response.data);
};

// Mark email as read
export const markEmailAsRead = async (emailId: string): Promise<void> => {
    return queueRequest(async () => {
        const response = await axios.patch(`/job-scanner/emails/${emailId}/read`);
        return response.data;
    }).then(() => undefined);
};

// Delete email
export const deleteEmail = async (emailId: string): Promise<void> => {
    return queueRequest(async () => {
        const response = await axios.delete(`/job-scanner/emails/${emailId}`);
        return response.data;
    }).then(() => undefined);
};

// Get Gmail integration status
export const getGmailIntegrationStatus = async (): Promise<{
    is_connected: boolean;
    email: string | null;
    last_scan: string | null;
    token_expires_at: string | null;
}> => {
    return queueRequest(async () => {
        const response = await axios.get('/job-scanner/gmail-status');
        return response.data;
    }).then((response: { status: string; data: any }) => response.data);
};

// Refresh Gmail token
export const refreshGmailToken = async (): Promise<void> => {
    return queueRequest(async () => {
        const response = await axios.post('/job-scanner/gmail-refresh');
        return response.data;
    }).then(() => undefined);
};
