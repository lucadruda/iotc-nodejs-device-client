import { DeviceTransport } from "../types/constants";

// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export function capitalizeFirst(text: string) {
    return `${text.charAt(0).toUpperCase()}${text.substring(1).toLowerCase()}`;
}

export function isObject(a: any): boolean {
    return (!!a) && (a.constructor === Object);
};

export function getTransportString(transportType: DeviceTransport): string {
    return (DeviceTransport[transportType].split("_")[0]).toLowerCase();
}

export function getTransportMod(transportType: DeviceTransport): string {
    let mod = capitalizeFirst(getTransportString(transportType));
    if (DeviceTransport[transportType].split("_")[1]) {
        mod = capitalizeFirst(DeviceTransport[transportType].split("_")[1]);
    }
    return mod;
}