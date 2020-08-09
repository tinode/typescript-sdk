import { getBrowserInfo, mergeObj, simplify, jsonLoggerHelper, jsonParseHelper, initializeNetworkProviders, base64encode } from './utilities';
import { ConnectionOptions, Connection, LPConnection, WSConnection, AutoReconnectData, OnDisconnetData } from './connection';
import { AppSettings, AppInfo, TopicNames } from './constants';
import { Packet, PacketTypes } from './models/packet';
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
import { Subject, Subscription } from 'rxjs';
import { OnLoginData } from './models/tinode-events';
import { AccountParams } from './models/account-params';
import { AuthenticationScheme } from './models/auth-scheme';

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
    private lastLogin = null;
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
    /**
     * Subject for connect event
     */
    onConnect = new Subject();
    /**
     * Subject for disconnect event
     */
    onDisconnect = new Subject();
    /**
     * Wrapper for the reconnect iterator callback.
     */
    onAutoReconnectIteration = new Subject<AutoReconnectData>();
    /**
     * Connection events subscriptions
     */
    private connectionEventsSubscriptions: Subscription[] = [];

    /**
     * Return information about the current version of this Tinode client library.
     */
    static getVersion(): string {
        return AppInfo.VERSION;
    }

    /**
     *  Return information about the current name and version of this Tinode library.
     */
    static getLibrary(): string {
        return AppInfo.LIBRARY;
    }

    /**
     * To use Tinode in a non browser context, supply WebSocket and XMLHttpRequest providers.
     */
    static setNetworkProviders(ws: any, xmlhttprequest: any) {
        initializeNetworkProviders(ws, xmlhttprequest);
    }

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

        switch (connectionConfig.transport) {
            case 'lp':
                this.connection = new LPConnection(connectionConfig);
                break;

            case 'ws':
                this.connection = new WSConnection(connectionConfig);
                break;

            default:
                throw new Error('Invalid transport method is selected! It can be "lp" or "ws"');
        }

        if (this.connection) {
            this.connection.logger = this.logger;
            this.doConnectionSubscriptions();
        }

        setInterval(() => {
            this.checkExpiredPromises();
        }, AppSettings.EXPIRE_PROMISES_PERIOD);
    }

    /**
     * Subscribe and handle connection events
     */
    private doConnectionSubscriptions(): void {
        const onMessageSubs = this.connection.onMessage.subscribe((data) => this.onConnectionMessage(data));
        this.connectionEventsSubscriptions.push(onMessageSubs);

        const onOpenSubs = this.connection.onOpen.subscribe(() => this.hello());
        this.connectionEventsSubscriptions.push(onOpenSubs);

        const onAutoReconnectSubs = this.connection.onAutoReconnectIteration.subscribe((data) => this.onAutoReconnectIteration.next(data));
        this.connectionEventsSubscriptions.push(onAutoReconnectSubs);

        const onDisconnectSubs = this.connection.onDisconnect.subscribe((data) => this.onConnectionDisconnect(data));
        this.connectionEventsSubscriptions.push(onDisconnectSubs);
    }

    /**
     * Toggle console logging. Logging is off by default.
     * @param enabled - Set to to enable logging to console.
     * @param trimLongStrings - Options to trim long strings
     */
    enableLogging(enabled: boolean, trimLongStrings?: boolean): void {
        this.loggingEnabled = enabled;
        this.trimLongStrings = enabled && trimLongStrings;
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
    private cacheMap(func: any, context?: any) {
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
    private initPacket(type: PacketTypes, topic?: string): Packet<any> {
        switch (type) {
            case PacketTypes.Hi:
                const hiData: HiPacketData = {
                    ver: AppInfo.VERSION,
                    ua: this.getUserAgent(),
                    dev: this.deviceToken,
                    lang: this.humanLanguage,
                    platf: this.platform,
                };
                return new Packet(type, hiData, this.getNextUniqueId());

            case PacketTypes.Acc:
                const accData: AccPacketData = {
                    user: null,
                    scheme: null,
                    secret: null,
                    login: false,
                    tags: null,
                    desc: {},
                    cred: {},
                    token: null,
                };
                return new Packet(type, accData, this.getNextUniqueId());

            case PacketTypes.Login:
                const loginData: LoginPacketData = {
                    scheme: null,
                    secret: null,
                    cred: null,
                };
                return new Packet(type, loginData, this.getNextUniqueId());

            case PacketTypes.Sub:
                const subData: SubPacketData = {
                    topic,
                    set: {},
                    get: {},
                };
                return new Packet(type, subData, this.getNextUniqueId());

            case PacketTypes.Leave:
                const leaveData: LeavePacketData = {
                    topic,
                    unsub: false,
                };
                return new Packet(type, leaveData, this.getNextUniqueId());

            case PacketTypes.Pub:
                const pubData: PubPacketData = {
                    topic,
                    noecho: false,
                    head: null,
                    content: {},
                };
                return new Packet(type, pubData, this.getNextUniqueId());

            case PacketTypes.Get:
                const getData: GetPacketData = {
                    topic,
                    what: null,
                    desc: {},
                    sub: {},
                    data: {},
                };
                return new Packet(type, getData, this.getNextUniqueId());

            case PacketTypes.Set:
                const setData: SetPacketData = {
                    topic,
                    desc: {},
                    sub: {},
                    tags: [],
                };
                return new Packet(type, setData, this.getNextUniqueId());

            case PacketTypes.Del:
                const delData: DelPacketData = {
                    topic,
                    what: null,
                    delseq: null,
                    hard: false,
                    user: null,
                };
                return new Packet(type, delData, this.getNextUniqueId());

            case PacketTypes.Note:
                const noteData: NotePacketData = {
                    topic,
                    seq: undefined,
                    what: null,
                };
                return new Packet(type, noteData, null);

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

        let formattedPkt = {};
        formattedPkt[pkt.name] = { ...pkt.data, id: pkt.id };
        formattedPkt = simplify(formattedPkt);
        const msg = JSON.stringify(formattedPkt);
        this.logger('out: ' + (this.trimLongStrings ? JSON.stringify(formattedPkt, jsonLoggerHelper) : msg));
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

        // Resolve or reject a pending promise, if any
        if (pkt.ctrl.id) {
            this.execPromise(pkt.ctrl.id, pkt.ctrl.code, pkt.ctrl, pkt.ctrl.text);
        }

        if (pkt.ctrl.code === 205 && pkt.ctrl.text === 'evicted') {
            // User evicted from topic.
            // REVIEW Set Topic type
            const topic: any = this.cacheGet('topic', pkt.ctrl.topic);
            if (topic) {
                topic._resetSub();
            }
        }

        if (pkt.ctrl.params && pkt.ctrl.params.what === 'data') {
            // All messages received: "params":{"count":11,"what":"data"},
            const topic = this.cacheGet('topic', pkt.ctrl.topic);
            if (topic) {
                topic._allMessagesReceived(pkt.ctrl.params.count);
            }
        }

        if (pkt.ctrl.params && pkt.ctrl.params.what === 'sub') {
            // The topic has no subscriptions.
            const topic = this.cacheGet('topic', pkt.ctrl.topic);
            if (topic) {
                // Trigger topic.onSubsUpdated.
                topic._processMetaSub([]);
            }
        }
    }

    /**
     * REVIEW: types
     * Handle meta type messages
     * @param pkt - Server message data
     */
    private handleMetaMessage(pkt: any) {
        this.onMetaMessage.next(pkt.meta);

        // Preferred API: Route meta to topic, if one is registered
        const topic = this.cacheGet('topic', pkt.meta.topic);
        if (topic) {
            topic._routeMeta(pkt.meta);
        }

        if (pkt.meta.id) {
            this.execPromise(pkt.meta.id, 200, pkt.meta, 'META');
        }
    }

    /**
     * REVIEW: types
     * Handle data type messages
     * @param pkt - Server message data
     */
    private handleDataMessage(pkt: any) {
        this.onDataMessage.next(pkt.data);

        // Preferred API: Route data to topic, if one is registered
        const topic = this.cacheGet('topic', pkt.data.topic);
        if (topic) {
            topic._routeData(pkt.data);
        }
    }

    /**
     * REVIEW: types
     * Handle pres type messages
     * @param pkt - Server message data
     */
    private handlePresMessage(pkt: any) {
        this.onPresMessage.next(pkt.pres);

        // Preferred API: Route presence to topic, if one is registered
        const topic = this.cacheGet('topic', pkt.pres.topic);
        if (topic) {
            topic._routePres(pkt.pres);
        }
    }

    /**
     * REVIEW: types
     * Handle info type messages
     * @param pkt - Server message data
     */
    private handleInfoMessage(pkt: any) {
        this.onInfoMessage.next(pkt.info);

        // Preferred API: Route {info}} to topic, if one is registered
        const topic = this.cacheGet('topic', pkt.info.topic);
        if (topic) {
            topic._routeInfo(pkt.info);
        }
    }

    /**
     * Reset all variables and unsubscribe from all events and topics
     * @param onDisconnectData - Data from connection disconnect event
     */
    private onConnectionDisconnect(onDisconnectData: OnDisconnetData): any {
        this.inPacketCount = 0;
        this.serverInfo = null;
        this.authenticated = false;

        // Mark all topics as unsubscribed
        this.cacheMap((obj, key) => {
            if (key.lastIndexOf('topic:', 0) === 0) {
                obj._resetSub();
            }
        });

        // Reject all pending promises
        for (const key in this.pendingPromises) {
            if (key) {
                const callbacks = this.pendingPromises[key];
                if (callbacks && callbacks.reject) {
                    callbacks.reject(onDisconnectData);
                }
            }
        }

        // Unsubscribe from connection events
        for (const subs of this.connectionEventsSubscriptions) {
            subs.unsubscribe();
        }
        this.connectionEventsSubscriptions = [];

        this.pendingPromises = {};
        this.onDisconnect.next(onDisconnectData);
    }

    /**
     * Connect to the server.
     * @param host - name of the host to connect to
     */
    connect(host?: string): Promise<void> {
        if (!this.connectionEventsSubscriptions.length) {
            this.doConnectionSubscriptions();
        }

        return this.connection.connect(host);
    }

    /**
     * Attempt to reconnect to the server immediately.
     * @param force - reconnect even if there is a connection already.
     */
    reconnect(force?: boolean): Promise<any> {
        return this.connection.connect(null, force);
    }

    /**
     * Disconnect from the server.
     */
    disconnect(): void {
        this.connection.disconnect();
    }

    /**
     * Check for live connection to server.
     */
    isConnected(): boolean {
        return this.connection.isConnected();
    }

    /**
     * Check if connection is authenticated (last login was successful).
     */
    isAuthenticated(): boolean {
        return this.authenticated;
    }

    /**
     * Send handshake to the server.
     */
    async hello(): Promise<any> {
        const pkt: Packet<HiPacketData> = this.initPacket(PacketTypes.Hi);
        try {
            const ctrl = await this.send(pkt, pkt.id);
            // Reset backoff counter on successful connection.
            this.connection.backoffReset();
            // Server response contains server protocol version, build, constraints,
            // session ID for long polling. Save them.
            if (ctrl.params) {
                this.serverInfo = ctrl.params;
            }
            this.onConnect.next();
            return ctrl;
        } catch (error) {
            this.connection.reconnect(true);
            this.onDisconnect.next(error);
            throw error;
        }
    }

    /**
     * Create or update an account
     * @param userId - User id to update
     * @param scheme - Authentication scheme; "basic" and "anonymous" are the currently supported schemes.
     * @param secret - Authentication secret, assumed to be already base64 encoded.
     * @param login - Use new account to authenticate current session
     * @param params - User data to pass to the server.
     */
    account(userId: string, scheme: AuthenticationScheme, secret: string, login: boolean, params?: AccountParams): Promise<any> {
        const pkt: Packet<AccPacketData> = this.initPacket(PacketTypes.Acc);
        pkt.data.user = userId;
        pkt.data.scheme = scheme;
        pkt.data.secret = secret;
        pkt.data.login = login;

        if (params) {
            pkt.data.tags = params.tags;
            pkt.data.cred = params.cred;
            pkt.data.token = params.token;

            pkt.data.desc.defacs = params.defacs;
            pkt.data.desc.public = params.public;
            pkt.data.desc.private = params.private;
        }

        return this.send(pkt, pkt.id);
    }

    /**
     * Create a new user. Wrapper for `account`.
     * @param scheme - Authentication scheme; "basic" is the only currently supported scheme.
     * @param secret - Authentication secret
     * @param login - Use new account to authenticate current session
     * @param params - User data to pass to the server
     */
    createAccount(scheme: AuthenticationScheme, secret: string, login: boolean, params?: AccountParams): Promise<any> {
        let promise = this.account(TopicNames.USER_NEW, scheme, secret, login, params);
        if (login) {
            promise = promise.then((ctrl) => {
                this.loginSuccessful(ctrl);
                return ctrl;
            });
        }
        return promise;
    }

    /**
     * Create user with 'basic' authentication scheme and immediately
     * use it for authentication. Wrapper for `account`
     * @param username - Using this username you can log into your account
     * @param password - User's password
     * @param params - User data to pass to the server
     */
    createAccountBasic(username: string, password: string, login: boolean, params?: AccountParams): Promise<any> {
        username = username || '';
        password = password || '';
        const secret = base64encode(username + ':' + password);
        return this.createAccount(AuthenticationScheme.Basic, secret, login, params);
    }

    /**
     * Update user's credentials for 'basic' authentication scheme. Wrapper for `account`
     * @param userId - User ID to update
     * @param username - Using this username you can log into your account
     * @param password - User's password
     * @param params - Data to pass to the server.
     */
    updateAccountBasic(userId: string, username: string, password: string, params?: AccountParams): Promise<any> {
        // Make sure we are not using 'null' or 'undefined';
        username = username || '';
        password = password || '';
        return this.account(userId, AuthenticationScheme.Basic, base64encode(username + ':' + password), false, params);
    }

    /**
     * Authenticate current session.
     * @param scheme - Authentication scheme; <tt>"basic"</tt> is the only currently supported scheme.
     * @param secret - Authentication secret, assumed to be already base64 encoded.
     * @param cred - cred
     * @returns Promise which will be resolved/rejected when server reply is received
     */
    async login(scheme: AuthenticationScheme, secret: string, cred?: any): Promise<any> {
        const pkt: Packet<LoginPacketData> = this.initPacket(PacketTypes.Login);
        pkt.data.scheme = scheme;
        pkt.data.secret = secret;
        pkt.data.cred = cred;

        const ctrl = await this.send(pkt, pkt.id);
        this.loginSuccessful(ctrl);
        return ctrl;
    }

    /**
     * Wrapper for `login` with basic authentication
     * @param username - User name
     * @param password - Password
     * @param cred - cred
     * @returns Promise which will be resolved/rejected on receiving server reply.
     */
    async loginBasic(username: string, password: string, cred?: any) {
        const ctrl = this.login(AuthenticationScheme.Basic, base64encode(username + ':' + password), cred);
        this.lastLogin = username;
        return ctrl;
    }

    /**
     * Wrapper for `login` with token authentication
     * @param token - Token received in response to earlier login.
     * @param cred - cred
     * @returns Promise which will be resolved/rejected on receiving server reply.
     */
    loginToken(token: string, cred?: any): Promise<any> {
        return this.login(AuthenticationScheme.Token, token, cred);
    }

    /**
     * Send a request for resetting an authentication secret.
     * @param scheme - authentication scheme to reset.
     * @param method - method to use for resetting the secret, such as "email" or "tel".
     * @param value - value of the credential to use, a specific email address or a phone number.
     */
    requestResetAuthSecret(scheme: AuthenticationScheme, method: string, value: string): Promise<any> {
        return this.login(AuthenticationScheme.Reset, base64encode(scheme + ':' + method + ':' + value));
    }

    /**
     * Set or refresh the push notifications/device token. If the client is connected,
     * the deviceToken can be sent to the server.
     * @param deviceToken - token obtained from the provider
     * @param sendToServer - if true, send deviceToken to server immediately.
     * @returns true if attempt was made to send the token to the server.
     */
    setDeviceToken(deviceToken: string, sendToServer: boolean): boolean {
        let sent = false;
        if (deviceToken && deviceToken !== this.deviceToken) {
            this.deviceToken = deviceToken;
            if (sendToServer && this.isConnected() && this.isAuthenticated()) {
                const pkt: Packet<HiPacketData> = this.initPacket(PacketTypes.Hi);
                pkt.data.dev = deviceToken;
                this.send(pkt, pkt.id);
                sent = true;
            }
        }
        return sent;
    }
}
