import { IoTCClient } from "../clients/iotcClient";
import { IOTC_CONNECT, IOTC_EVENTS } from "../types/constants";
import { IIoTCProperty, OperationStatus, IIoTCCommand } from "../types/interfaces";

const client = IoTCClient.create('<DEVICE_ID>', '<SCOPE_ID>', '<CAPABILITY_MODEL_ID>', IOTC_CONNECT.SYMM_KEY, '<SYMM_KEY>');
let stopId;
const propertyCallback = (prop: IIoTCProperty) => {
    console.log(`Received new value '${prop.value}' for property '${prop.name}' in interface '${prop.interfaceName}'`);
    prop.report(OperationStatus.SUCCESS);
}

const commandCallback = async (cmd: IIoTCCommand) => {
    console.log(`Received command '${cmd.name}' with parameter ${cmd.value} from interface '${cmd.interfaceName}'`);
    await cmd.acknowledge(OperationStatus.SUCCESS);
    if (cmd.name === 'stop') {
        console.log('Received stop signal. Exiting...');
        if (stopId) {
            clearInterval(stopId);
        }
        process.exit(0);
    }
}

client.on(IOTC_EVENTS.PropertiesUpdated, propertyCallback);
client.on(IOTC_EVENTS.Command, commandCallback);
client.on(IOTC_EVENTS.ConnectionStatus, () => {
    if (client.isConnected()) {
        console.log('Device is connected!! Starting telemetry...');
    }
});

client.addInterface({
    name: '<INTERFACE_NAME>',
    id: '<INTERFACE_ID>',
    telemetry: ['temperature', 'pressure', 'humidity'],
    commands: ['stop'],
    properties: ['fanSpeed']
});



async function main() {
    console.log('Welcome to IoTCentral');
    await client.connect();
    await client.sendProperty({
        fanSpeed: 15
    }, 'sensors');
    let obj;
    stopId = setInterval(async () => {
        obj = {
            temperature: Math.floor(Math.random() * 100),
            humidity: Math.floor(Math.random() * 100),
            pressure: Math.floor(Math.random() * 100)
        };
        console.log(`Sending ${JSON.stringify(obj)}`);
        await client.sendTelemetry(obj, 'sensors');
    }, 5000);


}

main();