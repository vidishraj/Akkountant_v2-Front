import axios from "axios";

// Currency conversion service with live exchange rates
export class CurrencyService {
    private static instance: CurrencyService;
    private baseCurrency = "INR";
    private exchangeRates: Record<string, number> = {
        // Fallback static rates in case API fails
        USD: 88.0,
        EUR: 104.0,
        GBP: 120.0,
        AUD: 58.7,
        INR: 1.0,
    };
    // ak-f9kg review: provenance. `liveRates` holds ONLY values that came from
    // the rate API in the last successful fetch (no per-currency substitution);
    // the static table above is a labelled approximation, never "live".
    private liveRates: Record<string, number> = {};
    private static readonly STATIC_RATES: Record<string, number> = {
        USD: 88.0, EUR: 104.0, GBP: 120.0, AUD: 58.7, INR: 1.0,
    };
    private lastUpdated: Date | null = null;
    private updateInProgress = false;
    private cacheExpiry = 1000 * 60 * 60; // 1 hour cache

    static getInstance(): CurrencyService {
        if (!CurrencyService.instance) {
            CurrencyService.instance = new CurrencyService();
            // Auto-update rates on first instantiation
            CurrencyService.instance.updateExchangeRates();
        }
        return CurrencyService.instance;
    }

    /**
     * Convert amount from any currency to INR
     */
    async convertToINR(amount: number, fromCurrency: string): Promise<number> {
        if (fromCurrency === this.baseCurrency) {
            return amount;
        }

        // Auto-update rates if needed
        if (this.needsUpdate() && !this.updateInProgress) {
            await this.updateExchangeRates();
        }

        const rate = this.exchangeRates[fromCurrency];
        if (!rate) {
            console.warn(
                `Exchange rate not found for ${fromCurrency}, using 1:1 ratio`
            );
            return amount;
        }

        return amount * rate;
    }

    /**
     * ak-f9kg: INR rate for a currency WITH provenance, or null when unknown.
     * - live: from the last successful rate fetch → exact.
     * - static: the built-in fallback table → `approx: true`; callers must
     *   label the figure (e.g. "≈ ₹X · approx. rate"), never present it as exact.
     * - neither → null (render "—"). Never a 1:1 guess.
     */
    getRateToINR(currency: string): {rate: number; approx: boolean} | null {
        const code = (currency || "").toUpperCase();
        if (code === this.baseCurrency) return {rate: 1, approx: false};
        const live = this.liveRates[code];
        if (typeof live === "number" && Number.isFinite(live) && live > 0) return {rate: live, approx: false};
        const fallback = CurrencyService.STATIC_RATES[code];
        if (typeof fallback === "number" && fallback > 0) return {rate: fallback, approx: true};
        return null;
    }

    /**
     * Synchronous conversion using cached rates
     */
    convertToINRSync(amount: number, fromCurrency: string): number {
        if (fromCurrency === this.baseCurrency) {
            return amount;
        }

        const rate = this.exchangeRates[fromCurrency];
        if (!rate) {
            console.warn(
                `Exchange rate not found for ${fromCurrency}, using 1:1 ratio`
            );
            return amount;
        }

        return amount * rate;
    }

    /**
     * Convert amount from INR to any currency
     */
    convertFromINR(amount: number, toCurrency: string): number {
        if (toCurrency === this.baseCurrency) {
            return amount;
        }

        const rate = this.exchangeRates[toCurrency];
        if (!rate) {
            console.warn(
                `Exchange rate not found for ${toCurrency}, using 1:1 ratio`
            );
            return amount;
        }

        return amount / rate;
    }

    /**
     * Get current exchange rate for a currency to INR
     */
    getExchangeRate(currency: string): number {
        return this.exchangeRates[currency] || 1.0;
    }

    /**
     * Get all supported currencies
     */
    getSupportedCurrencies(): string[] {
        return Object.keys(this.exchangeRates);
    }

    /**
     * Format currency with proper symbol
     */
    formatCurrency(amount: number, currency: string): string {
        const locale = currency === "INR" ? "en-IN" : "en-US";

        return new Intl.NumberFormat(locale, {
            style: "currency",
            currency: currency,
            currencyDisplay: "symbol",
        }).format(amount);
    }

