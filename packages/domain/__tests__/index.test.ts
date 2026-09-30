import { describe, it, expect } from 'vitest'
import {
  createStashItem,
  createPlayerStash,
  createQuestProgress,
  createProjectProgress,
  createHideoutProgress,
  createPlayerProfile,
  createPlayerState,
  createPlayerLoadout,
  type DomainResult,
} from '../index'

import {
  FIXTURE_TIMESTAMP,
  validPlayerState,
  validEmptyPlayerState,
  validStashFixture,
  invalidEmptyItemId,
  invalidWhitespaceItemId,
  invalidNegativeQuantity,
  invalidFractionalQuantity,
  invalidNegativeTotalSlots,
  invalidNegativeUsedSlots,
  invalidUsedSlotsExceedsTotal,
  validUsedSlotsEqualsTotal,
} from '../fixtures'

// ---- Discriminated-union narrowing helpers ----

function assertSuccess<T>(result: DomainResult<T>): asserts result is { success: true; value: T } {
  if (result.success !== true) throw new Error('expected success')
}

function assertFailure<T>(result: DomainResult<T>): asserts result is { success: false; error: string } {
  if (result.success !== false) throw new Error('expected failure')
}

// ---- StashItem tests ----

describe('Domain — StashItem', () => {
  it('accepts valid stash item', () => {
    const result = createStashItem('item-1', 3)
    assertSuccess(result)
    expect(result.value).toEqual({ id: 'item-1', quantity: 3 })
  })

  it('rejects empty ItemId', () => {
    const result = createStashItem(invalidEmptyItemId, 1)
    assertFailure(result)
    expect(result.error).toContain('invalid itemId')
  })

  it('rejects whitespace-only ItemId', () => {
    const result = createStashItem(invalidWhitespaceItemId, 1)
    assertFailure(result)
    expect(result.error).toContain('invalid itemId')
  })

  it('rejects negative quantity', () => {
    const result = createStashItem('item-1', invalidNegativeQuantity)
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })

  it('rejects fractional quantity', () => {
    const result = createStashItem('item-1', invalidFractionalQuantity)
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })
})

// ---- PlayerStash tests ----

describe('Domain — PlayerStash', () => {
  it('accepts valid stash with capacity', () => {
    const result = createPlayerStash(
      validStashFixture.id,
      validStashFixture.items,
      validStashFixture.capacity,
      validStashFixture.capturedAt
    )
    assertSuccess(result)
    expect(result.value.capacity).toEqual({ totalSlots: 10, usedSlots: 3 })
    expect(result.value.freshness.capturedAt).toBe(FIXTURE_TIMESTAMP)
  })

  it('accepts empty stash with capacity', () => {
    const result = createPlayerStash('player-1', [], { totalSlots: 10, usedSlots: 0 }, FIXTURE_TIMESTAMP)
    assertSuccess(result)
    expect(result.value.items).toHaveLength(0)
  })

  it('rejects negative totalSlots', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 1 }],
      { totalSlots: invalidNegativeTotalSlots, usedSlots: 1 },
      FIXTURE_TIMESTAMP
    )
    assertFailure(result)
    expect(result.error).toContain('totalSlots must be a non-negative integer')
  })

  it('rejects negative usedSlots', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 1 }],
      { totalSlots: 10, usedSlots: invalidNegativeUsedSlots },
      FIXTURE_TIMESTAMP
    )
    assertFailure(result)
    expect(result.error).toContain('usedSlots must be a non-negative integer')
  })

  it('rejects usedSlots > totalSlots', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 1 }],
      invalidUsedSlotsExceedsTotal,
      FIXTURE_TIMESTAMP
    )
    assertFailure(result)
    expect(result.error).toContain('usedSlots must not exceed totalSlots')
  })

  it('accepts valid usedSlots === totalSlots', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 3 }],
      validUsedSlotsEqualsTotal,
      FIXTURE_TIMESTAMP
    )
    assertSuccess(result)
  })

  it('rejects duplicate stash item IDs', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 3 }, { id: 'item-1', quantity: 1 }],
      { totalSlots: 10, usedSlots: 4 },
      FIXTURE_TIMESTAMP
    )
    assertFailure(result)
    expect(result.error).toContain('duplicate stash item ID')
  })

  it('validates items via createStashItem', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: invalidNegativeQuantity }],
      { totalSlots: 10, usedSlots: 1 },
      FIXTURE_TIMESTAMP
    )
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })

  it('accepts empty stash', () => {
    const result = createPlayerStash('player-1', [], { totalSlots: 10, usedSlots: 0 }, FIXTURE_TIMESTAMP)
    assertSuccess(result)
    expect(result.value.items).toHaveLength(0)
  })
})

