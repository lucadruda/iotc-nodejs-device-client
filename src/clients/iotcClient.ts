// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IIoTCClient, ConnectionError, Result, IIoTCLogger, Property, SettingsCallback, CommandCallback, Callback, MessageCallback, SendCallback } from "../types/interfaces";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_OK, IOTC_CONNECTION_ERROR, IOTC_EVENTS, DeviceTransport, DPS_DEFAULT_ENDPOINT, IOTC_LOGGING } from "../types/constants";
import { DigitalTwinClient, BaseInterface } from 'azure-iot-digitaltwins-device';
import { X509, Message, } from "azure-iot-common";
import * as util from 'util';
import { Client as DeviceClient, Twin, DeviceMethodResponse } from 'azure-iot-device';
import { ConsoleLogger } from "../consoleLogger";
import { DeviceProvisioning } from "../provision";
import * as rhea from 'rhea';
import { isObject, getTransportString } from "../utils/commons";
import Command from "../models/command";
import Setting from "../models/setting";
import { threadId } from "worker_threads";

interface InterfaceType<T extends BaseInterface> {
    [name: string]: T
}

export class IoTCClient implements IIoTCClient {

    private events: {
        [s in IOTC_EVENTS]?: {
            callback: (message: string | any) => void,
            param: any
        }
    }
    private interfaces: InterfaceType<>;
    private connected: boolean;
    private protocol: DeviceTransport = DeviceTransport.MQTT;
    private endpoint: string = DPS_DEFAULT_ENDPOINT;
    private connectionstring: string;
    private deviceClient: DeviceClient;
    private deviceProvisioning: DeviceProvisioning;
    private digitalTwinClient: DigitalTwinClient;
    private twin: Twin;
    private logger: IIoTCLogger;
    private constructor(readonly id: string, readonly scopeId: string, readonly capabilityModelId: string, readonly authenticationType: IOTC_CONNECT | string, readonly options: X509 | string, logger?: IIoTCLogger) {
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
        this.setCapabilityModel(capabilityModelId);
        this.interfaces = {};
    }

    static create(id: string, scopeId: string, modelId: string, authenticationType: IOTC_CONNECT | string, options: X509 | string, logger?: IIoTCLogger): IIoTCClient {
        return new IoTCClient(id, scopeId, modelId, authenticationType, options, logger);
    }

