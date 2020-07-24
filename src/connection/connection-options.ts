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
    BOFF_BASE: number;
    /**
     * Maximum delay between reconnects 2^10 * 2000 ~ 34 minutes
     */
    BOFF_MAX_ITER: number;
    /**
     * Add random delay
     */
    BOFF_JITTER: number;
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
    error: Error;
    code: number;
}
