import Axios from 'axios';
import {auth} from '../components/FirebaseConfig';
import {onAuthStateChanged} from 'firebase/auth';
import {setupCache} from 'axios-cache-interceptor';

const instance = Axios.create({baseURL: 'http://127.0.0.1:8000'});
const axios = setupCache(instance, {
    debug: console.log,
});


export const setupAxiosInterceptors = () => {
    axios.interceptors.request.use(
        async (config) => {
            if (config.params.clearCacheEntry && config.id) {
                console.log(config)
                try {
                    // Remove the cache entry for the current request
                    await axios.storage.remove(config.id);
                } catch (error) {
                    console.error('Error removing cache entry:', error);
                }
            }
            const user = auth.currentUser;
            if (!user) {
                await new Promise((resolve) => {
                    onAuthStateChanged(auth, (loggedInUser) => {
                        if (loggedInUser) {
                            config.headers["X-Firebase-ID"] = loggedInUser.uid;
                        }
                        resolve(null);
                    });
                });
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
