/* eslint-disable @typescript-eslint/no-explicit-any */
import Axios from 'axios';
import { setupCache } from 'axios-cache-interceptor';
import { useLoading } from '../contexts/LoadingContext';
import { auth } from '../components/FirebaseConfig';
const instance = Axios.create();
const axios = setupCache(instance, { debug: console.log });

const requestQueue: (() => void)[] = [];
export const useAxiosSetup = () => {
    const { setLoading } = useLoading();

    axios.interceptors.request.use(
        async (config) => {
            setLoading(true);
            const user = auth.currentUser; // Get currently signed-in user
            if (user) {
                const token = await user.getIdToken();
                config['headers'].setAuthorization(`Bearer ${token}`);
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
            if (requestQueue.length === 0) {
                setLoading(false);
            }
            return response;
        },
        (error) => {
            if (requestQueue.length === 0) {
                setLoading(false);
            }
            return Promise.reject(error);
        }
    );
};

let isRequestPending = false;
const delayBetweenRequests = 100;

const processNextRequest = () => {
    if (requestQueue.length > 0 && !isRequestPending) {
        isRequestPending = true;
        const nextRequest = requestQueue.shift();
        if (nextRequest) {
            nextRequest();
        }
    }
};

const queueRequest = (requestFunc: () => Promise<any>) => {
    return new Promise((resolve, reject) => {
        const executeRequest = () => {
            requestFunc()
                .then(resolve)
                .catch(reject)
                .finally(() => {
                    setTimeout(() => {
                        isRequestPending = false;
                        processNextRequest();
                    }, delayBetweenRequests);
                });
        };
        requestQueue.push(executeRequest);
        processNextRequest();
    });
};

export async function insertUser(body: any): Promise<any> {
    axios.storage.remove('summary');
    return queueRequest(() =>
        axios
            .post(process.env.REACT_APP_BACKENDURL + '/createUser', body)
            .then((response) => response)
    );
}
