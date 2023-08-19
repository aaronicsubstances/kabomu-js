export function createDelayPromise(millis: number) {
    return new Promise<void>((resolve) => {
        setTimeout(resolve, millis)
    })
}

export async function whenAnyPromiseSettled(q: any[]) {
    return await new Promise<number>((resolve) => {
        for (let i = 0; i < q.length; i++) {
            const p = q[i]
            const cb = () => resolve(i)
            p.finally(cb)
        }
    })
}