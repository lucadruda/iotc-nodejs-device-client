// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export const DPS_ENDPOINT = 'global.azure-devices-provisioning.net';
export const DEFAULT_EXPIRATION_SECONDS = 21600; // 6 hours

/**-------------------------------------------------------------------------------------- */
export enum IOTC_PROTOCOL {
    MQTT = 1,
    AMQP = 2,
    HTTP = 4,
    MQTT_WS = 8,
    AMQP_WS = 16
}

/**-------------------------------------------------------------------------------------- */

export enum IOTC_LOGGING {
    DISABLED = 1,
    API_ONLY = 2,
    ALL = 16
}


/**-------------------------------------------------------------------------------------- */

export enum IOTC_CONNECT {
    SYMM_KEY = 1,
    DEVICE_KEY = 2,
    X509_CERT = 3,
    CONN_STRING = 4
}


/**-------------------------------------------------------------------------------------- */

export enum IOTC_CONNECTION_ERROR {
    EXPIRED_SAS_TOKEN = 1,
    DEVICE_DISABLED = 2,
    BAD_CREDENTIAL = 4,
    RETRY_EXPIRED = 8,
    NO_NETWORK = 10,
    COMMUNICATION_ERROR = 20
}

export const IOTC_CONNECTION_OK = 0x40;

/**-------------------------------------------------------------------------------------- */

export enum IOTC_MESSAGE {
    ACCEPTED = 1,
    REJECTED = 2,
    ABANDONED = 4
}


export type HTTP_PROXY_OPTIONS = {
    host_address: string,
    port: number,
    username: string,
    password: string
}

export enum IOTC_EVENTS {
    ConnectionStatus = 1,
    MessageSent = 2,
    MessageReceived = 4,
    Command = 8,
    SettingsUpdated = 10,
    Error = 20
}

export const DPS_DEFAULT_ENDPOINT = 'global.azure-devices-provisioning.net';
export enum DeviceTransport {
    HTTP,
    MQTT,
    AMQP,
    MQTT_WS,
    AMQP_WS
}
