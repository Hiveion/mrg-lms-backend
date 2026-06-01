import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface ExchangeRateResponse {
    conversion_rates: Record<string, number>;
    base_code: string;
    time_last_update_utc: string;
}

export interface IExchangeRateProvider {
    convertCurrency(amount: number, fromCurrency: string, toCurrency: string): Promise<number>;
    getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number>;
}

/**
 * Exchange Rate Service using exchangerate-api.com
 * Implements caching to minimize API calls
 */
@Injectable()
export class ExchangeRateService implements IExchangeRateProvider {
    private readonly logger = new Logger(ExchangeRateService.name);
    private readonly apiKey = process.env.EXCHANGE_RATE_API_KEY;
    private readonly baseUrl = 'https://v6.exchangerate-api.com/v6';
    private readonly cacheDuration = 3600000; // 1 hour in milliseconds
    private httpClient: AxiosInstance;

    // Cache structure: { "USD_EUR": { rate: 0.92, timestamp: 123456 } }
    private rateCache: Map<string, { rate: number; timestamp: number }> = new Map();

    constructor() {
        if (!this.apiKey) {
            this.logger.warn('EXCHANGE_RATE_API_KEY not set in environment. Exchange rate conversions may fail.');
        }

        this.httpClient = axios.create({
            timeout: 5000,
            headers: {
                'Accept': 'application/json',
            },
        });
    }

   
    async convertCurrency(
        amount: number,
        fromCurrency: string,
        toCurrency: string
    ): Promise<number> {
        if (fromCurrency === toCurrency) {
            return amount;
        }

        try {
            const rate = await this.getExchangeRate(fromCurrency, toCurrency);
            return parseFloat((amount * rate).toFixed(2));
        } catch (error) {
            this.logger.error(
                `Failed to convert ${amount} from ${fromCurrency} to ${toCurrency}: ${error.message}`
            );
            // Return original amount if conversion fails
            return amount;
        }
    }

   
    async getExchangeRate(fromCurrency: string, toCurrency: string): Promise<number> {
        if (fromCurrency === toCurrency) {
            return 1;
        }

        const cacheKey = `${fromCurrency}_${toCurrency}`;

        // Check cache first
        if (this.isCacheValid(cacheKey)) {
            this.logger.debug(`Cache hit for ${cacheKey}`);
            return this.rateCache.get(cacheKey)!.rate;
        }

        try {
            const rate = await this.fetchExchangeRateFromApi(fromCurrency, toCurrency);
            
            // Update cache
            this.rateCache.set(cacheKey, {
                rate,
                timestamp: Date.now(),
            });

            return rate;
        } catch (error) {
            this.logger.error(
                `Failed to fetch exchange rate for ${fromCurrency} to ${toCurrency}: ${error.message}`
            );
            throw error;
        }
    }

    /**
     * Fetch exchange rate from external API
     * Can be overridden for different providers
     */
    private async fetchExchangeRateFromApi(
        fromCurrency: string,
        toCurrency: string
    ): Promise<number> {
        if (!this.apiKey) {
            throw new Error('EXCHANGE_RATE_API_KEY is not configured');
        }

        try {
            const url = `${this.baseUrl}/${this.apiKey}/latest/${fromCurrency}`;
            this.logger.debug(`Fetching exchange rate from: ${url.replace(this.apiKey, '***')}`);

            const response = await this.httpClient.get<ExchangeRateResponse>(url);

            const rate = response.data.conversion_rates[toCurrency];
            if (!rate) {
                throw new Error(
                    `Exchange rate for ${toCurrency} not found in API response`
                );
            }

            this.logger.debug(
                `Exchange rate ${fromCurrency} to ${toCurrency}: ${rate}`
            );
            return rate;
        } catch (error: any) {
            if (error.response?.status === 401) {
                throw new Error('Invalid Exchange Rate API key');
            }
            if (error.response?.status === 404) {
                throw new Error(`Invalid currency code: ${fromCurrency} or ${toCurrency}`);
            }
            throw new Error(`Exchange Rate API error: ${error.message}`);
        }
    }

    /**
     * Check if cached exchange rate is still valid
     */
    private isCacheValid(cacheKey: string): boolean {
        if (!this.rateCache.has(cacheKey)) {
            return false;
        }

        const cached = this.rateCache.get(cacheKey)!;
        const isValid = Date.now() - cached.timestamp < this.cacheDuration;

        if (!isValid) {
            this.rateCache.delete(cacheKey);
        }

        return isValid;
    }

    /**
     * Clear all cached rates
     */
    clearCache(): void {
        this.logger.log('Clearing exchange rate cache');
        this.rateCache.clear();
    }

    /**
     * Get cache statistics (for monitoring)
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.rateCache.size,
            entries: Array.from(this.rateCache.keys()),
        };
    }
}
