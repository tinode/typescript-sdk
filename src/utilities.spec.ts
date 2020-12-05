import { Utilities, NetworkProviders } from './utilities';

test('Should encode text to base64 format correctly', () => {
    expect(Utilities.base64encode('ThisIsAText')).toBe('VGhpc0lzQVRleHQ=');
});

test('Should decode base64 to text format correctly', () => {
    expect(Utilities.base64decode('VGhpc0lzQVRleHQ=')).toBe('ThisIsAText');
});

test('Should initialize network providers', () => {
    expect(NetworkProviders.WebSocket).toBeFalsy();
    expect(NetworkProviders.XMLHTTPRequest).toBeFalsy();
    const ws = {};
    const xml = {};
    Utilities.initializeNetworkProviders(ws, xml);
    expect(NetworkProviders.WebSocket).toBeTruthy();
    expect(NetworkProviders.XMLHTTPRequest).toBeTruthy();
});

test('Should correctly add pad', () => {
    expect(Utilities.pad(2)).toBe('02');
    expect(Utilities.pad(12)).toBe('12');
});

test('Should convert date to rfc3339DateString', () => {
    const date = new Date('2020-11-30 16:04:26');
    expect(Utilities.rfc3339DateString(date)).toBe('2020-11-30T12:34:26Z');
});

test('Should merge objects', () => {
    const src = { firstName: 'Moein' };
    const dst = { username: 'rxmoein' };
    const result = Utilities.mergeObj(dst, src);
    expect(result.firstName).toBe('Moein');
    expect(result.username).toBe('rxmoein');
});

test('Should merge object to cache object', () => {
    const cache: any = { key: { firstName: 'Moein' } };
    const obj = { username: 'rxmoein' };
    const result = Utilities.mergeToCache(cache, 'key', obj);
    expect(result.firstName).toBe('Moein');
    expect(result.username).toBe('rxmoein');
});

test('Should convert string to date', () => {
    const obj: any = { created: '2020-11-30 16:04:26' };
    Utilities.stringToDate(obj);
    expect(obj.created instanceof Date).toBeTruthy();
});

test('Should jsonBuildHelper convert dates to rfc3339DateString', () => {
    const obj: any = { created: new Date('2020-11-30 16:04:26') };
    const str = JSON.stringify(obj, Utilities.jsonBuildHelper);
    expect(str === '{"created":"2020-11-30T12:34:26.000Z"}').toBeTruthy();
});

test('Should simplify object', () => {
    const obj: any = { _key: 'val', key: false, next: true };
    const simplified = Utilities.simplify(obj);
    expect(simplified._key).toBeFalsy();
    expect(simplified.key).toBeFalsy();
    expect(simplified.next).toBeTruthy();
});

test('Should simplify object', () => {
    const obj: any = { _key: 'val', key: false, next: true };
    const simplified = Utilities.simplify(obj);
    expect(simplified._key).toBeFalsy();
    expect(simplified.key).toBeFalsy();
    expect(simplified.next).toBeTruthy();
});

test('Should normalize object', () => {
    const obj: any[] = [undefined, 'a', 'a', 'moein'];
    const norm = Utilities.normalizeArray(obj);
    expect(norm.length === 1).toBeTruthy();
    expect(norm[0] === 'moein').toBeTruthy();
});

test('Should jsonParseHelper convert strings dates to date', () => {
    const src = '{"ts":"2020-11-30T12:34:26.000Z"}';
    const obj = JSON.parse(src, Utilities.jsonParseHelper);
    expect(obj.ts instanceof Date).toBeTruthy();
});

test('Should find nearest element in an array', () => {
    const src = [1, 2, 3, 2];
    const obj = Utilities.findNearest(2, src, true);
    expect(obj.idx === 1).toBeTruthy();
});

test('Should insert element in sorted array', () => {
    const src = [1, 3];
    let obj = Utilities.insertSorted(4, src, true);
    obj = Utilities.insertSorted(2, obj, true);
    expect(obj[3] === 4).toBeTruthy();
    expect(obj[1] === 2).toBeTruthy();
});
