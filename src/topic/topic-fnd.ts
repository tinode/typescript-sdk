import { mergeToCache } from '../utilities';
import { TopicNames } from '../constants';
import { Tinode } from '../tinode';
import { Topic } from './topic';
import { SetParams } from '../models/set-params';

export class TopicFnd extends Topic {
    // List of contacts
    contacts: any = {};

    constructor(tinode: Tinode) {
        super(TopicNames.TOPIC_FND, tinode);
    }

    processMetaSub(subs: any[]) {
        let updateCount = Object.getOwnPropertyNames(this.contacts).length;
        // Reset contact list.
        this.contacts = {};
        for (const idx in subs) {
            if (Object.prototype.hasOwnProperty.call(subs, idx)) {
                let sub = subs[idx];
                const indexBy = sub.topic ? sub.topic : sub.user;

                sub.updated = new Date(sub.updated);
                if (sub.seen && sub.seen.when) {
                    sub.seen.when = new Date(sub.seen.when);
                }

                sub = mergeToCache(this.contacts, indexBy, sub);
                updateCount++;

                if (this.onMetaSub) {
                    this.onMetaSub.next(sub);
                }
            }
        }

        if (updateCount > 0 && this.onSubsUpdated) {
            this.onSubsUpdated.next(this.contacts);
        }
    }

    publish() {
        return Promise.reject(new Error('Publishing to "fnd" is not supported'));
    }

    setMeta(params: SetParams) {
        return Object.getPrototypeOf(TopicFnd.prototype).setMeta.call(this, params).then(() => {
            if (Object.keys(this.contacts).length > 0) {
                this.contacts = {};
                this.onSubsUpdated.next([]);
            }
        });
    }

    getContacts() {
        return this.contacts;
    }
}
