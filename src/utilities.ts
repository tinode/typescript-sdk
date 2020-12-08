import { base64codes, base64abc, DEL_CHAR, AppInfo, TopicTypesObj, TopicNames } from './constants';
import { AccessMode } from './access-mode';

/**
 * Stores needed network providers to use in app
 */
export const NetworkProviders = {
    WebSocket: null,
    XMLHTTPRequest: null,
};

export let CTextDecoder: any;
export let CTextEncoder: any;

if (typeof TextDecoder === 'undefined') {
    CTextEncoder = require('util').TextEncoder;
    CTextDecoder = require('util').TextDecoder;
} else {
    CTextDecoder = TextDecoder;
    CTextEncoder = TextEncoder;
}


export class Utilities {
    private static getBase64Code(charCode: number) {
        if (charCode >= base64codes.length) {
            throw new Error('Unable to parse base64 string.');
        }
        const code = base64codes[charCode];
        if (code === 255) {
            throw new Error('Unable to parse base64 string.');
        }
        return code;
    }

    private static bytesToBase64(bytes: Uint8Array): string {
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

    private static base64ToBytes(str: string) {
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
                Utilities.getBase64Code(str.charCodeAt(i)) << 18 |
                Utilities.getBase64Code(str.charCodeAt(i + 1)) << 12 |
                Utilities.getBase64Code(str.charCodeAt(i + 2)) << 6 |
                Utilities.getBase64Code(str.charCodeAt(i + 3));
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
    static base64encode(str: string, encoder = new CTextEncoder()): string {
        return Utilities.bytesToBase64(encoder.encode(str));
    }

    /**
     * Converts string to bytes and uses `bytesToBase64` to encode
     * @param str - input base64
     * @param decoder - text decoder
     */
    static base64decode(str: string, decoder = new CTextDecoder()): string {
        return decoder.decode(Utilities.base64ToBytes(str));
    }

    /**
     * If using this lib is nodejs, you must initialize ws and xmlhttprequest
     * @param ws - WebSocket
     * @param xmlhttprequest - XMLHttpRequest
     */
    static initializeNetworkProviders(ws?: any, xmlhttprequest?: any): void {
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

    static pad(val: number, sp = 2): string {
        return '0'.repeat(sp - ('' + val).length) + val;
    }

    /**
     * RFC3339 formatter of Date
     * @param date - Input date object
     */
    static rfc3339DateString(date: Date): string {
        if (!date || date.getTime() === 0) {
            return undefined;
        }

        const millisecond = date.getUTCMilliseconds();
        return date.getUTCFullYear() + '-' + Utilities.pad(date.getUTCMonth() + 1) + '-' + Utilities.pad(date.getUTCDate()) +
            'T' + Utilities.pad(date.getUTCHours()) + ':' + Utilities.pad(date.getUTCMinutes()) + ':' + Utilities.pad(date.getUTCSeconds()) +
            (millisecond ? '.' + Utilities.pad(millisecond, 3) : '') + 'Z';
    }

    /**
     * Recursively merge src own properties to dst.
     * Array and Date objects are shallow-copied.
     * @param dst - Destination object
     * @param src - Source object
     * @param ignore Ignore properties where ignore[property] is true.
     */
    static mergeObj(dst: any, src: any, ignore = false) {
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

                dst[prop] = Utilities.mergeObj(dst[prop], src[prop]);
            }
        }
        return dst;
    }

    /**
     * Update object stored in a cache. Returns updated value.
     */
    static mergeToCache(cache: any, key: string, newValue: any, ignore?: boolean) {
        cache[key] = Utilities.mergeObj(cache[key], newValue, ignore);
        return cache[key];
    }

    static stringToDate(obj: any): void {
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
    static jsonBuildHelper(key: any, val: any) {
        if (val instanceof Date) {
            // Convert javascript Date objects to rfc3339 strings
            val = Utilities.rfc3339DateString(val);
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
    static simplify(obj: any) {
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
                Utilities.simplify(obj[key]);
                // Strip empty objects.
                if (Object.getOwnPropertyNames(obj[key]).length === 0) {
                    delete obj[key];
                }
            }
        });
        return obj;
    }

    /**
     * Trim whitespace, strip empty and duplicate elements elements.
     * If the result is an empty array, add a single element "\u2421" (Unicode Del character).
     * @param arr - array value
     */
    static normalizeArray(arr: string[]) {
        let out = [];
        if (Array.isArray(arr)) {
            // Trim, throw away very short and empty tags.
            for (let i = 0, l = arr.length; i < l; i++) {
                let t = arr[i];
                if (t) {
                    t = t.trim().toLowerCase();
                    if (t.length > 1) {
                        out.push(t);
                    }
                }
            }
            out.sort();
            out = out.filter((item, pos, ary) => {
                return !pos || item !== ary[pos - 1];
            });
        }
        if (out.length === 0) {
            // Add single tag with a Unicode Del character, otherwise an empty array
            // is ambiguous. The Del tag will be stripped by the server.
            out.push(DEL_CHAR);
        }
        return out;
    }

    /**
     * Attempt to convert date strings to objects.
     */
    static jsonParseHelper(key: string, val: any) {
        // Convert string timestamps with optional milliseconds to Date
        // 2015-09-02T01:45:43[.123]Z
        if (key === 'ts' && typeof val === 'string' &&
            val.length >= 20 && val.length <= 24) {
            const date = new Date(val);
            if (date) {
                return date;
            }
        } else if (key === 'acs' && typeof val === 'object') {
            return new AccessMode(val);
        }
        return val;
    }

    /**
     * Trims very long strings (encoded images) to make logged packets more readable.
     */
    static jsonLoggerHelper(key: string, val: any) {
        if (typeof val === 'string' && val.length > 128) {
            return '<' + val.length + ', bytes: ' + val.substring(0, 12) + '...' + val.substring(val.length - 12) + '>';
        }
        return Utilities.jsonBuildHelper(key, val);
    }

    /**
     * Parse browser user agent to extract browser name and version.
     */
    static getBrowserInfo(ua: string, product: string) {
        ua = ua || '';
        let reactNative = '';
        // Check if this is a ReactNative app.
        if (/reactnative/i.test(product)) {
            reactNative = 'ReactNative; ';
        }
        // Then test for WebKit based browser.
        ua = ua.replace(' (KHTML, like Gecko)', '');
        let m = ua.match(/(AppleWebKit\/[.\d]+)/i);
        let result;
        if (m) {
            // List of common strings, from more useful to less useful.
            const priority = ['chrome', 'safari', 'mobile', 'version'];
            const tmp = ua.substr(m.index + m[0].length).split(' ');
            const tokens = [];
            // Split Name/0.0.0 into Name and version 0.0.0
            for (const item of tmp) {
                const m2 = /([\w.]+)[\/]([\.\d]+)/.exec(item);
                if (m2) {
                    tokens.push([m2[1], m2[2], priority.findIndex((e) => {
                        return (e === m2[1].toLowerCase());
                    })]);
                }
            }
            // Sort by priority: more interesting is earlier than less interesting.
            tokens.sort((a, b) => {
                const diff = a[2] - b[2];
                return diff !== 0 ? diff : b[0].length - a[0].length;
            });
            if (tokens.length > 0) {
                // Return the least common browser string and version.
                result = tokens[0][0] + '/' + tokens[0][1];
            } else {
                // Failed to ID the browser. Return the webkit version.
                result = m[1];
            }
            // Test for MSIE.
        } else if (/trident/i.test(ua)) {
            m = /(?:\brv[ :]+([.\d]+))|(?:\bMSIE ([.\d]+))/g.exec(ua);
            if (m) {
                result = 'MSIE/' + (m[1] || m[2]);
            } else {
                result = 'MSIE/?';
            }
            // Test for Firefox.
        } else if (/firefox/i.test(ua)) {
            m = /Firefox\/([.\d]+)/g.exec(ua);
            if (m) {
                result = 'Firefox/' + m[1];
            } else {
                result = 'Firefox/?';
            }
            // Older Opera.
        } else if (/presto/i.test(ua)) {
            m = /Opera\/([.\d]+)/g.exec(ua);
            if (m) {
                result = 'Opera/' + m[1];
            } else {
                result = 'Opera/?';
            }
        } else {
            // Failed to parse anything meaningful. Try the last resort.
            m = /([\w.]+)\/([.\d]+)/.exec(ua);
            if (m) {
                result = m[1] + '/' + m[2];
            } else {
                m = ua.split(' ');
                result = m[0];
            }
        }

        // Shorten the version to one dot 'a.bb.ccc.d -> a.bb' at most.
        m = result.split('/');
        if (m.length > 1) {
            const v = m[1].split('.');
            result = m[0] + '/' + v[0] + (v[1] ? '.' + v[1] : '');
        }
        return reactNative + result;
    }

    static findNearest(elem, arr: any[], exact: boolean, compare?: CallableFunction) {
        if (!compare) {
            compare = (a: any, b: any) => {
                return a === b ? 0 : a < b ? -1 : 1;
            };
        }

        let start = 0;
        let end = arr.length - 1;
        let pivot = 0;
        let diff = 0;
        let found = false;

        while (start <= end) {
            pivot = (start + end) / 2 | 0;
            diff = compare(arr[pivot], elem);
            if (diff < 0) {
                start = pivot + 1;
            } else if (diff > 0) {
                end = pivot - 1;
            } else {
                found = true;
                break;
            }
        }
        if (found) {
            return {
                idx: pivot,
                exact: true
            };
        }
        if (exact) {
            return {
                idx: -1
            };
        }
        // Not exact - insertion point
        return {
            idx: diff < 0 ? pivot + 1 : pivot
        };
    }

    /**
     * Insert element into a sorted array.
     */
    static insertSorted(elem: any, arr: any[], unique: boolean, compare?: CallableFunction) {
        const found = Utilities.findNearest(elem, arr, false, compare);
        const count = (found.exact && unique) ? 1 : 0;
        arr.splice(found.idx, count, elem);
        return arr;
    }

    /**
     * Helper function for creating an endpoint URL
     */
    static makeBaseUrl(host: string, protocol: 'http' | 'https' | 'ws' | 'wss', apiKey: string) {
        let url = null;

        if (protocol === 'http' || protocol === 'https' || protocol === 'ws' || protocol === 'wss') {
            url = protocol + '://';
            url += host;
            if (url.charAt(url.length - 1) !== '/') {
                url += '/';
            }
            url += 'v' + AppInfo.PROTOCOL_VERSION + '/channels';
            if (protocol === 'http' || protocol === 'https') {
                // Long polling endpoint end with "lp", i.e.
                // '/v0/channels/lp' vs just '/v0/channels' for ws
                url += '/lp';
            }
            url += '?apikey=' + apiKey;
        }

        return url;
    }

    static log(text: string, ...args: any[]) {
        // TODO: Implement
    }

    /**
     *  Helper method to package account credential.
     * @param meth - validation method or object with validation data.
     * @param val - validation value (e.g. email or phone number).
     * @param params - validation parameters.
     * @param resp - validation response.
     */
    static credential(meth: any, val: string, params: any, resp: string) {
        if (typeof meth === 'object') {
            ({
                val,
                params,
                resp,
                meth
            } = meth);
        }
        if (meth && (val || resp)) {
            return [{ meth, val, resp, params }];
        }
        return null;
    }

    /**
     * Determine topic type from topic's name: grp, p2p, me, fnd.
     * @param name - Name of the topic to test.
     */
    static topicType(name: string) {
        return TopicTypesObj[(typeof name === 'string') ? name.substring(0, 3) : 'xxx'];
    }


    static isNewGroupTopicName(name: string) {
        return (typeof name === 'string') && name.substring(0, 3) === TopicNames.TOPIC_NEW;
    }

    /**
     *  Check if the given string represents NULL value.
     * @param str - string to check for null value.
     */
    static isNullValue(str: string) {
        return str === DEL_CHAR;
    }

    /**
     * Check if the topic name is a name of a channel.
     * @param name Topic name
     */
    static isChannelTopicName(name: string) {
        return (typeof name === 'string') &&
            (name.substring(0, 3) === TopicNames.TOPIC_CHAN || name.substring(0, 3) === TopicNames.TOPIC_NEW_CHAN);
    }

    /**
     * Check if the topic name is a p2p topic name.
     * @param name Topic name
     */
    static isP2PTopicName(name: string) {
        return (typeof name === 'string') && name.substring(0, 3) === 'p2p';
    }

}
