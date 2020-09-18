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
