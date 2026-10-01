/** Minimal event-driven IDB test double. Real browser behavior is checked separately. */
export function fakeDb() {
  const records = new Map<string, unknown>()
  const operations: string[] = []
  let failed = false
  const database = {
    close: () => undefined,
    transaction: (name: string, mode: string) => {
      operations.push(`${name}:${mode}`)
      const request = { result: undefined as unknown }
      const tx = {
        oncomplete: undefined as (() => void) | undefined,
        onerror: undefined as (() => void) | undefined,
        onabort: undefined as (() => void) | undefined,
        objectStore: () => ({
          get: (key: string) => { request.result = records.get(key); return request },
          put: (bytes: unknown, key: string) => { records.set(key, bytes); return request },
          clear: () => { records.clear(); return request },
        }),
      }
      queueMicrotask(() => { if (failed) tx.onerror?.(); else tx.oncomplete?.() })
      return tx
    },
  }
  const factory = {
    open: (name: string, version: number) => {
      operations.push(`open:${name}:${version}`)
      const request = { result: database, onsuccess: undefined as (() => void) | undefined }
      queueMicrotask(() => request.onsuccess?.())
      return request
    },
  }
  // Narrow platform double, not a cast of persisted data into a trusted domain object.
  return { factory: factory as unknown as IDBFactory, records, operations, fail: () => { failed = true } }
}
