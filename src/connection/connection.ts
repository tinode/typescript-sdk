import { ConnectionOptions, BackoffSettings, AutoReconnectData, OnDisconnetData, Transport } from './connection-options';
import { log, NetworkProviders } from '../utilities';
import { Subject } from 'rxjs';

/**
 * Connection base class
 */
export abstract class Connection {
    /**
     * Settings for exponential backoff
     */
    protected backoffSettings: BackoffSettings = {
        BOFF_BASE: 2000,
        BOFF_JITTER: 0.3,
        BOFF_MAX_ITER: 10,
    };
    /**
     * Contains current connection configuration
     */
    protected config: ConnectionOptions;
    /**
     * Backoff timer timeout
     */
    protected boffTimer = null;
    /**
     * Backoff iteration counter
     */
    protected boffIteration = 0;
    /**
     *  Indicator if the socket was manually closed - don't autoReconnect if true.
     */
    protected boffClosed = false;
    /**
     * A callback to report logging events.
     */
    public logger = null;

    /**
     * Will be emitted when connection opens
     */
    onOpen = new Subject<void>();
    /**
     * Will be emitted when a message is received
     */
    onMessage = new Subject<any>();
    /**
     * Will be emitted on connection disconnect
     */
    onDisconnect = new Subject<OnDisconnetData>();
    /**
     * Will be emitted when connection tries to reconnect automatically
     */
    onAutoReconnectIteration = new Subject<AutoReconnectData>();

    constructor(config: ConnectionOptions, backoffSettings?: BackoffSettings) {
        this.config = config;
        if (backoffSettings) {
            this.backoffSettings = backoffSettings;
        }
    }

    /**
     * Returns connection transport method
     */
    get transport(): Transport {
        return this.config.transport;
    }

    /**
     * Backoff implementation - reconnect after a timeout.
     */
    protected boffReconnect(): void {
        // Clear timer
        clearTimeout(this.boffTimer);
        // Calculate when to fire the reconnect attempt
        const timeout = this.backoffSettings.BOFF_BASE * (Math.pow(2, this.boffIteration) * (1.0 + this.backoffSettings.BOFF_JITTER * Math.random()));
        // Update iteration counter for future use
        if (this.boffIteration < this.backoffSettings.BOFF_MAX_ITER) {
            this.boffIteration = this.boffIteration + 1;
        }
        this.onAutoReconnectIteration.next({ timeout });

        this.boffTimer = setTimeout(() => {
            log('Reconnecting, iter=' + this.boffIteration + ', timeout=' + timeout);
            // Maybe the socket was closed while we waited for the timer?
            if (!this.boffClosed) {
                const prom = this.connect();
                this.onAutoReconnectIteration.next({ timeout: 0, promise: prom });
            } else {
                this.onAutoReconnectIteration.next({ timeout: -1 });
            }
        }, timeout);
    }

    /**
     * Terminate auto-reconnect process.
     */
    protected backoffStop() {
        clearTimeout(this.boffTimer);
        this.boffTimer = 0;
    }

    /**
     * Try to restore a network connection, also reset backoff.
     * @param force - reconnect even if there is a live connection already.
     */
    reconnect(force?: boolean) {
        this.backoffStop();
        this.connect(null, force);
    }

    /**
     * Send a message to test
     */
    protected probe() {
        this.sendText('1');
    }

    /**
     * Check if the given network transport is available.
     * @param transport - either 'ws' (websocket) or 'lp' (long polling).
     */
    protected transportAvailable(transport: string): any {
        switch (transport) {
            case 'ws':
                return NetworkProviders.WebSocket;
            case 'lp':
                return NetworkProviders.XMLHTTPRequest;
            default:
                console.log('Request for unknown transport', transport);
                return false;
        }
    }

    /**
     * Reset auto reconnect counter to zero.
     */
    backoffReset(): void {
        this.backoffReset();
    }

    /**
     * Initiate a new connection
     * @param host - Host name to connect to; if null the old host name will be used.
     * @param force - Force new connection even if one already exists.
     */
    abstract connect(host?: string, force?: boolean): Promise<any>;

    /**
     * Disconnect this connection
     */
    abstract disconnect(): void;

    /**
     * Send a string to the server.
     * @param msg - String to send.
     */
    abstract sendText(msg: string): void;

    /**
     * Check if current connection exists
     */
    abstract isConnected(): boolean;
}
