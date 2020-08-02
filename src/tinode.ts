import { ConnectionOptions, Connection, LPConnection, WSConnection } from './connection';
import { getBrowserInfo, mergeObj, simplify, jsonLoggerHelper, jsonParseHelper } from './utilities';
import { Packet, PacketTypes } from './models/packet';
import { AppSettings, AppInfo } from './constants';
import {
    HiPacketData,
    AccPacketData,
    SubPacketData,
    PubPacketData,
    GetPacketData,
    SetPacketData,
    DelPacketData,
    NotePacketData,
    LeavePacketData,
    LoginPacketData,
} from './models/packet-data';
import { Subject } from 'rxjs';
import { OnLoginData } from './models/tinode-events';

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
    /**
     * Stores interval to clear later
     */
    private checkExpiredPromisesInterval: any;
    /**
     * Subject to report login completion.
     */
    onLogin = new Subject<OnLoginData>();
    /**
     * Subject to receive server responses to network probes
     */
    onRawMessage = new Subject<string>();
    /**
     * Subject to receive server responses to network probes
     */
    onNetworkProbe = new Subject();
    /**
     * Subject to receive all messages as objects.
     */
    onMessage = new Subject();
    /**
     * Subject to receive {ctrl} (control) messages.
     */
    onCtrlMessage = new Subject();
    /**
     * Subject to receive {meta} messages.
     */
    onMetaMessage = new Subject();
    /**
     * Subject to receive {data} messages.
     */
    onDataMessage = new Subject();
    /**
     * Subject to receive {pres} messages.
     */
    onPresMessage = new Subject();
    /**
     * Subject to receive {info} messages.
     */
    onInfoMessage = new Subject();

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
            this.connection.onMessage.subscribe((data) => this.onConnectionMessage(data));
        }

        setInterval(() => {
            this.checkExpiredPromises();
        }, AppSettings.EXPIRE_PROMISES_PERIOD);
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

    /**
     * REVIEW: Add Types
     * Make limited cache management available to topic.
     * Caching user.public only. Everything else is per-topic.
     * @param topic - Topic to attach cache
     */
    private attachCacheToTopic(topic: any) {
        topic._tinode = this;

        topic._cacheGetUser = (uid) => {
            const pub = this.cacheGet('user', uid);
            if (pub) {
                return {
                    user: uid,
                    public: mergeObj({}, pub)
                };
            }
            return undefined;
        };
        topic._cachePutUser = (uid, user) => {
            return this.cachePut('user', uid, mergeObj({}, user.public));
        };
        topic._cacheDelUser = (uid) => {
            return this.cacheDel('user', uid);
        };
        topic._cachePutSelf = () => {
            return this.cachePut('topic', topic.name, topic);
        };
        topic._cacheDelSelf = () => {
            return this.cacheDel('topic', topic.name);
        };
    }

    /**
     * Resolve or reject a pending promise.
     * Unresolved promises are stored in _pendingPromises.
     */
    private execPromise(id: string, code: number, onOK: any, errorText: string) {
        const callbacks = this.pendingPromises[id];
        if (callbacks) {
            delete this.pendingPromises[id];
            if (code >= 200 && code < 400) {
                if (callbacks.resolve) {
                    callbacks.resolve(onOK);
                }
            } else if (callbacks.reject) {
                callbacks.reject(new Error(errorText + ' (' + code + ')'));
            }
        }
    }

    /**
     * Stored callbacks will be called when the response packet with this Id arrives
     * @param id - Id of new promise
     */
    private makePromise(id: string): Promise<any> {
        let promise = null;
        if (id) {
            promise = new Promise((resolve, reject) => {
                this.pendingPromises[id] = {
                    resolve,
                    reject,
                    ts: new Date(),
                };
            });
        }
        return promise;
    }

    /**
     * Reject promises which have not been resolved for too long.
     */
    private checkExpiredPromises(): void {
        const err = new Error('Timeout (504)');
        const expires = new Date(new Date().getTime() - AppSettings.EXPIRE_PROMISES_TIMEOUT);
        for (const id in this.pendingPromises) {
            if (id) {
                const callbacks = this.pendingPromises[id];
                if (callbacks && callbacks.ts < expires) {
                    this.logger('Promise expired', id);
                    delete this.pendingPromises[id];
                    if (callbacks.reject) {
                        callbacks.reject(err);
                    }
                }
            }
        }
    }

    /**
     * Generates unique message IDs
     */
    private getNextUniqueId(): string {
        return (this.messageId !== 0) ? '' + this.messageId++ : undefined;
    }

    /**
     * Get User Agent string
     */
    private getUserAgent(): string {
        return this.appName + ' (' + (this.browser ? this.browser + '; ' : '') + this.hardwareOS + '); ' + AppInfo.LIBRARY;
    }

    /**
     * Generator of packets stubs
     */
    private initPacket(type: PacketTypes, topic: string): Packet<any> {
        switch (type) {
            case PacketTypes.Hi:
                const hiData: HiPacketData = {
                    id: this.getNextUniqueId(),
                    ver: AppInfo.VERSION,
                    ua: this.getUserAgent(),
                    dev: this.deviceToken,
                    lang: this.humanLanguage,
                    platf: this.platform,
                };
                return new Packet(type, hiData);

            case PacketTypes.Acc:
                const accData: AccPacketData = {
                    id: this.getNextUniqueId(),
                    user: null,
                    scheme: null,
                    secret: null,
                    login: false,
                    tags: null,
                    desc: {},
                    cred: {},
                };
                return new Packet(type, accData);

            case PacketTypes.Login:
                const loginData: LoginPacketData = {
                    id: this.getNextUniqueId(),
                    scheme: null,
                    secret: null,
                };
                return new Packet(type, loginData);

            case PacketTypes.Sub:
                const subData: SubPacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    set: {},
                    get: {},
                };
                return new Packet(type, subData);

            case PacketTypes.Leave:
                const leaveData: LeavePacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    unsub: false,
                };
                return new Packet(type, leaveData);

            case PacketTypes.Pub:
                const pubData: PubPacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    noecho: false,
                    head: null,
                    content: {},
                };
                return new Packet(type, pubData);

            case PacketTypes.Get:
                const getData: GetPacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    what: null,
                    desc: {},
                    sub: {},
                    data: {},
                };
                return new Packet(type, getData);

            case PacketTypes.Set:
                const setData: SetPacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    desc: {},
                    sub: {},
                    tags: [],
                };
                return new Packet(type, setData);

            case PacketTypes.Del:
                const delData: DelPacketData = {
                    id: this.getNextUniqueId(),
                    topic,
                    what: null,
                    delseq: null,
                    hard: false,
                    user: null,
                };
                return new Packet(type, delData);

            case PacketTypes.Note:
                const noteData: NotePacketData = {
                    topic,
                    seq: undefined,
                    what: null,
                };
                return new Packet(type, noteData);

            default:
                throw new Error('Unknown packet type requested: ' + type);
        }
    }

    /**
     * Send a packet. If packet id is provided return a promise.
     * @param pkt - Packet
     * @param id - Message ID
     */
    private send(pkt: Packet<any>, id: string) {
        let promise: any;
        if (id) {
            promise = this.makePromise(id);
        }
        pkt = simplify(pkt);
        const msg = JSON.stringify(pkt);
        this.logger('out: ' + (this.trimLongStrings ? JSON.stringify(pkt, jsonLoggerHelper) : msg));
        try {
            this.connection.sendText(msg);
        } catch (err) {
            // If sendText throws, wrap the error in a promise or rethrow.
            if (id) {
                this.execPromise(id, AppSettings.NETWORK_ERROR, null, err.message);
            } else {
                throw err;
            }
        }
        return promise;
    }

    /**
     * REVIEW: types
     * On successful login save server-provided data.
     * @param ctrl - Server response
     */
    private loginSuccessful(ctrl: any) {
        if (!ctrl.params || !ctrl.params.user) {
            return;
        }

        // This is a response to a successful login,
        // extract UID and security token, save it in Tinode module
        this.myUserID = ctrl.params.user;
        this.authenticated = (ctrl && ctrl.code >= 200 && ctrl.code < 300);
        if (ctrl.params && ctrl.params.token && ctrl.params.expires) {
            this.authToken = {
                token: ctrl.params.token,
                expires: new Date(ctrl.params.expires)
            };
        } else {
            this.authToken = null;
        }

        this.onLogin.next({ code: ctrl.code, text: ctrl.text });
    }

    /**
     * The main message dispatcher.
     * @param data - Server message data
     */
    private onConnectionMessage(data: string) {
        // Skip empty response. This happens when LP times out.
        if (!data) {
            return;
        }

        this.inPacketCount++;

        // Send raw message to listener
        this.onRawMessage.next(data);

        if (data === '0') {
            // Server response to a network probe.
            this.onNetworkProbe.next();
            return;
        }

        const pkt = JSON.parse(data, jsonParseHelper);

        if (!pkt) {
            this.logger('in: ' + data);
            this.logger('ERROR: failed to parse data');
            return;
        }

        this.logger('in: ' + (this.trimLongStrings ? JSON.stringify(pkt, jsonLoggerHelper) : data));

        // Send complete packet to listener
        this.onMessage.next(pkt);

        switch (true) {
            case Boolean(pkt.ctrl):
                this.handleCtrlMessage(pkt);
                break;

            case Boolean(pkt.meta):
                this.handleMetaMessage(pkt);
                break;

            case Boolean(pkt.data):
                this.handleDataMessage(pkt);
                break;

            case Boolean(pkt.pres):
                this.handlePresMessage(pkt);
                break;

            case Boolean(pkt.info):
                this.handleInfoMessage(pkt);
                break;

            default: this.logger('ERROR: Unknown packet received.');
        }
    }

    /**
     * REVIEW: types
     * Handle ctrl type messages
     * @param pkt - Server message data
     */
    private handleCtrlMessage(pkt: any) {
        this.onCtrlMessage.next(pkt.ctrl);
    }

    /**
     * REVIEW: types
     * Handle meta type messages
     * @param pkt - Server message data
     */
    private handleMetaMessage(pkt: any) {
        this.onMetaMessage.next(pkt.meta);
    }

    /**
     * REVIEW: types
     * Handle data type messages
     * @param pkt - Server message data
     */
    private handleDataMessage(pkt: any) {
        this.onDataMessage.next(pkt.data);
    }

    /**
     * REVIEW: types
     * Handle pres type messages
     * @param pkt - Server message data
     */
    private handlePresMessage(pkt: any) {
        this.onPresMessage.next(pkt.pres);
    }

    /**
     * REVIEW: types
     * Handle info type messages
     * @param pkt - Server message data
     */
    private handleInfoMessage(pkt: any) {
        this.onInfoMessage.next(pkt.info);
    }
}
