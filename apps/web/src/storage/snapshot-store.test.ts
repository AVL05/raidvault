import { describe, it, expect } from 'vitest'
import { createMockPlayerProvider, createPlayerStateSnapshotCache } from '@raidvault/providers'
import { MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD, DEMO_CAPTURED_AT } from '../stash/mock-data'
import { clearSnapshots, decodeSnapshot, encodeSnapshot, readSnapshot, saveSnapshot,
  SNAPSHOT_DB, SNAPSHOT_SCHEMA, SNAPSHOT_STORE } from './snapshot-store'
import { restoreWorkspace } from '../stash/offline-stash'

import { fakeDb } from './snapshot-test-helpers'

async function snapshot() {
  const result = await createPlayerStateSnapshotCache(createMockPlayerProvider(MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD)).refresh()
  if (!result.success) throw new Error('Expected validated fixture')
  return result.value
}

describe('M10 snapshot authority and independent IDB storage', () => {
  it('stores only the normalized envelope, retaining capture time', async () => {
    const bytes = encodeSnapshot(await snapshot())
    expect(Object.keys(JSON.parse(bytes))).toEqual(['schema', 'providerId', 'state'])
    const loaded = decodeSnapshot(bytes, MOCK_PROVIDER_ID)
    expect(loaded.status).toBe('ready')
    if (loaded.status !== 'ready') throw new Error('Expected ready')
    expect(loaded.snapshot.stale).toBe(true)
    expect(loaded.snapshot.fetchedAt).toBe(DEMO_CAPTURED_AT)
    expect(loaded.snapshot.state.snapshotMetadata.capturedAt).toBe(DEMO_CAPTURED_AT)
    expect(bytes).not.toMatch(/VerifiedAiContext|classification|reasons|messages|analysis|planning/)
  })
  it.each(['{broken', null, 42, '{}', '{"schema":1,"providerId":"wrong"}'])('rejects corrupted record %s', (record) => {
    expect(decodeSnapshot(record, MOCK_PROVIDER_ID).status).toBe('error')
  })
  it('rejects incompatible schema explicitly', async () => {
    const row = JSON.parse(encodeSnapshot(await snapshot()))
    row.schema = 2
    expect(decodeSnapshot(JSON.stringify(row), MOCK_PROVIDER_ID)).toEqual({ status: 'error', message: 'Saved snapshot schema is incompatible.' })
  })
  it.each(['classification', 'analysis', 'planning', 'context', 'messages', 'accessToken'])('rejects extra stored authority/secret field %s', async (field) => {
    const row = JSON.parse(encodeSnapshot(await snapshot()))
    row.state[field] = 'untrusted'
    expect(decodeSnapshot(JSON.stringify(row), MOCK_PROVIDER_ID).status).toBe('error')
  })
  it('rejects nested invalid types and domain invariants', async () => {
    const row = JSON.parse(encodeSnapshot(await snapshot()))
    row.state.stash.capacity.usedSlots = 100
    expect(decodeSnapshot(JSON.stringify(row), MOCK_PROVIDER_ID).status).toBe('error')
    row.state.stash.items = 'not a list'
    expect(decodeSnapshot(JSON.stringify(row), MOCK_PROVIDER_ID).status).toBe('error')
    const invalidTime = JSON.parse(encodeSnapshot(await snapshot()))
    invalidTime.state.snapshotMetadata.capturedAt = Number.MAX_SAFE_INTEGER
    expect(decodeSnapshot(JSON.stringify(invalidTime), MOCK_PROVIDER_ID).status).toBe('error')
  })
  it('uses exact owned database/store/version and saves before clearing', async () => {
    const db = fakeDb()
    const saving = saveSnapshot(await snapshot(), db.factory)
    const clearing = clearSnapshots(db.factory)
    expect((await saving).status).toBe('ready')
    expect((await clearing).status).toBe('ready')
    expect((await readSnapshot(MOCK_PROVIDER_ID, db.factory)).status).toBe('empty')
    expect(db.operations).toEqual([
      `open:${SNAPSHOT_DB}:${SNAPSHOT_SCHEMA}`, `${SNAPSHOT_STORE}:readwrite`,
      `open:${SNAPSHOT_DB}:${SNAPSHOT_SCHEMA}`, `${SNAPSHOT_STORE}:readwrite`,
      `open:${SNAPSHOT_DB}:${SNAPSHOT_SCHEMA}`, `${SNAPSHOT_STORE}:readonly`,
    ])
  })
  it('does not fabricate availability when IndexedDB is absent', async () => {
    expect((await readSnapshot(MOCK_PROVIDER_ID)).status).toBe('unsupported')
    expect((await saveSnapshot(await snapshot())).status).toBe('unsupported')
    expect((await clearSnapshots()).status).toBe('unsupported')
  })
  it('sanitizes transaction failure', async () => {
    const db = fakeDb(); db.fail()
    expect((await saveSnapshot(await snapshot(), db.factory)).status).toBe('error')
    expect((await readSnapshot(MOCK_PROVIDER_ID, db.factory)).status).toBe('error')
    expect((await clearSnapshots(db.factory)).status).toBe('error')
  })
  it('rejects corrupted IDB data in the offline path instead of loading mock player data', async () => {
    const db = fakeDb(); db.records.set(MOCK_PROVIDER_ID, 'broken')
    expect((await restoreWorkspace(db.factory)).status).toBe('error')
    db.records.clear()
    expect((await restoreWorkspace(db.factory)).status).toBe('empty')
  })
  it('recomputes deterministic facts from restored stale/local state', async () => {
    const db = fakeDb(); await saveSnapshot(await snapshot(), db.factory)
    const restored = await restoreWorkspace(db.factory)
    expect(restored.status).toBe('ready')
    if (restored.status !== 'ready') throw new Error('Expected ready')
    expect(restored.snapshot.stale).toBe(true)
    expect(restored.context.snapshot.stale).toBe(true)
    expect(restored.context.snapshot.capturedAt).toBe(DEMO_CAPTURED_AT)
    expect(restored.rows.find((row) => row.itemId === 'demo-wire')?.quantity).toBe(12)
    expect(restored.planning.hasStash).toBe(true)
  })
})
