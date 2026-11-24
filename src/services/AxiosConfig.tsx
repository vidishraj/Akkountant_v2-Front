import Axios from 'axios';
import {auth} from '../components/FirebaseConfig';
import {onAuthStateChanged, User} from 'firebase/auth';
import {setupCache} from 'axios-cache-interceptor';
import {isSessionUnauthorized, notifySessionExpired, resolveIdToken} from './sessionExpiry';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';
const instance = Axios.create({baseURL: API_BASE_URL});
const axios = setupCache(instance);

// Cache the auth ready promise so we only create one listener. Resolves
// with the Firebase User (not just the uid) so callers can derive both
// the uid AND the ID-token JWT without re-querying onAuthStateChanged.
let authReadyPromise: Promise<User | null> | null = null;

function waitForAuthUser(): Promise<User | null> {
    if (!authReadyPromise) {
        authReadyPromise = new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user);
            });
        });
    }
    return authReadyPromise;
}

/**
 * Value for the X-Firebase-ID header on outgoing requests: the Firebase ID
 * token (JWT), or null.
 *
 * Resolution:
 *   1. `auth.currentUser`, else the first `onAuthStateChanged` emission
 *      (cold boot; memoized). No user → null (header omitted).
 *   2. `getIdToken(false)` (SDK auto-refreshes near expiry).
 *   3. ak-p612: on failure, ONE forced refresh `getIdToken(true)`.
 *   4. Still failing → raise the app-wide session-expired state and return
 *      null.
 *
 * ak-p612: this NEVER returns the raw uid. The previous `catch { return
 * user.uid }` fallback (ak-t7ax dual-mode rollout) was the last thing
 * preventing the BE from enforcing `FIREBASE_AUTH_MODE=verify_only`: a bare
 * uid is not a credential, so accepting it lets anyone who knows a uid act
 * as that user (IDOR). A token failure now surfaces as "session expired —
 * sign in again" instead of silently downgrading the credential.
 */
export async function getFirebaseAuthHeader(): Promise<string | null> {
    let user: User | null = auth.currentUser;
    if (!user) {
        user = await waitForAuthUser();
    }
    if (!user) return null;
    return resolveIdToken(user);
}

export const setupAxiosInterceptors = () => {
    axios.interceptors.request.use(
        async (config) => {
            if (config.params && config.params.clearCacheEntry && config.id) {
                try {
                    // Remove the cache entry for the current request
                    await axios.storage.remove(config.id);
                } catch (error) {
                    console.error('Error removing cache entry:', error);
                }
            }
            // ak-t7ax / ak-p612: ship the Firebase ID-token JWT. No token →
            // no header (never the raw uid); the BE rejects with 401.
            const authHeader = await getFirebaseAuthHeader();
            if (authHeader) {
                config.headers["X-Firebase-ID"] = authHeader;
            }
            return config;
        },
        (error) => {
            return Promise.reject(error);
        }
    );

    axios.interceptors.response.use(
        (response) => {
            return response;
        },
        (error) => {
            // ak-p612: a real 401 (not Kite's reconnect_required) means the
            // session is gone — show the re-auth state instead of letting
            // every tile render empty.
            // Only when we actually sent a credential: signed-out background
            // requests (no header) must not latch the dialog (review MINOR-1).
            const sentCredential = Boolean(error?.config?.headers?.["X-Firebase-ID"]);
            if (isSessionUnauthorized(error?.response?.status, error?.response?.data, sentCredential)) {
                notifySessionExpired("unauthorized");
            }
            return Promise.reject(error);
        }
    );
};

export default axios;
