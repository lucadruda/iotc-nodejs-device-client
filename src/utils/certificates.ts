// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

import { pki, md } from 'node-forge';
import * as path from 'path';
import { promises as fs } from 'fs';
import { createInterface } from 'readline';


type InputReader = {
    question: (questionText: string) => Promise<string>
}

const getInputReader = function (): InputReader {
    const rl = createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return {
        question: (questionText: string) => {
            return new Promise((resolve) => {
                rl.question(questionText, (answer) => {
                    resolve(answer);
                });
            });
        }
    }
}

const Log = function (tag: 'INFO' | 'DEBUG', msg: string) {
    if (tag === 'DEBUG') {
        if (process.env.DEBUG) {
            console.log(msg);
        }
    }
    else {
        console.log(msg);
    }
}

export type CertificatesOptions = {
    outFolder: string,
    passphrase: string,
    yearsTTL: number,
    defaultAlgorithm: string,
    keyBits: number,
    intermediateExtension: string,
    leafExtension: string
}

const defaultOptions: CertificatesOptions = {
    outFolder: path.join('./certificates'),
    passphrase: 'abcd456',
    yearsTTL: 1,
    defaultAlgorithm: 'genrsa',
    keyBits: 4096,
    intermediateExtension: 'v3_intermediate_ca',
    leafExtension: 'server_cert'
}

let options: CertificatesOptions;
let certificateAttrs: pki.CertificateField[];

const certificateExtensions = [
    {
        name: 'subjectKeyIdentifier',
    },
    {
        name: 'keyUsage',
        keyCertSign: true,
        digitalSignature: true,
        nonRepudiation: true,
        keyEncipherment: true,
        dataEncipherment: true
    }, {
        name: 'extKeyUsage',
        serverAuth: true,
        clientAuth: true,
        codeSigning: true,
        emailProtection: true,
        timeStamping: true
    }, {
        name: 'nsCertType',
        client: true,
        server: true,
        email: true,
        objsign: true,
        sslCA: true,
        emailCA: true,
        objCA: true
    }]

type Certificate = {
    privateKey?: pki.PrivateKey,
    public?: string,
    password?: string,
    commonName?: string,
    ttl?: number
    chain?: string,
    csr?: string,
    config?: string
}


async function createCAPrivKey(): Promise<pki.rsa.KeyPair> {
    return new Promise((resolve, reject) => {
        pki.rsa.generateKeyPair({
            bits: options.keyBits,
            algorithm: 'AES-256-CBC'
        }, async (err, keypair) => {
            if (err) {
                return reject(err);
            }
            resolve(keypair);
        });
    })

}

async function createCert(name: string, issuer?: pki.Certificate): Promise<pki.Certificate> {
    return new Promise(async (resolve, reject) => {
        const key = await createCAPrivKey();
        await fs.writeFile(path.join(options.outFolder, `${name}.key.pem`), pki.privateKeyToPem(key.privateKey));
        Log('DEBUG', `Created private key for cert: ${pki.privateKeyToPem(key.privateKey)}`);
        const outcert = pki.createCertificate();
        outcert.setSubject([...certificateAttrs, { name: 'commonName', value: name }]);
        outcert.validity.notBefore = new Date();
        outcert.validity.notAfter = new Date();
        outcert.publicKey = key.publicKey;
        outcert.privateKey = key.privateKey;
        outcert.validity.notAfter.setFullYear(outcert.validity.notBefore.getFullYear() + 1);
        outcert.serialNumber = `${Math.floor(Math.random() * 1000)}`;
        outcert.setIssuer([...certificateAttrs, { name: 'commonName', value: name }]);
        outcert.setExtensions([...certificateExtensions, ...(issuer ? [] : [{
            name: 'basicConstraints',
            cA: true
        }])]);
        if (issuer) {
            outcert.setIssuer(issuer.subject.attributes);
            Log('DEBUG', `Chiave:${pki.privateKeyToPem(issuer.privateKey)}\n`);
            outcert.sign(issuer.privateKey, md.sha256.create());

            if (!issuer.verify(outcert)) {
                return reject('Something went wrong when creating leaf certificate.');
            }
        }
        else {
            outcert.sign(key.privateKey, md.sha256.create());
        }
        resolve(outcert);
    });
}


async function generateRoot(name: string): Promise<pki.Certificate> {
    try {
        await fs.mkdir(options.outFolder, { recursive: true });
        // generate root
        const caCert = await createCert(name);
        await fs.writeFile(path.join(options.outFolder, `${name}.cert.pem`), pki.certificateToPem(caCert));
        return caCert;
    } catch (e) {
        console.log(e);
    }
}


async function createDevices(count: number, prefix: string, rootCertificate: pki.Certificate) {
    for (let i = 1; i <= count; i++) {
        const name = `${prefix}${count > 1 ? i : ''}`;
        Log('INFO', `Creating certificates for ${name}`);
        try {
            const leaf = await createCert(name, rootCertificate);
            const outName = path.join(options.outFolder, `${name}.cert.pem`);
            await fs.writeFile(outName, `${pki.certificateToPem(leaf)}${pki.certificateToPem(rootCertificate)}`);
        }
        catch (e) { }
    }
}
async function validate(validationCode: string, rootCA: pki.Certificate): Promise<string> {
    await fs.mkdir(options.outFolder, { recursive: true });
    const validated = await createCert(validationCode, rootCA);
    const outName = path.join(options.outFolder, 'Validated.pem');
    await fs.writeFile(outName, `${pki.certificateToPem(validated)}${pki.certificateToPem(rootCA)}`);
    return outName;
}

async function run(validationCode?: string) {
    console.log('Welcome to certificate generation for Azure IoT Central...');
    options = { ...defaultOptions, ...{} };
    const name = 'AzureIoTCentral';
    certificateAttrs = [
        {
            name: 'countryName',
            value: 'US'
        }, {
            shortName: 'ST',
            value: 'Washington'
        }, {
            name: 'localityName',
            value: 'Redmond'
        }, {
            name: 'organizationName',
            value: 'Azure'
        }, {
            shortName: 'OU',
            value: 'Azure IoT'
        }
    ];
    if (validationCode) {
        const rootCertPem = await fs.readFile(path.join(options.outFolder, `${name}.cert.pem`), { encoding: 'binary' });
        const rootKeyPem = await fs.readFile(path.join(options.outFolder, `${name}.key.pem`), { encoding: 'binary' });
        Log('DEBUG', rootCertPem.toString());
        const rootCert = pki.certificateFromPem(rootCertPem);
        const rootKey = pki.privateKeyFromPem(rootKeyPem);
        rootCert.privateKey = rootKey;
        await validate(validationCode, rootCert);
        console.log(`Certificates have been generated. You can find them at '${options.outFolder}'`);
        process.exit(0);
    }

    const inputReader = getInputReader();
    const certNum = +(await inputReader.question('How many leaf certificates do you want to generate?:\t'));
    const deviceName = await inputReader.question('Insert device name, in case of multiple devices, this is used as a prefix to generate a unique name (e.g. device => device1,device2):\t');
    Log('INFO', 'Generating root certificate');
    const root = await generateRoot(name);

    Log('INFO', 'Generating device certificates');
    await createDevices(certNum, deviceName, root);
    validationCode = await inputReader.question('Insert validation code: ');
    console.log('Generating validated certificate');
    const validatePath = await validate(validationCode, root);
    console.log(`Certificates have been generated. You can find them at '${options.outFolder}'`);
    process.exit(0);

}

var myArgs = process.argv.slice(2);
run(myArgs.length > 0 ? myArgs[0] : undefined);