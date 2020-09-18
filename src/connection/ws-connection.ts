import { makeBaseUrl, NetworkProviders, log } from '../utilities';
import { ConnectionOptions } from './models/connection-options';
import { AppSettings } from '../constants';
import { Connection } from './models';

export class WSConnection extends Connection {
    socket: WebSocket;

    constructor(options: ConnectionOptions) {
        super(options);
    }

    /**
     * Initiate a new connection
     * Returns Promise resolved/rejected when the connection call completes, resolution is called without parameters,
     * rejection passes the {Error} as parameter.
     * @param host - Host name to connect to; if null the old host name will be used.
     * @param force - Force new connection even if one already exists.
     */
    connect(host: string, force: boolean): Promise<any> {
        this.boffClosed = false;

        if (this.socket) {
            if (!force && this.socket.readyState === this.socket.OPEN) {
                return Promise.resolve();
            }
            this.socket.close();
            this.socket = null;
        }

        if (host) {
            this.config.host = host;
        }

        return new Promise((resolve, reject) => {
            const url = makeBaseUrl(this.config.host, this.config.secure ? 'wss' : 'ws', this.config.APIKey);
            log('Connecting to: ', url);
            const conn: WebSocket = new NetworkProviders.WebSocket(url);

            conn.onerror = (err) => {
                reject(err);
            };

            conn.onopen = (() => {
                if (this.config.autoReconnect) {
                    this.backoffStop();
                }
                this.onOpen.next();
                resolve();
            }).bind(this);

            conn.onclose = (() => {
                this.socket = null;
                const code = this.boffClosed ? AppSettings.NETWORK_USER : AppSettings.NETWORK_ERROR;
                const error = new Error(this.boffClosed ? AppSettings.NETWORK_USER_TEXT : AppSettings.ERROR_TEXT + ' (' + code + ')');
                this.onDisconnect.next({ error, code });
                if (!this.boffClosed && this.config.autoReconnect) {
                    this.boffReconnect();
                }
            }).bind(this);

            conn.onmessage = ((evt: any) => {
                this.onMessage.next(evt.data);
            }).bind(this);
            this.socket = conn;
        });
    }

    /**
     * Disconnect this connection
     */
    disconnect() {
        this.boffClosed = true;
        if (!this.socket) {
            return;
        }

        this.backoffStop();
        this.socket.close();
        this.socket = null;
    }

    /**
     * Send a string to the server.
     * @param msg - String to send.
     */
    sendText(msg: string) {
        if (this.socket && (this.socket.readyState === this.socket.OPEN)) {
            this.socket.send(msg);
        } else {
            throw new Error('Websocket is not connected');
        }
    }

    /**
     * Check if current connection exists
     */
    isConnected(): boolean {
        return (this.socket && (this.socket.readyState === this.socket.OPEN));
    }
}
