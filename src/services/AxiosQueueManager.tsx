let isRequestPending = false;
const delayBetweenRequests = 100;
const requestQueue: (() => void)[] = [];

const processNextRequest = () => {
    if (requestQueue.length > 0 && !isRequestPending) {
        isRequestPending = true;
        const nextRequest = requestQueue.shift();
        if (nextRequest) {
            nextRequest();
        }
    }
};

export const queueRequest = (requestFunc: () => Promise<any>): Promise<any> => {
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
