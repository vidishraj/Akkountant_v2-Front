import Axios from 'axios';
import {auth} from '../components/FirebaseConfig';
import {onAuthStateChanged} from 'firebase/auth';
import {setupCache} from 'axios-cache-interceptor';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/';
const instance = Axios.create({baseURL: API_BASE_URL});
const axios = setupCache(instance);

// Cache the auth ready promise so we only create one listener
let authReadyPromise: Promise<string | null> | null = null;

function waitForAuth(): Promise<string | null> {
    if (!authReadyPromise) {
        authReadyPromise = new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, (user) => {
                unsubscribe();
                resolve(user ? user.uid : null);
            });
        });
    }
    return authReadyPromise;
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
            const user = auth.currentUser;
            if (!user) {
                const uid = await waitForAuth();
                if (uid) {
                    config.headers["X-Firebase-ID"] = uid;
                }
            } else {
                config.headers["X-Firebase-ID"] = user.uid;
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
