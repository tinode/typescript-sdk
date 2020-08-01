import { AppInfo } from "../constants";

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
