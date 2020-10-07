// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { exec as openssl } from 'openssl-wrapper';
import * as path from 'path';
import { promises as fs } from 'fs';

const DEFAULT_ROOT_FOLDER = path.join('./certificates');
const DEFAULT_PASSWORD = 'abcd456';
const DEFAULT_COMMON_NAME = 'Azure IoTCentral'
const DEFAULT_TTL = 360;
const DEFAULT_ALGORITHM = 'genrsa';
const INTERMEDIATE_EXTENSION = 'v3_intermediate_ca';
const LEAF_EXTENSION = 'server_cert';


type Certificate = {
    privateKey?: string,
    public?: string,
    password?: string,
    commonName?: string,
    ttl?: number
    chain?: string,
    csr?: string,
    config?: string
}

export type CertificatesConfiguration = {
    rootFolder: string,
    root_ca: Certificate,
    intermediate_ca: Certificate,
    device_ca: (deviceName: string) => Certificate
}

const defaultConfig: CertificatesConfiguration = {
    rootFolder: DEFAULT_ROOT_FOLDER,
    root_ca: {
        public: path.join(DEFAULT_ROOT_FOLDER, 'certs/root_ca.cert.pem'),
        privateKey: path.join(DEFAULT_ROOT_FOLDER, 'private/root_ca.key.pem'),
        config: path.join(__dirname, '../../openssl/openssl_root_ca.cnf'),
        password: DEFAULT_PASSWORD,
        commonName: DEFAULT_COMMON_NAME,
        ttl: DEFAULT_TTL
    },
    intermediate_ca: {
        public: path.join(DEFAULT_ROOT_FOLDER, 'certs/intermediate_ca.cert.pem'),
        privateKey: path.join(DEFAULT_ROOT_FOLDER, 'private/intermediate_ca.key.pem'),
        config: path.join(__dirname, '../../openssl/openssl_device_intermediate_ca.cnf'),
        password: DEFAULT_PASSWORD,
        commonName: DEFAULT_COMMON_NAME,
        ttl: DEFAULT_TTL,
        csr: path.join(DEFAULT_ROOT_FOLDER, 'csr/intermediate_ca.csr.pem'),
        chain: path.join(DEFAULT_ROOT_FOLDER, 'certs/intermediate_ca.chain.pem')
    },
    device_ca: (deviceName) => ({
        public: path.join(DEFAULT_ROOT_FOLDER, `certs/${deviceName}.cert.pem`),
        privateKey: path.join(DEFAULT_ROOT_FOLDER, `private/${deviceName}.key.pem`),
        config: path.join(__dirname, '../../openssl/openssl_device_intermediate_ca.cnf'),
        csr: path.join(DEFAULT_ROOT_FOLDER, `csr/${deviceName}.csr.pem`),
        commonName: deviceName,
        ttl: DEFAULT_TTL,
        chain: path.join(DEFAULT_ROOT_FOLDER, `certs/${deviceName}.chain.pem`)
    })
}

export class CertificateGenerator {
    private config: CertificatesConfiguration;
    constructor(private devicesCount: number, private devicesNamePrefix: string = 'device', config?: CertificatesConfiguration) {
        this.config = Object.assign({}, defaultConfig, config)
    }

