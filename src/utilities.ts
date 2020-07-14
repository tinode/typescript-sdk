import { base64codes, base64abc } from './constants';

function getBase64Code(charCode: number) {
    if (charCode >= base64codes.length) {
        throw new Error('Unable to parse base64 string.');
    }
    const code = base64codes[charCode];
    if (code === 255) {
        throw new Error('Unable to parse base64 string.');
    }
    return code;
}

function bytesToBase64(bytes: Uint8Array): string {
    const l = bytes.length;
    let result = '';
    let i = 0;

    for (i = 2; i < l; i += 3) {
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[((bytes[i - 1] & 0x0F) << 2) | (bytes[i] >> 6)];
        result += base64abc[bytes[i] & 0x3F];
    }

    if (i === l + 1) { // 1 octet yet to write
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[(bytes[i - 2] & 0x03) << 4];
        result += '==';
    }

    if (i === l) { // 2 octets yet to write
        result += base64abc[bytes[i - 2] >> 2];
        result += base64abc[((bytes[i - 2] & 0x03) << 4) | (bytes[i - 1] >> 4)];
        result += base64abc[(bytes[i - 1] & 0x0F) << 2];
        result += '=';
    }
    return result;
}

function base64ToBytes(str: string) {
    if (str.length % 4 !== 0) {
        throw new Error('Unable to parse base64 string.');
    }
    const index = str.indexOf('=');
    if (index !== -1 && index < str.length - 2) {
        throw new Error('Unable to parse base64 string.');
    }
    const missingOctets = str.endsWith('==') ? 2 : str.endsWith('=') ? 1 : 0;
    const n = str.length;
    const result = new Uint8Array(3 * (n / 4));

    for (let i = 0, j = 0; i < n; i += 4, j += 3) {
        const buffer =
            getBase64Code(str.charCodeAt(i)) << 18 |
            getBase64Code(str.charCodeAt(i + 1)) << 12 |
            getBase64Code(str.charCodeAt(i + 2)) << 6 |
            getBase64Code(str.charCodeAt(i + 3));
        result[j] = buffer >> 16;
        result[j + 1] = (buffer >> 8) & 0xFF;
        result[j + 2] = buffer & 0xFF;
    }
    return result.subarray(0, result.length - missingOctets);
}

/**
 * Converts string to bytes and uses `bytesToBase64` to encode
 * @param str - input string
 * @param encoder - text encoder
 */
export function base64encode(str: string, encoder = new TextEncoder()): string {
    return bytesToBase64(encoder.encode(str));
}

/**
 * Converts string to bytes and uses `bytesToBase64` to encode
 * @param str - input base64
 * @param decoder - text decoder
 */
export function base64decode(str: string, decoder = new TextDecoder()): string {
    return decoder.decode(base64ToBytes(str));
}

/**
 * Stores needed network providers to use in app
 */
export const NetworkProviders = {
    WebSocket: null,
    XMLHTTPRequest: null,
};

/**
 * If using this lib is nodejs, you must initialize ws and xmlhttprequest
 * @param ws - WebSocket
 * @param xmlhttprequest - XMLHttpRequest
 */
export function initializeNetworkProviders(ws: any, xmlhttprequest: any): void {
    if (!ws && !xmlhttprequest) {
        if (typeof WebSocket !== 'undefined') {
            NetworkProviders.WebSocket = WebSocket;
        }
        if (typeof XMLHttpRequest !== 'undefined') {
            NetworkProviders.XMLHTTPRequest = XMLHttpRequest;
        }
    } else {
        NetworkProviders.XMLHTTPRequest = ws;
        NetworkProviders.XMLHTTPRequest = xmlhttprequest;
    }
}

function pad(val: number, sp = 2): string {
    return '0'.repeat(sp - ('' + val).length) + val;
}

/**
 * RFC3339 formatter of Date
 * @param date - Input date object
 */
export function rfc3339DateString(date: Date): string {
    if (!date || date.getTime() === 0) {
        return undefined;
    }

    const millisecond = date.getUTCMilliseconds();
    return date.getUTCFullYear() + '-' + pad(date.getUTCMonth() + 1) + '-' + pad(date.getUTCDate()) +
        'T' + pad(date.getUTCHours()) + ':' + pad(date.getUTCMinutes()) + ':' + pad(date.getUTCSeconds()) +
        (millisecond ? '.' + pad(millisecond, 3) : '') + 'Z';
}
