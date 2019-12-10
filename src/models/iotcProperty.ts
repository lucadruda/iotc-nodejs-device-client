import { SendCallback, IIoTCProperty, OperationStatus, Result } from '../types/interfaces'
import { Client as DeviceClient } from 'azure-iot-device'
import { Property } from 'azure-iot-digitaltwins-device';



export default class IoTCProperty implements IIoTCProperty {

    constructor(private originalProp: Property, public name: string, public interfaceName: string, public interfaceId: string, public value: string, public version?: number) {
    }

    send(callback?: any) {
        if (callback) {
            this.originalProp.report(this.value, callback);
        }
        else {
            return this.originalProp.report(this.value);
        }
    }

    report(status: OperationStatus, param1?: any, param2?: any): any {
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
        let obj = {
            code: status,
            description: statusMessage,
            version: this.version
        };

        if (callback && typeof callback === 'function') {
            this.originalProp.report(this.value, obj, callback);
        }
        else {
            return this.originalProp.report(this.value, obj);
        }
    }


}