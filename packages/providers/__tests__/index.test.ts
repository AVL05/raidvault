import { describe, it, expect } from 'vitest'
import {
  createMockPlayerProvider,
  createPlayerStateSnapshotCache,
  type PlayerDataProvider,
  type ProviderError,
  type ProviderResult,
} from '../index'
import * as publicApi from '../index'
import type { PlayerState } from '@raidvault/domain'

import {
  FIXTURE_CAPTURED_AT,
  FIXTURE_PROVIDER_ID,
  duplicateStashIdsPayload,
  emptyPlayerIdPayload,
  fractionalQuantityPayload,
  invalidCapacityPayload,
  invalidHideoutPayload,
  invalidLoadoutPayload,
  invalidQuestQuantityPayload,
  invalidTimestampPayload,
  malformedPayload,
  malformedStashPayload,
  negativeQuantityPayload,
  validEmptyMockPayload,
  validMockPayload,
} from '../fixtures'

// ---- Discriminated-union narrowing helpers ----

function assertSuccess<T>(result: ProviderResult<T>): asserts result is { success: true; value: T } {
  if (result.success !== true) throw new Error('expected success')
}

function assertFailure<T>(result: ProviderResult<T>): asserts result is { success: false; error: ProviderError } {
  if (result.success !== false) throw new Error('expected failure')
}

function mockOk(payload: unknown): PlayerDataProvider {
  return createMockPlayerProvider(FIXTURE_PROVIDER_ID, payload)
}

function mockUnavailable(): PlayerDataProvider {
  return createMockPlayerProvider(FIXTURE_PROVIDER_ID, validMockPayload, 'unavailable')
}

// Test-local two-stage provider: first load delegates to `first`, every
// later load delegates to `second`. Composes only the public contract so a
// success-then-failure sequence is observable through one provider identity.
function createSequencedProvider(
  providerId: string,
  first: PlayerDataProvider,
  second: PlayerDataProvider
): PlayerDataProvider {
  let calls = 0
  return {
    providerId,
    loadPlayerState(): Promise<ProviderResult<PlayerState>> {
      calls += 1
      if (calls === 1) {
        return first.loadPlayerState()
      }
      return second.loadPlayerState()
    },
  }
}

// ---- Mock provider loads ----

