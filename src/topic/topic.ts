import { PubPacketData } from '../models/packet-data';
import { AccessMode } from '../access-mode';
import { AppSettings } from '../constants';
import { Packet } from '../models/packet';
import { CBuffer } from '../cbuffer';
import { Tinode } from '../tinode';
import { Subject } from 'rxjs';
import { Drafty } from '../drafty';

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
    private tinode: Tinode;
    /**
     * Locally cached data
     * Subscribed users, for tracking read/recv/msg notifications.
     */
    private users: any = {};
    /**
     * Credentials such as email or phone number
     */
    private credentials = [];
    /**
     * Boolean, true if the topic is currently live
     */
    private subscribed = false;
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
    private acs = new AccessMode(null);
    /**
     * Current value of locally issued seqId, used for pending messages.
     */
    private queuedSeqId = AppSettings.LOCAL_SEQ_ID;
    /**
     * Message cache, sorted by message seq values, from old to new.
     */
    private messages = new CBuffer((a, b) => {
        return a.seq - b.seq;
    }, true);
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

    // Topic events
    onData = new Subject<any>();
    onMeta = new Subject<any>();
    onPres = new Subject<any>();
    onInfo = new Subject<any>();
    onMetaSub = new Subject<any>(); // A single subscription record;
    onMetaDesc = new Subject<any>(); // A single desc update;
    onSubsUpdated = new Subject<any>(); // All subscription records received;
    onTagsUpdated = new Subject<any>();
    onCredsUpdated = new Subject<any>();
    onDeleteTopic = new Subject<any>();
    onAllMessagesReceived = new Subject<any>();

    constructor(name: string, tinode: Tinode) {
        this.name = name;
        this.tinode = tinode;
    }

    /**
     * Check if the topic is subscribed.
     */
    isSubscribed(): boolean {
        return this.subscribed;
    }

    /**
     * Create a draft of a message without sending it to the server.
     * @param data - Content to wrap in a draft.
     * @param noEcho - If true server will not echo message back to originating
     */
    createMessage(data: any, noEcho: boolean): Packet<PubPacketData> {
        return this.tinode.createMessage(this.name, data, noEcho);
    }

    /**
     * Update message's seqId.
     * @param pub - message packet.
     * @param newSeqId - new seq id for pub.
     */
    swapMessageId(pub: Packet<PubPacketData>, newSeqId: number) {
        const idx = this.messages.find({
            seq: pub.data.seq
        }, true);
        const numMessages = this.messages.length();
        pub.data.seq = newSeqId;
        if (0 <= idx && idx < numMessages) {
            // this.messages are sorted by `seq`.
            // If changing pub.seq to newSeqId breaks the invariant, fix it.
            // FIXME: Operator '<=' cannot be applied to types 'boolean' and 'number'.
            // if ((idx > 0 && this.messages.getAt(idx - 1).seq >= newSeqId) ||
            //     (idx + 1 < numMessages && newSeqId < this.messages.getAt(idx + 1).seq <= newSeqId)) {
            //     this.messages.delAt(idx);
            //     this.messages.put(pub);
            // }
        }
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
    async publishMessage(pub: Packet<PubPacketData>): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot publish on inactive topic'));
        }

        // Update header with attachment records.
        if (Drafty.hasAttachments(pub.data.content) && !pub.data.head.attachments) {
            const attachments = [];
            Drafty.attachments(pub.data.content, (data: any) => {
                attachments.push(data.ref);
            });
            pub.data.head.attachments = attachments;
        }

        pub.sending = true;
        pub.failed = false;

        try {
            const ctrl = await this.tinode.publishMessage(pub);
            pub.sending = false;
            pub.data.ts = ctrl.ts;
            this.swapMessageId(pub, ctrl.params.seq);
            this.routeData(pub);
            return ctrl;
        } catch (err) {
            this.tinode.logger('WARNING: Message rejected by the server', err);
            pub.sending = false;
            pub.failed = true;
            this.onData.next();
        }
    }

    getType(): string {
        return '';
    }

    subscribe() { }

    routeData(a: Packet<PubPacketData>) { }
}
