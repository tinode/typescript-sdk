import { WSConnection } from './ws-connection';
import { Utilities } from '../utilities';

test('Should connect using WS', () => {

    Utilities.initializeNetworkProviders(require('ws'), require('xmlhttprequest'));
    const ws = new WSConnection({
        autoReconnect: false,
        host: 'sandbox.tinode.co',
        APIKey: 'AQEAAAABAAD_rAp4DJh05a1HAwFT3A6K',
        secure: true,
        transport: 'ws'
    });
    // FIXME
    ws.onOpen.subscribe((res) => {
        console.log('res: ');
        expect(1).toBeFalsy();
    });
    ws.connect('', false);
});
