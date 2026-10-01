import {
  createPlayerState, createPlayerProfile, createPlayerStash, createQuestProgress,
  createProjectProgress, createHideoutProgress, createPlayerLoadout,
  type DomainResult, type SnapshotMetadata, type StashItem,
} from '@raidvault/domain'
import type { PlayerStateSnapshot } from '@raidvault/providers'

export const SNAPSHOT_DB = 'raidvault-local-state'
export const SNAPSHOT_SCHEMA = 1
export const SNAPSHOT_STORE = 'snapshots'
export type SnapshotResult =
  | { readonly status: 'ready'; readonly snapshot: PlayerStateSnapshot }
  | { readonly status: 'empty' | 'unsupported' | 'error'; readonly message: string }
export type StorageAction = { readonly status: 'ready' | 'unsupported' | 'error'; readonly message: string }

function object(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value) ||
      Object.keys(value).some((key) => !keys.includes(key))) throw new Error('Invalid record')
  return value as Record<string, unknown>
}
function text(value: unknown): string {
  if (typeof value !== 'string' || value.trim() === '') throw new Error('Invalid string')
  return value
}
function optionalText(value: unknown): string | undefined { return value === undefined ? undefined : text(value) }
function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new Error('Invalid quantity')
  return value
}
function array(value: unknown): readonly unknown[] {
  if (!Array.isArray(value)) throw new Error('Invalid list')
  return value
}
function valid<T>(result: DomainResult<T>): T {
  if (!result.success) throw new Error('Domain validation failed')
  return result.value
}
function metadata(value: unknown): SnapshotMetadata {
  const row = object(value, ['capturedAt', 'source'])
  const capturedAt = number(row.capturedAt)
  if (!Number.isFinite(new Date(capturedAt).getTime())) throw new Error('Invalid capture time')
  return { capturedAt, source: optionalText(row.source) }
}

/** Stored JSON is untrusted. Reconstruct only domain fields; no AI/Rules output is accepted. */
export function decodeSnapshot(bytes: unknown, providerId: string): SnapshotResult {
  if (bytes === undefined) return { status: 'empty', message: 'No saved snapshot is available.' }
  try {
    if (typeof bytes !== 'string') throw new Error('Invalid bytes')
    const parsed: unknown = JSON.parse(bytes)
    const envelope = object(parsed, ['schema', 'providerId', 'state'])
    if (envelope.schema !== SNAPSHOT_SCHEMA) return { status: 'error', message: 'Saved snapshot schema is incompatible.' }
    if (text(envelope.providerId) !== providerId) throw new Error('Provider mismatch')
    const row = object(envelope.state, ['profile', 'stash', 'hideoutProgress', 'projects', 'questProgress', 'loadout', 'snapshotMetadata'])
    const profile = object(row.profile, ['playerId'])
    const capture = metadata(row.snapshotMetadata)
    let stash
    if (row.stash !== undefined) {
      const saved = object(row.stash, ['id', 'items', 'capacity', 'freshness'])
      const capacity = object(saved.capacity, ['totalSlots', 'usedSlots'])
      const freshness = metadata(saved.freshness)
      const items: StashItem[] = array(saved.items).map((value) => {
        const entry = object(value, ['id', 'quantity'])
        return { id: text(entry.id), quantity: number(entry.quantity) }
      })
      stash = valid(createPlayerStash(text(saved.id), items,
        { totalSlots: number(capacity.totalSlots), usedSlots: number(capacity.usedSlots) }, freshness.capturedAt, freshness.source))
    }
    const quests = row.questProgress === undefined ? undefined : array(row.questProgress).map((value) => {
      const goal = object(value, ['questId', 'state', 'quantities'])
      return valid(createQuestProgress(text(goal.questId), text(goal.state), array(goal.quantities).map(number)))
    })
    const projects = row.projects === undefined ? undefined : array(row.projects).map((value) => {
      const goal = object(value, ['projectId', 'state', 'quantities'])
      return valid(createProjectProgress(text(goal.projectId), text(goal.state), array(goal.quantities).map(number)))
    })
    let hideout
    if (row.hideoutProgress !== undefined) {
      const saved = object(row.hideoutProgress, ['hideoutId', 'state', 'resources'])
      hideout = valid(createHideoutProgress(text(saved.hideoutId), text(saved.state), array(saved.resources).map(number)))
    }
    let loadout
    if (row.loadout !== undefined) {
      const saved = object(row.loadout, ['weaponId', 'armorId', 'accessoryId'])
      loadout = valid(createPlayerLoadout(optionalText(saved.weaponId), optionalText(saved.armorId), optionalText(saved.accessoryId)))
    }
    const state = valid(createPlayerState(valid(createPlayerProfile(text(profile.playerId))), stash,
      hideout, projects, quests, loadout, capture))
    return { status: 'ready', snapshot: { state, providerId, fetchedAt: capture.capturedAt, stale: true } }
  } catch { return { status: 'error', message: 'Saved snapshot is invalid. Reconnect to obtain validated data.' } }
}

