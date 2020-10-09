const iotcModule = require('azure-iotcentral-device-client');


/** Comment out below line to use local version of the library */
// const iotcModule = require('..');

const { IoTCClient, IOTC_CONNECT, IOTC_CONNECTION_STATUS, IOTC_EVENTS, IIoTCCommandResponse } = iotcModule;

const scopeId = process.env.SCOPE_ID || '<SCOPE_ID>';
const deviceId = process.env.DEVICE_ID || '<DEVICE_ID>';
const deviceKey = process.env.DEVICE_KEY || '<DEVICE_KEY>';

/** If device is not already created in IoT Central, it will be provisioned and assigned to specified model and device key will be generated from group enrollment*/
const groupKey = process.env.GROUP_KEY || '<GROUP_KEY>';
const modelId = process.env.MODEL_ID || '<MODEL_ID>';


const iotc = new IoTCClient(deviceId, scopeId, IOTC_CONNECT.DEVICE_KEY, deviceKey);

/** When using group enrollment key
* const iotc = new IoTCClient(deviceId, scopeId, IOTC_CONNECT.SYMM_KEY, groupKey);
* iotc.setModelId(modelId);
**/

const onPropertyUpdated = async function (prop) {
    console.log(`Received new value '${prop.value}' for property '${prop.name}'`);
    // prop has been successfully applied. report operation result
    await prop.ack();
}

const onCommandReceived = async function (cmd) {
    console.log(`Received command '${cmd.name}'${cmd.requestPayload ? ` with payload ${cmd.requestPayload}` : '.'}`);
    // command has been successfully executed
    await cmd.reply(IIoTCCommandResponse.SUCCESS, 'Completed');
}

const onConnectionStatusChanged = async function (status) {
    console.log(`Device is ${IOTC_CONNECTION_STATUS[status]}`);
}

async function run() {

    iotc.on(IOTC_EVENTS.Properties, onPropertyUpdated);
    iotc.on(IOTC_EVENTS.Commands, onCommandReceived);
    iotc.on(IOTC_EVENTS.ConnectionStatus, onConnectionStatusChanged);
    console.log(`Connecting ${deviceId}...`);
    await iotc.connect();
    const propObj = { prop: 30 };
    console.log(`Sending property ${JSON.stringify(propObj)}`)
    await iotc.sendProperty(propObj);

    setInterval(async () => {
        const telemObj = { temperature: Math.floor(Math.random() * 100) };
        console.log(`Sending telemetry ${JSON.stringify(telemObj)}`)
        await iotc.sendTelemetry(telemObj);
    }, 5000);
}

run();