describe('Providers — mock loads', () => {
  it('returns a valid deterministic PlayerState', async () => {
    const provider = mockOk(validMockPayload)
    const first = await provider.loadPlayerState()
    assertSuccess(first)
    expect(first.value.profile.playerId).toBe('player-1')
    if (first.value.stash === undefined) throw new Error('expected stash')
    expect(first.value.stash.items).toHaveLength(2)
    expect(first.value.snapshotMetadata.capturedAt).toBe(FIXTURE_CAPTURED_AT)
    const second = await provider.loadPlayerState()
    assertSuccess(second)
    expect(second.value).toEqual(first.value)
  })

  it('supports a valid empty state', async () => {
    const result = await mockOk(validEmptyMockPayload).loadPlayerState()
    assertSuccess(result)
    expect(result.value.profile.playerId).toBe('player-2')
    expect(result.value.stash).toBeUndefined()
    expect(result.value.hideoutProgress).toBeUndefined()
    expect(result.value.loadout).toBeUndefined()
  })

  it('exposes a stable explicit provider id', async () => {
    const provider = mockOk(validMockPayload)
    expect(provider.providerId).toBe(FIXTURE_PROVIDER_ID)
    const result = await provider.loadPlayerState()
    assertSuccess(result)
    expect(result.value.profile.playerId).toBe('player-1')
  })

  it('rejects an empty provider id', async () => {
    const result = await createMockPlayerProvider('', validMockPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid provider id')
  })

  it('rejects an empty player id', async () => {
    const result = await mockOk(emptyPlayerIdPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('invalid playerId')
  })
})

// ---- Payload validation and normalization ----

describe('Providers — validation', () => {
  it('rejects a malformed provider payload', async () => {
    const result = await mockOk(malformedPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('expected an object')
  })

  it('rejects a malformed stash section', async () => {
    const result = await mockOk(malformedStashPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('expected an object')
  })

  it('rejects a negative stash quantity', async () => {
    const result = await mockOk(negativeQuantityPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('invalid quantity')
  })

  it('rejects a fractional stash quantity', async () => {
    const result = await mockOk(fractionalQuantityPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('invalid quantity')
  })

  it('rejects duplicate stash ids', async () => {
    const result = await mockOk(duplicateStashIdsPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('duplicate stash item ID')
  })

  it('rejects invalid stash capacity', async () => {
    const result = await mockOk(invalidCapacityPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('usedSlots must not exceed totalSlots')
  })

  it('rejects invalid nested quest progress', async () => {
    const result = await mockOk(invalidQuestQuantityPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('non-negative integer')
  })

  it('rejects invalid nested hideout progress', async () => {
    const result = await mockOk(invalidHideoutPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('non-negative integer')
  })

  it('rejects invalid loadout ids', async () => {
    const result = await mockOk(invalidLoadoutPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('invalid weaponId')
  })

  it('rejects an invalid snapshot timestamp', async () => {
    const result = await mockOk(invalidTimestampPayload).loadPlayerState()
    assertFailure(result)
    expect(result.error.kind).toBe('normalization-error')
    expect(result.error.message).toContain('capturedAt')
  })
})

// ---- Snapshot cache behavior ----

describe('Providers — snapshot cache', () => {
  it('stores a valid load as the last-valid snapshot', async () => {
    const cache = createPlayerStateSnapshotCache(mockOk(validMockPayload))
    const refreshed = await cache.refresh()
    assertSuccess(refreshed)
    expect(refreshed.value.stale).toBe(false)
    expect(refreshed.value.providerId).toBe(FIXTURE_PROVIDER_ID)
    expect(refreshed.value.fetchedAt).toBe(FIXTURE_CAPTURED_AT)
    expect(refreshed.value.state.profile.playerId).toBe('player-1')
    const current = cache.current()
    assertSuccess(current)
    expect(current.value.stale).toBe(false)
    expect(current.value.state).toEqual(refreshed.value.state)
  })

  it('returns the stale fallback after the bound provider becomes unavailable', async () => {
    const provider = createSequencedProvider(
      FIXTURE_PROVIDER_ID,
      mockOk(validMockPayload),
      mockUnavailable()
    )
    const cache = createPlayerStateSnapshotCache(provider)
    const fresh = await cache.refresh()
    assertSuccess(fresh)
    expect(fresh.value.stale).toBe(false)
    const fallback = await cache.refresh()
    assertSuccess(fallback)
    expect(fallback.value.stale).toBe(true)
    expect(fallback.value.state).toEqual(fresh.value.state)
    expect(fallback.value.providerId).toBe(FIXTURE_PROVIDER_ID)
  })

  it('never returns one provider snapshot as another provider fallback', async () => {
    const cacheA = createPlayerStateSnapshotCache(mockOk(validMockPayload))
    const stored = await cacheA.refresh()
    assertSuccess(stored)
    const cacheB = createPlayerStateSnapshotCache(
      createMockPlayerProvider('other-provider', validMockPayload, 'unavailable')
    )
    const result = await cacheB.refresh()
    assertFailure(result)
    expect(result.error.kind).toBe('unavailable')
    const current = cacheB.current()
    assertFailure(current)
    expect(current.error.kind).toBe('snapshot-unavailable')
  })

  it('returns unavailable when the provider fails before the first success', async () => {
    const cache = createPlayerStateSnapshotCache(mockUnavailable())
    const result = await cache.refresh()
    assertFailure(result)
    expect(result.error.kind).toBe('unavailable')
    const current = cache.current()
    assertFailure(current)
    expect(current.error.kind).toBe('snapshot-unavailable')
  })

  it('returns validation failures explicitly without touching the cache', async () => {
    const provider = createSequencedProvider(
      FIXTURE_PROVIDER_ID,
      mockOk(validMockPayload),
      mockOk(negativeQuantityPayload)
    )
    const cache = createPlayerStateSnapshotCache(provider)
    const fresh = await cache.refresh()
    assertSuccess(fresh)
    const rejected = await cache.refresh()
    assertFailure(rejected)
    expect(rejected.error.kind).toBe('normalization-error')
    expect(rejected.error.message).toContain('invalid quantity')
    const current = cache.current()
    assertSuccess(current)
    expect(current.value.stale).toBe(false)
    expect(current.value.state).toEqual(fresh.value.state)
    if (current.value.state.stash === undefined) throw new Error('expected stash')
    expect(current.value.state.stash.items).toHaveLength(2)
  })
})

// ---- Public boundary ----

describe('Providers — public boundary', () => {
  it('does not leak raw DTOs publicly', async () => {
    const leaked = Object.keys(publicApi).filter((key) => key.startsWith('Raw'))
    expect(leaked).toEqual([])
    const result = await mockOk(validMockPayload).loadPlayerState()
    assertSuccess(result)
    const serialized = JSON.stringify(result.value)
    for (const rawKey of [
      '"pid"',
      '"sku"',
      '"amount"',
      '"goods"',
      '"slotsTotal"',
      '"slotsUsed"',
      '"owner"',
      '"site"',
      '"stage"',
      '"stores"',
      '"uid"',
      '"title"',
      '"needs"',
      '"primary"',
      '"guard"',
      '"trinket"',
      '"takenAt"',
    ]) {
      expect(serialized).not.toContain(rawKey)
    }
  })

  it('keeps the public contract free of provider-specific names', async () => {
    const names = Object.keys(publicApi)
    for (const name of names) {
      expect(name.toLowerCase()).not.toContain('arctracker')
      expect(name.toLowerCase()).not.toContain('tracker')
    }
    const provider: PlayerDataProvider = mockOk(validMockPayload)
    expect(Object.keys(provider).sort()).toEqual(['loadPlayerState', 'providerId'])
    expect(typeof provider.loadPlayerState).toBe('function')
    const result: ProviderResult<PlayerState> = await provider.loadPlayerState()
    assertSuccess(result)
    expect(result.value.profile.playerId).toBe('player-1')
  })
})
