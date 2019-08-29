// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export function capitalizeFirst(text: string) {
    return `${text.charAt(0).toUpperCase()}${text.substring(1).toLowerCase()}`;
}

