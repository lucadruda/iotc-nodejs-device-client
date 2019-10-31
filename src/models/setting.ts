import { Property, Result, SendCallback, ISetting } from '../types/interfaces'
import { IoTCClient } from '..';
import { DeviceMethodResponse } from 'azure-iot-device';
import { IOTC_MESSAGE } from '../types/constants';

export default class Setting implements ISetting {
    value: any;
    statusCode?: number;
    statusMessage?: string;



    constructor(client: IoTCClient, interfaceName: string, name: string, version: number);
    constructor(client: IoTCClient, interfaceName: string, name: string, version: number, value: any);
    constructor(private client: IoTCClient, public interfaceName: string, public name: string, public version: number, value?: any) {
        if (value) {
            this.value = value;
        }
    }
    aknowledge(param1?: any, param2?: any) {
        let statusMessage = 'registered';
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
        let prop: Property = {
            ...this,
            statusCode: 201,
            version: this.version,
            statusMessage
        };
        if (callback) {
            this.client.sendProperty.bind(this.client)(prop, callback);
        }
        else {
            return this.client.sendProperty.bind(this.client)(prop) as Promise<Result>;
        }
    }


}