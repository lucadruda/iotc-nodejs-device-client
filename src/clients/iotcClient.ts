// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { IIoTCClient, IIoTCLogger, CommandCallback, PropertyCallback, ConnectionStatusCallback, IIoTCCommand, IIoTCCommandResponse, FileUploadResult } from "../types/interfaces";
import { IOTC_CONNECT, IOTC_EVENTS, DeviceTransport, DPS_DEFAULT_ENDPOINT, IOTC_LOGGING, IOTC_CONNECTION_STATUS } from "../types/constants";
import { X509, Message } from "azure-iot-common";
import * as util from 'util';
import { Client as DeviceClient, Twin, DeviceMethodResponse } from 'azure-iot-device';
import { ConsoleLogger } from "../consoleLogger";
import { DeviceProvisioning } from "../provision";
import * as rhea from 'rhea';
import { promiseTimeout } from "../utils/common";

export class IoTCClient implements IIoTCClient {
    isConnected(): boolean {
        return this.connected;
    }


    private events: {
        [s in IOTC_EVENTS]?: {
            callback: PropertyCallback | CommandCallback | ConnectionStatusCallback,
            filter?: string
        }
    }
    private protocol: DeviceTransport = DeviceTransport.MQTT;
    private endpoint: string = DPS_DEFAULT_ENDPOINT;
    private connectionstring: string;
    private deviceClient: DeviceClient;
    private deviceProvisioning: DeviceProvisioning;
    private connected: boolean;
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
        this.events = {};
    }
    async fetchTwin(): Promise<void> {
        this.twin = await util.promisify(this.deviceClient.getTwin).bind(this.deviceClient)();
    }
    uploadFile(fileName: string, contentType: string, fileData: any, encoding?: string): Promise<FileUploadResult> {
        throw new Error("Method not implemented.");
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


    async disconnect(): Promise<void> {
        this.logger.debug(`Disconnecting client...`);
        const disconnectResult = await this.deviceClient.close();
        return;
    }

    async connect(timeout: number = 30): Promise<any> {
        const connStatusEvent = this.events[IOTC_EVENTS.ConnectionStatus];
        this.logger.log(`Connecting client...`);
        this.connectionstring = await promiseTimeout(this.register.bind(this, this.modelId), timeout * 1000);
        this.deviceClient = DeviceClient.fromConnectionString(this.connectionstring, await this.deviceProvisioning.getConnectionTransport(this.protocol));
        if (this.authenticationType === IOTC_CONNECT.X509_CERT) {
            this.deviceClient.setOptions(this.options as X509);
        }
        this.deviceClient.on('disconnect', () => {
            if (connStatusEvent && connStatusEvent.callback) {
                (connStatusEvent.callback as ConnectionStatusCallback)(IOTC_CONNECTION_STATUS.DISCONNECTED);
            }
            this.connected = false;

        });
        this.deviceClient.on('connect', () => {
            if (connStatusEvent && connStatusEvent.callback) {
                (connStatusEvent.callback as ConnectionStatusCallback)(IOTC_CONNECTION_STATUS.CONNECTED);
            }
            this.connected = true;

        });

        try {
            await promiseTimeout(util.promisify(this.deviceClient.open).bind(this.deviceClient), timeout * 1000);
            this.connected = true;
            if (this.protocol !== DeviceTransport.HTTP) {
                this.twin = await promiseTimeout(util.promisify(this.deviceClient.getTwin).bind(this.deviceClient), timeout * 1000);
                this.subscribe();
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
            const x509Security = this.deviceProvisioning.generateX509SecurityClient(this.id, certificate);
            const registration = await this.deviceProvisioning.register(this.scopeId, this.protocol, x509Security);
            connectionString = `HostName=${registration.assignedHub};DeviceId=${registration.deviceId};x509=true`;
        }
        else {
            let sasKey: string;
            if (this.authenticationType == IOTC_CONNECT.SYMM_KEY) {
                sasKey = this.deviceProvisioning.computeDerivedKey(this.options as string, this.id);
            }
            else {
                sasKey = this.options as string;
            }
            const sasSecurity = this.deviceProvisioning.generateSymKeySecurityClient(this.id, sasKey);
            const registration = await this.deviceProvisioning.register(this.scopeId, this.protocol, sasSecurity);
            connectionString = `HostName=${registration.assignedHub};DeviceId=${registration.deviceId};SharedAccessKey=${sasKey}`;
        }

        return connectionString;
    }


    on(eventName: string | IOTC_EVENTS, callback: PropertyCallback | CommandCallback | ConnectionStatusCallback): void {
        if (typeof (eventName) == 'number') {
            eventName = IOTC_EVENTS[eventName];
        }
        const properties = eventName.match(/^Properties$|Properties\.([\S]+)/); // matches "Properties" or "Properties.propertyname"
        const commands = eventName.match(/^Commands$|Commands\.([\S]+)/);
        const connection = eventName.match(/^ConnectionStatus$/);
        if (properties) {
            this.events[IOTC_EVENTS.Properties] = {
                callback: callback as PropertyCallback,
                filter: properties[1] ? properties[1] : undefined
            }
        }
        else if (commands) {
            this.events[IOTC_EVENTS.Commands] = {
                callback,
                filter: commands[1] ? commands[1] : undefined
            }
        }
        else if (connection) {
            this.events[IOTC_EVENTS.ConnectionStatus] = {
                callback
            }
        }
    }

    async sendTelemetry(payload: any, properties?: any): Promise<void> {
        if (payload instanceof Array) {
            await this.deviceClient.sendEventBatch(payload.map(p => new Message(JSON.stringify(p))));
            return;
        }

        let message = new Message(JSON.stringify(payload));
        if (properties) {
            Object.keys(properties).forEach(prop => {
                if (prop.toLowerCase() === 'contenttype') {
                    message.contentType = properties[prop];
                }
                else if (prop.toLowerCase() === 'contentencoding') {
                    message.contentEncoding = properties[prop];
                }
                else {
                    message.properties.add(prop, properties[prop]);
                }
            });
        }
        await this.deviceClient.sendEvent(message);
    }

    async sendProperty(property: any): Promise<void> {
        // payload = JSON.stringify(payload);
        return new Promise((resolve, reject) => {
            this.logger.debug(`Sending property ${property}`);
            this.twin.properties.reported.update(property, (err: Error) => {
                if (err) {
                    reject(err);
                }
                else {
                    resolve();
                }
            });
        });
    }


    private subscribe() {
        if (this.connected && this.twin) {
            this.twin.on('properties.desired', this.onPropertiesUpdated.bind(this));
            this.listenToCommands();
            this.deviceClient.on('message', (msg) => {
                if (msg.properties && msg.properties.propertyList) {
                    const c2d = msg.properties.propertyList.find(p => p.key === 'method-name');
                    if (c2d) {
                        let cmd: IIoTCCommand = {
                            name: c2d.value.split(':')[1],
                            requestPayload: msg.data ? msg.getData() : undefined,
                            reply: async function (this: IoTCClient) {
                                await this.deviceClient.complete(msg);
                            }.bind(this),
                            requestId: null
                        }
                        const listener = this.events[IOTC_EVENTS.Commands];
                        if (!listener) {
                            return;
                        }
                        if ((listener.filter && listener.filter != cmd.name)) {
                            return;
                        }
                        // confirm reception first
                        (listener.callback as CommandCallback)(cmd);

                    }
                }
            });
        }
    }

    private onPropertiesUpdated(properties: {
        [x: string]: any,
        '$version': number
    }) {
        const listener = this.events[IOTC_EVENTS.Properties];
        if (!listener) {
            return;
        }
        Object.keys(properties).forEach(prop => {
            if ((listener.filter && listener.filter != prop) || prop === '$version') {
                return;
            }
            const propVersion = properties['$version'];
            let value = properties[prop];
            let wrapped = false;
            const valueType = typeof properties[prop];
            if (valueType !== 'string' && valueType !== 'number' && properties[prop].value) {
                value = properties[prop].value;
                wrapped = true;
            }
            (listener.callback as PropertyCallback)({
                name: prop,
                value,
                version: propVersion,
                ack: async function (this: IoTCClient, message?: string) {
                    if (wrapped) {
                        await this.sendProperty({
                            [prop]: {
                                ac: 200,
                                ad: message ? message : `Property applied`,
                                av: propVersion,
                                value
                            }
                        });
                    }
                    else {
                        await this.sendProperty({
                            [prop]: value
                        });
                    }
                }.bind(this)
            });
        });
    }

    private async ackCommand(requestId: string, message: string, status?: IIoTCCommandResponse) {
        if (!this.connected) {
            return;
        }
        let resp = new DeviceMethodResponse(requestId, this.deviceClient._transport);
        let responseStatus = 200;
        if (status && status == IIoTCCommandResponse.ERROR) {
            responseStatus = 500;
        }
        await resp.send(responseStatus, message);
    }

    private onCommandReceived(command: Partial<IIoTCCommand>) {
        const listener = this.events[IOTC_EVENTS.Commands];
        if (!listener) {
            return;
        }
        if ((listener.filter && listener.filter != command.name)) {
            return;
        }
        // confirm reception first
        (listener.callback as CommandCallback)({
            name: command.name as string,
            requestPayload: command.requestPayload as any,
            requestId: command.requestId as string,
            reply: async function (this: IoTCClient, status: IIoTCCommandResponse, message: string) {
                await this.ackCommand(command.requestId as string, message, status);
                await this.sendProperty({
                    [command.name as string]: {
                        value: message
                    }
                });
            }.bind(this)
        });
    }

    private listenToCommands() {
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
                            this.onCommandReceived({
                                name: commandMatch[1], requestId: commandMatch[2], requestPayload: payload
                            });
                        }
                    });
                }
            });

        }
        else if (this.protocol == DeviceTransport.AMQP) {
            this.deviceClient._transport.enableMethods((err) => {
                (<any>this.deviceClient._transport)._deviceMethodClient._receiverLink.on('message', (msg) => {
                    this.onCommandReceived({
                        name: msg.application_properties['IoThub-methodname'],
                        requestPayload: JSON.parse(msg.body.content.toString()),
                        requestId: rhea.uuid_to_string(msg.correlation_id)
                    });
                });
            });
        }
        else {
            throw new Error('Commands are not supported over http');
        }
    }


    public setLogging(logLevel: string | IOTC_LOGGING) {
        this.logger.setLogLevel(logLevel);
        this.logger.log(`Log level set to ${logLevel}`);
    }

}