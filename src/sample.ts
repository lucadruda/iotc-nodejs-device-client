import { IoTCClient } from '.';
import { IOTC_CONNECT, IOTC_EVENTS, IOTC_LOGGING } from './types/constants';
import { Setting, ICommand } from './types/interfaces';

const client = new IoTCClient('pnpsettings', '0ne0008CE34', IOTC_CONNECT.SYMM_KEY, 'RzmmaPBIjcTXyi4jDAWRFkW+PSVoGQT/7/bv1PrYqLUqlNulDR+lEpr/GgK22xRBkp/3oL663COnpZuoGbFYVw==');
(async () => {
    try {
        client.setModelId('urn:lucapnpprev:PnPTemplate_1zi:2');
        client.setLogging(IOTC_LOGGING.ALL);
        await client.connect();
        //@ts-ignore
        console.log(client.deviceClient._transport._mqtt._config.sharedAccessSignature);
        console.log(client.getConnectionString());
        // setInterval(async () => {
        //     await client.sendTelemetry({
        //         temp: Math.floor(Math.random() * 100),
        //         hum: Math.floor(Math.random() * 100)
        //     })
        // }, 3000);
        // client.sendProperty({
        //     interfaceName: '$iotin:NodeDev_v2_1ym',
        //     name: 'fanSpeed',
        //     value: Math.floor(Math.random() * 100)
        // });
        client.on(IOTC_EVENTS.Command, async (cmd: ICommand) => {
            if (cmd.name == 'updFirmware') {
                await cmd.aknowledge(true, 'Update completed');
            }
            else
                if (cmd.name == 'downloadModel') {
                    await cmd.aknowledge(true, 'Command received');
                    await cmd.update('Download in progress');
                    setTimeout(async () => {
                        await cmd.update('Download in progress');
                    }, 5000);
                }
        });
        client.on(IOTC_EVENTS.SettingsUpdated, (settings: Setting[]) => {
            settings.forEach(setting => {
                // do work
                setting.aknowledge('ciao');
                setting.aknowledge((err, res) => {
                    console.log(res);
                });
                setting.aknowledge();
                setting.aknowledge('ciao', (err, res) => {
                    console.log(res);
                });
            });
        });
    }
    catch (e) {
        console.error(e);
    }
})();