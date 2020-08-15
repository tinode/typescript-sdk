export interface ServerParams {
    /**
     * Server version
     */
    ver: string;
    /**
     * Server build
     */
    build: string;
    /**
     * Session ID, long polling connections only
     */
    sid: string;
}
