import { isP2PTopicName, mergeObj, mergeToCache, stringToDate } from '../utilities';
import { TopicNames } from '../constants';
import { Tinode } from '../tinode';
import { Topic } from './topic';
import { Subject } from 'rxjs';

export interface ContactUpdateData {
    status: any;
    contact: any;
}

export class TopicMe extends Topic {
    // List of contacts
    contacts: any = {};

    // Events
    onContactUpdate = new Subject<ContactUpdateData>();

    constructor(tinode: Tinode) {
        super(TopicNames.TOPIC_ME, tinode);
        this.contacts = {};
    }

    getContact(a: any): any {
        return {
            online: false,
        };
    }

    // Override the original Topic.processMetaDesc
    processMetaDesc(desc: any) {
        // Check if online contacts need to be turned off because P permission was removed.
        const turnOff = (desc.acs && !desc.acs.isPresencer()) && (this.acs && this.acs.isPresencer());

        // Copy parameters from desc object to this topic.
        mergeObj(this, desc);
        // String date-time headers to Date() objects.
        stringToDate(this);

        // 'P' permission was removed. All topics are offline now.
        if (turnOff) {
            for (const key in this.contacts) {
                if (Object.prototype.hasOwnProperty.call(this.contacts, key)) {
                    const cont = this.contacts[key];
                    if (cont.online) {
                        cont.online = false;
                        if (cont.seen) {
                            cont.seen.when = new Date();
                        } else {
                            cont.seen = {
                                when: new Date()
                            };
                        }
                        this.onContactUpdate.next();
                        if (this.onContactUpdate) {
                            this.onContactUpdate.next({
                                status: 'off',
                                contact: cont,
                            });
                        }
                    }
                }
            }
        }

        this.onMetaDesc.next(this);
    }

    processMetaSub(subs: any) {
        for (const key in subs) {
            if (Object.prototype.hasOwnProperty.call(subs, key)) {
                const sub = subs[key];
                const topicName = sub.topic;

                // Don't show 'me' and 'fnd' topics in the list of contacts.
                if (topicName === TopicNames.TOPIC_FND || topicName === TopicNames.TOPIC_ME) {
                    continue;
                }

                sub.updated = new Date(sub.updated);
                sub.touched = sub.touched ? new Date(sub.touched) : undefined;
                sub.deleted = sub.deleted ? new Date(sub.deleted) : null;

                let cont = null;
                if (sub.deleted) {
                    cont = sub;
                    delete this.contacts[topicName];
                } else {
                    // Ensure the values are defined and are integers.
                    if (typeof sub.seq !== 'undefined') {
                        sub.seq = sub.seq | 0;
                        sub.recv = sub.recv | 0;
                        sub.read = sub.read | 0;
                        sub.unread = sub.seq - sub.read;
                    }

                    if (sub.seen && sub.seen.when) {
                        sub.seen.when = new Date(sub.seen.when);
                    }
                    cont = mergeToCache(this.contacts, topicName, sub);

                    if (isP2PTopicName(topicName)) {
                        this.cachePutUser(topicName, cont);
                    }

                    // Notify topic of the update if it's an external update.
                    if (!sub.noForwarding) {
                        const topic = this.tinode.getTopic(topicName);
                        if (topic) {
                            sub._noForwarding = true;
                            topic._processMetaDesc(sub);
                        }
                    }
                }

                this.onMetaSub.next(cont);
                this.onSubsUpdated.next(Object.keys(this.contacts));
            }
        }
    }

    setMsgReadRecv(contactName, what, seq, ts?) { }
    getMsgReadRecv(a, b): number { return 0; }
    routePres(a) { }
}
