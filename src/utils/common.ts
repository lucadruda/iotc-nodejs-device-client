// Copyright (c) Luca Druda. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

export async function promiseTimeout<T>(fn: (...args: any[]) => Promise<T>, ms: number): Promise<T> {
    let id: NodeJS.Timer;
    let timeout = new Promise<T>((resolve, reject) => {
        id = setTimeout(() => {
            reject('Timed out in ' + ms + 'ms.')
        }, ms)
    })

    return Promise.race([
        fn(),
        timeout
    ]).then((result: T) => {
        clearTimeout(id)

        /**
         * ... we also need to pass the result back
         */
        return Promise.resolve(result)
    }).catch(err => {
        clearTimeout(id);
        return Promise.reject(err);
    });
}