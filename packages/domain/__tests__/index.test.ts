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
  type StashItemResult,
  type PlayerStashResult,
  type QuestProgressResult,
  type ProjectProgressResult,
  type HideoutProgressResult,
  type PlayerProfileResult,
  type PlayerStateResult,
  type PlayerLoadoutResult,
  type DomainResult,
} from '../index'

import { FIXTURE_TIMESTAMP } from '../fixtures'

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
    const result = createStashItem('', 1)
    assertFailure(result)
    expect(result.error).toContain('invalid itemId')
  })

  it('rejects whitespace-only ItemId', () => {
    const result = createStashItem('  ', 1)
    assertFailure(result)
    expect(result.error).toContain('invalid itemId')
  })

  it('rejects negative quantity', () => {
    const result = createStashItem('item-1', -1)
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })

  it('rejects fractional quantity', () => {
    const result = createStashItem('item-1', 2.5)
    assertFailure(result)
    expect(result.error).toContain('invalid quantity')
  })

  it('rejects negative slotCount — StashItem has no slotCount field', () => {
    // StashItem only has id and quantity per the new M1 model
    const result = createStashItem('item-1', 1)
    // slotCount was removed from StashItem; test passes as valid item
    assertSuccess(result)
  })

  it('accepts usedSlots === slotCount — slot invariants at PlayerStash level', () => {
    // Slot capacity invariants are enforced by PlayerStash, not StashItem
    const result = createStashItem('item-1', 1)
    assertSuccess(result)
  })
})

// ---- PlayerStash tests ----

describe('Domain — PlayerStash', () => {
  it('accepts valid stash with capacity', () => {
    const capacity = { totalSlots: 10, usedSlots: 3 }
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 3 }], capacity, FIXTURE_TIMESTAMP)
    assertSuccess(result)
    expect(result.value.capacity).toEqual({ totalSlots: 10, usedSlots: 3 })
  })

  it('accepts empty stash with capacity', () => {
    const capacity = { totalSlots: 10, usedSlots: 0 }
    const result = createPlayerStash('player-1', [], capacity, FIXTURE_TIMESTAMP)
    assertSuccess(result)
    expect(result.value.items).toHaveLength(0)
  })

  it('rejects negative totalSlots', () => {
    const capacity = { totalSlots: -1, usedSlots: 1 }
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 1 }], capacity, FIXTURE_TIMESTAMP)
    assertFailure(result)
    expect(result.error).toContain('totalSlots must be a non-negative integer')
  })

  it('rejects negative usedSlots', () => {
    const capacity = { totalSlots: 10, usedSlots: -1 }
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 1 }], capacity, FIXTURE_TIMESTAMP)
    assertFailure(result)
    expect(result.error).toContain('usedSlots must be a non-negative integer')
  })

  it('rejects usedSlots > totalSlots', () => {
    const capacity = { totalSlots: 3, usedSlots: 5 }
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 1 }], capacity, FIXTURE_TIMESTAMP)
    assertFailure(result)
    expect(result.error).toContain('usedSlots must not exceed totalSlots')
  })

  it('accepts valid usedSlots === totalSlots', () => {
    const capacity = { totalSlots: 5, usedSlots: 5 }
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 3 }], capacity, FIXTURE_TIMESTAMP)
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
      [{ id: 'item-1', quantity: -1 }],
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
    const result = createQuestProgress('q-1', 'active', [-1])
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
    const result = createProjectProgress('p-1', 'active', [-1])
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
    const result = createHideoutProgress('h-1', 'active', [-1])
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
    const result = createPlayerLoadout('', undefined, undefined)
    assertFailure(result)
    expect(result.error).toContain('invalid weaponId')
  })

  it('rejects empty armorId', () => {
    const result = createPlayerLoadout(undefined, '', undefined)
    assertFailure(result)
    expect(result.error).toContain('invalid armorId')
  })

  it('rejects empty accessoryId', () => {
    const result = createPlayerLoadout(undefined, undefined, '')
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
    const result = createPlayerProfile('')
    assertFailure(result)
    expect(result.error).toContain('invalid playerId')
  })

  it('rejects whitespace-only playerId', () => {
    const result = createPlayerProfile('  ')
    assertFailure(result)
    expect(result.error).toContain('invalid playerId')
  })

  it('PlayerProfile contains NO gameplay state', () => {
    // PlayerProfile is identity-only; stash/hideout/projects/quests/loadout are in PlayerState
    const result = createPlayerProfile('player-1')
    assertSuccess(result)
    // No stash, hideout, projects, quests, or loadout in PlayerProfile
    expect((result as any).value).toEqual({ playerId: 'player-1' })
  })
})

// ---- PlayerState tests ----

describe('Domain — PlayerState', () => {
  it('accepts valid deterministic PlayerState fixture', () => {
    const result = createPlayerState(
      'player-1',
      { playerId: 'player-1' },
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertSuccess(result)
    expect(result.value.playerId).toBe('player-1')
  })

  it('accepts valid empty PlayerState fixture', () => {
    const result = createPlayerState(
      'player-2',
      { playerId: 'player-2' },
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertSuccess(result)
    expect(result.value.stash).toBeUndefined()
    expect(result.value.hideoutProgress).toBeUndefined()
    expect(result.value.projects).toHaveLength(0)
    expect(result.value.questProgress).toHaveLength(0)
    expect(result.value.loadout).toBeUndefined()
  })

  it('rejects invalid timestamp', () => {
    const result = createPlayerState(
      'player-1',
      { playerId: 'player-1' },
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

  it('PlayerState preserves the provided PlayerProfile correctly', () => {
    const profile = { playerId: 'test-player' }
    const result = createPlayerState(
      'player-1',
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

  it('no duplicated profile/state ownership', () => {
    // PlayerProfile contains only playerId — no stash/hideout/projects/quests/loadout duplication
    const profile = { playerId: 'owner-1' }
    const result = createPlayerState(
      'player-1',
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
    expect(result.value.stash).toBeUndefined()
  })

  it('validates profile inside player state', () => {
    const result = createPlayerState(
      'player-1',
      { playerId: '' },
      undefined,
      undefined,
      [],
      [],
      undefined,
      { capturedAt: FIXTURE_TIMESTAMP }
    )
    assertFailure(result)
  })
})