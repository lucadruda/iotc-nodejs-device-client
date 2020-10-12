const iotc = require('./dist/index');
const { IIoTCCommandResponse } = require('./dist/types/interfaces');

const client = new iotc.IoTCClient('nodejs', '0ne0011423C', iotc.IOTC_CONNECT.SYMM_KEY, 'r0mxLzPr9gg5DfsaxVhOwKK2+8jEHNclmCeb9iACAyb2A7yHPDrB2/+PTmwnTAetvI6oQkwarWHxYbkIVLybEg==');
client.setModelId('urn:testapplucaM3:TestSDK_18x:2');

client.on(iotc.IOTC_EVENTS.Properties, async (prop) => {
    console.log(`Received prop ${prop.name} with value ${prop.value}`);
    await prop.ack();
});

client.on(iotc.IOTC_EVENTS.Commands, async (cmd) => {
    console.log(`Received command ${cmd.name} with params ${cmd.requestPayload}`);
    await cmd.reply(IIoTCCommandResponse.SUCCESS, 'Command received');
});

client.connect(true).then(async () => {
    console.log('connected');
    while (true) {
        await client.sendTelemetry({
            temperature: Math.floor(Math.random() * 100),
            pressure: Math.floor(Math.random() * 100)
        });
        await new Promise(r => setTimeout(r, 5000));
    }

})