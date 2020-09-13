import { Packet, PacketTypes } from './models/packet';
import { PubPacketData } from './models/packet-data';
import { MessageStatus } from './constants';
import { initPacket } from './utilities';
import { Drafty } from './drafty';
import { Subject } from 'rxjs';

export class Message {
    /**
     * UTC timestamp
     */
    ts: Date;
    /**
     * Sender's topic name
     */
    from: string;
    /**
     * Locally assigned message ID
     */
    seq: number;
    /**
     * Message payload, might be a string or drafty
     */
    content: any;
    /**
     * If true, tell the server to echo the message to the original session.
     */
    echo: boolean;
    /**
     * Name of the topic that this message is for
     */
    topicName: string;
    /**
     * Current message status
     */
    status: MessageStatus;
    noForwarding: boolean;
    cancelled: boolean;

    // Events
    onStatusChange = new Subject<MessageStatus>();

    constructor(topicName: string, data: any, echo: boolean = true) {
        this.echo = echo;
        this.content = data;
        this.topicName = topicName;
        this.status = MessageStatus.NONE;
    }

    /**
     * Create a pub packet using this message data
     */
    getPubPacket(): Packet<PubPacketData> {
        const pkt: Packet<PubPacketData> = initPacket(PacketTypes.Pub, this.topicName);
        const dft = typeof this.content === 'string' ? Drafty.parse(this.content) : this.content;
        pkt.data.content = this.content;
        pkt.data.noecho = !this.echo;

        if (dft && !Drafty.isPlainText(dft)) {
            pkt.data.head = {
                mime: Drafty.getContentType()
            };
            pkt.data.content = dft;

            // Update header with attachment records.
            if (Drafty.hasAttachments(pkt.data.content) && !pkt.data.head.attachments) {
                const attachments = [];
                Drafty.attachments(pkt.data.content, (data: any) => {
                    attachments.push(data.ref);
                });
                pkt.data.head.attachments = attachments;
            }
        }

        return pkt;
    }

    /**
     * Set message status
     * @param status new status
     */
    setStatus(status: MessageStatus) {
        this.status = status;
        this.onStatusChange.next(status);
    }

    /**
     * Simple getter for message status
     */
    getStatus(): MessageStatus {
        return this.status;
    }

    /**
     * Reset locally assigned values
     */
    resetLocalValues() {
        this.seq = undefined;
        this.from = undefined;
        this.ts = undefined;
    }
}
