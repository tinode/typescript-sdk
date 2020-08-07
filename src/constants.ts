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

export const base64abc = [
    'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M',
    'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
    'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm',
    'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z',
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '+', '/'
];

export const base64codes = [
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
    255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 62, 255, 255, 255, 63,
    52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 255, 255, 255, 0, 255, 255,
    255, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14,
    15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 255, 255, 255, 255, 255,
    255, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40,
    41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51
];

export const DEL_CHAR = '\u2421';

/**
 * Access mode permission types
 */
export enum AccessModeFlags {
    NONE = 0x00,
    JOIN = 0x01,
    READ = 0x02,
    WRITE = 0x04,
    PRES = 0x08,
    APPROVE = 0x10,
    SHARE = 0x20,
    DELETE = 0x40,
    OWNER = 0x80,
    INVALID = 0x100000,
}

export const AccessModePermissionsBITMASK =
    AccessModeFlags.JOIN
    | AccessModeFlags.READ
    | AccessModeFlags.WRITE
    | AccessModeFlags.PRES
    | AccessModeFlags.APPROVE
    | AccessModeFlags.SHARE
    | AccessModeFlags.DELETE
    | AccessModeFlags.OWNER;

export enum XDRStatus {
    UNSENT = 0, // Client has been created. open() not called yet.
    OPENED = 1, // open() has been called.
    HEADERS_RECEIVED = 2, // send() has been called, and headers and status are available.
    LOADING = 3, // Downloading; responseText holds partial data.
    DONE = 4, // The operation is complete.
}

export const TopicTypesObj = {
    me: 'me',
    fnd: 'fnd',
    grp: 'grp',
    new: 'grp',
    usr: 'p2p',
    sys: 'sys',
};

export enum ServerConfigurationKeys {
    MaxMessageSize = 'maxMessageSize',
    MaxSubscriberCount = 'maxSubscriberCount',
    MaxTagCount = 'maxTagCount',
    MaxFileUploadSize = 'maxFileUploadSize',
}
