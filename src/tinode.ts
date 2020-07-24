import { ConnectionOptions, Connection, LPConnection, WSConnection } from './connection';
import { getBrowserInfo } from './utilities';

export class Tinode {
    /**
     * Connection config used to initiate a connection
     */
    private connectionConfig: ConnectionOptions;
    /**
     * Client's platform
     */
    private hardwareOS = 'Undefined';
    /**
     * Client's language
     */
    private humanLanguage = 'en-US';
    /**
     * Specified platform by user
     */
    private platform = 'Undefined';
    /**
     * Specified app name by user
     */
    private appName = 'Undefined';
    /**
     * If this code is running on a browser, which one?
     */
    private browser = '';
    /**
     * Logging to console enabled
     */
    private loggingEnabled = false;
    /**
     * When logging, trip long strings (base64-encoded images) for readability
     */
    private trimLongStrings = false;
    /**
     * UID of the currently authenticated user.
     */
    private myUserID = null;
    /**
     * Status of connection: authenticated or not.
     */
    private authenticated = false;
    /**
     * Login used in the last successful basic authentication
     */
    private login = null;
    /**
     * Token which can be used for login instead of login/password.
     */
    private authToken = null;
    /**
     * Counter of received packets
     */
    private inPacketCount = 0;
    /**
     * Counter for generating unique message IDs
     */
    private messageId = Math.floor((Math.random() * 0xFFFF) + 0xFFFF);
    /**
     * Information about the server, if connected
     */
    private serverInfo = null;
    /**
     * Push notification token. Called deviceToken for consistency with the Android SDK.
     */
    private deviceToken = null;
    /**
     * Cache of pending promises by message id.
     */
    private pendingPromises = {};
    /**
     * A connection object
     */
    private connection: Connection = null;
    /**
     * Tinode's cache of objects
     */
    private cache = {};

    constructor(appName: string, platform: string, connectionConfig: ConnectionOptions) {
        this.connectionConfig = connectionConfig;

        if (appName) {
            this.appName = appName;
        }

        if (platform) {
            this.platform = platform;
        }

        if (typeof navigator !== 'undefined') {
            this.browser = getBrowserInfo(navigator.userAgent, navigator.product);
            this.hardwareOS = navigator.platform;
            // This is the default language. It could be changed by client.
            this.humanLanguage = navigator.language || 'en-US';
        }

        if (connectionConfig.transport === 'lp') {
            this.connection = new LPConnection(connectionConfig);
        } else if (connectionConfig.transport === 'ws') {
            this.connection = new WSConnection(connectionConfig);
        } else {
            throw new Error('Invalid transport method is selected! It can be "lp" or "ws"');
        }

        if (this.connection) {
            this.connection.logger = this.logger;
        }
    }

    /**
     * Console logger
     * @param str - String to log
     * @param args - arguments
     */
    private logger(str: string, ...args: any[]) {
        if (this.loggingEnabled) {
            const d = new Date();
            const dateString = ('0' + d.getUTCHours()).slice(-2) + ':' +
                ('0' + d.getUTCMinutes()).slice(-2) + ':' +
                ('0' + d.getUTCSeconds()).slice(-2) + '.' +
                ('00' + d.getUTCMilliseconds()).slice(-3);

            console.log('[' + dateString + ']', str, args.join(' '));
        }
    }

    /**
     * Put an object into cache
     * @param type - cache type
     * @param name - cache name
     * @param obj - cache object
     */
    private cachePut(type: string, name: string, obj: any) {
        this.cache[type + ':' + name] = obj;
    }

    /**
     * Get an object from cache
     * @param type - cache type
     * @param name - cache name
     */
    private cacheGet(type: string, name: string) {
        return this.cache[type + ':' + name];
    }

    /**
     * Delete an object from cache
     * @param type - cache type
     * @param name - cache name
     */
    private cacheDel(type: string, name: string) {
        delete this.cache[type + ':' + name];
    }

    /**
     * Enumerate all items in cache, call func for each item.
     * Enumeration stops if func returns true.
     * @param func - function to call for each item
     * @param context - function context
     */
    private cacheMap(func: any, context: any) {
        for (const idx in this.cache) {
            if (func(this.cache[idx], idx, context)) {
                break;
            }
        }
    }
}
