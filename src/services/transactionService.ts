import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {
    TransactionRequestBody,
    FileDetailsRequestBody,
    TransactionResponse,
    FileDetailsResponse,
    GoogleStatusResponse,
    OptedBankPasswordsRequestBody,
    JobResponseBody,
} from '../utils/interfaces.ts';


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
 * Fetch transactions with filtering and pagination.
 */
export async function fetchTransactions(
    body: TransactionRequestBody,
    clearCache = false
): Promise<TransactionResponse> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() =>
        axios.post('/fetchTransactions', body, options).then((res) => res.data)
    );
}

/**
 * Fetch file details with filtering and pagination.
 */
export async function fetchFileDetails(
    body: FileDetailsRequestBody,
    clearCache = false
): Promise<FileDetailsResponse> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() =>
        axios.post('/getFileDetails', body, options).then((res) => res.data)
    );
}

/**
 * Post opted banks along with their respective password
 */
export async function fetchOptedBanksPassword(
    body: OptedBankPasswordsRequestBody,
    clearCache = false
): Promise<FileDetailsResponse> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() =>
        axios.post('/setOptedBanks', body, options).then((res) => res.data)
    );
}


/**
 * Fetch opted banks for the user.
 */
export async function fetchOptedBanks(clearCache = false): Promise<string[]> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() => axios.get('/fetchOptedBanks', options).then((res) => res.data));
}

//Fetch jobs table
export async function fetchJobsTable(clearCache = false): Promise<JobResponseBody> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() => axios.get('/getJobsTable', options).then((res) => res.data));
}

/**
 * Insert a new user into the system.
 */
export async function insertUser(body: any): Promise<any> {
    axios.storage?.remove('summary'); // Ensure cached data is cleared
    return queueRequest(() =>
        axios.post('/createUser', body).then((res) => res)
    );
}

/**
 * Check the status of Google API services (Gmail or Drive).
 */
export async function checkGoogleStatus(
    serviceType: string,
    clearCache = false
): Promise<GoogleStatusResponse> {
    const options = clearCache ? withCacheCleared({params: {serviceType}}) : {params: {serviceType}};
    return queueRequest(() =>
        axios.get('/getGoogleStatus', options).then((res) => res.data)
    );
}

/**
 * Update Google OAuth tokens for a specific service.
 */
export async function updateGoogleTokens(body: any): Promise<any> {
    return queueRequest(() =>
        axios.post('/updateGoogleTokens', body).then((res) => res.data)
    );
}

/**
 * Fetch transactions for calendar view.
 */
export async function fetchCalendarTransactions(
    body: any,
    clearCache = false
): Promise<any> {
    const options = clearCache ? withCacheCleared() : {};
    return queueRequest(() =>
        axios.post('/calendarTransactions', body, options).then((res) => res.data)
    );
}


/**
 * Trigger email check for a date from and date to
 */
export async function triggerEmailCheck(dateTo: string,
                                        dateFrom: string,
                                        clearCache = false): Promise<any> {
    const options = clearCache ? withCacheCleared({dateTo, dateFrom}) : {params: {dateTo, dateFrom}};
    return queueRequest(() => axios.get('/readEmails', options).then((res) => res));

}

/**
 * Trigger statement check for a date from and date to
 */
export async function triggerStatementCheck(dateTo: string,
                                            dateFrom: string,
                                            clearCache = false): Promise<any> {
    const options = clearCache ? withCacheCleared({dateTo, dateFrom}) : {params: {dateTo, dateFrom}};
    return queueRequest(() => axios.get('/readStatements', options).then((res) => res));

}

/**
 * Trigger statement check for a date from and date to
 */
export async function downloadFile(fileId: string): Promise<any> {
    return queueRequest(() => axios.get('/downloadFile', {
        params: {fileId: fileId},
        responseType: 'blob'
    }).then((res) => res));
}

/**
 * Trigger statement check for a date from and date to
 */
export async function deleteFile(fileId: string): Promise<any> {
    return queueRequest(() => axios.get('/deleteFile', {
        params: {fileId: fileId},
    }).then((res) => res));
}