    /**
     * Update exchange rates from live API
     */
    async updateExchangeRates(): Promise<void> {
        if (this.updateInProgress) {
            return;
        }
        this.updateInProgress = true;
        const jsdelivrUrl =
            "https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/inr.json";
        const fallbackUrl =
            "https://latest.currency-api.pages.dev/v1/currencies/inr.json";
        try {
            let data;
            try {
                const response = await axios.get(jsdelivrUrl, {timeout: 10000});
                data = response.data;
            } catch (err) {
                // Try fallback
                const response = await axios.get(fallbackUrl, {timeout: 10000});
                data = response.data;
            }
            if (data && data.inr) {
                // The API returns { inr: { usd: number, eur: number, ... } }
                // (units of currency per 1 INR). ak-f9kg review: take EVERY
                // currency the API returns, and NO per-currency substitution:
                // a missing/invalid key is simply not live.
                const live: Record<string, number> = {INR: 1.0};
                for (const [k, v] of Object.entries(data.inr as Record<string, unknown>)) {
                    const perInr = Number(v);
                    if (Number.isFinite(perInr) && perInr > 0) live[k.toUpperCase()] = 1 / perInr;
                }
                this.liveRates = live;
                // Legacy convert* paths keep their old behaviour (static
                // table for gaps) — the UI money paths use getRateToINR.
                this.exchangeRates = {...CurrencyService.STATIC_RATES, ...live};
                this.lastUpdated = new Date();
            } else {
                throw new Error("Invalid API response");
            }
        } catch (error) {
            console.warn(
                "⚠️ Failed to update exchange rates from both APIs, using fallback static rates:",
                error
            );
            // ak-f9kg review: a failed fetch leaves NO live rates (the old code
            // silently reset to the static table and stamped it "updated").
            this.liveRates = {};
            this.exchangeRates = {...CurrencyService.STATIC_RATES};
            this.lastUpdated = null;
        } finally {
            this.updateInProgress = false;
        }
    }

    /**
     * Get service status and rate information
     */
    getStatus(): {
        lastUpdated: Date | null;
        ratesAge: string;
        isLive: boolean;
        supportedCurrencies: string[];
        sampleRates: Record<string, number>;
    } {
        const now = new Date();
        let ratesAge = "Never updated";
        let isLive = false;

        if (this.lastUpdated) {
            const ageInMinutes = Math.floor(
                (now.getTime() - this.lastUpdated.getTime()) / 1000 / 60
            );
            if (ageInMinutes < 1) {
                ratesAge = "Just updated";
                isLive = true;
            } else if (ageInMinutes < 60) {
                ratesAge = `${ageInMinutes} minutes ago`;
                isLive = ageInMinutes < 60;
            } else {
                const ageInHours = Math.floor(ageInMinutes / 60);
                ratesAge = `${ageInHours} hours ago`;
                isLive = ageInHours < 2;
            }
        }

        return {
            lastUpdated: this.lastUpdated,
            ratesAge,
            isLive,
            supportedCurrencies: this.getSupportedCurrencies(),
            sampleRates: {...this.exchangeRates},
        };
    }

    /**
     * Get conversion info with details (synchronous)
     */
    getConversionInfo(
        amount: number,
        fromCurrency: string
    ): {
        originalAmount: number;
        originalCurrency: string;
        convertedAmount: number;
        baseCurrency: string;
        exchangeRate: number;
    } {
        const exchangeRate = this.getExchangeRate(fromCurrency);
        const convertedAmount = this.convertToINRSync(amount, fromCurrency);

        return {
            originalAmount: amount,
            originalCurrency: fromCurrency,
            convertedAmount,
            baseCurrency: this.baseCurrency,
            exchangeRate,
        };
    }

    /**
     * Force refresh rates from API
     */
    async forceRefresh(): Promise<boolean> {
        this.lastUpdated = null; // Force update
        await this.updateExchangeRates();
        return this.lastUpdated !== null;
    }

    /**
     * Check if rates need updating
     */
    private needsUpdate(): boolean {
        if (!this.lastUpdated) return true;
        const now = new Date();
        return now.getTime() - this.lastUpdated.getTime() > this.cacheExpiry;
    }
}

// Export singleton instance
export const currencyService = CurrencyService.getInstance();
