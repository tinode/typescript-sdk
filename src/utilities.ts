import { base64codes, base64abc, DEL_CHAR } from './constants';
import { AccessMode } from './access-mode';

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
        NetworkProviders.WebSocket = ws;
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

/**
 * Recursively merge src own properties to dst.
 * Array and Date objects are shallow-copied.
 * @param dst - Destination object
 * @param src - Source object
 * @param ignore Ignore properties where ignore[property] is true.
 */
export function mergeObj(dst: any, src: any, ignore = false) {
    if (typeof src !== 'object') {
        if (src === DEL_CHAR) {
            return undefined;
        }
        if (src === undefined) {
            return dst;
        }
        return src;
    }
    // JS is crazy: typeof null is 'object'.
    if (src === null) {
        return src;
    }

    // Handle Date
    if (src instanceof Date) {
        return (!dst || !(dst instanceof Date) || dst < src) ? src : dst;
    }

    // Access mode
    if (src instanceof AccessMode) {
        return new AccessMode(src);
    }

    // Handle Array
    if (src instanceof Array) {
        return src;
    }

    if (!dst || dst === DEL_CHAR) {
        dst = src.constructor();
    }

    for (const prop in src) {
        if (src.hasOwnProperty(prop) &&
            (!ignore || !ignore[prop]) &&
            (prop !== '_noForwarding')) {

            dst[prop] = mergeObj(dst[prop], src[prop]);
        }
    }
    return dst;
}

/**
 * Update object stored in a cache. Returns updated value.
 */
export function mergeToCache(cache: any, key: string, newValue: any, ignore: boolean) {
    cache[key] = mergeObj(cache[key], newValue, ignore);
    return cache[key];
}

export function stringToDate(obj: any): void {
    if (typeof obj.created === 'string') {
        obj.created = new Date(obj.created);
    }
    if (typeof obj.updated === 'string') {
        obj.updated = new Date(obj.updated);
    }
    if (typeof obj.touched === 'string') {
        obj.touched = new Date(obj.touched);
    }
}

/**
 * JSON stringify helper - pre-processor for JSON.stringify
 */
export function jsonBuildHelper(key: any, val: any) {
    if (val instanceof Date) {
        // Convert javascript Date objects to rfc3339 strings
        val = rfc3339DateString(val);
    } else if (val instanceof AccessMode) {
        val = val.jsonHelper();
    } else if (val === undefined || val === null || val === false ||
        (Array.isArray(val) && val.length === 0) ||
        ((typeof val === 'object') && (Object.keys(val).length === 0))) {
        // strip out empty elements while serializing objects to JSON
        return undefined;
    }
    return val;
}

/**
 * Strips all values from an object of they evaluate to false or if their name starts with '_'.
 */
export function simplify(obj: any) {
    Object.keys(obj).forEach((key) => {
        if (key[0] === '_') {
            // Strip fields like "obj._key".
            delete obj[key];
        } else if (!obj[key]) {
            // Strip fields which evaluate to false.
            delete obj[key];
        } else if (Array.isArray(obj[key]) && obj[key].length === 0) {
            // Strip empty arrays.
            delete obj[key];
        } else if (typeof obj[key] === 'object' && !(obj[key] instanceof Date)) {
            simplify(obj[key]);
            // Strip empty objects.
            if (Object.getOwnPropertyNames(obj[key]).length === 0) {
                delete obj[key];
            }
        }
    });
    return obj;
}
