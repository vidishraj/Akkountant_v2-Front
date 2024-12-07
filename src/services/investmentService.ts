import axios from './AxiosConfig.tsx';
import {
    FileUploadParams,
    FileUploadResponse,
    MSNListResponse,
    MSNRateResponse,
    MSNSummaryResponse
} from '../utils/interfaces.ts';
import {queueRequest} from './AxiosQueueManager.tsx';
import {CacheAxiosResponse} from 'axios-cache-interceptor';

/**
 * Uploads a file to the server with additional parameters.
 * @param file - The file to upload.
 * @param params - Additional parameters for the request.
 * @returns A promise that resolves with the server response.
 */
export async function uploadFile(
    file: File,
    params: FileUploadParams
): Promise<FileUploadResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return queueRequest(() =>
        axios.post('uploadSecuritiesFile', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
            params, // Pass additional query parameters
        })
    );
}

/**
 * Fetches a list of securities based on the security type.
 * @param securityType - The type of security to fetch.
 * @returns A promise that resolves with a cached Axios response.
 */
export async function fetchSecuritiesList(
    securityType: string
): Promise<CacheAxiosResponse<any>> {
    return queueRequest(() =>
        axios.get('fetchSecurityList', {
            params: {serviceType: securityType},
        })
    );
}

/**
 * Fetches a summary of a specific service type.
 * @param serviceType - The type of service to fetch the summary for.
 * @returns A promise that resolves with a cached Axios response containing the summary.
 */
export async function fetchSummary(
    serviceType: string
): Promise<CacheAxiosResponse<MSNSummaryResponse>> {
    return queueRequest(() =>
        axios.get('fetchSummary', {
            params: {serviceType},
        })
    );
}

/**
 * Fetches user-specific securities for a given service type.
 * @param serviceType - The type of service to fetch user securities for.
 * @returns A promise that resolves with a cached Axios response containing the securities list.
 */
export async function fetchUserSecurities(
    serviceType: string
): Promise<CacheAxiosResponse<MSNListResponse[]>> {
    return queueRequest(() =>
        axios.get('fetchUserSecurities', {
            params: {serviceType},
        })
    );
}

/**
 * Fetches a security scheme based on the service type and scheme code.
 * @param serviceType - The type of service to fetch the scheme for.
 * @param schemeCode - The code of the scheme to fetch.
 * @returns A promise that resolves with a cached Axios response containing the rate response.
 */
export async function fetchSecurityScheme(
    serviceType: string,
    schemeCode: string
): Promise<CacheAxiosResponse<MSNRateResponse>> {
    return queueRequest(() =>
        axios.get('fetchSecurityScheme', {
            params: {
                serviceType,
                schemeCode,
            },
        })
    );
}
