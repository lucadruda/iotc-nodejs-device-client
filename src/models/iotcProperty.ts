import { SendCallback, IIoTCProperty, OperationStatus, Result } from '../types/interfaces'
import { Client as DeviceClient, Twin } from 'azure-iot-device'



export default class IoTCProperty implements IIoTCProperty {

    constructor(public name: string, public interfaceName: string, public interfaceId: string, public value: string, private twin?: Twin, public version?: number) {
    }


    acknowledge(status: OperationStatus, param1?: any, param2?: any): any {
        if (!this.twin) {
            throw new Error('Property cannot be aknolwedged since has not been received from the cloud');
        }
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
            [`$.iotin:${this.interfaceName}`]: {
                [this.name]: {
                    value: this.value,
                    sv: this.version,
                    sc: status,
                    sd: statusMessage
                }
            }
        };

        if (callback && typeof callback === 'function') {
            this.twin.properties.reported.update(obj, callback);
        }
        else {
            return new Promise<Result>((resolve, reject) => {
                this.twin.properties.reported.update(obj, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else resolve({ code: OperationStatus.SUCCESS });
                });
            });
        }
    }


}