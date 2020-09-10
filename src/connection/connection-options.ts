/**
 * Available transport methods
 */
export type Transport = 'ws' | 'lp';

/**
 * Information needed to create an instance of connection
 */
export interface ConnectionOptions {
    /**
     * Connection host without protocol name
     */
    host: string;
    /**
     * Generated key by server keygen utility
     */
    APIKey: string;
    /**
     * Is connection secure or not
     */
    secure: boolean;
    /**
     * Which transport method should be used
     */
    transport: Transport;
    /**
     * Should auto reconnect if disconnected
     */
    autoReconnect: boolean;
}

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

/**
 * Auto reconnect event data
 */
export interface AutoReconnectData {
    timeout: number;
    promise?: Promise<any>;
}

/**
 * On disconnect event data
 */
export interface OnDisconnetData {
    /**
     * A descriptive error for client
     */
    error: Error;
    /**
     * Error code
     */
    code: number;
}
