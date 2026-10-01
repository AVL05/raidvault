import type { StorageAction } from './snapshot-store'

export const SHELL_CACHE_PATTERN = /^raidvault-app-shell-v1-[a-f0-9]{64}$/
export type BrowserStorageInfo = {
  readonly status: 'supported' | 'unsupported' | 'error'
  readonly usage?: number
  readonly quota?: number
  readonly persistent: 'yes' | 'no' | 'unsupported' | 'error'
}
export async function storageInfo(manager: StorageManager | undefined): Promise<BrowserStorageInfo> {
  let persistent: BrowserStorageInfo['persistent'] = 'unsupported'
  if (typeof manager?.persisted === 'function') {
    try { persistent = await manager.persisted() ? 'yes' : 'no' }
    catch { persistent = 'error' }
  }
  if (typeof manager?.estimate !== 'function') return { status: 'unsupported', persistent }
  try {
    const estimate = await manager.estimate()
    const safeBytes = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value >= 0 ? value : undefined
    return { status: 'supported', usage: safeBytes(estimate.usage), quota: safeBytes(estimate.quota), persistent }
  } catch { return { status: 'error', persistent } }
}
export async function shellCacheNames(storage: CacheStorage | undefined): Promise<readonly string[] | undefined> {
  if (storage === undefined) return undefined
  return (await storage.keys()).filter((name) => SHELL_CACHE_PATTERN.test(name))
}
export async function clearShellCaches(storage: CacheStorage | undefined): Promise<StorageAction> {
  if (storage === undefined) return { status: 'unsupported', message: 'Cache Storage is unsupported.' }
  try {
    const names = await shellCacheNames(storage) ?? []
    const results = await Promise.allSettled(names.map((name) => storage.delete(name)))
    const cleared = results.filter((result) => result.status === 'fulfilled').length
    return cleared === names.length
      ? { status: 'ready', message: 'App-shell caches cleared. Offline reloads require a subsequent worker installation.' }
      : { status: 'error', message: `Cache clearing incomplete: ${cleared} of ${names.length} operations completed.` }
  } catch { return { status: 'error', message: 'App-shell caches could not be inspected or cleared.' } }
}
