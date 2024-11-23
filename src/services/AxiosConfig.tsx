/* eslint-disable @typescript-eslint/no-explicit-any */
import Axios from 'axios';
import {setupCache} from 'axios-cache-interceptor';
import {auth} from '../components/FirebaseConfig';
import {onAuthStateChanged} from 'firebase/auth';
import {useLoading} from '../contexts/LoadingContext';

const instance = Axios.create({baseURL: 'http://127.0.0.1:8000'});
const axios = setupCache(instance, {debug: console.log});

export const setupAxiosInterceptors = () => {
    const {setLoading} = useLoading();

    axios.interceptors.request.use(
        async (config) => {
            setLoading(true);
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
            setLoading(false);
            return Promise.reject(error);
        }
    );

    axios.interceptors.response.use(
        (response) => {
            setLoading(false);
            return response;
        },
        (error) => {
            setLoading(false);
            return Promise.reject(error);
        }
    );
};

export default axios;
