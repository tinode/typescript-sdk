import { AuthenticationScheme } from './auth-scheme';
import { AppInfo } from '../constants';

export interface HiPacketData {
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
    user: string;
    scheme: AuthenticationScheme;
    secret: string;
    login: boolean;
    tags: string[];
    desc: any;
    cred: any;
    token: string;
}

export interface LoginPacketData {
    scheme: string;
    secret: string;
    cred: any;
}

export interface SubPacketData {
    topic: string;
    set: any;
    get: any;
}

export interface LeavePacketData {
    topic: string;
    unsub: boolean;
}

export interface PubPacketData {
    topic: string;
    noecho: boolean;
    head: null;
    content: any;
}

export interface GetPacketData {
    topic: string;
    what: string;
    desc: any;
    sub: any;
    data: any;
}

export interface SetPacketData {
    topic: string;
    desc: any;
    sub: any;
    tags: string[];
}

export interface DelPacketData {
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
