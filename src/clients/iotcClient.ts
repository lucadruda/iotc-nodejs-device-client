// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IIoTCClient, ConnectionError, Result, IIoTCLogger, Callback, SendCallback, IIoTCProperty, OperationStatus, IoTCInterface } from "../types/interfaces";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_OK, IOTC_CONNECTION_ERROR, IOTC_EVENTS, DeviceTransport, DPS_DEFAULT_ENDPOINT, IOTC_LOGGING } from "../types/constants";
import { DigitalTwinClient, BaseInterface, CommandRequest, CommandResponse, Property, Telemetry } from 'azure-iot-digitaltwins-device';
import { X509, Message, } from "azure-iot-common";
import * as util from 'util';
import { Client as DeviceClient, Twin } from 'azure-iot-device';
import { ConsoleLogger } from "../consoleLogger";
import { DeviceProvisioning } from "../provision";
import { parse } from "./parseClient";
import IoTCCommand from "../models/iotcCommand";
import { InterfaceMap } from "../types/capabilities";
import IoTCProperty from "../models/iotcProperty";
import CommonInterface from "../models/commonInterface";


export class IoTCClient implements IIoTCClient {

    private events: {
        [s in IOTC_EVENTS]?: (message: string | any) => void
    }
    private interfaces: InterfaceMap = {};
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
        this.deviceProvisioning.setIoTCModelId(capabilityModelId);
        this.interfaces = {};
        this.events = {};
        this.onCommandReceived = this.onCommandReceived.bind(this);
        this.onPropertyUpdated = this.onPropertyUpdated.bind(this);
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
        this.interfaces = { ...this.interfaces, ...parse(model, this.onPropertyUpdated, this.onCommandReceived) };
    }

    setModelId(modelId: string): void {
        this.deviceProvisioning.setIoTCModelId(modelId);
    }
    setProxy(options: HTTP_PROXY_OPTIONS): void {
        throw new Error("Method not implemented.");
    }

    sendTelemetry(payload: any, interfaceName: string, param1?: any, param2?: any, param3?: any): any {
        this.logger.debug(`Sending telemetry ${JSON.stringify(payload)}`);
        let toSend = [];
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

        Object.keys(payload).map(telName => {
            this.logger.debug(`Sending telemetry ${telName} with value ${payload[telName]}`);
            if (this.interfaces[interfaceName]) {
                const tel = this.interfaces[interfaceName][telName];
                if (tel) {
                    tel['value'] = payload[telName];
                    toSend.push(tel);
                }
            }
        });
        if (callback && typeof callback === 'function') {
            toSend.map(t => {
                t.send(t.value, callback);
            });
        }
        else {
            return Promise.all(toSend.map(t => {
                t.send(t.value);
            }));
        }
    }

    sendProperty(payload: any, interfaceName: string, callback?: any): any {
        let toSend: IoTCProperty[] = [];
        try {
            payload = JSON.parse(payload);
        }
        catch (e) { }
        Object.keys(payload).map(propName => {
            this.logger.debug(`Sending property ${propName} with value ${payload[propName]}`);
            if (this.interfaces[interfaceName]) {
                const prop = this.interfaces[interfaceName][propName];
                if (prop) {
                    toSend.push(new IoTCProperty(prop, propName, interfaceName, this.interfaces[interfaceName].interfaceId, payload[propName]));
                }
            }
        });
        if (callback && typeof callback === 'function') {
            toSend.map(p => {
                p.send(callback);
            });
        }
        else {
            return Promise.all(toSend.map(p => {
                p.send();
            }));
        }
    }
    sendState(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        this.logger.debug(`Sending state ${JSON.stringify(payload)}`);
        return this.sendMessage(payload, null, timestamp, null, callback);
    }
    sendEvent(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): void | Promise<Result> {
        return this.sendMessage(payload, null, timestamp, null, callback);
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
                connStatusEvent('disconnected');
            }
            this.connected = false;

        });
        try {
            await util.promisify(this.deviceClient.open).bind(this.deviceClient)();
            this.connected = true;
            this.digitalTwinClient = new DigitalTwinClient(this.capabilityModelId, this.deviceClient);
            Object.keys(this.interfaces).map(inf => {
                this.digitalTwinClient.addInterfaceInstance(this.interfaces[inf]);
            });
            await this.digitalTwinClient.register();
            if (connStatusEvent) {
                connStatusEvent('connected');
            }
        }
        catch (err) {
            throw err;
        }
    }

    // private subscribe() {
    //     if (this.connected && this.twin) {
    //         if (this.events[IOTC_EVENTS.PropertiesUpdated]) {
    //             const propertiesUpdated = this.events[IOTC_EVENTS.PropertiesUpdated];
    //             this.onPropertyUpdated(setting.param, setting.callback);
    //         }
    //         else if (this.events[IOTC_EVENTS.Command]) {
    //             const command = this.events[IOTC_EVENTS.Command];
    //             this.onCommand(command.param, command.callback);
    //         }
    //         else if (this.events[IOTC_EVENTS.MessageReceived]) {
    //             const msg = this.events[IOTC_EVENTS.MessageReceived];
    //             this.onMessageReceived(msg.param, msg.callback);
    //         }
    //         else if (this.events[IOTC_EVENTS.MessageSent]) {
    //             const msg = this.events[IOTC_EVENTS.MessageSent];
    //             this.onMessageSent(msg.param, msg.callback);
    //         }
    //     }
    // }

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
        if (typeof (eventName) === 'string') {
            eventName = IOTC_EVENTS[eventName];
        }
        // assign callback to right event
        this.events[eventName] = callback;
    }

    private sendMessage(payload: any, interfaceName: string, properties: any, timestamp: string, callback?: (err: ConnectionError, result: Result) => void): void | Promise<Result> {
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

    private onMessageSent(settingName: string, callback) {
        if (settingName) {
            settingName = `.${settingName}`;
        }

        return this.twin.on(`properties.desired${
            settingName ? settingName : ''}`, callback);
    }

    public setLogging(logLevel: string | IOTC_LOGGING) {
        this.logger.setLogLevel(logLevel);
        this.logger.log(`Log level set to ${IOTC_LOGGING[logLevel]}`);
    }

    private onPropertyUpdated(interfaceObject: BaseInterface, propertyName: string, reportedValue: any, desiredValue: any, version: number): void {
        const callback = this.events[IOTC_EVENTS.PropertiesUpdated];
        const prop = new IoTCProperty(interfaceObject[propertyName], propertyName, interfaceObject.interfaceInstanceName, interfaceObject.interfaceId, desiredValue, version);
        this.logger.debug(`Property ${propertyName} in interface ${interfaceObject.interfaceInstanceName} has been updated with value ${desiredValue}`);
        if (callback && typeof callback === 'function') {
            callback(prop);
        }
    }

    private onCommandReceived(request: CommandRequest, response: CommandResponse): void {
        const callback = this.events[IOTC_EVENTS.Command];
        const cmd = new IoTCCommand(request.commandName, request.interfaceInstance.interfaceInstanceName, request.interfaceInstance.interfaceId, request.payload, null, response);
        this.logger.debug(`Received command ${cmd.name} from interface ${cmd.interfaceName} ${cmd.value ? 'with parameter' + cmd.value : ''}`);
        if (callback && typeof callback === 'function') {
            callback(cmd);
        }
    }
    addInterface(inf: IoTCInterface) {
        let infClass = new CommonInterface(inf.name, inf.id, this.onPropertyUpdated, this.onCommandReceived);
        if (inf.properties) {
            inf.properties.forEach(prop => infClass.addProperty(prop, true));
        }
        if (inf.commands) {
            inf.commands.forEach(cmd => infClass.addCommand(cmd));
        }
        if (inf.telemetry) {
            inf.telemetry.forEach(tel => infClass.addTelemetry(tel));
        }
        this.interfaces[inf.name] = infClass;

    }

}