export function encodeSnapshot(snapshot: PlayerStateSnapshot): string {
  const bytes = JSON.stringify({ schema: SNAPSHOT_SCHEMA, providerId: snapshot.providerId, state: snapshot.state })
  const checked = decodeSnapshot(bytes, snapshot.providerId)
  if (checked.status !== 'ready') throw new Error('Snapshot cannot be stored')
  // Serialize reconstructed domain values only, never arbitrary extra properties.
  return JSON.stringify({ schema: SNAPSHOT_SCHEMA, providerId: snapshot.providerId, state: checked.snapshot.state })
}

function browserDb(): IDBFactory | undefined {
  return typeof window === 'undefined' ? undefined : window.indexedDB
}
function open(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let failed = false
    const request = factory.open(SNAPSHOT_DB, SNAPSHOT_SCHEMA)
    request.onupgradeneeded = () => { request.result.createObjectStore(SNAPSHOT_STORE) }
    request.onerror = () => { failed = true; reject(new Error('Storage unavailable')) }
    request.onblocked = () => { failed = true; reject(new Error('Storage blocked')) }
    request.onsuccess = () => {
      if (failed) { request.result.close(); return }
      request.result.onversionchange = () => request.result.close()
      resolve(request.result)
    }
  })
}
async function transaction(factory: IDBFactory, mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
  const db = await open(factory)
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(SNAPSHOT_STORE, mode)
      const request = operation(tx.objectStore(SNAPSHOT_STORE))
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = tx.onerror = () => reject(new Error('Storage operation failed'))
    })
  } finally { db.close() }
}
// Keep save/clear ordering deterministic, including StrictMode mount effects.
let pending: Promise<unknown> = Promise.resolve()
function ordered<T>(work: () => Promise<T>): Promise<T> {
  const next = pending.then(work, work)
  pending = next
  return next
}

export async function readSnapshot(providerId: string, factory?: IDBFactory): Promise<SnapshotResult> {
  try {
    const backend = factory ?? browserDb()
    if (backend === undefined) return { status: 'unsupported', message: 'IndexedDB is unsupported. Snapshots remain in memory only.' }
    return decodeSnapshot(await ordered(() => transaction(backend, 'readonly', (store) => store.get(providerId))), providerId)
  }
  catch { return { status: 'error', message: 'Saved snapshot storage could not be read.' } }
}
export async function saveSnapshot(snapshot: PlayerStateSnapshot, factory?: IDBFactory): Promise<StorageAction> {
  try {
    const backend = factory ?? browserDb()
    if (backend === undefined) return { status: 'unsupported', message: 'IndexedDB is unsupported. Snapshots remain in memory only.' }
    const bytes = encodeSnapshot(snapshot)
    await ordered(() => transaction(backend, 'readwrite', (store) => store.put(bytes, snapshot.providerId)))
    return { status: 'ready', message: 'Validated snapshot saved locally. Original capture time preserved.' }
  } catch { return { status: 'error', message: 'Snapshot could not be saved locally.' } }
}
export async function clearSnapshots(factory?: IDBFactory): Promise<StorageAction> {
  try {
    const backend = factory ?? browserDb()
    if (backend === undefined) return { status: 'unsupported', message: 'IndexedDB is unsupported.' }
    await ordered(() => transaction(backend, 'readwrite', (store) => store.clear()))
    return { status: 'ready', message: 'Saved snapshots cleared. Open views remain in memory only.' }
  } catch { return { status: 'error', message: 'Saved snapshots could not be cleared.' } }
}
