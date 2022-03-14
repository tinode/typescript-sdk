import { AppSettings, DEL_CHAR, MessageStatus, AccessModeFlags, TopicNames } from '../constants';
import { SetDesc, SetParams, SetSub } from '../models/set-params';
import { MetaGetBuilder } from '../meta-get-builder';
import { Credential } from '../models/credential';
import { GetQuery } from '../models/get-query';
import { DelRange } from '../models/del-range';
import { AccessMode } from '../access-mode';
import { Utilities } from '../utilities';
import { CBuffer } from '../cbuffer';
import { Message } from '../message';
import { Tinode } from '../tinode';
import { Subject } from 'rxjs';

export class Topic {
    /**
     * Topic created but not yet synced with the server. Used only during initialization.
     */
    private new = true;
    /**
     * User discovery tags
     */
    private tags = [];
    /**
     * Parent Tinode object
     */
    tinode: Tinode;
    /**
     * Locally cached data
     * Subscribed users, for tracking read/recv/msg notifications.
     */
    private users: any = {};
    /**
     * Credentials such as email or phone number
     */
    protected credentials: Credential[] = [];
    /**
     * Boolean, true if the topic is currently live
     */
    protected subscribed = false;
    /**
     * Timestamp when the topic was created
     */
    private created: Date = null;
    /**
     * Timestamp when the topic was last updated
     */
    private update: Date = null;
    /**
     * Timestamp of the last messages
     */
    private touched: Date = null;
    /**
     * Indicator that the last request for earlier messages returned 0.
     */
    private noEarlierMsgs = false;
    /**
     * Access mode, see AccessMode
     */
    protected acs = new AccessMode(null);
    /**
     * Current value of locally issued seqId, used for pending messages.
     */
    private queuedSeqId = AppSettings.LOCAL_SEQ_ID;
    /**
     * Message cache, sorted by message seq values, from old to new.
     */
    private messages = new CBuffer((a: Message, b: Message) => a.seq - b.seq, true);
    /**
     * The maximum known {data.seq} value.
     */
    maxSeq = 0;
    /**
     * The minimum known {data.seq} value.
     */
    minSeq = 0;
    /**
     * The maximum known deletion ID.
     */
    maxDel = 0;
    /**
     * Topic name
     */
    name: string;
    /**
     * Timestamp when topic meta-desc update was received.
     */
    lastDescUpdate: any;
    /**
     * Timestamp when topic meta-subs update was received.
     */
    lastSubsUpdate: any;
    /**
     * per-topic private data
     */
    private: any = null;
    /**
     * per-topic public data
     */
    public: any = null;
    seq: number;
    updated: any;
    clear: any;

    // Topic events
    onData = new Subject<any>();
    onMeta = new Subject<any>();
    onPres = new Subject<any>();
    onInfo = new Subject<any>();
    onMetaSub = new Subject<any>();
    onMetaDesc = new Subject<any>();
    onSubsUpdated = new Subject<any>();
    onTagsUpdated = new Subject<any>();
    onCredsUpdated = new Subject<any>();
    onDeleteTopic = new Subject<any>();
    onAllMessagesReceived = new Subject<any>();

    // Cache related callbacks will be set by tinode class
    cacheDelSelf: () => void = () => { };
    cachePutSelf: () => void = () => { };
    cacheGetUser: (userId: string) => any = (userId: string) => { };
    cacheDelUser: (userId: string) => any = (userId: string) => { };
    cachePutUser: (userId: string, cached: any) => void = (userId: string, cached: any) => { };

    // Do nothing for topics other than 'me'
    processMetaCreds: (creds: any[], update?: boolean) => void = (creds, update) => { };

    constructor(name: string, tinode: Tinode) {
        this.name = name;
        this.tinode = tinode;
    }

    /**
     * Check if the topic is subscribed.
     * @returns Subscription status
     */
    isSubscribed(): boolean {
        return this.subscribed;
    }

