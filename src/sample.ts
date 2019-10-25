import { IoTCClient } from '.';
import { IOTC_CONNECT, IOTC_EVENTS, IOTC_LOGGING } from './types/constants';
import { Command, Setting } from './types/interfaces';

const client = new IoTCClient('pnpsettings', '0ne00087AE9', IOTC_CONNECT.SYMM_KEY, 'C1C31svc6EolNLVFWzCl8MhMiN2T7FLtfTNnhs7TPD1cyaYR4X5Ij3KykHnNw8NVPQ5WI8POWD7xaLHup6up5g==');
(async () => {
    try {
        client.setModelId('urn:ludrudaPnp:NodeDev_2uo:7');
        client.setLogging(IOTC_LOGGING.ALL);
        await client.connect();
        //@ts-ignore
        console.log(client.deviceClient._transport._mqtt._config.sharedAccessSignature);
        console.log(client.getConnectionString());
        setInterval(async () => {
            await client.sendTelemetry({
                temp: Math.floor(Math.random() * 100),
                hum: Math.floor(Math.random() * 100)
            })
        }, 3000);
        client.sendProperty({
            interfaceName: '$iotin:NodeDev_v2_1ym',
            name: 'fanSpeed',
            value: Math.floor(Math.random() * 100)
        });
        client.on(IOTC_EVENTS.Command, async (cmd: Command) => {
            if (cmd.name == 'updFW') {
                cmd.response.send(200, 'Update completed');
            }
            else if (cmd.name == 'downloadModel') {
                await cmd.response.send(201, 'Start Downloading');
                setTimeout(async () => {

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