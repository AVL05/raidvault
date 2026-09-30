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
} from '../index'

describe('Domain — StashItem', () => {
  it('accepts valid stash item', () => {
    const result = createStashItem('item-1', 3)
    expect(result.success).toBe(true)
    expect((result as any).value).toEqual({ id: 'item-1', quantity: 3 })
  })

  it('rejects negative quantity', () => {
    const result = createStashItem('item-1', -1)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid quantity')
  })

  it('rejects fractional quantity', () => {
    const result = createStashItem('item-1', 2.5)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid quantity')
  })

  it('rejects negative slotCount', () => {
    const result = createStashItem('item-1', 1, -1)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid slotCount')
  })

  it('rejects usedSlots > slotCount', () => {
    const result = createStashItem('item-1', 1, 2, 3)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('exceeds')
  })

  it('accepts usedSlots === slotCount', () => {
    const result = createStashItem('item-1', 1, 2, 2)
    expect(result.success).toBe(true)
  })
})

describe('Domain — PlayerStash', () => {
  it('accepts valid player stash', () => {
    const result = createPlayerStash('player-1', [{ id: 'item-1', quantity: 3 }], Date.now())
    expect(result.success).toBe(true)
    expect(result.value.items).toHaveLength(1)
  })

  it('rejects duplicate stash item IDs', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: 3 }, { id: 'item-1', quantity: 1 }],
      Date.now()
    )
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('duplicate')
  })

  it('validates items via createStashItem', () => {
    const result = createPlayerStash(
      'player-1',
      [{ id: 'item-1', quantity: -1 }],
      Date.now()
    )
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid quantity')
  })

  it('accepts empty stash', () => {
    const result = createPlayerStash('player-1', [], Date.now())
    expect(result.success).toBe(true)
    expect(result.value.items).toHaveLength(0)
  })
})

describe('Domain — QuestProgress', () => {
  it('accepts valid quest progress', () => {
    const result = createQuestProgress('q-1', 'active', [3, 0, 1])
    expect(result.success).toBe(true)
    expect(result.value).toEqual({ questId: 'q-1', state: 'active', quantities: [3, 0, 1] })
  })

  it('rejects empty questId', () => {
    const result = createQuestProgress('', 'active', [1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid questId')
  })

  it('rejects empty state', () => {
    const result = createQuestProgress('q-1', '', [1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid quest state')
  })

  it('rejects negative quantities', () => {
    const result = createQuestProgress('q-1', 'active', [-1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('non-negative integer')
  })

  it('rejects empty quantities array', () => {
    const result = createQuestProgress('q-1', 'active', [])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('at least one entry')
  })
})

describe('Domain — ProjectProgress', () => {
  it('accepts valid project progress', () => {
    const result = createProjectProgress('p-1', 'in_progress', [2])
    expect(result.success).toBe(true)
  })

  it('rejects empty projectId', () => {
    const result = createProjectProgress('', 'active', [1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid projectId')
  })

  it('rejects negative quantities', () => {
    const result = createProjectProgress('p-1', 'active', [-1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('non-negative integer')
  })
})

describe('Domain — HideoutProgress', () => {
  it('accepts valid hideout progress', () => {
    const result = createHideoutProgress('h-1', 'active', [100, 50])
    expect(result.success).toBe(true)
  })

  it('rejects empty hideoutId', () => {
    const result = createHideoutProgress('', 'active', [1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid hideoutId')
  })

  it('rejects negative resources', () => {
    const result = createHideoutProgress('h-1', 'active', [-1])
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('non-negative integer')
  })
})

describe('Domain — PlayerLoadout', () => {
  it('accepts valid loadout', () => {
    const result = createPlayerLoadout('w-1', 'a-1', 'acc-1')
    expect(result.success).toBe(true)
  })

  it('accepts partial loadout', () => {
    const result = createPlayerLoadout('w-1', undefined, undefined)
    expect(result.success).toBe(true)
  })

  it('rejects empty weaponId', () => {
    const result = createPlayerLoadout('', undefined, undefined)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid weaponId')
  })

  it('rejects empty armorId', () => {
    const result = createPlayerLoadout(undefined, '', undefined)
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid armorId')
  })

  it('rejects empty accessoryId', () => {
    const result = createPlayerLoadout(undefined, undefined, '')
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid accessoryId')
  })
})

describe('Domain — PlayerProfile', () => {
  it('accepts valid player profile', () => {
    const result = createPlayerProfile('player-1')
    expect(result.success).toBe(true)
    expect(result.value.playerId).toBe('player-1')
  })

  it('rejects empty playerId', () => {
    const result = createPlayerProfile('')
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid playerId')
  })

  it('validates stash when present', () => {
    const result = createPlayerProfile('player-1', {
      id: 'stash-1',
      items: [{ id: 'item-1', quantity: 3 }],
      freshness: { fetchedAt: Date.now() },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid stash', () => {
    const result = createPlayerProfile('player-1', {
      id: 'stash-1',
      items: [{ id: 'item-1', quantity: -1 }],
      freshness: { fetchedAt: Date.now() },
    })
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('stash')
  })
})

describe('Domain — PlayerState', () => {
  it('accepts valid player state', () => {
    const result = createPlayerState(
      'player-1',
      { playerId: 'player-1' },
      { id: 'stash-1', items: [{ id: 'item-1', quantity: 3 }], freshness: { fetchedAt: Date.now() } },
      undefined,
      [],
      [],
      undefined
    )
    expect(result.success).toBe(true)
    expect(result.value.playerId).toBe('player-1')
  })

  it('rejects empty playerId', () => {
    const result = createPlayerState('', { playerId: 'inner' })
    expect(result.success).toBe(false)
    expect((result as any).error).toContain('invalid playerId')
  })

  it('validates profile inside player state', () => {
    const result = createPlayerState(
      'player-1',
      { playerId: '', stash: undefined, hideoutProgress: undefined, projects: [], questProgress: [], loadout: undefined }
    )
    expect(result.success).toBe(false)
  })
})