import { DeviceTransport, DEFAULT_EXPIRATION_SECONDS } from "./types/constants";
import { Buffer } from "buffer";
import * as crypto from 'crypto';
import { SharedAccessSignature } from 'azure-iot-common';
import * as https from 'https';
import { IIoTCLogger } from "./types/interfaces";
export class SASAuthentication {
    constructor(private endpoint: string, private id: string, private scopeId: string, private symKey: string, private protocol: DeviceTransport, private logger: IIoTCLogger) {
    }

    public deviceKey: string;
    public assignedHub: string;
    public async register(): Promise<any> {
        // const deviceProvisioning = new DeviceProvisioning(this.endpoint);
        const expiration = (Date.now() / 1000 | 0) + DEFAULT_EXPIRATION_SECONDS;
        this.deviceKey = this.computeKey(this.symKey, this.id);
        const sas = SharedAccessSignature.create(`${this.scopeId}%2fregistrations%2f${this.id}`, 'registration', this.deviceKey, expiration);
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8',
            'Connection': 'keep-alive',
            'UserAgent': 'prov_device_client/1.0',
            'Authorization': sas.toString()
        }
        const operationId = await this.httpRegister(headers);
        return await this.onHttpRegistration(operationId, headers);

        // TODO:
        // Comment out these lines when security client will be publicly available so code can be cleaner.
        // Registration works anyway using the approach above

        // const symSecurity = await deviceProvisioning.generateSymKeySecurityClient(this.id, this.options as string);
        // const registration = await deviceProvisioning.register(this.scopeId, this.protocol, symSecurity);

    }
    private async httpRegister(headers: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let registrationResponse: string = '';
            const regReq = https.request({
                host: this.endpoint,
                path: `/${this.scopeId}/registrations/${this.id}/register?api-version=2018-09-01-preview`,
                method: 'PUT',
                headers
            }, (resp) => {
                resp.on('data', (d) => {
                    registrationResponse = `${registrationResponse}${d}`;
                });
                resp.on('end', () => {
                    const data = JSON.parse(registrationResponse);
                    if (data.errorCode) {
                        reject(`${data.errorCode}:${data.message}`);
                    }
                    resolve(data.operationId);
                });
            });
            regReq.write(JSON.stringify({
                registrationId: this.id
            }));
            regReq.on('error', (err) => {
                reject(err.message);
            });
            regReq.end();
        });
    }

    private onHttpRegistration(operationId: string, headers: any): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            let registrationResponse: string = '';
            const regReq = https.request({
                host: this.endpoint,
                path: `/${this.scopeId}/registrations/${this.id}/operations/${operationId}?api-version=2018-09-01-preview`,
                method: 'GET',
                headers

            }, (resp) => {
                resp.on('data', (d) => {
                    registrationResponse = `${registrationResponse}${d}`;
                });
                resp.on('end', async () => {
                    const data = JSON.parse(registrationResponse);
                    if (data.status == 'assigned') {
                        resolve(data.registrationState)
                    }
                    else if (data.status == 'assigning') {
                        this.logger.log(`Waiting for registration...`);
                        await new Promise(r => setTimeout(r, 2000));
                        resolve(await this.onHttpRegistration(operationId, headers));
                    }
                    else {
                        reject(`${data.errorCode}:${data.message}`);
                    }
                });
            });
            regReq.write(JSON.stringify({
                registrationId: this.id
            }));
            regReq.on('error', (err) => {
                reject(err.message);
            });
            regReq.end();
        })
    }

    private computeKey(masterKey, regId) {
        return crypto.createHmac('SHA256', Buffer.from(masterKey, 'base64'))
            .update(regId, 'utf8')
            .digest('base64');
    }
}