import { ICommand, Property, Result, SendCallback } from './interfaces'
import { IoTCClient } from '..';
import { DeviceMethodResponse, Message } from 'azure-iot-device';
import { IOTC_MESSAGE } from './constants';
export default class Command implements ICommand {


    public requestProperty: Property;
    private response: DeviceMethodResponse;

    constructor(client: IoTCClient, interfaceName: string, name: string, requestId: string);
    constructor(client: IoTCClient, interfaceName: string, name: string, requestId: string, option: Property | DeviceMethodResponse);
    constructor(client: IoTCClient, interfaceName: string, name: string, requestId: string, requestProperty: Property);
    constructor(client: IoTCClient, interfaceName: string, name: string, requestId: string, response: DeviceMethodResponse);
    constructor(private client: IoTCClient, public interfaceName: string, public name: string, public requestId: string, option?: Property | DeviceMethodResponse) {
        if (option) {
            if (option instanceof DeviceMethodResponse) {
                this.response = option as DeviceMethodResponse;
            }
            else {
                this.requestProperty = option as Property;
            }
        }
    }
    aknowledge(sync: boolean, param1?: any, param2?: any) {
        //@ts-ignore
        const response = this.response ? this.response : new DeviceMethodResponse(this.requestId, this.client.deviceClient._transport);
        let statusMessage = 'executed';
        let callback = null;
        if (param1) {
            if ((typeof param1) === 'string' && param1.length > 0) {
                statusMessage = param1 as string;
            }
            else {
                callback = param1 as SendCallback;
            }
        }
        if (param2) {
            callback = param2 as SendCallback;
        }

        if (callback) {
            response.send(sync ? 200 : 201, statusMessage, callback);
        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    await response.send(sync ? 200 : 201, statusMessage);
                    resolve(new Result(IOTC_MESSAGE.ACCEPTED));
                }
                catch (err) {
                    reject(err);
                }
            });
        }
    }

    update(param1?: any, param2?: any) {
        const commandUpdateSchemaProperty = 'iothub-message-schema';
        const commandUpdateCommandNameProperty = 'iothub-command-name';
        const commandUpdateRequestIdProperty = 'iothub-command-request-id';
        const commandUpdateStatusCodeProperty = 'iothub-command-statuscode';
        const messageInterfaceInstanceProperty: string = '$.ifname';
        let statusMessage = 'executed';
        let callback = null;
        if (param1) {
            if ((typeof param1) === 'string' && param1.length > 0) {
                statusMessage = param1 as string;
            }
            else {
                callback = param1 as SendCallback;
            }
        }
        if (param2) {
            callback = param2 as SendCallback;
        }
        if (callback) {
            this.client.sendMessage(statusMessage, {
                [commandUpdateSchemaProperty]: 'asyncResult',
                [commandUpdateCommandNameProperty]: this.name,
                [commandUpdateRequestIdProperty]: this.requestId,
                [commandUpdateStatusCodeProperty]: `${200}`,
                [messageInterfaceInstanceProperty]: this.interfaceName,
            }, null, callback);

        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    await this.client.sendMessage(statusMessage, {
                        [commandUpdateSchemaProperty]: 'asyncResult',
                        [commandUpdateCommandNameProperty]: this.name,
                        [commandUpdateRequestIdProperty]: this.requestId,
                        [commandUpdateStatusCodeProperty]: `${200}`,
                        [messageInterfaceInstanceProperty]: this.interfaceName,
                    });
                    resolve(new Result(IOTC_MESSAGE.ACCEPTED));
                }
                catch (err) {
                    reject(err);
                }
            });
        }
    }

}