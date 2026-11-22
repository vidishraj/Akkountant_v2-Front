import Axios from 'axios';
import {auth} from '../components/FirebaseConfig';
import {onAuthStateChanged, User} from 'firebase/auth';
import {setupCache} from 'axios-cache-interceptor';

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
 * ak-t7ax (ak-c8l companion FE): return the value for the X-Firebase-ID
 * header on outgoing requests.
 *
 * Resolution order:
 *   1. If `auth.currentUser` is set, use it directly.
 *   2. Else, wait for the first `onAuthStateChanged` emission
 *      (cold-boot path; `waitForAuthUser` is memoized so this fires
 *      once per session).
 *   3. If still no user, return null — caller omits the header,
 *      BE treats the request as unauthenticated.
 *
 * From the resolved User:
 *   - Prefer the Firebase ID token (`getIdToken(false)` — a short-
 *     lived JWT the SDK auto-refreshes when within ~5 min of expiry).
 *     This is what ak-c8l's BE rollout verifies.
 *   - If `getIdToken` throws (transient SDK error / network blip /
 *     revoked token), fall back to the raw uid. BE's rollout default
 *     `FIREBASE_AUTH_MODE=verify_with_raw_uid_fallback` still accepts
 *     bare uids during the cutover window, so a transient JWT failure
 *     doesn't drop the user to logged-out. The BE logs a WARN which
 *     the operator greps during their 24h cutover audit before
 *     flipping to `verify_only`.
 */
export async function getFirebaseAuthHeader(): Promise<string | null> {
    let user: User | null = auth.currentUser;
    if (!user) {
        user = await waitForAuthUser();
    }
    if (!user) return null;
    try {
        return await user.getIdToken(false);
    } catch {
        // Transient failure — fall back to raw uid during the ak-c8l
        // dual-mode rollout window. Zero-downtime cutover guarantee.
        return user.uid;
    }
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
            // ak-t7ax: ship the Firebase ID-token JWT (with raw-uid
            // fallback on SDK error) instead of the pre-ak-t7ax bare uid.
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
            return Promise.reject(error);
        }
    );
};

export default axios;
