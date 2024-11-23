import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {
    TransactionRequestBody,
    FileDetailsRequestBody,
    TransactionResponse,
    FileDetailsResponse, GoogleStatusResponse
} from '../utils/interfaces.ts';

/**
 * Fetch transactions with filtering and pagination.
 */
export async function fetchTransactions(body: TransactionRequestBody): Promise<TransactionResponse> {
    return queueRequest(() =>
        axios.post('/fetchTransactions', body).then((res) => res.data)
    );
}

/**
 * Fetch file details with filtering and pagination.
 */
export async function fetchFileDetails(body: FileDetailsRequestBody): Promise<FileDetailsResponse> {
    return queueRequest(() =>
        axios.post('/getFileDetails', body).then((res) => res.data)
    );
}

/**
 * Fetch opted banks for the user.
 */
export async function fetchOptedBanks(): Promise<any> {
    return queueRequest(() => axios.get('/fetchOptedBanks').then((res) => res.data));
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
export async function checkGoogleStatus(serviceType: string): Promise<GoogleStatusResponse> {
    return queueRequest(() =>
        axios
            .get('/getGoogleStatus', {params: {serviceType}})
            .then((res) => res.data)
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
export async function fetchCalendarTransactions(body: any): Promise<any> {
    return queueRequest(() =>
        axios.post('/calendarTransactions', body).then((res) => res.data)
    );
}
