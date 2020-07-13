/**
 * Contains basic information about library
 */
export enum AppInfo {
    VERSION = '0.16',
    PROTOCOL_VERSION = '0',
    LIBRARY = 'tinode-typescript',
}

/**
 * Constant topic names
 */
export enum TopicNames {
    TOPIC_NEW = 'new',
    TOPIC_ME = 'me',
    TOPIC_FND = 'fnd',
    TOPIC_SYS = 'sys',
    USER_NEW = 'new'
}

export enum MessageStatus {
    /**
     * Status not assigned.
     */
    NONE = 0,
    /**
     * Local ID assigned, in progress to be sent.
     */
    QUEUED = 1,
    /**
     * Transmission started.
     */
    SENDING = 2,
    /**
     * At least one attempt was made to send the message.
     */
    FAILED = 3,
    /**
     * Delivered to the server.
     */
    SENT = 4,
    /**
     * Received by the client.
     */
    RECEIVED = 5,
    /**
     * Read by the user.
     */
    READ = 6,
    /**
     *  Message from another user.
     */
    TO_ME = 7,
}

/**
 * Global settings for library
 */
export const AppSettings = {
    LOCAL_SEQ_ID: 0xFFFFFFF, // Starting value of a locally-generated seqId used for pending messages.
    NETWORK_ERROR: 503, // Error code to return in case of a network problem.
    ERROR_TEXT: 'Connection failed', // Error text to return in case of a network problem.
    EXPIRE_PROMISES_TIMEOUT: 5000, // Reject unresolved futures after this many milliseconds.
    EXPIRE_PROMISES_PERIOD: 1000, // Periodicity of garbage collection of unresolved futures.
    NETWORK_USER: 418, // Error code to return when user disconnected from server.
    NETWORK_USER_TEXT: 'Disconnected by client', // Error text to return when user disconnected from server.
};
