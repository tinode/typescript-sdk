import { Tinode } from './tinode';
import { Topic } from './topic';

/**
 * Helper class for constructing GetQuery
 */
export class MetaGetBuilder {
    tinode: Tinode;
    contact: any;
    topic: Topic;
    what: any;

    constructor(tinode: Tinode, topic: Topic) {
        this.tinode = tinode;
        const me = tinode.getMeTopic();
        this.contact = me && me.getContact(topic.name);
        this.topic = topic;
        this.what = {};
    }

    /**
     * Get latest timestamp
     */
    private getIms() {
        const cupd = this.contact && this.contact.updated;
        const tupd = this.topic.lastDescUpdate || 0;
        return cupd > tupd ? cupd : tupd;
    }

    /**
     * Add query parameters to fetch messages within explicit limits
     * @param since - messages newer than this (inclusive);
     * @param before - older than this (exclusive)
     * @param limit - number of messages to fetch
     */
    withData(since?: number, before?: number, limit?: number): MetaGetBuilder {
        this.what.data = {
            since,
            before,
            limit,
        };
        return this;
    }

    /**
     * Add query parameters to fetch messages newer than the latest saved message.
     * @param limit - number of messages to fetch
     */
    withLaterData(limit?: number): MetaGetBuilder {
        return this.withData(this.topic.maxSeq > 0 ? this.topic.maxSeq + 1 : undefined, undefined, limit);
    }

    /**
     * Add query parameters to fetch messages older than the earliest saved message.
     * @param limit - maximum number of messages to fetch
     */
    withEarlierData(limit?: number): MetaGetBuilder {
        return this.withData(undefined, this.topic.minSeq > 0 ? this.topic.minSeq : undefined, limit);
    }

    /**
     * Add query parameters to fetch topic description if it's newer than the given timestamp.
     * @param ims - fetch messages newer than this timestamp
     */
    withDesc(ims: Date): MetaGetBuilder {
        this.what.desc = { ims };
        return this;
    }

    /**
     * Add query parameters to fetch topic description if it's newer than the last update.
     */
    withLaterDesc(): MetaGetBuilder {
        return this.withDesc(this.getIms());
    }

    /**
     * Add query parameters to fetch subscriptions
     * @param ims - fetch subscriptions modified more recently than this timestamp
     * @param limit - maximum number of subscriptions to fetch
     * @param userOrTopic - user ID or topic name to fetch for fetching one subscription
     */
    withSub(ims?: Date, limit?: number, userOrTopic?: string): MetaGetBuilder {
        const opts: any = { ims, limit };
        if (this.topic.getType() === 'me') {
            opts.topic = userOrTopic;
        } else {
            opts.user = userOrTopic;
        }
        this.what.sub = opts;
        return this;
    }

    /**
     * Add query parameters to fetch a single subscription
     * @param ims - fetch subscriptions modified more recently than this timestamp
     * @param userOrTopic - user ID or topic name to fetch for fetching one subscription
     */
    withOneSub(ims?: Date, userOrTopic?: string): MetaGetBuilder {
        return this.withSub(ims, undefined, userOrTopic);
    }

    /**
     * Add query parameters to fetch a single subscription if it's been updated since the last update
     * @param userOrTopic - user ID or topic name to fetch for fetching one subscription.
     */
    withLaterOneSub(userOrTopic?: string): MetaGetBuilder {
        return this.withOneSub(this.topic.lastSubsUpdate, userOrTopic);
    }

    /**
     * Add query parameters to fetch subscriptions updated since the last update
     * @param limit - maximum number of subscriptions to fetch
     */
    withLaterSub(limit?: number): MetaGetBuilder {
        return this.withSub(this.topic.getType() === 'p2p' ? this.getIms() : this.topic.lastSubsUpdate, limit);
    }

    /**
     * Add query parameters to fetch topic tags
     */
    withTags(): MetaGetBuilder {
        this.what.tags = true;
        return this;
    }

    /**
     * Add query parameters to fetch user's credentials. 'me' topic only
     */
    withCred(): MetaGetBuilder {
        if (this.topic.getType() === 'me') {
            this.what.cred = true;
        } else {
            this.tinode.logger('ERROR: Invalid topic type for MetaGetBuilder:withCreds', this.topic.getType());
        }
        return this;
    }
}
