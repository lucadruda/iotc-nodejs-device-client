import CommonInterface from "../models/commonInterface"
import { BaseInterface } from "azure-iot-digitaltwins-device"

export type CapabilityType = 'InterfaceInstance' | 'Interface' | 'Property' | 'Command' | 'Telemetry'
export type CapabilityId = {
    '@id': string,
    '@type': CapabilityType,
    name?: string,
    displayName?: {
        [lang: string]: string
    }
}


export type Capability = CapabilityId & {
    schema: string | Capability,
    description?: string,
    displayUnit?: {
        [lang: string]: string
    },
    writable?: boolean
}

export type CommandCapability = Capability & {
    request?: Capability,
    response?: Capability,
    commandType?: 'synchronous' | 'asynchronous'
}

export type CapabilityInterface = Capability & {
    schema: Capability & {
        contents: CommandCapability[] | Capability[]
    }

}
export type CapabilityModel = Capability & {
    implements: CapabilityInterface[],
    contents: string[],
    '@context': string[]
}

export type InterfaceMap = {
    [infName: string]: BaseInterface
}