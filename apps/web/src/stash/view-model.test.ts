import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import type { PlayerStateSnapshot } from '@raidvault/providers'
import {
  ALL_CATEGORIES,
  buildStashRows,
  describeSnapshot,
  filterStashRows,
  formatTimestamp,
  listCategories,
  summarizeStash,
} from './view-model'

const CAPTURED_AT = 1700000000000

const knowledge: GameKnowledge = {
  items: [
    { id: 'demo-bandage', name: 'Field Bandage', category: 'medical' },
    { id: 'demo-wire', name: 'Copper Wire', category: 'parts' },
  ],
  quests: [],
  workshops: [],
  projects: [],
  metadata: { sourceId: 'test-data', datasetVersion: 't1', capturedAt: CAPTURED_AT },
}

const state: PlayerState = {
  profile: { playerId: 'player-1' },
  stash: {
    id: 'stash-1',
    items: [
      { id: 'demo-bandage', quantity: 3 },
      { id: 'demo-wire', quantity: 12 },
      { id: 'demo-relic', quantity: 1 },
    ],
    capacity: { totalSlots: 10, usedSlots: 3 },
    freshness: { capturedAt: CAPTURED_AT },
  },
  snapshotMetadata: { capturedAt: CAPTURED_AT },
}

function freshSnapshot(): PlayerStateSnapshot {
  return { state, providerId: 'mock-provider', fetchedAt: CAPTURED_AT, stale: false }
}

describe('Stash view-model — rows', () => {
  it('builds rows from a valid snapshot', () => {
    const rows = buildStashRows(state, knowledge)
    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.itemId)).toEqual(['demo-bandage', 'demo-wire', 'demo-relic'])
  })

  it('joins name and category by item ID', () => {
    const rows = buildStashRows(state, knowledge)
    const bandage = rows[0]
    if (bandage === undefined) throw new Error('expected row')
    expect(bandage.displayName).toBe('Field Bandage')
    expect(bandage.category).toBe('medical')
    expect(bandage.quantity).toBe(3)
    expect(bandage.metadataKnown).toBe(true)
  })

  it('falls back safely for unknown metadata', () => {
    const rows = buildStashRows(state, knowledge)
    const relic = rows[2]
    if (relic === undefined) throw new Error('expected row')
    expect(relic.displayName).toBeUndefined()
    expect(relic.category).toBeUndefined()
    expect(relic.metadataKnown).toBe(false)
    expect(relic.searchText).toContain('demo-relic')
  })

  it('returns no rows when the stash is missing', () => {
    const stateless: PlayerState = {
      profile: { playerId: 'player-1' },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(buildStashRows(stateless, knowledge)).toEqual([])
  })
})

describe('Stash view-model — search and filter', () => {
  it('matches by display name', () => {
    const rows = buildStashRows(state, knowledge)
    const matched = filterStashRows(rows, 'bandage', ALL_CATEGORIES)
    expect(matched.map((row) => row.itemId)).toEqual(['demo-bandage'])
  })

  it('matches by item ID', () => {
    const rows = buildStashRows(state, knowledge)
    const matched = filterStashRows(rows, 'demo-wire', ALL_CATEGORIES)
    expect(matched.map((row) => row.itemId)).toEqual(['demo-wire'])
  })

  it('matches case-insensitively across name and category', () => {
    const rows = buildStashRows(state, knowledge)
    expect(filterStashRows(rows, 'BANDAGE', ALL_CATEGORIES)).toHaveLength(1)
    expect(filterStashRows(rows, 'MEDICAL', ALL_CATEGORIES).map((row) => row.itemId)).toEqual([
      'demo-bandage',
    ])
  })

  it('filters by category', () => {
    const rows = buildStashRows(state, knowledge)
    const matched = filterStashRows(rows, '', 'parts')
    expect(matched.map((row) => row.itemId)).toEqual(['demo-wire'])
  })

  it('composes search and category filter', () => {
    const rows = buildStashRows(state, knowledge)
    expect(
      filterStashRows(rows, 'wire', 'parts').map((row) => row.itemId)
    ).toEqual(['demo-wire'])
    expect(filterStashRows(rows, 'wire', 'medical')).toHaveLength(0)
  })

  it('returns all rows for an empty query', () => {
    const rows = buildStashRows(state, knowledge)
    expect(filterStashRows(rows, '   ', ALL_CATEGORIES)).toHaveLength(3)
  })

  it('lists known categories sorted', () => {
    const rows = buildStashRows(state, knowledge)
    expect(listCategories(rows)).toEqual(['medical', 'parts'])
  })
})

describe('Stash view-model — summary and status', () => {
  it('summarizes stash presence and capacity', () => {
    expect(summarizeStash(state)).toEqual({
      hasStash: true,
      itemCount: 3,
      usedSlots: 3,
      totalSlots: 10,
    })
  })

  it('summarizes an empty stash explicitly', () => {
    const empty: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [],
        capacity: { totalSlots: 10, usedSlots: 0 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(summarizeStash(empty)).toEqual({
      hasStash: true,
      itemCount: 0,
      usedSlots: 0,
      totalSlots: 10,
    })
    expect(buildStashRows(empty, knowledge)).toEqual([])
  })

  it('summarizes a missing stash explicitly', () => {
    const stateless: PlayerState = {
      profile: { playerId: 'player-1' },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(summarizeStash(stateless)).toEqual({
      hasStash: false,
      itemCount: 0,
      usedSlots: undefined,
      totalSlots: undefined,
    })
  })

  it('keeps a fresh snapshot fresh', () => {
    const status = describeSnapshot(freshSnapshot())
    expect(status.stale).toBe(false)
    expect(status.providerId).toBe('mock-provider')
  })

  it('keeps a stale snapshot stale', () => {
    const snapshot = { ...freshSnapshot(), stale: true }
    const status = describeSnapshot(snapshot)
    expect(status.stale).toBe(true)
  })

  it('formats snapshot timestamps deterministically', () => {
    expect(formatTimestamp(CAPTURED_AT)).toBe('2023-11-14T22:13:20.000Z')
  })
})
