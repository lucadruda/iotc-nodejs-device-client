// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IIoTCClient, ConnectionError, Result, IIoTCLogger } from "../types/interfaces";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_OK, IOTC_CONNECTION_ERROR, IOTC_EVENTS, DeviceTransport, DPS_DEFAULT_ENDPOINT, IOTC_LOGGING, IOTC_PROTOCOL } from "../types/constants";
import { X509, Message, callbackToPromise } from "azure-iot-common";
import * as util from 'util';
import { Client as DeviceClient, Twin, DeviceMethodResponse } from 'azure-iot-device';
import { ConsoleLogger } from "../consoleLogger";
import { log, error } from "util";
import { DeviceProvisioning } from "../provision";
import * as rhea from 'rhea';

export class IoTCClient implements IIoTCClient {



    private protocol: DeviceTransport = DeviceTransport.MQTT;
    private endpoint: string = DPS_DEFAULT_ENDPOINT;
    private connectionstring: string;
    private deviceClient: DeviceClient;
    private deviceProvisioning: DeviceProvisioning;
    private twin: Twin;
    private logger: IIoTCLogger;
    private modelId: string;
    constructor(readonly id: string, readonly scopeId: string, readonly authenticationType: IOTC_CONNECT | string, readonly options: X509 | string, logger?: IIoTCLogger) {
        if (typeof (authenticationType) == 'string') {
            this.authenticationType = IOTC_CONNECT[authenticationType.toUpperCase()];
        }
        if (logger) {
            this.logger = logger;
        }
        else {
            this.logger = new ConsoleLogger();
        }
        this.deviceProvisioning = new DeviceProvisioning(this.endpoint);
    }
    getConnectionString(): string {
        return this.connectionstring;
    }
    setProtocol(transport: string | DeviceTransport): void {
        if (typeof (transport) === 'string') {
            this.protocol = DeviceTransport[transport.toUpperCase()];
            this.logger.log(`Protocol set to ${DeviceTransport[this.protocol]}.`);
        }
        else {
            this.protocol = transport;
        }
    }
    setGlobalEndpoint(endpoint: string): void {
        this.endpoint = endpoint;
        this.logger.log(`Endpoint set to ${endpoint}.`);
    }

