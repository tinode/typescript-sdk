import { AppInfo } from '../constants';

export interface HiPacketData {
    /**
     * Message Id
     */
    id: string;
    /**
     * Version
     */
    ver: AppInfo.VERSION;
    /**
     * User Agent
     */
    ua: string;
    /**
     * Device Token
     */
    dev: string;
    /**
     * Language
     */
    lang: string;
    /**
     * Platform
     */
    platf: string;
}

export interface AccPacketData {
    /**
     * Message Id
     */
    id: string;
    user: string;
    scheme: string;
    secret: string;
    login: boolean;
    tags: string[];
    desc: any;
    cred: any;
}

export interface LoginPacketData {
    /**
     * Message Id
     */
    id: string;
    scheme: string;
    secret: string;
}

export interface SubPacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    set: any;
    get: any;
}

export interface LeavePacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    unsub: boolean;
}

export interface PubPacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    noecho: boolean;
    head: null;
    content: any;
}

export interface GetPacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    what: string;
    desc: any;
    sub: any;
    data: any;
}

export interface SetPacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    desc: any;
    sub: any;
    tags: string[];
}

export interface DelPacketData {
    /**
     * Message Id
     */
    id: string;
    topic: string;
    what: string;
    delseq: any;
    user: any;
    hard: boolean;
}

export interface NotePacketData {
    topic: string;
    what: string;
    seq: any;
}
