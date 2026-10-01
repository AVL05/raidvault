import { describe, it, expect, vi } from 'vitest'
import { clearShellCaches, shellCacheNames, storageInfo } from './storage-info'
import { clearSnapshots, saveSnapshot, readSnapshot } from './snapshot-store'
import { createMockPlayerProvider, createPlayerStateSnapshotCache } from '@raidvault/providers'
import { MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD } from '../stash/mock-data'
import { fakeDb } from './snapshot-test-helpers'
import { readFileSync } from 'node:fs'

const owned = `raidvault-app-shell-v1-${'a'.repeat(64)}`
const obsolete = `raidvault-app-shell-v1-${'b'.repeat(64)}`
describe('M10 storage reporting and cache ownership', () => {
  it('reports absent APIs as unsupported without byte counts', async () => {
    expect(await storageInfo(undefined)).toEqual({ status: 'unsupported', persistent: 'unsupported' })
    expect(await shellCacheNames(undefined)).toBeUndefined()
    expect((await clearShellCaches(undefined)).status).toBe('unsupported')
  })
  it('reports approximate origin estimate separately from persistence', async () => {
    const manager = { estimate: async () => ({ usage: 100, quota: 1000 }), persisted: async () => false } as StorageManager
    expect(await storageInfo(manager)).toEqual({ status: 'supported', usage: 100, quota: 1000, persistent: 'no' })
  })
  it('reports rejected estimates and persistence as errors without zeros', async () => {
    const manager = { estimate: async () => { throw new Error('secret') }, persisted: async () => { throw new Error('secret') } } as unknown as StorageManager
    expect(await storageInfo(manager)).toEqual({ status: 'error', persistent: 'error' })
  })
  it('does not invent unknown or invalid estimate values', async () => {
    const result = await storageInfo({ estimate: async () => ({ usage: NaN, quota: -1 }) } as StorageManager)
    expect(result.usage).toBeUndefined(); expect(result.quota).toBeUndefined()
  })
  it('clears only the exact shell namespace; other RaidVault/origin data survives', async () => {
    const names = [owned, obsolete, 'raidvault-model-v1', 'raidvault-provider', 'another-app', 'raidvault-app-shell-v1-not-a-digest']
    const storage = { keys: async () => [...names], delete: vi.fn(async (name: string) => { names.splice(names.indexOf(name), 1); return true }) } as unknown as CacheStorage
    expect((await clearShellCaches(storage)).status).toBe('ready')
    expect(names).toEqual(['raidvault-model-v1', 'raidvault-provider', 'another-app', 'raidvault-app-shell-v1-not-a-digest'])
  })
  it('reports partial cache deletion failure honestly', async () => {
    const storage = { keys: async () => [owned, obsolete], delete: async (name: string) => {
      if (name === obsolete) throw new Error('sensitive browser error')
      return true
    } } as unknown as CacheStorage
    expect(await clearShellCaches(storage)).toEqual({ status: 'error', message: 'Cache clearing incomplete: 1 of 2 operations completed.' })
  })
  it('reports cache enumeration failure with a fixed message', async () => {
    const storage = { keys: async () => { throw new Error('secret') } } as unknown as CacheStorage
    expect((await clearShellCaches(storage)).message).toBe('App-shell caches could not be inspected or cleared.')
  })
  it('snapshot and shell clears cannot call model removal or each other', async () => {
    for (const file of ['snapshot-store.ts', 'storage-info.ts']) {
      expect(readFileSync(`apps/web/src/storage/${file}`, 'utf8')).not.toMatch(/@raidvault\/ai-engine|modelManager|removeModel/)
    }
    const db = fakeDb()
    const result = await createPlayerStateSnapshotCache(createMockPlayerProvider(MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD)).refresh()
    if (!result.success) throw new Error('Expected fixture')
    await saveSnapshot(result.value, db.factory)
    const names = [owned]
    const storage = { keys: async () => names, delete: async () => { names.length = 0; return true } } as unknown as CacheStorage
    await clearSnapshots(db.factory)
    expect(names).toEqual([owned])
    await saveSnapshot(result.value, db.factory)
    await clearShellCaches(storage)
    expect((await readSnapshot(MOCK_PROVIDER_ID, db.factory)).status).toBe('ready')
  })
})
