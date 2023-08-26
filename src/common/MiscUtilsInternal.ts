import { IPendingPromiseInternal } from "./types"

export async function whenAnyPromiseSettles(q: any[]) {
    return await new Promise<number>((resolve) => {
        for (let i = 0; i < q.length; i++) {
            const p = q[i]
            p.finally(() => resolve(i))
        }
    })
}

/**
 * This JavaScript function always returns a random number between min (included) and max (excluded).
 * (copied from https://www.w3schools.com/js/js_random.asp).
 * @param min defaults to zero
 * @param max defaults to max signed 32-bit integer
 * @returns 
 */
export function getRndInteger(min?: number, max?: number) {
    if (!min) {
        min = 0
    }
    const MAX_SIGNED_INT_32_VALUE = 2_147_483_647
    if (!max) {
        max = MAX_SIGNED_INT_32_VALUE
    }
    return Math.floor(Math.random() * (max - min) ) + min;
}

export function createDelayPromise(millis: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, millis)
    })
}

export function createYieldPromise() {
    return new Promise<void>((resolve) => {
        setImmediate(resolve)
    })
}

export function createPendingPromise<T>() {
    const pendingPromise = {
    } as IPendingPromiseInternal<T>
    pendingPromise.promise = new Promise<T>((resolve, reject) => {
        pendingPromise.resolve = resolve
        pendingPromise.reject = reject
    })
    return pendingPromise;
}
