import {updateGoogleTokens} from './transactionService';

export function makeDriveInitialRequest() {
    let localStorage = window.localStorage
    let authUrl = localStorage.getItem('oauth_uri')
    let redirect_uri = localStorage.getItem('redirect_uri')
    let client_id = localStorage.getItem('client_id')
    window.location.href = `${authUrl}?scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}&prompt=consent&access_type=offline`;
}

export function makeInitialRequest() {
    let localStorage = window.localStorage
    let authUrl = localStorage.getItem('oauth_uri')
    let redirect_uri = localStorage.getItem('redirect_uri')
    let client_id = localStorage.getItem('client_id')
    window.location.href = `${authUrl}?scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fgmail.readonly&response_type=code&redirect_uri=${redirect_uri}&client_id=${client_id}&prompt=consent&access_type=offline`
}

/**
 * Request tokens from Google OAuth2 for Gmail.
 */
export async function makeTokenRequest(code: string): Promise<void> {
    const localStorage = window.localStorage;
    const clientId = localStorage.getItem('client_id');
    const clientSecret = localStorage.getItem('client_secret');
    const redirectUri = localStorage.getItem('redirect_uri');

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&grant_type=authorization_code`,
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tokens');
        }

        const responseBody = await response.json();
        const expires = responseBody['expires_in'];
        delete responseBody['expires_in'];

        const serviceType = 'gmail';
        const tokenData = {
            ...responseBody,
            expiry: expires,
            service_type: serviceType,
            client_id: clientId,
            client_secret: clientSecret,
        };

        await updateGoogleTokens(tokenData); // Save tokens using the API
    } catch (error) {
        console.error('Error fetching tokens:', error);
    }
}

/**
 * Request tokens from Google OAuth2 for Google Drive.
 */
export async function makeDriveTokenRequest(code: string): Promise<void> {
    const localStorage = window.localStorage;
    const clientId = localStorage.getItem('client_id');
    const clientSecret = localStorage.getItem('client_secret');
    const redirectUri = localStorage.getItem('redirect_uri');

    try {
        const response = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: `code=${code}&client_id=${clientId}&client_secret=${clientSecret}&redirect_uri=${redirectUri}&grant_type=authorization_code`,
        });

        if (!response.ok) {
            throw new Error('Failed to fetch tokens');
        }

        const responseBody = await response.json();
        const expires = responseBody['expires_in'];
        delete responseBody['expires_in'];

        const serviceType = 'gdrive';
        const tokenData = {
            ...responseBody,
            expiry: expires,
            service_type: serviceType,
            client_id: clientId,
            client_secret: clientSecret,
        };

        await updateGoogleTokens(tokenData); // Save tokens using the API
    } catch (error) {
        console.error('Error fetching Drive tokens:', error);
    }
}

