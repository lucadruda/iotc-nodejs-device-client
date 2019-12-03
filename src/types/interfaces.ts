// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { X509ProvisioningTransport, TpmProvisioningTransport, X509SecurityClient, TpmSecurityClient } from "azure-iot-provisioning-device/lib/interfaces";
import { X509, Message } from "azure-iot-common";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_ERROR, IOTC_EVENTS, DeviceTransport, IOTC_LOGGING } from "./constants";
import { SymmetricKeySecurityClient } from "azure-iot-security-symmetric-key";

export class ConnectionError extends Error {
    constructor(message: string, public code: IOTC_CONNECTION_ERROR) {
        super(message);
    }
}
export class Result {
    constructor(public code?: any) {

    }
}

export type DeviceProvisioningTransport = X509ProvisioningTransport | TpmProvisioningTransport;

export type DeviceSecurityClient = X509SecurityClient | TpmSecurityClient | SymmetricKeySecurityClient;

export type SendCallback = (err: Error, result: Result) => void;


export interface IIoTCClient {

    // new(id: string, scopeId: string, authenticationType: IOTC_CONNECT, options: X509 | string): IIoTCClient
    /**
     * Get the current connection string
     */
    getConnectionString(): string;
    /**
     * Set transport protocol for the client
     * @param transport (http, mqtt or amqp)
     */
    setProtocol(transport: string | DeviceTransport): void,
    /**
     * 
     * @param modelId IoT Central model Id for automatic approval process
     */
    setModelId(modelId: string): void,
    /**
     * Set global endpoint for DPS provisioning
     * @param endpoint hostname without protocol
     */
    setGlobalEndpoint(endpoint: string): void,
    /**
     * Set network proxy for the connection
     * @param options object representing proxy configuration
     */
    setProxy(options: HTTP_PROXY_OPTIONS): void,
    /**
     * Disconnect device. Client cannot be reused after disconnect!!!
     */
    disconnect(): Promise<Result>,
    disconnect(callback: SendCallback): void,
    /**
     * Connect the device
     */
    connect(): Promise<Result>,
    connect(callback: SendCallback): void,
    /**
     * 
     * @param payload Message to send: can be any type (usually json) or a collection of messages
     * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
     * @param [callback] Function to execute when message gets delivered
     * @returns void or Promise<Result>
     */
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string): Promise<Result>
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, callback: SendCallback): void
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, properties: any): Promise<Result>
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, properties: any, callback: SendCallback): void
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, timestamp: string): Promise<Result>
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, timestamp: string, callback: SendCallback): void
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, properties: any, timestamp: string): Promise<Result>
    sendTelemetry(payload: any, interfaceName: string, interfaceId: string, properties: any, timestamp: string, callback: SendCallback): void
    /**
    * 
    * @param payload State to send: can be any type (usually json) or a collection of states
    * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
    * @param [callback] Function to execute when state information gets delivered
    * @returns void or Promise<Result>
    */
    sendState(payload: any, timestamp?: string, callback?: SendCallback): Promise<Result> | void,
    /**
     * 
     * @param payload Event to send: can be any type (usually json) or a collection of events
     * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
     * @param [callback] Function to execute when events gets triggered
     * @returns void or Promise<Result>
     */
    sendEvent(payload: any, timestamp?: string, callback?: SendCallback): Promise<Result> | void,
    /**
    * 
    * @param payload Property to send: can be any type (usually json) or a collection of properties
    * @param [callback] Function to execute when property gets set
    * @returns void or Promise<Result>
    */
    sendProperty(payload: any, callback?: SendCallback): Promise<Result> | void,
    /**
     * 
     * @param eventName name of the event to listen
     * @param callback function to execute when event triggers
     */
    on(eventName: string | IOTC_EVENTS, callback: Callback): void

    setLogging(logLevel: string | IOTC_LOGGING): void

}

export interface IIoTCLogger {
    setLogLevel(logLevel: string | IOTC_LOGGING): void;
    log(message: string): void;
    debug(message: string): void;
}

export enum CommandExecutionType {
    SYNC,
    ASYNC
}
interface Acknowledgable {
    acknowledge(): void | Promise<Result>,
    acknowledge(message: string): void | Promise<Result>,
    acknowledge(callback: SendCallback): void | Promise<Result>,
    acknowledge(message: string, callback: SendCallback): void | Promise<Result>
}

export interface ICommand extends Acknowledgable {
    interfaceName: string,
    requestId: string,
    name: string,
    requestProperty?: Property,
    type: CommandExecutionType,
    update(): void | Promise<Result>,
    update(message: string): void | Promise<Result>,
    update(callback: SendCallback): void | Promise<Result>,
    update(message: string, callback: SendCallback): void | Promise<Result>,
}


export type Property = {
    interfaceName: string
    name: string,
    value: any,
    statusCode?: number,
    statusMessage?: string,
    version?: number
}

export interface ISetting extends Property, Acknowledgable {
}

export type MessageCallback = (message: Message) => void;
export type SettingsCallback = (settings: ISetting[]) => void;
export type CommandCallback = (command: ICommand) => void;

export type Callback = MessageCallback | SettingsCallback | CommandCallback;
