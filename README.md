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
#### Connection String
You can use the SAS or X509 approach to retrieve the connection string through DPS. Use `getConnectionString()` to retrieve the connection string from the IoT Central client once the connection is open, when using SAS or X509.
```
const iotCentral = require('azure-iotcentral-device-client');

const scopeId = 'scopeID';
const deviceId = 'deviceID';
const connStr = 'connectionstring';

const iotc = new iotCentral.IoTCClient(deviceId, scopeId, 'conn_string', connStr);
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
            }, timestamp, sendCallback)
```
An optional timestamp field can be included in the send methods, to specify the UTC date and time of the message. This field must be in ISO format (e.g., YYYY-MM-DDTHH:mm:ss.sssZ). If timestamp is not provided, the current date and time will be used.

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