// ---- Progress tests ----

describe('Domain — QuestProgress', () => {
  it('accepts valid quest progress', () => {
    const result = createQuestProgress('q-1', 'active', [3, 0, 1])
    assertSuccess(result)
    expect(result.value).toEqual({ questId: 'q-1', state: 'active', quantities: [3, 0, 1] })
  })

  it('accepts empty quantities array', () => {
    const result = createQuestProgress('q-1', 'active', [])
    assertSuccess(result)
    expect(result.value.quantities).toHaveLength(0)
  })

  it('rejects negative quantities', () => {
    const result = createQuestProgress('q-1', 'active', [invalidNegativeQuantity])
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })
})

describe('Domain — ProjectProgress', () => {
  it('accepts valid project progress', () => {
    const result = createProjectProgress('p-1', 'in_progress', [2])
    assertSuccess(result)
  })

  it('accepts empty quantities array', () => {
    const result = createProjectProgress('p-1', 'active', [])
    assertSuccess(result)
    expect(result.value.quantities).toHaveLength(0)
  })

  it('rejects negative quantities', () => {
    const result = createProjectProgress('p-1', 'active', [invalidNegativeQuantity])
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })
})

describe('Domain — HideoutProgress', () => {
  it('accepts valid hideout progress', () => {
    const result = createHideoutProgress('h-1', 'active', [100, 50])
    assertSuccess(result)
  })

  it('accepts empty resources array', () => {
    const result = createHideoutProgress('h-1', 'active', [])
    assertSuccess(result)
    expect(result.value.resources).toHaveLength(0)
  })

  it('rejects negative resources', () => {
    const result = createHideoutProgress('h-1', 'active', [invalidNegativeQuantity])
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })
})

// ---- PlayerLoadout tests ----

describe('Domain — PlayerLoadout', () => {
  it('accepts valid loadout', () => {
    const result = createPlayerLoadout('w-1', 'a-1', 'acc-1')
    assertSuccess(result)
  })

  it('accepts partial loadout', () => {
    const result = createPlayerLoadout('w-1', undefined, undefined)
    assertSuccess(result)
  })

  it('rejects empty weaponId', () => {
    const result = createPlayerLoadout(invalidEmptyItemId, undefined, undefined)
    assertFailure(result)
    expect(result.error).toContain('invalid weaponId')
  })

  it('rejects empty armorId', () => {
    const result = createPlayerLoadout(undefined, invalidEmptyItemId, undefined)
    assertFailure(result)
    expect(result.error).toContain('invalid armorId')
  })

  it('rejects empty accessoryId', () => {
    const result = createPlayerLoadout(undefined, undefined, invalidEmptyItemId)
    assertFailure(result)
    expect(result.error).toContain('invalid accessoryId')
  })
})

// ---- PlayerProfile tests ----

describe('Domain — PlayerProfile', () => {
  it('accepts valid player profile', () => {
    const result = createPlayerProfile('player-1')
    assertSuccess(result)
    expect(result.value.playerId).toBe('player-1')
  })

  it('rejects empty playerId', () => {
    const result = createPlayerProfile(invalidEmptyItemId)
    assertFailure(result)
    expect(result.error).toContain('invalid playerId')
  })

  it('rejects whitespace-only playerId', () => {
    const result = createPlayerProfile(invalidWhitespaceItemId)
    assertFailure(result)
    expect(result.error).toContain('invalid playerId')
  })

  it('PlayerProfile contains NO gameplay state', () => {
    // PlayerProfile is identity-only; stash/hideout/projects/quests/loadout live in PlayerState
    const result = createPlayerProfile('player-1')
    assertSuccess(result)
    expect(result.value).toEqual({ playerId: 'player-1' })
    expect(Object.keys(result.value).sort()).toEqual(['playerId'])
  })
})