    isConnected(): boolean {
        return this.connected;
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

    setCapabilityModel(model: any): void {
        this.deviceProvisioning.setCapabilityModel(model);
    }

    setModelId(modelId: string): void {
        this.deviceProvisioning.setIoTCModelId(modelId);
    }
    setProxy(options: HTTP_PROXY_OPTIONS): void {
        throw new Error("Method not implemented.");
    }

    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, param1?: any, param2?: any, param3?: any): any {
        this.logger.debug(`Sending telemetry ${JSON.stringify(payload)}`);
        let callback: SendCallback = null;
        let properties: any = null;
        let timestamp: string = null;
        if (param1) {
            switch (typeof param1) {
                case 'object':
                    properties = param1;
                    break;
                case 'string':
                    timestamp = param1;
                    break;
                default:
                    callback = param1;
            }
        }
        if (param2) {
            switch (typeof param2) {
                case 'string':
                    timestamp = param2;
                    break;
                default:
                    callback = param2;
            }
        }
        if (param3 && (typeof param3 === 'function')) {
            callback = param3;
        }
        return this.sendMessage(payload, interfaceName, interfaceId, properties, timestamp, callback);
    }
    sendState(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        this.logger.debug(`Sending state ${JSON.stringify(payload)}`);
        return this.sendMessage(payload, null, null, timestamp, null, callback);
    }
    sendEvent(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        return this.sendMessage(payload, null, null, timestamp, null, callback);
    }
    sendProperty(property: Property, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        let payload = {
            [property.interfaceName]: {
                [property.name]: {
                    value: property.value
                }
            }
        };
        if (property.statusCode) {
            payload[property.interfaceName][property.name]['sc'] = property.statusCode;
        }
        if (property.statusMessage && property.statusMessage.length > 0) {
            payload[property.interfaceName][property.name]['sd'] = property.statusMessage;
        }
        if (property.version && property.version > 0) {
            payload[property.interfaceName][property.name]['sv'] = property.version;
        }
        if (callback && typeof callback === 'function') {
            this.logger.debug(`Sending property ${property.name}. Payload: ${payload}`);
            this.twin.properties.reported.update(payload, callback);
        }
        else {
            return new Promise<Result>((resolve, reject) => {
                this.logger.debug(`Sending property ${property.name}. Payload: ${JSON.stringify(payload)}`);
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

    disconnect(callback?: (err: Error, result: Result) => void): any {
        this.logger.log(`Disconnecting client...`);
        if (callback && typeof callback === 'function') {
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
        this.logger.log(`Using protocol ${DeviceTransport[this.protocol]}`);
        this.logger.log(`Connecting client...`);
        const connStatusEvent = this.events[IOTC_EVENTS.ConnectionStatus];
        this.connectionstring = await this.register();
        this.deviceClient = DeviceClient.fromConnectionString(this.connectionstring, await this.deviceProvisioning.getConnectionTransport(this.protocol));
        this.deviceClient.on('disconnect', () => {
            if (connStatusEvent) {
                connStatusEvent.callback('disconnected');
            }
            this.connected = false;

        });
        try {
            await util.promisify(this.deviceClient.open).bind(this.deviceClient)();
            this.connected = true;
            this.digitalTwinClient = new DigitalTwinClient(this.capabilityModelId, this.deviceClient);
            if (this.protocol != DeviceTransport.HTTP) {
                this.twin = await util.promisify(this.deviceClient.getTwin).bind(this.deviceClient)();
                this.subscribe();
            }
            if (connStatusEvent) {
                connStatusEvent.callback('connected');
            }
        }
        catch (err) {
            throw err;
        }
    }

    private subscribe() {
        if (this.connected && this.twin) {
            if (this.events[IOTC_EVENTS.SettingsUpdated]) {
                const setting = this.events[IOTC_EVENTS.SettingsUpdated];
                this.onSettingsUpdated(setting.param, setting.callback);
            }
            else if (this.events[IOTC_EVENTS.Command]) {
                const command = this.events[IOTC_EVENTS.Command];
                this.onCommand(command.param, command.callback);
            }
            else if (this.events[IOTC_EVENTS.MessageReceived]) {
                const msg = this.events[IOTC_EVENTS.MessageReceived];
                this.onMessageReceived(msg.param, msg.callback);
            }
            else if (this.events[IOTC_EVENTS.MessageSent]) {
                const msg = this.events[IOTC_EVENTS.MessageSent];
                this.onMessageSent(msg.param, msg.callback);
            }
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
        else if (this.authenticationType == IOTC_CONNECT.CONN_STRING) {
            // Just pass the provided connection string.
            connectionString = this.options as string;
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

        return connectionString;
    }


    on(eventName: string | IOTC_EVENTS, callback: Callback): void {
        if (typeof (eventName) == 'number') {
            eventName = IOTC_EVENTS[eventName];
        }
        const settings = eventName.match(/^SettingsUpdated$|SettingsUpdated\.([\S]+)/); // matches "SettingsUpdated" or "SettingsUpdated.settingname"
        const messageReceived = eventName.match(/^MessageReceived$|MessageReceived\.([\S]+)/); // matches "SettingsUpdated" or "SettingsUpdated.settingname"
        const messageSent = eventName.match(/^MessageSent$|MessageSent\.([\S]+)/); // matches "MessageSent" or "MessageSent.settingname"
        const command = eventName.match(/^Command$|Command\.([\S]+)/); // matches "Command" or "Command.commandName"
        if (settings) {
            this.onSettingsUpdated(settings[1], callback as SettingsCallback);
        }
        else if (messageReceived) {
            this.onMessageReceived(messageReceived[1], callback);
        }
        else if (messageSent) {
            this.onMessageSent(messageSent[1], callback);
        }
        else if (command) {
            this.onCommand(command[1], callback as CommandCallback);
        }
        else {
            this.deviceClient._transport.on('message', callback as MessageCallback);
        }
    }

    private sendMessage(payload: any, interfaceName: string, interfaceId: string, properties: any, timestamp: string, callback?: (err: ConnectionError, result: Result) => void): void | Promise<Result> {
        let messages: Message[] = [];
        const clientCallback = (clientErr, clientRes) => {
            if (clientErr) {
                callback(new ConnectionError(clientErr.message, IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR), null);
            }
            else {
                callback(null, new Result(IOTC_CONNECTION_OK));
            }
        }
        if (payload instanceof Array) {
            payload.map(p => {
                messages.push(new Message(JSON.stringify(p)));
            });
        }
        else {
            messages.push(new Message(JSON.stringify(payload)));
        }
        if (timestamp) {
            messages.forEach(m => m.properties.add('iothub-creation-time-utc', timestamp));
        }
        if (properties) {
            Object.keys(properties).forEach(propName => {
                messages.forEach(m => m.properties.add(propName, properties[propName]));
            });
        }

        if (callback && typeof callback === 'function') {
            if (payload instanceof Array) {
                this.deviceClient.sendEventBatch(messages, clientCallback);
            }
            else {
                this.deviceClient.sendEvent(messages[0], clientCallback);
            }
        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    if (payload instanceof Array) {
                        await this.deviceClient.sendEventBatch(messages);
                        resolve(new Result(IOTC_CONNECTION_OK));
                    }
                    else {
                        await this.deviceClient.sendEvent(messages[0]);
                        resolve(new Result(IOTC_CONNECTION_OK));
                    }
                }
                catch (err) {
                    reject(new ConnectionError(err.message, IOTC_CONNECTION_ERROR.COMMUNICATION_ERROR));
                }
            });
        }
    }

    private onSettingsUpdated(settingName: string, callback: SettingsCallback) {
        if (settingName) {
            settingName = `.${settingName}`;
        }
        return this.twin.on(`properties.desired${settingName ? settingName : ''}`, (payload) => {
            // console.log(`Settings:${JSON.stringify(settings)}`);
            let changed: Setting[] = [];
            Object.getOwnPropertyNames(payload).forEach((interfaceName) => {
                if (interfaceName === "$version") {
                    return;
                }
                this.logger.debug(`Settings in ${interfaceName} changed.`)
                let inf = payload[interfaceName];
                if (interfaceName.startsWith('$iotin:') && isObject(inf)) {
                    let client = this;
                    // this is an interface. loop through capabilities
                    Object.keys(inf).forEach(settingName => changed.push(new Setting(client, interfaceName, settingName, payload.$version, inf[settingName].value)));
                }
            });
            callback(changed);
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
        this.logger.log(`Log level set to ${IOTC_LOGGING[logLevel]}`);
    }


    private onCommand(commandName: string, callback: CommandCallback) {
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
                                this.logger.debug(`Received command ${commandMatch[1]}`);
                                this.respondToCommand(commandMatch[2], commandMatch[1], payload, callback);
                            }
                        });
                    }
                });

            }
            else if (this.protocol == DeviceTransport.AMQP) {
                this.deviceClient._transport.enableMethods((err) => {
                    (<any>this.deviceClient._transport)._deviceMethodClient._receiverLink.on('message', (msg) => {
                        this.logger.debug(`Received command ${msg.application_properties['IoThub-methodname']}`);
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

    private respondToCommand(requestId: string, commandName: string, payload: any, callback: CommandCallback, resp?: DeviceMethodResponse) {
        const matches = commandName.match(/^\$iotin:([\S]+)\*([\S]+)/);
        if (matches.length <= 1) {
            // bad name
            return;
        }

        let client = this;
        let command: Command = new Command(client, matches[1], matches[2], requestId);
        try {
            let commandRequest = JSON.parse(payload.toString());
            let prop: Property = {
                name: command.name,
                interfaceName: command.interfaceName,
                value: commandRequest.commandRequest.value
            }
            command.requestProperty = prop;
        }
        catch (e) {
            //commandRequest not an object
        }
        callback(command);
    }

    addInterface(param1: any, param2?: any) {
        if (typeof param1 === 'string') {

        }
        else {
            const inf = param1 as BaseInterface;
            this.interfaces[inf.interfaceInstanceName] = inf;
        }
    }

}