    /**
     * Request this topic to subscribe
     * @param getParams - get query parameters.
     * @param setParams - set parameters.
     */
    async subscribe(getParams: GetQuery, setParams: SetParams): Promise<any> {
        // If the topic is already subscribed, return resolved promise
        if (this.isSubscribed()) {
            return Promise.resolve(this);
        }

        // Send subscribe message, handle async response.
        // If topic name is explicitly provided, use it. If no name, then it's a new group topic, use "new".
        const ctrl = await this.tinode.subscribe(this.name || TopicNames.TOPIC_NEW, getParams, setParams);

        if (ctrl.code >= 400) {
            // Do nothing if the topic is already subscribed to.
            return ctrl;
        }

        this.subscribed = true;
        this.acs = (ctrl.params && ctrl.params.acs) ? ctrl.params.acs : this.acs;

        // Set topic name for new topics and add it to cache.
        if (this.new) {
            this.new = false;

            // Name may change new123456 -> grpAbCdEf
            this.name = ctrl.topic;
            this.created = ctrl.ts;
            this.updated = ctrl.ts;
            // Don't assign touched, otherwise topic will be put on top of the list on subscribe.
            this.cachePutSelf();

            if (this.name !== TopicNames.TOPIC_ME && this.name !== TopicNames.TOPIC_FND) {
                // Add the new topic to the list of contacts maintained by the 'me' topic.
                const me = this.tinode.getMeTopic();
                if (me) {
                    me.processMetaSub([{
                        noForwarding: true,
                        topic: this.name,
                        created: ctrl.ts,
                        updated: ctrl.ts,
                        acs: this.acs
                    }]);
                }
            }

            if (setParams && setParams.desc) {
                setParams.desc.noForwarding = true;
                this.processMetaDesc(setParams.desc);
            }
        }
        return ctrl;
    }

    /**
     * Create a draft of a message without sending it to the server.
     * @param data - Content to wrap in a draft.
     * @param noEcho - If true server will not echo message back to originating
     */
    createMessage(data: any, noEcho: boolean): Message {
        return this.tinode.createMessage(this.name, data, noEcho);
    }

    /**
     * Immediately publish data to topic. Wrapper for Tinode.publish
     * @param data - Data to publish, either plain string or a Drafty object.
     * @param noEcho - If <tt>true</tt> server will not echo message back to originating
     */
    publish(data: any, noEcho: boolean): Promise<any> {
        return this.publishMessage(this.createMessage(data, noEcho));
    }

