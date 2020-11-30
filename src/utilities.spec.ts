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