    setModelId(modelId: string): void {
        this.deviceProvisioning.setIoTCModelId(modelId);
    }
    setProxy(options: HTTP_PROXY_OPTIONS): void {
        throw new Error("Method not implemented.");
    }
    sendTelemetry(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        return this.sendMessage(payload, timestamp, callback);
    }
    sendState(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        return this.sendMessage(payload, timestamp, callback);
    }
    sendEvent(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        return this.sendMessage(payload, timestamp, callback);
    }
    sendProperty(payload: any, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        // payload = JSON.stringify(payload);
        this.logger.log(`Sending property ${payload}`);
        if (callback) {
            this.twin.properties.reported.update(payload, callback);
        }
        else {
            return new Promise<Result>((resolve, reject) => {
                this.twin.properties.reported.update(payload, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(new Result(IOTC_CONNECTION_OK));
                    }
                });
            });
        }
    }

    disconnect(callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        this.logger.log(`Disconnecting client...`);
        if (callback) {
            this.deviceClient.close((clientErr, clientRes) => {
                if (clientErr) {
                    callback(new Error(clientErr.message), new Result(IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR));
                }
                else {
                    callback(null, new Result(IOTC_CONNECTION_OK));
                }
            });
        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    const disconnectResult = await this.deviceClient.close();
                    resolve(new Result(IOTC_CONNECTION_OK));
                }
                catch (err) {
                    reject(new ConnectionError(err.message, IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR));
                }
            });
        }
    }

    async connect(): Promise<any> {
        this.logger.log(`Connecting client...`);
        this.connectionstring = await this.register();
        this.deviceClient = DeviceClient.fromConnectionString(this.connectionstring, await this.deviceProvisioning.getConnectionTransport(this.protocol));
        try {
            await util.promisify(this.deviceClient.open).bind(this.deviceClient)();
            if (!(this.protocol == DeviceTransport.HTTP)) {
                this.twin = await util.promisify(this.deviceClient.getTwin).bind(this.deviceClient)();
            }
        }
        catch (err) {
            throw err;
        }
    }

    /**
     * Implement in derived class based on the security protocol.
     * This is responsible of invoking DPS and creating hub connection string 
     */

    private async register(): Promise<string> {
        let connectionString: string;
        if (this.authenticationType == IOTC_CONNECT.X509_CERT) {
            const certificate = this.options as X509;
            const x509Security = await this.deviceProvisioning.generateX509SecurityClient(this.id, certificate);
            const registration = await this.deviceProvisioning.register(this.scopeId, this.protocol, x509Security);
            connectionString = `HostName=${registration.assignedHub};DeviceId=${registration.deviceId};x509=true`;
        }
        else {
            let sasKey;
            if (this.authenticationType == IOTC_CONNECT.SYMM_KEY) {
                sasKey = this.deviceProvisioning.computeDerivedKey(this.options as string, this.id);
            }
            else {
                sasKey = this.options as string;
            }
            const sasSecurity = await this.deviceProvisioning.generateSymKeySecurityClient(this.id, sasKey);
            const registration = await this.deviceProvisioning.register(this.scopeId, this.protocol, sasSecurity);
            connectionString = `HostName=${registration.assignedHub};DeviceId=${registration.deviceId};SharedAccessKey=${sasKey}`;
        }
        else if (this.authenticationType == IOTC_CONNECT.CONN_STRING) {
            // Just pass the provided connection string.
            connectionString = this.options;
        }
        return connectionString;
    }


    on(eventName: string | IOTC_EVENTS, callback: (message: string | any) => void): void {
        if (typeof (eventName) == 'number') {
            eventName = IOTC_EVENTS[eventName];
        }
        const settings = eventName.match(/^SettingsUpdated$|SettingsUpdated\.([\S]+)/); // matches "SettingsUpdated" or "SettingsUpdated.settingname"
        const messageReceived = eventName.match(/^MessageReceived$|MessageReceived\.([\S]+)/); // matches "SettingsUpdated" or "SettingsUpdated.settingname"
        const messageSent = eventName.match(/^MessageSent$|MessageSent\.([\S]+)/); // matches "MessageSent" or "MessageSent.settingname"
        const command = eventName.match(/^Command$|Command\.([\S]+)/); // matches "Command" or "Command.commandName"
        if (settings) {
            this.onSettingsUpdated(settings[1], callback);
        }
        else if (messageReceived) {
            this.onMessageReceived(messageReceived[1], callback);
        }
        else if (messageSent) {
            this.onMessageSent(messageSent[1], callback);
        }
        else if (command) {
            this.onCommand(command[1], callback);
        }
        else {
            this.deviceClient._transport.on('message', callback);
        }
    }

    sendMessage(payload: any, timestamp?: string, callback?: (err: ConnectionError, result: Result) => void): void | Promise<Result> {
        const clientCallback = (clientErr, clientRes) => {
            if (clientErr) {
                callback(new ConnectionError(clientErr.message, IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR), null);
            }
            else {
                callback(null, new Result(IOTC_CONNECTION_OK));
            }
        }
        if (callback) {
            if (payload instanceof Array) {
                this.deviceClient.sendEventBatch(payload.map(p => new Message(JSON.stringify(p))), clientCallback);
            }
            else {
                var message = new Message(JSON.stringify(payload));
                if (timestamp) {
                    message.properties.add('iothub-creation-time-utc', timestamp);
                }
                this.deviceClient.sendEvent(message, clientCallback);
            }
        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    if (payload instanceof Array) {
                        const messageEnqued = await this.deviceClient.sendEventBatch(payload.map(p => new Message(JSON.stringify(p))));
                        resolve(new Result(IOTC_CONNECTION_OK));
                    }
                    else {
                        var message = new Message(JSON.stringify(payload));
                        if (timestamp) {
                            message.properties.add('iothub-creation-time-utc', timestamp);
                        }
                        const messageEnqued = await this.deviceClient.sendEvent(message);
                        resolve(new Result(IOTC_CONNECTION_OK));
                    }
                }
                catch (err) {
                    reject(new ConnectionError(err.message, IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR));
                }
            });
        }
    }

    private onSettingsUpdated(settingName: string, callback) {
        if (settingName) {
            settingName = `.${settingName}`;
        }
        return this.twin.on(`properties.desired${settingName ? settingName : ''}`, (settings) => {
            let changed = {};
            Object.getOwnPropertyNames(settings).forEach((setting) => {
                this.logger.log(`Value of ${setting} changed.`)
                if (setting === "$version") {
                    return;
                }
                let reported = this.twin.properties.reported[setting];
                if (!reported || reported.desiredVersion != settings.$version) {
                    changed[setting] = settings[setting];
                }
            });
            if (Object.keys(changed).length > 0) {
                changed["$version"] = settings.$version;
                callback(changed);
            }
        });
    }
    private onMessageSent(settingName: string, callback) {
        if (settingName) {
            settingName = `.${settingName}`;
        }

        return this.twin.on(`properties.desired${
            settingName ? settingName : ''}`, callback);
    }

    private onMessageReceived(msgname: string, callback) {
        this.deviceClient.on(msgname, callback);
    }

    public setLogging(logLevel: string | IOTC_LOGGING) {
        this.logger.setLogLevel(logLevel);
        this.logger.log(`Log level set to ${logLevel}`);
    }


    private onCommand(commandName: string, callback) {
        if (!commandName) {
            if (this.protocol == DeviceTransport.MQTT) {
                this.deviceClient._transport.enableMethods((err) => {
                    if (err) {
                        throw new Error('Commands can\'t be received');
                    }
                    else {
                        const commandFormat = /\$iothub\/methods\/POST\/([\S]+)\/\?\$rid=([\d])+/;
                        (<any>this.deviceClient._transport)._mqtt.on('message', (topic, payload) => {
                            const commandMatch = topic.match(commandFormat);
                            if (commandMatch) {
                                this.respondToCommand(commandMatch[2], commandMatch[1], payload, callback);
                            }
                        });
                    }
                });

            }
            else if (this.protocol == DeviceTransport.AMQP) {
                this.deviceClient._transport.enableMethods((err) => {
                    (<any>this.deviceClient._transport)._deviceMethodClient._receiverLink.on('message', (msg) => {
                        this.respondToCommand(rhea.uuid_to_string(msg.correlation_id), msg.application_properties['IoThub-methodname'], JSON.parse(msg.body.content.toString()), callback);
                    });
                });
            }
            else {
                throw new Error('Commands are not supported over http');
            }

        } else {
            this.deviceClient.onDeviceMethod(commandName, (req, resp) => {
                this.respondToCommand(req.requestId, req.methodName, req.payload, callback, resp);
            });
        }
    }

    private respondToCommand(requestId: string, commandName: string, payload: any, callback, resp?: DeviceMethodResponse) {
        if (resp) {
            resp.send(200, { message: 'received' }, (err) => {
                callback({
                    requestId,
                    commandName,
                    payload
                });
            });
            return;
        }
        resp = new DeviceMethodResponse(requestId, this.deviceClient._transport);
        resp.send(200, { message: 'received' });
        this.deviceClient._transport.sendMethodResponse(resp, (err) => {
            if (err) {
                throw new Error('Can\'t reply to command');
            }
        });
        callback({
            requestId,
            commandName,
            payload
        });
    }

}