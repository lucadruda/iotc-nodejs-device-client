import { Result, SendCallback, IIoTCProperty, OperationStatus, IIoTCCommand } from '../types/interfaces'
import { CommandResponse } from 'azure-iot-digitaltwins-device';


export default class IoTCCommand implements IIoTCCommand {

    constructor(public name, public interfaceName, public interfaceId, public value, public version, private resp: CommandResponse) {
    }

    acknowledge(status: OperationStatus, param1?: any, param2?: any): any {
        let statusMessage = 'command executed';
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
            this.resp.acknowledge(status, statusMessage, callback);
        }
        else {
            return this.resp.acknowledge(status, statusMessage);
        }
    }

    update(status: OperationStatus, param1?: any, param2?: any): any {
        let statusMessage = 'command update';
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
            this.resp.update(status, statusMessage).then(callback());
        }
        else {
            return new Promise<Result>(async (resolve, reject) => {
                try {
                    await this.resp.update(status, statusMessage);
                    resolve({ code: status });
                }
                catch (e) {
                    reject(e);
                }
            })
        }
    }


}