// ---- PlayerState tests ----

describe('Domain — PlayerState', () => {
  it('accepts valid deterministic PlayerState fixture', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      validPlayerState.stash,
      validPlayerState.hideoutProgress,
      validPlayerState.projects,
      validPlayerState.questProgress,
      validPlayerState.loadout,
      validPlayerState.snapshotMetadata
    )
    assertSuccess(result)
    expect(result.value.profile.playerId).toBe('player-1')
    expect(result.value.snapshotMetadata.capturedAt).toBe(FIXTURE_TIMESTAMP)
  })

  it('accepts valid deterministic empty PlayerState fixture', () => {
    const result = createPlayerState(
      validEmptyPlayerState.profile,
      validEmptyPlayerState.stash,
      validEmptyPlayerState.hideoutProgress,
      validEmptyPlayerState.projects,
      validEmptyPlayerState.questProgress,
      validEmptyPlayerState.loadout,
      validEmptyPlayerState.snapshotMetadata
    )
    assertSuccess(result)
    expect(result.value.stash).toBeUndefined()
    expect(result.value.hideoutProgress).toBeUndefined()
    expect(result.value.projects).toHaveLength(0)
    expect(result.value.questProgress).toHaveLength(0)
    expect(result.value.loadout).toBeUndefined()
  })

  it('rejects invalid snapshot timestamp', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: -1 }
    )
    assertFailure(result)
    expect(result.error).toContain('invalid snapshotMetadata.capturedAt')
  })

  it('PlayerState preserves the provided PlayerProfile', () => {
    const profile = { playerId: 'test-player' }
    const result = createPlayerState(
      profile,
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertSuccess(result)
    expect(result.value.profile).toBe(profile)
  })

  it('PlayerState identity lives only in profile (no duplicated ownership)', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      undefined,
      [],
      [],
      undefined,
      validPlayerState.snapshotMetadata
    )
    assertSuccess(result)
    expect('playerId' in result.value).toBe(false)
    expect(result.value.profile.playerId).toBe('player-1')
  })

  it('rejects invalid profile inside player state', () => {
    const result = createPlayerState(
      { playerId: invalidEmptyItemId },
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('invalid playerId')
  })

  it('rejects invalid nested stash via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      {
        id: 'player-1',
        items: [
          { id: 'item-1', quantity: 1 },
          { id: 'item-1', quantity: 2 },
        ],
        capacity: { totalSlots: 10, usedSlots: 3 },
        freshness: { capturedAt: FIXTURE_TIMESTAMP },
      },
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('duplicate stash item ID')
  })

  it('rejects invalid nested stash quantity via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      {
        id: 'player-1',
        items: [{ id: 'item-1', quantity: invalidNegativeQuantity }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: FIXTURE_TIMESTAMP },
      },
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })

  it('rejects invalid nested quest data via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      undefined,
      [],
      [{ questId: 'q-1', state: 'active', quantities: [invalidNegativeQuantity] }],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })

  it('rejects invalid nested project data via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      undefined,
      [{ projectId: 'p-1', state: 'active', quantities: [invalidNegativeQuantity] }],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })

  it('rejects invalid nested hideout data via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      {
        hideoutId: 'h-1',
        state: 'active',
        resources: [invalidNegativeQuantity],
      },
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('non-negative integer')
  })

  it('rejects invalid nested loadout via PlayerState', () => {
    const result = createPlayerState(
      validPlayerState.profile,
      undefined,
      undefined,
      [],
      [],
      { weaponId: invalidEmptyItemId },
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
    expect(result.error).toContain('invalid weaponId')
  })
})
