// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { X509ProvisioningTransport, TpmProvisioningTransport, X509SecurityClient, TpmSecurityClient } from "azure-iot-provisioning-device/lib/interfaces";
import { X509, Message } from "azure-iot-common";
import { IOTC_CONNECT, HTTP_PROXY_OPTIONS, IOTC_CONNECTION_ERROR, IOTC_EVENTS, DeviceTransport, IOTC_LOGGING } from "./constants";

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

export type DeviceSecurityClient = X509SecurityClient | TpmSecurityClient;


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
    disconnect(callback?: (err: Error, result: Result) => void): void,
    /**
     * Connect the device
     */
    connect(callback?: (err: Error, result: Result) => void): void,
    /**
     * 
     * @param payload Message to send: can be any type (usually json) or a collection of messages
     * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
     * @param [callback] Function to execute when message gets delivered
     * @returns void or Promise<Result>
     */
    sendTelemetry(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): Promise<Result> | void,
    /**
    * 
    * @param payload State to send: can be any type (usually json) or a collection of states
    * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
    * @param [callback] Function to execute when state information gets delivered
    * @returns void or Promise<Result>
    */
    sendState(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): Promise<Result> | void,
    /**
     * 
     * @param payload Event to send: can be any type (usually json) or a collection of events
     * @param timestamp Timestamp in ISO format to set custom timestamp instead of now()
     * @param [callback] Function to execute when events gets triggered
     * @returns void or Promise<Result>
     */
    sendEvent(payload: any, timestamp?: string, callback?: (err: Error, result: Result) => void): Promise<Result> | void,
    /**
    * 
    * @param payload Property to send: can be any type (usually json) or a collection of properties
    * @param [callback] Function to execute when property gets set
    * @returns void or Promise<Result>
    */
    sendProperty(payload: any, callback?: (err: Error, result: Result) => void): Promise<Result> | void,
    /**
     * 
     * @param eventName name of the event to listen
     * @param callback function to execute when event triggers
     */
    on(eventName: string | IOTC_EVENTS, callback: (message: string | Message) => void): void

    setLogging(logLevel: string | IOTC_LOGGING): void

}

export interface IIoTCLogger {
    setLogLevel(logLevel: string | IOTC_LOGGING): void;
    log(message: string): void;
}


