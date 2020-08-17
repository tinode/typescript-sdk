import { AccessMode } from '../access-mode';
import { AppSettings } from '../constants';
import { CBuffer } from '../cbuffer';
import { Tinode } from '../tinode';

export class Topic {
    /**
     * Topic name
     */
    name: string;
    /**
     * Parent Tinode object
     */
    private tinode: Tinode;
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
     * Access mode, see AccessMode
     */
    private acs = new AccessMode(null);
    /**
     * per-topic private data
     */
    private: any = null;
    /**
     * per-topic public data
     */
    public: any = null;
    /**
     * Locally cached data
     * Subscribed users, for tracking read/recv/msg notifications.
     */
    private users: any = {};
    /**
     * Current value of locally issued seqId, used for pending messages.
     */
    private queuedSeqId = AppSettings.LOCAL_SEQ_ID;
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
     * Indicator that the last request for earlier messages returned 0.
     */
    private noEarlierMsgs = false;
    /**
     * User discovery tags
     */
    private tags = [];
    /**
     * Credentials such as email or phone number
     */
    private credentials = [];
    /**
     * Message cache, sorted by message seq values, from old to new.
     */
    private messages = new CBuffer((a, b) => {
        return a.seq - b.seq;
    }, true);
    /**
     * Boolean, true if the topic is currently live
     */
    private subscribed = false;
    /**
     * Timestamp when topic meta-desc update was received.
     */
    lastDescUpdate: any;
    /**
     * Timestamp when topic meta-subs update was received.
     */
    lastSubsUpdate: any;
    /**
     * Topic created but not yet synced with the server. Used only during initialization.
     */
    private new = true;
    constructor(a?: any) { }

    getType(): string {
        return '';
    }
}
