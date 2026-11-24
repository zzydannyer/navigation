import { describe, expect, it } from 'vitest'
import { PersistenceQueue, type PersistStatus } from '../src/persistence/queue'

interface Deferred<T> {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (error: unknown) => void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

interface ManualStorage {
  load(): Promise<string | null>
  save(value: string): Promise<void>
  saves: { value: string; deferred: Deferred<void> }[]
}

function manualStorage(): ManualStorage {
  const saves: ManualStorage['saves'] = []
  return {
    async load() {
      return null
    },
    async save(value: string) {
      const deferredItem = deferred<void>()
      saves.push({ value, deferred: deferredItem })
      return deferredItem.promise
    },
    saves,
  }
}

function createQueue(storage: ManualStorage) {
  const statuses: PersistStatus[] = []
  const queue = new PersistenceQueue(storage, (status) => {
    statuses.push(status)
  })
  return { queue, statuses }
}

const tick = () => Promise.resolve()

/** 排空异步链上的若干微任务跳转；不使用固定定时器判断竞态。 */
async function flush() {
  for (let i = 0; i < 6; i += 1) {
    await tick()
  }
}

describe('PersistenceQueue revision semantics', () => {
  it('continues with B after A finishes; final stored snapshot is B', async () => {
    const storage = manualStorage()
    const { queue, statuses } = createQueue(storage)

    queue.save('A')
    queue.save('B')
    expect(storage.saves).toHaveLength(1)

    storage.saves[0].deferred.resolve()
    await flush()
    expect(storage.saves).toHaveLength(2)
    expect(storage.saves[1].value).toBe('B')

    storage.saves[1].deferred.resolve()
    await flush()
    expect(statuses.at(-1)?.state).toBe('saved')
  })

  it('keeps the newest C when A, B, C are submitted back to back', async () => {
    const storage = manualStorage()
    const { queue } = createQueue(storage)

    queue.save('A')
    queue.save('B')
    queue.save('C')

    storage.saves[0].deferred.resolve()
    await flush()
    storage.saves[1].deferred.resolve()
    await flush()

    expect(storage.saves).toHaveLength(2)
    expect(storage.saves[1].value).toBe('C')
  })

  it('failed A keeps latest C; retry saves C instead of the stale failed snapshot', async () => {
    const storage = manualStorage()
    const { queue, statuses } = createQueue(storage)

    queue.save('A')
    queue.save('C')

    storage.saves[0].deferred.reject(new Error('disk full'))
    await flush()
    expect(statuses.at(-1)?.state).toBe('failed')

    queue.retry()
    await flush()
    expect(storage.saves).toHaveLength(2)
    expect(storage.saves[1].value).toBe('C')

    storage.saves[1].deferred.resolve()
    await flush()
    expect(statuses.at(-1)?.state).toBe('saved')
  })

  it('stays failed until retry succeeds', async () => {
    const storage = manualStorage()
    const { queue, statuses } = createQueue(storage)

    queue.save('A')
    storage.saves[0].deferred.reject(new Error('offline'))
    await flush()
    expect(statuses.at(-1)?.state).toBe('failed')

    queue.retry()
    await flush()
    expect(statuses.at(-1)?.state).toBe('saving')
    storage.saves[1].deferred.resolve()
    await flush()
    expect(statuses.at(-1)?.state).toBe('saved')
  })

  it('setBaseline does not trigger a save', () => {
    const storage = manualStorage()
    const { queue } = createQueue(storage)
    queue.setBaseline('baseline')
    expect(storage.saves).toHaveLength(0)
  })
})
