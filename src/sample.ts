import { IoTCClient } from '.';
import { IOTC_CONNECT, IOTC_EVENTS, IOTC_LOGGING } from './types/constants';
import { ICommand, CommandExecutionType, ISetting } from './types/interfaces';
import { c } from 'rhea/typings/types';

const client = new IoTCClient('simdev', '0ne0008CE34', IOTC_CONNECT.SYMM_KEY, 'RzmmaPBIjcTXyi4jDAWRFkW+PSVoGQT/7/bv1PrYqLUqlNulDR+lEpr/GgK22xRBkp/3oL663COnpZuoGbFYVw==');
(async () => {
    try {
        client.setModelId('urn:lucapnpprev:PnPTemplate_1zi:3');
        client.setLogging(IOTC_LOGGING.ALL);
        await client.connect();
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
                cmd.type = CommandExecutionType.SYNC;
                await cmd.aknowledge('Update completed');
            }
            else
                if (cmd.name == 'downloadModel') {
                    cmd.type = CommandExecutionType.ASYNC;
                    await cmd.update('Download in progress');
                    await cmd.aknowledge('Command received');
                    setTimeout(async () => {
                        await cmd.update('Download completed');
                    }, 5000);
                }
        });
        client.on(IOTC_EVENTS.SettingsUpdated, (settings: ISetting[]) => {
            settings.forEach(setting => {
                // do work
                setting.aknowledge('ciao');
            });
        });
    }
    catch (e) {
        console.error(e);
    }
})();