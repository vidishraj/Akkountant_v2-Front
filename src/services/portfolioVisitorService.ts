import axios from './AxiosConfig.tsx';
import {queueRequest} from './AxiosQueueManager.tsx';
import {withCacheCleared} from './transactionService.ts';

export interface PortfolioVisitor {
    id: number;
    ip: string;
    city: string | null;
    region: string | null;
    country: string | null;
    country_code: string | null;
    lat: number | null;
    lon: number | null;
    isp: string | null;
    user_agent: string | null;
    referrer: string | null;
    page_url: string | null;
    visited_at: string;
    is_backfill: boolean;
}

export interface VisitorsPagination {
    page: number;
    per_page: number;
    total: number;
    pages: number;
}

export interface VisitorsResponse {
    visitors: PortfolioVisitor[];
    pagination: VisitorsPagination;
}

export interface DailyVisit {
    day: string;
    unique_visitors: number;
    total_visits: number;
}

export interface CountryVisit {
    country: string;
    country_code: string;
    visits: number;
    unique_ips: number;
}

export interface CityVisit {
    city: string;
    country: string;
    visits: number;
}

export interface VisitorStats {
    total_visits: number;
    unique_visitors: number;
    live_visits: number;
    backfill_visits: number;
    daily: DailyVisit[];
    countries: CountryVisit[];
    cities: CityVisit[];
}

function withRequestId(endpoint: string, options: Record<string, any> = {}): Record<string, any> {
    return {
        ...options,
        id: `${endpoint}-${JSON.stringify(options.params || {})}`,
    };
}

export const fetchVisitors = async (
    page: number = 1,
    perPage: number = 50,
    clearCache: boolean = false
): Promise<VisitorsResponse> => {
    const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
    });
    const endpoint = `/portfolio/visitors?${params.toString()}`;
    const options = withRequestId(endpoint, clearCache ? withCacheCleared() : {});

    return queueRequest(async () => {
        const response = await axios.get(endpoint, options);
        return response.data;
    });
};

export const fetchVisitorStats = async (
    clearCache: boolean = false
): Promise<VisitorStats> => {
    const endpoint = '/portfolio/stats';
    const options = withRequestId(endpoint, clearCache ? withCacheCleared() : {});

    return queueRequest(async () => {
        const response = await axios.get(endpoint, options);
        return response.data;
    });
};
