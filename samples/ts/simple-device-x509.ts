import * as fs from 'fs';
import * as path from 'path';

// import { IoTCClient, IOTC_CONNECT, IIoTCProperty, IIoTCCommand, IIoTCCommandResponse, IOTC_EVENTS, IOTC_CONNECTION_STATUS } from 'azure-iotcentral-device-client';

/** Comment out below line to use local version of the library */
import { IoTCClient, IOTC_CONNECT, IIoTCProperty, IIoTCCommand, IIoTCCommandResponse, IOTC_EVENTS, IOTC_CONNECTION_STATUS } from '../..';

const scopeId = process.env.SCOPE_ID || '<SCOPE_ID>';
const deviceId = process.env.DEVICE_ID || '<DEVICE_ID>';
const cert = {
    cert: process.env.PUBLIC_CERT ? fs.readFileSync(path.resolve(process.cwd(), process.env.PUBLIC_CERT)).toString() : '<PUBLIC_CERT>',
    key: process.env.PRIVATE_KEY ? fs.readFileSync(path.resolve(process.cwd(), process.env.PRIVATE_KEY)).toString() : '<PRIVATE_KEY>',
    // passphrase: process.env.KEY_PASSPHRASE ? fs.readFileSync(path.resolve(process.cwd(), process.env.KEY_PASSPHRASE)).toString() : '<KEY_PASSPHRASE>'
}


const iotc = new IoTCClient(deviceId, scopeId, IOTC_CONNECT.X509_CERT, cert);

/** When using group enrollment key
* const iotc = new IoTCClient(deviceId, scopeId, IOTC_CONNECT.SYMM_KEY, groupKey);
* iotc.setModelId(modelId);
**/

const onPropertyUpdated = async function (prop: IIoTCProperty) {
    console.log(`Received new value '${prop.value}' for property '${prop.name}'`);
    // prop has been successfully applied. report operation result
    await prop.ack();
}

const onCommandReceived = async function (cmd: IIoTCCommand) {
    console.log(`Received command '${cmd.name}'${cmd.requestPayload ? ` with payload ${cmd.requestPayload}` : '.'}`);
    // command has been successfully executed
    await cmd.reply(IIoTCCommandResponse.SUCCESS, 'Completed');
}

const onConnectionStatusChanged = async function (status: IOTC_CONNECTION_STATUS) {
    console.log(`Device is ${IOTC_CONNECTION_STATUS[status]}`);
}

async function run() {

    iotc.on(IOTC_EVENTS.Properties, onPropertyUpdated);
    iotc.on(IOTC_EVENTS.Commands, onCommandReceived);
    iotc.on(IOTC_EVENTS.ConnectionStatus, onConnectionStatusChanged);
    await iotc.connect();
    const propObj = { readOnlyProp: 30 };
    console.log(`Sending property ${JSON.stringify(propObj)}`)
    await iotc.sendProperty(propObj);

    setInterval(async () => {
        const telemObj = { temperature: Math.floor(Math.random() * 100) };
        console.log(`Sending telemetry ${JSON.stringify(telemObj)}`)
        await iotc.sendTelemetry(telemObj);
    }, 5000);
}

run();