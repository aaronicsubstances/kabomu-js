export async function whenAnyPromiseSettles(q: any[]) {
    return await new Promise<number>((resolve) => {
        for (let i = 0; i < q.length; i++) {
            const p = q[i]
            p.finally(() => resolve(i))
        }
    })
}