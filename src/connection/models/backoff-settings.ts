/**
 * Settings structure for exponential backoff
 */
export interface BackoffSettings {
    /**
     * Minimum delay between reconnects
     */
    backOffBaseDelay: number;
    /**
     * Maximum delay between reconnects 2^10 * 2000 ~ 34 minutes
     */
    backOffMaxIteration: number;
    /**
     * Add random delay used to prevent clients reconnecting all at the same time
     */
    backOffJitter: number;
}