    /**
     * Publish message created by create message
     * @param pub - {data} object to publish. Must be created by createMessage
     */
    async publishMessage(message: Message): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot publish on inactive topic'));
        }

        message.setStatus(MessageStatus.SENDING);

        try {
            const ctrl = await this.tinode.publishMessage(message);
            const seq = ctrl.params.seq;
            if (seq) {
                message.setStatus(MessageStatus.SENT);
            }
            message.ts = ctrl.ts;
            this.swapMessageId(message, seq);
            this.routeData(message);
            return ctrl;
        } catch (err) {
            this.tinode.logger('WARNING: Message rejected by the server', err);
            message.setStatus(MessageStatus.FAILED);
            this.onData.next();
        }
    }

    /**
     * Add message to local message cache, send to the server when the promise is resolved.
     * If promise is null or undefined, the message will be sent immediately.
     * The message is sent when the
     * The message should be created by createMessage.
     * This is probably not the final API.
     * @param msg - Message to use as a draft.
     * @param prom - Message will be sent when this promise is resolved, discarded if rejected.
     */
    publishDraft(msg: Message, prom?: Promise<any>): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot publish on inactive topic'));
        }

        const seq = msg.seq || this.getQueuedSeqId();
        if (!msg.noForwarding) {
            // The 'seq', 'ts', and 'from' are added to mimic {data}. They are removed later
            // before the message is sent.
            msg.noForwarding = true;
            msg.seq = seq;
            msg.ts = new Date();
            msg.from = this.tinode.getCurrentUserID();

            // Don't need an echo message because the message is added to local cache right away.
            msg.echo = false;
            // Add to cache.
            this.messages.put(msg);
            this.onData.next(msg);
        }

        // If promise is provided, send the queued message when it's resolved.
        // If no promise is provided, create a resolved one and send immediately.
        prom = (prom || Promise.resolve()).then(
            () => {
                if (msg.cancelled) {
                    return {
                        code: 300,
                        text: 'cancelled'
                    };
                }

                return this.publishMessage(msg);
            },
            (err) => {
                this.tinode.logger('WARNING: Message draft rejected by the server', err);
                msg.setStatus(MessageStatus.FAILED);
                this.messages.delAt(this.messages.find(msg));
                this.onData.next();
            });
        return prom;
    }

    /**
     * Leave the topic, optionally unsubscribe. Leaving the topic means the topic will stop
     * receiving updates from the server. Unsubscribing will terminate user's relationship with the topic.
     * Wrapper for Tinode.leave
     * @param unsubscribe - If true, unsubscribe, otherwise just leave.
     */
    async leave(unsubscribe: boolean) {
        // It's possible to unsubscribe from inactive topic.
        if (!this.subscribed && !unsubscribe) {
            return Promise.reject(new Error('Cannot leave inactive topic'));
        }

        // Send a 'leave' message, handle async response
        const ctrl = await this.tinode.leave(this.name, unsubscribe);
        this.resetSub();
        if (unsubscribe) {
            this.tinode.cacheDel('topic', this.name);
            this.gone();
        }
        return ctrl;
    }

    /**
     * Request topic metadata from the server.
     * @param params - parameters
     */
    getMeta(params: GetQuery): Promise<any> {
        // Send {get} message, return promise.
        return this.tinode.getMeta(this.name, params);
    }

    /**
     * Request more messages from the server
     * @param limit - number of messages to get.
     * @param forward - if true, request newer messages.
     */
    getMessagesPage(limit: number, forward: boolean): Promise<any> {
        const query = this.startMetaQuery();
        let promise = this.getMeta(query.build());

        if (forward) {
            query.withLaterData(limit);
        } else {
            query.withEarlierData(limit);
            promise = promise.then((ctrl) => {
                if (ctrl && ctrl.params && !ctrl.params.count) {
                    this.noEarlierMsgs = true;
                }
            });
        }

        return promise;
    }

    /**
     * Update topic metadata.
     * @param params - parameters to update.
     */
    async setMeta(params: SetParams) {
        if (params.tags) {
            params.tags = Utilities.normalizeArray(params.tags);
        }

        // Send Set message, handle async response.
        const ctrl = await this.tinode.setMeta(this.name, params);
        if (ctrl && ctrl.code >= 300) {
            // Not modified
            return ctrl;
        }

        if (params.sub) {
            params.sub.topic = this.name;
            if (ctrl.params && ctrl.params.acs) {
                params.sub.acs = ctrl.params.acs;
                params.sub.updated = ctrl.ts;
            }
            if (!params.sub.user) {
                // This is a subscription update of the current user.
                // Assign user ID otherwise the update will be ignored by _processMetaSub.
                params.sub.user = this.tinode.getCurrentUserID();
                if (!params.desc) {
                    // Force update to topic's asc.
                    params.desc = {};
                }
            }
            params.sub.noForwarding = true;
            this.processMetaSub([params.sub]);
        }

        if (params.desc) {
            if (ctrl.params && ctrl.params.acs) {
                params.desc.acs = ctrl.params.acs;
                params.desc.updated = ctrl.ts;
            }
            this.processMetaDesc(params.desc);
        }

        if (params.tags) {
            this.processMetaTags(params.tags);
        }

        if (params.cred) {
            this.processMetaCreds([params.cred], true);
        }

        return ctrl;
    }

    /**
     * Update access mode of the current user or of another topic subscriber.
     * @param uid - UID of the user to update or null to update current user.
     * @param update - the update value, full or delta.
     */
    updateMode(uid: string, update: string) {
        const user = uid ? this.subscriber(uid) : null;
        const am = user ?
            user.acs.updateGiven(update).getGiven() :
            this.getAccessMode().updateWant(update).getWant();

        return this.setMeta({
            sub: {
                user: uid,
                mode: am
            }
        });
    }

    /**
     * Create new topic subscription. Wrapper for Tinode.setMeta.
     * @param userId - ID of the user to invite
     * @param mode - Access mode. <tt>null</tt> means to use default.
     */
    invite(userId: string, mode: string): Promise<any> {
        return this.setMeta({
            sub: {
                user: userId,
                mode,
            }
        });
    }

    /**
     * Archive or un-archive the topic. Wrapper for Tinode.setMeta.
     * @param arch - true to archive the topic, false otherwise
     */
    archive(arch: boolean): Promise<any> {
        if (this.private && this.private.arch === arch) {
            return Promise.resolve(arch);
        }
        return this.setMeta({
            desc: {
                private: {
                    arch: arch ? true : DEL_CHAR
                }
            }
        });
    }

    /**
     * Delete messages. Hard-deleting messages requires Owner permission.
     * @param ranges - Ranges of message IDs to delete.
     * @param hard - Hard or soft delete
     */
    async delMessages(ranges: DelRange[], hard?: boolean): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot delete messages in inactive topic'));
        }

        // Sort ranges in ascending order by low, the descending by hi.
        ranges.sort((r1, r2) => {
            if (r1.low < r2.low) {
                return 1;
            }
            if (r1.low === r2.low) {
                return !r2.hi || (r1.hi >= r2.hi) === true ? 1 : -1;
            }
            return -1;
        });

        // Remove pending messages from ranges possibly clipping some ranges.
        const toSend = ranges.reduce((out, r) => {
            if (r.low < AppSettings.LOCAL_SEQ_ID) {
                if (!r.hi || r.hi < AppSettings.LOCAL_SEQ_ID) {
                    out.push(r);
                } else {
                    // Clip hi to max allowed value.
                    out.push({
                        low: r.low,
                        hi: this.maxSeq + 1
                    });
                }
            }
            return out;
        }, []);

        // Send {del} message, return promise
        let result: Promise<any>;
        if (toSend.length > 0) {
            result = this.tinode.delMessages(this.name, toSend, hard);
        } else {
            result = Promise.resolve({
                params: {
                    del: 0
                }
            });
        }

        const ctrl = await result;

        if (ctrl.params.del > this.maxDel) {
            this.maxDel = ctrl.params.del;
        }

        ranges.forEach((r) => {
            if (r.hi) {
                this.flushMessageRange(r.low, r.hi);
            } else {
                this.flushMessage(r.low);
            }
        });

        this.updateDeletedRanges();
        // Calling with no parameters to indicate the messages were deleted.
        this.onData.next();
        return ctrl;
    }

    /**
     *  Delete all messages. Hard-deleting messages requires Owner permission.
     * @param hard - true if messages should be hard-deleted.
     */
    delMessagesAll(hard?: boolean) {
        if (!this.maxSeq || this.maxSeq <= 0) {
            // There are no messages to delete.
            return Promise.resolve();
        }
        return this.delMessages([{
            low: 1,
            hi: this.maxSeq + 1,
            all: true
        }], hard);
    }

    /**
     * Delete multiple messages defined by their IDs. Hard-deleting messages requires Owner permission.
     * @param list - list of seq IDs to delete
     * @param hard - true if messages should be hard-deleted.
     */
    delMessagesList(list: number[], hard?: boolean) {
        // Sort the list in ascending order
        list.sort((a, b) => a - b);

        // Convert the array of IDs to ranges.
        const ranges = list.reduce((out, id) => {
            if (out.length === 0) {
                // First element.
                out.push({
                    low: id
                });
            } else {
                const prev = out[out.length - 1];
                if ((!prev.hi && (id !== prev.low + 1)) || (id > prev.hi)) {
                    // New range.
                    out.push({
                        low: id
                    });
                } else {
                    // Expand existing range.
                    prev.hi = prev.hi ? Math.max(prev.hi, id + 1) : id + 1;
                }
            }
            return out;
        }, []);

        // Send {del} message, return promise
        return this.delMessages(ranges, hard);
    }

    /**
     *  Delete topic. Requires Owner permission. Wrapper for delTopic
     * @param hard - had-delete topic.
     */
    async delTopic(hard: boolean = false): Promise<any> {
        const ctrl = await this.tinode.delTopic(this.name, hard);
        this.resetSub();
        this.gone();
        return ctrl;
    }

    /**
     * Delete subscription. Requires Share permission. Wrapper for Tinode.delSubscription
     * @param user - ID of the user to remove subscription for.
     */
    async delSubscription(user: string): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot delete subscription in inactive topic'));
        }

        // Send {del} message, return promise
        const ctrl = await this.tinode.delSubscription(this.name, user);
        // Remove the object from the subscription cache;
        delete this.users[user];
        // Notify listeners
        this.onSubsUpdated.next(Object.keys(this.users));
        return ctrl;
    }

    /**
     * Send a read/recv notification
     * @param what - what notification to send: <tt>recv</tt>, <tt>read</tt>.
     * @param seq - ID or the message read or received.
     */
    note(what: string, seq: number) {
        if (!this.subscribed) {
            // Cannot sending {note} on an inactive topic".
            return;
        }

        const me = this.tinode.getMeTopic();
        const user = this.users[this.tinode.getCurrentUserID()];

        let update = false;
        if (user) {
            if (!user[what] || user[what] < seq) {
                user[what] = seq;
                update = true;
            }
        } else if (me) {
            // Subscriber not found, such as in case of no S permission.
            update = me.getMsgReadRecv(this.name, what) < seq;
        }

        if (update) {
            this.tinode.note(this.name, what, seq);
        }

        if (me) {
            me.setMsgReadRecv(this.name, what, seq);
        }
    }

    /**
     * Send a 'recv' receipt. Wrapper for Tinode.noteRecv.
     * @param seq - ID of the message to acknowledge.
     */
    noteRecv(seq: number) {
        this.note('recv', seq);
    }

    /**
     * Send a 'read' receipt. Wrapper for Tinode.noteRead.
     * @param seq - ID of the message to acknowledge or 0/undefined to acknowledge the latest messages.
     */
    noteRead(seq: number) {
        seq = seq || this.maxSeq;
        if (seq > 0) {
            this.note('read', seq);
        }
    }

    /**
     * Send a key-press notification. Wrapper for Tinode.noteKeyPress.
     */
    noteKeyPress() {
        if (this.subscribed) {
            this.tinode.noteKeyPress(this.name);
        } else {
            this.tinode.logger('INFO: Cannot send notification in inactive topic');
        }
    }

    /**
     * Get user description from global cache. The user does not need to be a
     * subscriber of this topic.
     * @param uid - ID of the user to fetch.
     */
    userDesc(uid: string) {
        // TODO: (gene) handle asynchronous requests
        const user = this.cacheGetUser(uid);
        if (user) {
            return user; // Promise.resolve(user)
        }
    }

    /**
     * Get description of the p2p peer from subscription cache.
     */
    p2pPeerDesc() {
        if (!this.isP2P()) {
            return undefined;
        }
        return this.users[this.name];
    }

    /**
     * Iterate over cached subscribers. If callback is undefined, use this.onMetaSub.
     */
    getSubscribers(): any[] {
        return this.users;
    }

    /**
     * Get cached subscription for the given user ID.
     * @param uid - id of the user to query for
     */
    subscriber(uid: string) {
        return this.users[uid];
    }

    /**
     * Get a copy of cached tags.
     */
    getTags() {
        // Return a copy.
        return this.tags.slice(0);
    }

    /**
     * Get cached messages
     * @param sinceId - Optional seqId to start iterating from (inclusive)
     * @param beforeId - Optional seqId to stop iterating before (exclusive).`.
     */
    getMessages(sinceId?: number, beforeId?: number) {
        const startIdx = typeof sinceId === 'number' ? this.messages.find({
            seq: sinceId
        }, true) : undefined;
        const beforeIdx = typeof beforeId === 'number' ? this.messages.find({
            seq: beforeId
        }, true) : undefined;
        if (startIdx !== -1 && beforeIdx !== -1) {
            const temp = [];
            this.messages.forEach((value) => temp.push(value), startIdx, beforeIdx);
            return temp;
        }
    }

    /**
     * Get cached unsent messages.
     */
    queuedMessages(): any[] {
        return this.getMessages(AppSettings.LOCAL_SEQ_ID);
    }

    /**
     * Get the number of topic subscribers who marked this message as either recv or read
     * Current user is excluded from the count.
     * @param what - what notification to send: recv, read.
     * @param seq - ID or the message read or received.
     */
    msgReceiptCount(what: string, seq: number) {
        let count = 0;
        if (seq > 0) {
            const me = this.tinode.getCurrentUserID();
            for (const idx in this.users) {
                if (idx) {
                    const user = this.users[idx];
                    if (user.user !== me && user[what] >= seq) {
                        count++;
                    }
                }
            }
        }
        return count;
    }

    /**
     * Get the number of topic subscribers who marked this message (and all older messages) as read.
     * The current user is excluded from the count.
     * @param seq - Message id to check.
     */
    msgReadCount(seq: number) {
        return this.msgReceiptCount('read', seq);
    }

    /**
     * Get the number of topic subscribers who marked this message (and all older messages) as received.
     * The current user is excluded from the count.
     * @param seq - Message id to check.
     */
    msgRecvCount(seq: number) {
        return this.msgReceiptCount('recv', seq);
    }

    /**
     * Check if cached message IDs indicate that the server may have more messages.
     * @param newer - Check for newer messages
     */
    msgHasMoreMessages(newer?: boolean) {
        return newer ? this.seq > this.maxSeq :
            // minSeq could be more than 1, but earlier messages could have been deleted.
            (this.minSeq > 1 && !this.noEarlierMsgs);
    }

    /**
     * Check if the given seq Id is id of the most recent message.
     * @param seqId - id of the message to check
     */
    isNewMessage(seqId: number) {
        return this.maxSeq <= seqId;
    }

    /**
     * Remove one message from local cache.
     * @param seqId id of the message to remove from cache.
     */
    flushMessage(seqId: number) {
        const idx = this.messages.find({
            seq: seqId
        });
        return idx >= 0 ? this.messages.delAt(idx) : undefined;
    }

    /**
     * Update message's seqId.
     * @param msg - message packet.
     * @param newSeqId - new seq id for
     */
    swapMessageId(msg: Message, newSeqId: number) {
        const idx = this.messages.find({
            seq: msg.seq
        }, true);

        const numMessages = this.messages.length();
        msg.seq = newSeqId;
        if (0 <= idx && idx < numMessages) {
            if (
                (idx > 0 && this.messages.getAt(idx - 1).seq >= newSeqId) ||
                (idx + 1 < numMessages && this.messages.getAt(idx + 1).seq <= newSeqId)
            ) {
                this.messages.delAt(idx);
                this.messages.put(msg);
            }
        }
    }

    /**
     * Remove a range of messages from the local cache.
     * @param fromId seq ID of the first message to remove (inclusive).
     * @param untilId seqID of the last message to remove (exclusive).
     */
    flushMessageRange(fromId: number, untilId: number) {
        // start, end: find insertion points (nearest == true).
        const since = this.messages.find({
            seq: fromId
        }, true);
        return since >= 0 ? this.messages.delRange(since, this.messages.find({
            seq: untilId
        }, true)) : [];
    }

    /**
     * Attempt to stop message from being sent.
     * @param seqId id of the message to stop sending and remove from cache.
     */
    cancelSend(seqId: number): boolean {
        const idx = this.messages.find({
            seq: seqId
        });
        if (idx >= 0) {
            const msg = this.messages.getAt(idx);
            const status = this.msgStatus(msg);
            if (status === MessageStatus.QUEUED || status === MessageStatus.FAILED) {
                msg.cancelled = true;
                this.messages.delAt(idx);
                // Calling with no parameters to indicate the message was deleted.
                this.onData.next();
                return true;
            }
        }
        return false;
    }

    /**
     * Get type of the topic: me, p2p, grp, fnd...
     */
    getType(): string {
        return this.name;
    }

    /**
     * Get user's cumulative access mode of the topic.
     */
    getAccessMode() {
        return this.acs;
    }

    /**
     * Initialize new meta Tinode.GetQuery builder. The query is attached to the current topic.
     * It will not work correctly if used with a different topic.
     */
    startMetaQuery() {
        return new MetaGetBuilder(this.tinode, this);
    }

    /**
     * heck if topic is archived, i.e. private.arch == true.
     */
    isArchived() {
        return this.private && this.private.arch ? true : false;
    }

    /**
     * Check if topic is a channel.
     */
    isChannel() {
        return Utilities.isChannelTopicName(this.name);
    }

    /**
     * Check if topic is a group topic.
     */
    isGroup() {
        return this.getType() === 'grp';
    }

    /**
     * Check if topic is a p2p topic.
     */
    isP2P() {
        return this.getType() === 'p2p';
    }

    /**
     * Get status (queued, sent, received etc) of a given message in the context
     * of this topic.
     */
    msgStatus(msg: any) {
        let status = MessageStatus.NONE;
        if (this.tinode.isMe(msg.from)) {
            if (msg.sending) {
                status = MessageStatus.SENDING;
            } else if (msg.failed) {
                status = MessageStatus.FAILED;
            } else if (msg.seq >= AppSettings.LOCAL_SEQ_ID) {
                status = MessageStatus.QUEUED;
            } else if (this.msgReadCount(msg.seq) > 0) {
                status = MessageStatus.READ;
            } else if (this.msgRecvCount(msg.seq) > 0) {
                status = MessageStatus.RECEIVED;
            } else if (msg.seq > 0) {
                status = MessageStatus.SENT;
            }
        } else {
            status = MessageStatus.TO_ME;
        }
        return status;
    }

    /**
     * Process data message
     * @param data data
     */
    routeData(data: Message) {
        if (data.content) {
            if (!this.touched || this.touched < data.ts) {
                this.touched = data.ts;
            }
        }

        if (data.seq > this.maxSeq) {
            this.maxSeq = data.seq;
        }
        if (data.seq < this.minSeq || this.minSeq === 0) {
            this.minSeq = data.seq;
        }

        if (!data.noForwarding) {
            this.messages.put(data);
            this.updateDeletedRanges();
        }

        this.onData.next(data);

        // Update locally cached contact with the new message count.
        const me = this.tinode.getMeTopic();
        if (me) {
            // Messages from the current user are considered to be read already.
            me.setMsgReadRecv(
                this.name,
                (!data.from || this.tinode.isMe(data.from)) ? 'read' : 'msg',
                data.seq, data.ts
            );
        }
    }

    /**
     * Process metadata message
     */
    routeMeta(meta: any) {
        if (meta.desc) {
            this.lastDescUpdate = meta.ts;
            this.processMetaDesc(meta.desc);
        }
        if (meta.sub && meta.sub.length > 0) {
            this.lastSubsUpdate = meta.ts;
            this.processMetaSub(meta.sub);
        }
        if (meta.del) {
            this.processDelMessages(meta.del.clear, meta.del.delseq);
        }
        if (meta.tags) {
            this.processMetaTags(meta.tags);
        }
        if (meta.cred) {
            this.processMetaCreds(meta.cred);
        }
        this.onMeta.next(meta);
    }

    /**
     * Process presence change message
     * TODO determine input value type
     */
    routePres(pres: any) {
        let user: any;
        switch (pres.what) {
            case 'del':
                // Delete cached messages.
                this.processDelMessages(pres.clear, pres.delseq);
                break;
            case 'on':
            case 'off':
                // Update online status of a subscription.
                user = this.users[pres.src];
                if (user) {
                    user.online = pres.what === 'on';
                } else {
                    this.tinode.logger('WARNING: Presence update for an unknown user', this.name, pres.src);
                }
                break;
            case 'term':
                // Attachment to topic is terminated probably due to cluster rehashing.
                this.resetSub();
                break;
            case 'acs':
                const uid = pres.src || this.tinode.getCurrentUserID();
                user = this.users[uid];
                if (!user) {
                    // Update for an unknown user: notification of a new subscription.
                    const acs = new AccessMode().updateAll(pres.dacs);
                    if (acs && acs.mode !== AccessModeFlags.NONE) {
                        user = this.cacheGetUser(uid);
                        if (!user) {
                            user = {
                                user: uid,
                                acs,
                            };
                            this.getMeta(this.startMetaQuery().withOneSub(undefined, uid).build());
                        } else {
                            user.acs = acs;
                        }
                        user.updated = new Date();
                        this.processMetaSub([user]);
                    }
                } else {
                    // Known user
                    user.acs.updateAll(pres.dacs);
                    // Update user's access mode.
                    this.processMetaSub([{
                        user: uid,
                        updated: new Date(),
                        acs: user.acs
                    }]);
                }
                break;
            default:
                this.tinode.logger('INFO: Ignored presence update', pres.what);
        }

        this.onPres.next(pres);
    }

    /**
     * Process {info} message
     * TODO determine input value type
     */
    routeInfo(info: any) {
        if (info.what !== 'kp') {
            const user = this.users[info.from];
            if (user) {
                user[info.what] = info.seq;
                if (user.recv < user.read) {
                    user.recv = user.read;
                }
            }

            // If this is an update from the current user, update the contact with the new count too.
            if (this.tinode.isMe(info.from)) {
                const me = this.tinode.getMeTopic();
                if (me) {
                    me.setMsgReadRecv(info.topic, info.what, info.seq);
                }
            }
        }

        this.onInfo.next(info);
    }

    /**
     * Called by Tinode when meta.desc packet is received.
     * Called by 'me' topic on contact update (desc.noForwarding is true).
     * @param desc - Desc packet
     */
    processMetaDesc(desc: SetDesc) {
        // Synthetic desc may include defacs for p2p topics which is useless.
        // Remove it.
        if (this.getType() === 'p2p') {
            delete desc.defacs;
        }

        // Copy parameters from desc object to this topic.
        Utilities.mergeObj(this, desc);
        // Make sure date fields are Date().
        Utilities.stringToDate(this);

        // Update relevant contact in the me topic, if available:
        if (this.name !== TopicNames.TOPIC_ME && !desc.noForwarding) {
            const me = this.tinode.getMeTopic();
            if (me) {
                // Must use original 'desc' instead of 'this' so not to lose DEL_CHAR.
                me.processMetaSub([{
                    noForwarding: true,
                    topic: this.name,
                    updated: this.updated,
                    touched: this.touched,
                    acs: desc.acs,
                    seq: desc.seq,
                    read: desc.read,
                    recv: desc.recv,
                    public: desc.public,
                    private: desc.private
                }]);
            }
        }

        this.onMetaDesc.next(this);
    }

    /**
     * Called by Tinode when meta.sub is received or in response to received
     * {ctrl} after setMeta-sub.
     * @param subs Subscriptions
     */
    processMetaSub(subs: SetSub[]) {
        for (const idx in subs) {
            if (idx) {
                const sub = subs[idx];

                sub.updated = new Date(sub.updated);
                sub.deleted = sub.deleted ? new Date(sub.deleted) : null;

                let user = null;
                if (!sub.deleted) {
                    // If this is a change to user's own permissions, update them in topic too.
                    // Desc will update 'me' topic.
                    if (this.tinode.isMe(sub.user) && sub.acs) {
                        this.processMetaDesc({
                            updated: sub.updated || new Date(),
                            touched: sub.updated,
                            acs: sub.acs
                        });
                    }
                    user = this.updateCachedUser(sub.user, sub);
                } else {
                    // Subscription is deleted, remove it from topic (but leave in Users cache)
                    delete this.users[sub.user];
                    user = sub;
                }

                this.onMetaSub.next(user);
            }
        }

        if (this.onSubsUpdated) {
            this.onSubsUpdated.next(Object.keys(this.users));
        }
    }

    // Called by Tinode when meta.tags is received.
    processMetaTags(tags: any) {
        if (tags.length === 1 && tags[0] === DEL_CHAR) {
            tags = [];
        }
        this.tags = tags;
        this.onTagsUpdated.next(tags);
    }

    /**
     * Delete cached messages and update cached transaction IDs
     */
    processDelMessages(clear: any, delseq: any) {
        this.maxDel = Math.max(clear, this.maxDel);
        this.clear = Math.max(clear, this.clear);
        const topic = this;
        let count = 0;
        if (Array.isArray(delseq)) {
            delseq.forEach((range) => {
                if (!range.hi) {
                    count++;
                    topic.flushMessage(range.low);
                } else {
                    for (let i = range.low; i < range.hi; i++) {
                        count++;
                        topic.flushMessage(i);
                    }
                }
            });
        }

        if (count > 0) {
            this.updateDeletedRanges();
            this.onData.next();
        }
    }

    /**
     * Topic is informed that the entire response to {get what=data} has been received.
     * @param count - Messages count
     */
    allMessagesReceived(count: any) {
        this.updateDeletedRanges();
        this.onAllMessagesReceived.next(count);
    }

    /**
     * Reset subscribed state
     */
    resetSub(): void {
        this.subscribed = false;
    }

    /**
     * This topic is either deleted or unsubscribed from.
     */
    gone() {
        this.messages.reset();
        this.users = {};
        this.acs = new AccessMode(null);
        this.private = null;
        this.public = null;
        this.maxSeq = 0;
        this.minSeq = 0;
        this.subscribed = false;

        const me = this.tinode.getMeTopic();
        if (me) {
            me.routePres({
                noForwarding: true,
                what: 'gone',
                topic: TopicNames.TOPIC_ME,
                src: this.name
            });
        }
        this.onDeleteTopic.next();
    }

    /**
     * Update global user cache and local subscribers cache.
     * Don't call this method for non-subscribers.
     * @param userId - user id
     * @param obj - user object
     */
    updateCachedUser(userId: string, obj: any) {
        // Fetch user object from the global cache.
        // This is a clone of the stored object
        let cached = this.cacheGetUser(userId);
        cached = Utilities.mergeObj(cached || {}, obj);
        // Save to global cache
        this.cachePutUser(userId, cached);
        // Save to the list of topic subscribers.
        return Utilities.mergeToCache(this.users, userId, cached);
    }

    /**
     * Get local seqId for a queued message.
     */
    getQueuedSeqId(): number {
        return this.queuedSeqId++;
    }

    /**
     * Calculate ranges of missing messages.
     */
    private updateDeletedRanges(): void {
        const ranges = [];

        let prev = null;
        // Check for gap in the beginning, before the first message.
        const first = this.messages.getAt(0);
        if (first && this.minSeq > 1 && !this.noEarlierMsgs) {
            // Some messages are missing in the beginning.
            if (first.hi) {
                // The first message already represents a gap.
                if (first.seq > 1) {
                    first.seq = 1;
                }
                if (first.hi < this.minSeq - 1) {
                    first.hi = this.minSeq - 1;
                }
                prev = first;
            } else {
                // Create new gap.
                prev = {
                    seq: 1,
                    hi: this.minSeq - 1
                };
                ranges.push(prev);
            }
        } else {
            // No gap in the beginning.
            prev = {
                seq: 0,
                hi: 0
            };
        }

        /**
         * Find gaps in the list of received messages. The list contains messages-proper as well  as placeholders
         * for deleted ranges. The messages are iterated by seq ID in ascending order.
         */
        this.messages.forEach((data) => {
            // Do not create a gap between the last sent message and the first unsent.
            if (data.seq >= AppSettings.LOCAL_SEQ_ID) {
                return;
            }

            // New message is reducing the existing gap
            if (data.seq === (prev.hi || prev.seq) + 1) {
                // No new gap. Replace previous with current.
                prev = data;
                return;
            }

            // Found a new gap.
            if (prev.hi) {
                // Previous is also a gap, alter it.
                prev.hi = data.hi || data.seq;
                return;
            }

            // Previous is not a gap. Create a new gap.
            prev = {
                seq: (prev.hi || prev.seq) + 1,
                hi: data.hi || data.seq
            };
            ranges.push(prev);
        });

        // Check for missing messages at the end.
        // All messages could be missing or it could be a new topic with no messages.
        const last = this.messages.getLast();
        const maxSeq = Math.max(this.seq, this.maxSeq) || 0;
        if ((maxSeq > 0 && !last) || (last && ((last.hi || last.seq) < maxSeq))) {
            if (last && last.hi) {
                // Extend existing gap
                last.hi = maxSeq;
            } else {
                // Create new gap.
                ranges.push({
                    seq: last ? last.seq + 1 : 1,
                    hi: maxSeq
                });
            }
        }

        // Insert new gaps into cache.
        ranges.forEach((gap) => {
            this.messages.put(gap);
        });
    }
}