    private async createCAPrivKey(cert: Certificate): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const params = {
                aes256: true,
                passout: `pass:${cert.password}`,
                4096: false,
                out: cert.privateKey

            }
            openssl('genrsa', params, (err, output) => {
                if (err) {
                    console.log(err);
                    reject(err.message);
                }
                else resolve();
            });
        });
    }

    private async createCert(cert: Certificate): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const params = {
                config: cert.config,
                new: true,
                x509: true,
                passin: `pass:${cert.password}`,
                key: cert.privateKey,
                subj: `/CN=${cert.commonName}`,
                days: cert.ttl,
                sha256: true,
                extensions: 'v3_ca',
                out: cert.public
            }

            openssl('req', params, (err, output) => {
                if (err) {
                    console.log(err);
                    reject(err.message);
                }
                else resolve();
            });
        });
    }

    private async createCsr(cert: Certificate): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const params = {
                config: cert.config,
                new: true,
                key: cert.privateKey,
                subj: `/CN=${cert.commonName}`,
                sha256: true,
                out: cert.csr
            }
            if (cert.password) {
                params['passin'] = `pass:${cert.password}`;
            }

            openssl('req', params, (err, output) => {
                if (err) {
                    console.log(err);
                    reject(err.message);
                }
                else resolve();
            });
        });
    }

    private async signCert(cert: Certificate, signer: Certificate, extension: string): Promise<void> {
        return new Promise<void>(async (resolve, reject) => {
            const params = {
                config: signer.config,
                batch: true,
                notext: true,
                passin: `pass:${signer.password}`,
                md: 'sha256',
                days: cert.ttl,
                in: cert.csr,
                extensions: extension,
                out: cert.public
            }

            openssl('ca', params, (err, output) => {
                if (err) {
                    console.log(err);
                    reject(err.message);
                }
                else resolve();
            });
        });
    }

    private async createChain(certConfig: Certificate, ...certs: string[]) {
        await fs.writeFile(certConfig.chain, (await Promise.all(certs.map(async cert => {
            return fs.readFile(cert);
        }))).join(''));
    }

    public async init() {
        console.log(`Certificates will be saved under ${this.config.rootFolder}`);
        await fs.rmdir(this.config.rootFolder);
        await fs.mkdir(path.join(this.config.root_ca.public, '..'), { recursive: true });
        await fs.mkdir(path.join(this.config.root_ca.privateKey, '..'), { recursive: true });
        await fs.mkdir(path.join(this.config.intermediate_ca.public, '..'), { recursive: true });
        await fs.mkdir(path.join(this.config.intermediate_ca.privateKey, '..'), { recursive: true });
        await fs.mkdir(path.join(this.config.intermediate_ca.csr, '..'), { recursive: true });
        await fs.mkdir(path.join(this.config.rootFolder, 'newcerts'));
        await fs.writeFile(path.join(this.config.rootFolder, 'index.txt'), '');
        await fs.writeFile(path.join(this.config.rootFolder, 'serial'), '01');
        // set env for openssl
        process.env['ROOT_FOLDER'] = this.config.rootFolder
    }
    public async generateRoot() {
        try {
            // generate root
            await this.createCAPrivKey(this.config.root_ca);

            await this.createCert(this.config.root_ca);
            //generate intermediate
            await this.createCAPrivKey(this.config.intermediate_ca);

            await this.createCsr(this.config.intermediate_ca);

            await this.signCert(this.config.intermediate_ca, this.config.root_ca, INTERMEDIATE_EXTENSION);
            await this.createChain(this.config.intermediate_ca, this.config.intermediate_ca.public, this.config.root_ca.public);
        } catch (e) {
            console.log(e);
        }
    }

    private async createLeaf(cert: Certificate, signer: Certificate) {
        await new Promise(async (resolve, reject) => {
            const params = {
                4096: false,
                out: cert.privateKey
            }

            openssl(DEFAULT_ALGORITHM, params, (err, output) => {
                if (err) {
                    reject(err.message);
                }
                else resolve();
            });
        });
        await this.createCsr(cert);
        await this.signCert(cert, signer, LEAF_EXTENSION);
        await this.createChain(cert, cert.public, this.config.intermediate_ca.public, this.config.root_ca.public);
    }

    public async createDevices() {
        for (let i = 0; i < this.devicesCount; i++) {
            console.log(`Creating certificates for ${this.devicesNamePrefix}${i}`);
            try {
                await this.createLeaf(this.config.device_ca(`${this.devicesNamePrefix}${i}`), this.config.intermediate_ca);
            }
            catch (e) { }
        }
    }
    public async validate(validationCode: string): Promise<string> {
        await this.createLeaf({
            public: path.join(this.config.rootFolder, `validation.cert.pem`),
            privateKey: path.join(this.config.rootFolder, `validation.key.pem`),
            config: this.config.root_ca.config,
            password: DEFAULT_PASSWORD,
            commonName: validationCode,
            ttl: DEFAULT_TTL,
            chain: path.join(this.config.rootFolder, `validation.chain.pem`)
        }, this.config.root_ca);
        return path.join(this.config.rootFolder, `validation.cert.pem`);
    }
}
