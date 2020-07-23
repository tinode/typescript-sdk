import { ConnectionOptions, BackoffSettings, AutoReconnectData, OnDisconnetData } from './connection-options';
import { log } from '../utilities';
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

    // Events
    onOpen = new Subject<void>();
    onMessage = new Subject<any>();
    onDisconnect = new Subject<OnDisconnetData>();
    onAutoReconnectIteration = new Subject<AutoReconnectData>();

    constructor(config: ConnectionOptions, backoffSettings?: BackoffSettings) {
        this.config = config;
        if (backoffSettings) {
            this.backoffSettings = backoffSettings;
        }
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
     * Initiate a new connection
     * @param host - Host name to connect to; if null the old host name will be used.
     * @param force - Force new connection even if one already exists.
     */
    abstract connect(host?: string, force?: boolean): Promise<any>;
    /**
     * Disconnect this connection
     */
    abstract disconnect(): void;
}
