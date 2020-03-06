# Microsoft Azure IoTCentral SDK for Node.js

[![Join the chat at https://gitter.im/iotdisc/community](https://badges.gitter.im/iotdisc.svg)](https://gitter.im/iotdisc/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
[![Licensed under the MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](https://github.com/lucadruda/iotc-nodejs-device-client/blob/master/LICENSE)


## Prerequisites
+ Node.js version 8.x or higher - https://nodejs.org

## Installing `azure-iotcentral-device-client` and types

```
npm install azure-iotcentral-device-client
```

## Samples

A couple of samples in Javascripts can be found [here](https://github.com/lucadruda/iotc-samples)

When connecting a device to an IoT Central application an IoTCClient is initialized.
SDK supports X509 and SymmetricKey authentication;

#### X509
```
const iotCentral = require('azure-iotcentral-device-client');

const scopeId = '';
const deviceId = '';
const passphrase = ''; //optional
const cert = {
    cert: "public cert"
    key: "private key",
    passphrase: "passphrase"
}

const iotc = new iotCentral.IoTCClient(deviceId, scopeId, 'X509_CERT', cert);
```

#### SAS
```
const iotCentral = require('azure-iotcentral-device-client');

const scopeId = 'scopeID';
const deviceId = 'deviceID';
const sasKey = 'masterKey';

const iotc = new iotCentral.IoTCClient(deviceId, scopeId, 'symm_key', sasKey);
```

### Connect
Using callback
```
iotc.connect(callback)
```
Using promises
```
iotc.connect().then(()=>{
    console.log('Connected");
})
```
After successfull connection, IOTC context is available for further commands.

All the callbacks are optional parameters and are triggered when message has reached the ingestion engine.

### Send telemetry

Send telemetry every 3 seconds
```
setInterval(() => {
            iotc.sendTelemetry({
                field1: value1,
                field2: value2,
                field3: value3
            }, properties, sendCallback)
```
An optional *properties* object can be included in the send methods, to specify additional properties for the message (e.g. timestamp, content-type etc... ).
Properties can be custom or part of the reserved ones (see list [here](https://github.com/Azure/azure-iot-sdk-csharp/blob/master/iothub/device/src/MessageSystemPropertyNames.cs#L36)).

### Send state update
```
iotc.sendState({fieldName:'fieldValue'}, timestamp, sendCallback);
```
### Send event
```
iotc.sendEvent(event, timestamp, sendCallback);
```
### Send property update
```
iotc.sendProperty({fieldName:'fieldValue'}, sendCallback);
```
### Listen to settings update
```
iotc.on('SettingsUpdate', callback);
```
To provide setting sync aknowledgement, the client can send back a property with the same name of the setting and a particular value object.
```
iotc.on('SettingsUpdated', (val) => {
            Object.keys(val).forEach(setting => {
                iotc.sendProperty({
                    [setting]: {
                        value: val[setting].value,
                        status: 'completed',
                        desiredVersion: val.$version,
                        message: 'whatever'
                    }
                });
            });
        });
```

### Listen to commands
```
iotc.on('Command',callback);
```
To provide feedbacks for the command like execution result or progress, the client can send back a property with the same name of the executing command.
```
iotc.on('Command', (cmd) => {
    // send execution start feedback
    iotc.sendProperty({
                [cmd.commandName]: { 
                    value: 'Command execution started at ' + new Date().toISOString(),
                    requestId:cmd.requestId
                    }
            }, sendCallback);
        });
```

## One-touch device provisioning and approval
A device can send custom data during provision process: if a device is aware of its IoT Central template Id, then it can be automatically provisioned.

### How to set IoTC template ID in your device
Template Id can be found in the device explorer page of IoTCentral
![Img](assets/modelId.jpg)

Then call this method before connect():

```
iotc.setModelId('<modelId>');
```

### Manual approval (default)
By default device auto-approval in IoT Central is disabled, which means that administrator needs to approve the device registration to complete the provisioning process.
This can be done from explorer page after selecting the device
![Img](assets/manual_approval.jpg)


### Automatic approval
To change default behavior, administrator can enable device auto-approval from Device Connection page under the Administration section.
With automatic approval a device can be provisioned without any manual action and can start sending/receiving data after status changes to "Provisioned"

![Img](assets/auto_approval.jpg)

## Generate x509 certificates
IoT Central SDK comes with a tool to generate self-signed x509 certificates to be used when testing device connection.
If you want to generate certificates for 6 devices and also validate the authority you can run something like this:
```
const IoTCentral = require('azure-iotcentral');
const readline = require('readline');

const certificateGenerator = new IoTCentral.CertificateGenerator(6);
certificateGenerator.init()
    .then(() => {
        console.log('Generating root certificate');
        certificateGenerator.generateRoot.bind(certificateGenerator)()
            .then(() => {
                console.log('Generating device certificates');
                certificateGenerator.createDevices.bind(certificateGenerator)()
                    .then(() => {
                        const rl = readline.createInterface({
                            input: process.stdin,
                            output: process.stdout
                        });
                        rl.question('Insert validation code: ', async (answer) => {
                            const validationCert = await certificateGenerator.validate.bind(certificateGenerator)(answer);
                            console.log(`Validation certificate create at '${validationCert}'`);
                            rl.close()
                        });
                    })
            })
    });
```
This example wait for a validation code which is provided by IoTCentral in the device configuration page when uploading primary or secondary root certificate.
Resulting device certificates can be used in connection example above.