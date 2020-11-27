import { AccessModeFlags, DEL_CHAR, TopicNames } from '../constants';
import { Credential } from '../models/credential';
import { AccessMode } from '../access-mode';
import { Utilities } from '../utilities';
import { Tinode } from '../tinode';
import { Topic } from './topic';
import { Subject } from 'rxjs';

export interface ContactUpdateData {
    what: any;
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

    // Override the original Topic.processMetaDesc
    processMetaDesc(desc: any) {
        // Check if online contacts need to be turned off because P permission was removed.
        const turnOff = (desc.acs && !desc.acs.isPresencer()) && (this.acs && this.acs.isPresencer());

        // Copy parameters from desc object to this topic.
        Utilities.mergeObj(this, desc);
        // String date-time headers to Date() objects.
        Utilities.stringToDate(this);

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
                                what: 'off',
                                contact: cont,
                            });
                        }
                    }
                }
            }
        }

        this.onMetaDesc.next(this);
    }

    // Override the original Topic.processMetaSub
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
                    cont = Utilities.mergeToCache(this.contacts, topicName, sub);

                    if (Utilities.isP2PTopicName(topicName)) {
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

    /**
     * Called by Tinode when meta.sub is received.
     */
    processMetaCreds = (creds: any[], upd: boolean) => {
        if (creds.length === 1 && creds[0] === DEL_CHAR) {
            creds = [];
        }
        if (upd) {
            creds.forEach((cr) => {
                if (cr.val) {
                    // Adding a credential.
                    let idx = this.credentials.findIndex((el) => {
                        return el.meth === cr.meth && el.val === cr.val;
                    });
                    if (idx < 0) {
                        // Not found.
                        if (!cr.done) {
                            // Unconfirmed credential replaces previous unconfirmed credential of the same method.
                            idx = this.credentials.findIndex((el) => {
                                return el.meth === cr.meth && !el.done;
                            });
                            if (idx >= 0) {
                                // Remove previous unconfirmed credential.
                                this.credentials.splice(idx, 1);
                            }
                        }
                        this.credentials.push(cr);
                    } else {
                        // Found. Maybe change 'done' status.
                        this.credentials[idx].done = cr.done;
                    }
                } else if (cr.resp) {
                    // Handle credential confirmation.
                    const idx = this.credentials.findIndex((el) => {
                        return el.meth === cr.meth && !el.done;
                    });
                    if (idx >= 0) {
                        this.credentials[idx].done = true;
                    }
                }
            });
        } else {
            this.credentials = creds;
        }
        this.onCredsUpdated.next(this.credentials);
    }

    routePres(pres: any) {
        if (pres.what === 'term') {
            // The 'me' topic itself is detached. Mark as unsubscribed.
            this.resetSub();
            return;
        }

        if (pres.what === 'upd' && pres.src === TopicNames.TOPIC_ME) {
            // Update to me description. Request updated value.
            this.getMeta(this.startMetaQuery().withDesc().build());
            return;
        }

        const cont = this.contacts[pres.src];
        if (cont) {
            switch (pres.what) {
                case 'on': // topic came online
                    cont.online = true;
                    break;
                case 'off': // topic went offline
                    if (cont.online) {
                        cont.online = false;
                        if (cont.seen) {
                            cont.seen.when = new Date();
                        } else {
                            cont.seen = {
                                when: new Date()
                            };
                        }
                    }
                    break;
                case 'msg': // new message received
                    cont.touched = new Date();
                    cont.seq = pres.seq | 0;
                    // Check if message is sent by the current user. If so it's been read already.
                    if (!pres.act || this.tinode.isMe(pres.act)) {
                        cont.read = cont.read ? Math.max(cont.read, cont.seq) : cont.seq;
                        cont.recv = cont.recv ? Math.max(cont.read, cont.recv) : cont.recv;
                    }
                    cont.unread = cont.seq - cont.read;
                    break;
                case 'upd': // desc updated
                    // Request updated subscription.
                    this.getMeta(this.startMetaQuery().withLaterOneSub(pres.src).build());
                    break;
                case 'acs': // access mode changed
                    if (cont.acs) {
                        cont.acs.updateAll(pres.dacs);
                    } else {
                        cont.acs = new AccessMode().updateAll(pres.dacs);
                    }
                    cont.touched = new Date();
                    break;
                case 'ua': // user agent changed
                    cont.seen = {
                        when: new Date(),
                        ua: pres.ua
                    };
                    break;
                case 'recv': // user's other session marked some messages as received
                    pres.seq = pres.seq | 0;
                    cont.recv = cont.recv ? Math.max(cont.recv, pres.seq) : pres.seq;
                    break;
                case 'read': // user's other session marked some messages as read
                    pres.seq = pres.seq | 0;
                    cont.read = cont.read ? Math.max(cont.read, pres.seq) : pres.seq;
                    cont.recv = cont.recv ? Math.max(cont.read, cont.recv) : cont.recv;
                    cont.unread = cont.seq - cont.read;
                    break;
                case 'gone': // topic deleted or unsubscribed from
                    delete this.contacts[pres.src];
                    break;
                case 'del':
                    // Update topic.del value.
                    break;
                default:
                    this.tinode.logger('INFO: Unsupported presence update in "me"', pres.what);
            }

            this.onContactUpdate.next({
                what: pres.what,
                contact: cont,
            });
        } else {
            if (pres.what === 'acs') {
                // New subscriptions and deleted/banned subscriptions have full
                // access mode (no + or - in the dacs string). Changes to known subscriptions are sent as
                // deltas, but they should not happen here.
                const acs = new AccessMode(pres.dacs);
                if (!acs || acs.mode === AccessModeFlags.INVALID) {
                    this.tinode.logger('ERROR: Invalid access mode update', pres.src, pres.dacs);
                    return;
                } else if (acs.mode === AccessModeFlags.NONE) {
                    this.tinode.logger('WARNING: Removing non-existent subscription', pres.src, pres.dacs);
                    return;
                } else {
                    // New subscription. Send request for the full description.
                    // Using .withOneSub (not .withLaterOneSub) to make sure IfModifiedSince is not set.
                    this.getMeta(this.startMetaQuery().withOneSub(undefined, pres.src).build());
                    // Create a dummy entry to catch online status update.
                    this.contacts[pres.src] = {
                        touched: new Date(),
                        topic: pres.src,
                        online: false,
                        acs,
                    };
                }
            } else if (pres.what === 'tags') {
                this.getMeta(this.startMetaQuery().withTags().build());
            }
        }

        this.onPres.next(pres);
    }

    publish(): Promise<any> {
        return Promise.reject(new Error('Publishing to "me" is not supported'));
    }

    async delCredential(method: string, value: string): Promise<any> {
        if (!this.subscribed) {
            return Promise.reject(new Error('Cannot delete credential in inactive "me" topic'));
        }
        // Send {del} message, return promise
        const ctrl = this.tinode.delCredential(method, value);
        const index = this.credentials.findIndex((el) => {
            return el.meth === method && el.val === value;
        });
        if (index > -1) {
            this.credentials.splice(index, 1);
        }
        // Notify listeners
        this.onCredsUpdated.next(this.credentials);
        return ctrl;
    }

    getContacts() {
        return this.contacts;
    }

    /**
     * Update a cached contact with new read/received/message count.
     * @param contactName - UID of contact to update.
     * @param what - Which count to update, one of <tt>"read", "recv", "msg"</tt>
     * @param seq - New value of the count.
     * @param ts - Timestamp of the update.
     */
    setMsgReadRecv(contactName: string, what: string, seq: number, ts?: Date): void {
        const cont = this.contacts[contactName];
        let oldVal = false;
        let doUpdate = false;
        if (cont) {
            seq = seq | 0;
            cont.seq = cont.seq | 0;
            cont.read = cont.read | 0;
            cont.recv = cont.recv | 0;
            switch (what) {
                case 'recv':
                    oldVal = cont.recv;
                    cont.recv = Math.max(cont.recv, seq);
                    doUpdate = (oldVal !== cont.recv);
                    break;
                case 'read':
                    oldVal = cont.read;
                    cont.read = Math.max(cont.read, seq);
                    doUpdate = (oldVal !== cont.read);
                    break;
                case 'msg':
                    oldVal = cont.seq;
                    cont.seq = Math.max(cont.seq, seq);
                    if (!cont.touched || cont.touched < ts) {
                        cont.touched = ts;
                    }
                    doUpdate = (oldVal !== cont.seq);
                    break;
            }

            // Sanity checks.
            if (cont.recv < cont.read) {
                cont.recv = cont.read;
                doUpdate = true;
            }
            if (cont.seq < cont.recv) {
                cont.seq = cont.recv;
                if (!cont.touched || cont.touched < ts) {
                    cont.touched = ts;
                }
                doUpdate = true;
            }
            cont.unread = cont.seq - cont.read;

            if (doUpdate && (!cont.acs || !cont.acs.isMuted())) {
                this.onContactUpdate.next({
                    what,
                    contact: cont,
                });
            }
        }
    }

    /**
     * Get cached read/received/message count for the given contact.
     * @param contactName - UID of contact to read.
     * @param what - Which count to read, one of <tt>"read", "recv", "msg"</tt>
     */
    getMsgReadRecv(contactName: string, what: string): number {
        const cont = this.contacts[contactName];
        if (cont) {
            switch (what) {
                case 'recv':
                    return cont.recv | 0;
                case 'read':
                    return cont.read | 0;
                case 'msg':
                    return cont.seq | 0;
            }
        }
        return 0;
    }

    /**
     * Get a contact from cache.
     * @param name - Name of the contact to get, either a UID (for p2p topics) or a topic name.
     */
    getContact(name: string) {
        return this.contacts[name];
    }

    /**
     * Get access mode of a given contact from cache.
     */
    getAccessMode(): AccessMode {
        if (name) {
            const cont = this.contacts[name];
            return cont ? cont.acs : null;
        }
        return this.acs;
    }

    /**
     * Check if contact is archived, i.e. contact.private.arch == true.
     * @param name - Name of the contact to check archived status, either a UID (for p2p topics) or a topic name.
     */
    isContactArchived(name: string): boolean {
        const cont = this.contacts[name];
        return cont ? ((cont.private && cont.private.arch) ? true : false) : null;
    }

    /**
     * Get the user's credentials: email, phone, etc.
     */
    getCredentials(): Credential[] {
        return this.credentials;
    }
}
