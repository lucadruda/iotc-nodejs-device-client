// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { X509ProvisioningTransport, TpmProvisioningTransport } from "azure-iot-provisioning-device";
import { X509, Message } from "azure-iot-common";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_ERROR, IOTC_EVENTS, IOTC_LOGGING, IOTC_CONNECTION_STATUS } from "./constants";
import { SymmetricKeySecurityClient } from "azure-iot-security-symmetric-key";
import { X509Security } from "azure-iot-security-x509";

export class ConnectionError extends Error {
    constructor(message: string, public code: IOTC_CONNECTION_ERROR) {
        super(message);
    }
}
export class Result {
    constructor(public code?: any) {

    }
}

export type DeviceProvisioningTransport = X509ProvisioningTransport;

export type DeviceSecurityClient = X509Security | SymmetricKeySecurityClient;


export interface IIoTCProperty {
    name: string,
    value: any,
    version: number,
    ack: () => Promise<void>
}

export enum IIoTCCommandResponse {
    SUCCESS,
    ERROR
}

export interface IIoTCCommand {
    name: string,
    requestPayload: any,
    requestId: string,
    reply: (status: IIoTCCommandResponse, message: string) => Promise<void>
}
export type PropertyCallback = (data: IIoTCProperty) => void | Promise<void>;
export type CommandCallback = (data: IIoTCCommand) => void | Promise<void>;
export type ConnectionCallback = (connectionStatus: IOTC_CONNECTION_STATUS) => void | Promise<void>;

export interface IIoTCClient {

    getConnectionString(): string,
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
     * Disconnect device. Client cannot be reused after disconnect!!!
     * @returns The disconnection reason
     */
    disconnect(): Promise<string>,
    /**
     * Connect the device
     */
    connect(cleanSession?: boolean): Promise<void>,
    /**
     * 
     * @param payload Message to send: can be any type (usually json) or a collection of messages
     * @param properties Properties to be added to the message (JSON format)
     * @returns void or Promise<Result>
     */
    sendTelemetry(payload: any, properties?: any): Promise<void>,
    /**
    * 
    * @param payload Property to send: can be any type (usually json) or a collection of properties
    * @param [callback] Function to execute when property gets set
    * @returns void or Promise<Result>
    */
    sendProperty(payload: any): Promise<void>,
    /**
     * 
     * @param eventName name of the event to listen
     * @param callback function to execute when event triggers
     */
    on(eventName: IOTC_EVENTS.Properties | string, callback: PropertyCallback): void,
    on(eventName: IOTC_EVENTS.Commands | string, callback: CommandCallback): void,

    setLogging(logLevel: string | IOTC_LOGGING): void,

    isConnected(): boolean,

    fetchTwin(): Promise<void>

}

export interface IIoTCLogger {
    setLogLevel(logLevel: string | IOTC_LOGGING): void;
    log(message: string, tag?: string): void;
    debug(message: string, tag?: string): void;
}


