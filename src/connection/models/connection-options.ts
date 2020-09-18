import { Transport } from './transport';

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
