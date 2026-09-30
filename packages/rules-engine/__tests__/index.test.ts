import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import {
  analyzeStash,
  type ItemAnalysis,
  type ItemClassification,
  type StashAnalysis,
} from '../index'
import {
  emptyStashState,
  knowledgeAllSources,
  knowledgeBase,
  knowledgeEmptyCatalog,
  knowledgeNoRequirements,
  knowledgeTwoQuests,
  missingStashState,
  stateWithItems,
} from '../fixtures'

const CAPTURED_AT = 1700000000000

function row(analysis: StashAnalysis, itemId: string): ItemAnalysis {
  const found = analysis.items.find((entry) => entry.itemId === itemId)
  if (found === undefined) throw new Error(`expected row for ${itemId}`)
  return found
}

function stashHolding(
  itemId: string,
  quantity: number,
  questIds: readonly string[] = [],
  projectIds: readonly string[] = []
): PlayerState {
  return {
    profile: { playerId: 'player-1' },
    stash: {
      id: 'stash-1',
      items: [{ id: itemId, quantity }],
      capacity: { totalSlots: 10, usedSlots: 1 },
      freshness: { capturedAt: CAPTURED_AT },
    },
    questProgress: questIds.map((questId) => ({ questId, state: 'active', quantities: [] })),
    projects: projectIds.map((projectId) => ({ projectId, state: 'active', quantities: [] })),
    snapshotMetadata: { capturedAt: CAPTURED_AT },
  }
}

function baseMetadata() {
  return { sourceId: 'rules-fixture-data', datasetVersion: 'm5-fixture-1', capturedAt: CAPTURED_AT }
}

function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null) return
  Object.freeze(value)
  for (const child of Object.values(value)) {
    freezeDeep(child)
  }
}

describe('Rules engine — classification', () => {
  it('keeps a known item with no requirements', () => {
    const analysis = analyzeStash(stashHolding('rule-wire', 5), knowledgeNoRequirements)
    const wire = row(analysis, 'rule-wire')
    expect(wire.classification).toBe('KEEP')
    expect(wire.owned).toBe(5)
    expect(wire.required).toBe(0)
    expect(wire.reserved).toBe(0)
    expect(wire.missing).toBe(0)
    expect(wire.surplus).toBe(5)
    expect(wire.reasons.map((reason) => reason.code)).toEqual(['NO_KNOWN_REQUIREMENT'])
  })

  it('reserves an item required by one quest', () => {
    const questOnly: GameKnowledge = { ...knowledgeBase, workshops: [], projects: [] }
    const analysis = analyzeStash(stashHolding('rule-wire', 5, ['rule-quest']), questOnly)
    const wire = row(analysis, 'rule-wire')
    expect(wire.classification).toBe('RESERVE')
    expect(wire.required).toBe(2)
    expect(wire.reasons.map((reason) => reason.code)).toEqual(['REQUIRED_BY_QUEST'])
  })

  it('reserves an item required by one project', () => {
    const projectOnly: GameKnowledge = { ...knowledgeBase, quests: [], workshops: [] }
    const analysis = analyzeStash(stashHolding('rule-bandage', 5, [], ['rule-shelter']), projectOnly)
    const bandage = row(analysis, 'rule-bandage')
    expect(bandage.classification).toBe('RESERVE')
    expect(bandage.required).toBe(1)
    expect(bandage.reasons.map((reason) => reason.code)).toEqual(['REQUIRED_BY_PROJECT'])
  })

  it('aggregates quest and project contributions while excluding workshops', () => {
    const analysis = analyzeStash(
      stashHolding('rule-bandage', 9, ['rule-quest-bandage'], ['rule-shelter']),
      knowledgeAllSources
    )
    const bandage = row(analysis, 'rule-bandage')
    expect(bandage.required).toBe(3)
    expect(bandage.reasons.map((reason) => reason.code)).toEqual([
      'REQUIRED_BY_QUEST',
      'REQUIRED_BY_PROJECT',
    ])
  })

  it('aggregates multiple targets within one source', () => {
    const analysis = analyzeStash(
      stashHolding('rule-wire', 9, ['rule-quest-a', 'rule-quest-b']),
      knowledgeTwoQuests
    )
    const wire = row(analysis, 'rule-wire')
    expect(wire.required).toBe(7)
    expect(wire.classification).toBe('RESERVE')
  })

  it('sums duplicate contributions instead of deduplicating', () => {
    const duplicated: GameKnowledge = {
      ...knowledgeBase,
      workshops: [],
      projects: [],
      quests: [
        {
          id: 'rule-quest-dup',
          name: 'Rule Quest Dup',
          requirements: [
            { itemId: 'rule-wire', quantity: 2 },
            { itemId: 'rule-wire', quantity: 2 },
          ],
        },
      ],
    }
    const analysis = analyzeStash(stashHolding('rule-wire', 9, ['rule-quest-dup']), duplicated)
    expect(row(analysis, 'rule-wire').required).toBe(4)
  })
})

describe('Rules engine — requirement scoping', () => {
  it('counts only the pursued quest, not every catalog quest', () => {
    const knowledge: GameKnowledge = {
      items: [{ id: 'rule-wire', name: 'Rule Wire' }],
      quests: [
        { id: 'quest-a', name: 'Quest A', requirements: [{ itemId: 'rule-wire', quantity: 2 }] },
        { id: 'quest-b', name: 'Quest B', requirements: [{ itemId: 'rule-wire', quantity: 50 }] },
      ],
      workshops: [],
      projects: [],
      metadata: baseMetadata(),
    }
    const analysis = analyzeStash(stashHolding('rule-wire', 9, ['quest-a']), knowledge)
    expect(row(analysis, 'rule-wire').required).toBe(2)
  })

  it('counts only the pursued project, not every catalog project', () => {
    const knowledge: GameKnowledge = {
      items: [{ id: 'rule-wire', name: 'Rule Wire' }],
      quests: [],
      workshops: [],
      projects: [
        { id: 'proj-a', name: 'Project A', requirements: [{ itemId: 'rule-wire', quantity: 2 }] },
        { id: 'proj-b', name: 'Project B', requirements: [{ itemId: 'rule-wire', quantity: 50 }] },
      ],
      metadata: baseMetadata(),
    }
    const analysis = analyzeStash(stashHolding('rule-wire', 9, [], ['proj-a']), knowledge)
    expect(row(analysis, 'rule-wire').required).toBe(2)
  })

  it('never counts workshop catalog entries, even on exact hideout match', () => {
    const knowledge: GameKnowledge = {
      items: [{ id: 'rule-wire', name: 'Rule Wire' }],
      quests: [
        { id: 'quest-a', name: 'Quest A', requirements: [{ itemId: 'rule-wire', quantity: 2 }] },
      ],
      workshops: [
        { id: 'wx', name: 'Workshop X', requirements: [{ itemId: 'rule-wire', quantity: 40 }] },
        { id: 'wy', name: 'Workshop Y', requirements: [{ itemId: 'rule-wire', quantity: 1 }] },
      ],
      projects: [],
      metadata: baseMetadata(),
    }
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'rule-wire', quantity: 9 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'quest-a', state: 'active', quantities: [] }],
      hideoutProgress: { hideoutId: 'wx', state: 'active', resources: [] },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(row(analyzeStash(state, knowledge), 'rule-wire').required).toBe(2)
  })

  it('contributes zero quest requirements when questProgress is undefined', () => {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'rule-wire', quantity: 1 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(row(analyzeStash(state, knowledgeBase), 'rule-wire').required).toBe(0)
  })

  it('ignores progress quantities when matching quests', () => {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'rule-wire', quantity: 5 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'rule-quest', state: 'active', quantities: [99] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const questOnly: GameKnowledge = { ...knowledgeBase, workshops: [], projects: [] }
    expect(row(analyzeStash(state, questOnly), 'rule-wire').required).toBe(2)
  })

  it('matches progression by ID without reading state strings', () => {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'rule-wire', quantity: 5 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'rule-quest', state: 'completed', quantities: [] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const questOnly: GameKnowledge = { ...knowledgeBase, workshops: [], projects: [] }
    const wire = row(analyzeStash(state, questOnly), 'rule-wire')
    expect(wire.required).toBe(2)
    expect(wire.classification).toBe('RESERVE')
  })

  it('reviews clean rows when a quest reference is unknown', () => {
    const analysis = analyzeStash(
      stashHolding('rule-bandage', 5, ['quest-ghost']),
      knowledgeNoRequirements
    )
    const bandage = row(analysis, 'rule-bandage')
    expect(bandage.classification).toBe('REVIEW')
    expect(bandage.reasons.map((reason) => reason.code)).toEqual([
      'NO_KNOWN_REQUIREMENT',
      'INSUFFICIENT_DATA',
    ])
  })

  it('reviews clean rows when a project reference is unknown', () => {
    const analysis = analyzeStash(
      stashHolding('rule-bandage', 5, [], ['project-ghost']),
      knowledgeNoRequirements
    )
    const bandage = row(analysis, 'rule-bandage')
    expect(bandage.classification).toBe('REVIEW')
    expect(bandage.reasons.map((reason) => reason.code)).toEqual([
      'NO_KNOWN_REQUIREMENT',
      'INSUFFICIENT_DATA',
    ])
  })

  it('leaves clean rows alone for unmatched hideout progress', () => {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'rule-bandage', quantity: 5 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      hideoutProgress: { hideoutId: 'den-1', state: 'active', resources: [] },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const bandage = row(analyzeStash(state, knowledgeNoRequirements), 'rule-bandage')
    expect(bandage.classification).toBe('KEEP')
    expect(bandage.reasons.map((reason) => reason.code)).toEqual(['NO_KNOWN_REQUIREMENT'])
  })

  it('reviews workshop-mentioned items instead of keeping them', () => {
    const analysis = analyzeStash(stashHolding('rule-bandage', 5), knowledgeBase)
    const bandage = row(analysis, 'rule-bandage')
    expect(bandage.required).toBe(0)
    expect(bandage.classification).toBe('REVIEW')
    expect(bandage.reasons.map((reason) => reason.code)).toEqual(['INSUFFICIENT_DATA'])
  })
})

describe('Rules engine — quantity math', () => {
  it('exposes missing when owned is below required', () => {
    const analysis = analyzeStash(
      stashHolding('rule-wire', 2, ['rule-quest-a', 'rule-quest-b']),
      knowledgeTwoQuests
    )
    const wire = row(analysis, 'rule-wire')
    expect(wire.owned).toBe(2)
    expect(wire.required).toBe(7)
    expect(wire.reserved).toBe(2)
    expect(wire.missing).toBe(5)
    expect(wire.surplus).toBe(0)
  })

  it('reports zero missing and surplus when owned equals required', () => {
    const analysis = analyzeStash(
      stashHolding('rule-wire', 2, ['rule-quest-a']),
      knowledgeTwoQuests
    )
    const wire = row(analysis, 'rule-wire')
    expect(wire.owned).toBe(2)
    expect(wire.required).toBe(2)
    expect(wire.reserved).toBe(2)
    expect(wire.missing).toBe(0)
    expect(wire.surplus).toBe(0)
    expect(wire.classification).toBe('RESERVE')
  })

  it('keeps RESERVE with surplus exposed when owned exceeds required', () => {
    const analysis = analyzeStash(stateWithItems, knowledgeBase)
    const wire = row(analysis, 'rule-wire')
    expect(wire.owned).toBe(5)
    expect(wire.required).toBe(2)
    expect(wire.reserved).toBe(2)
    expect(wire.missing).toBe(0)
    expect(wire.surplus).toBe(3)
    expect(wire.classification).toBe('RESERVE')
  })

  it('holds reserved, missing, and surplus invariants on every row', () => {
    const analysis = analyzeStash(stateWithItems, knowledgeBase)
    for (const entry of analysis.items) {
      expect(entry.reserved).toBeLessThanOrEqual(entry.owned)
      expect(entry.missing).toBeGreaterThanOrEqual(0)
      expect(entry.surplus).toBeGreaterThanOrEqual(0)
      expect(Number.isInteger(entry.owned)).toBe(true)
      expect(Number.isInteger(entry.required)).toBe(true)
      expect(Number.isInteger(entry.reserved)).toBe(true)
      expect(Number.isInteger(entry.missing)).toBe(true)
      expect(Number.isInteger(entry.surplus)).toBe(true)
    }
  })

  it('creates no rows for required items the player does not own', () => {
    const analysis = analyzeStash(stashHolding('rule-wire', 1, ['rule-quest']), knowledgeBase)
    expect(analysis.items).toHaveLength(1)
    expect(analysis.items.map((entry) => entry.itemId)).toEqual(['rule-wire'])
    expect(row(analysis, 'rule-wire').missing).toBe(1)
  })
})

describe('Rules engine — unknown and empty states', () => {
  it('reviews an unknown stash item with explicit reasons', () => {
    const analysis = analyzeStash(stateWithItems, knowledgeBase)
    const ghost = row(analysis, 'rule-ghost')
    expect(ghost.classification).toBe('REVIEW')
    expect(ghost.reasons.map((reason) => reason.code)).toEqual(['UNKNOWN_ITEM', 'INSUFFICIENT_DATA'])
  })

  it('reviews every item when the catalog is empty', () => {
    const analysis = analyzeStash(stashHolding('rule-wire', 2), knowledgeEmptyCatalog)
    expect(row(analysis, 'rule-wire').classification).toBe('REVIEW')
  })

  it('returns an explicit empty analysis for a missing stash', () => {
    const analysis = analyzeStash(missingStashState, knowledgeBase)
    expect(analysis.hasStash).toBe(false)
    expect(analysis.items).toEqual([])
  })

  it('returns an explicit empty analysis for an empty stash', () => {
    const analysis = analyzeStash(emptyStashState, knowledgeBase)
    expect(analysis.hasStash).toBe(true)
    expect(analysis.items).toEqual([])
  })
})

describe('Rules engine — determinism and safety', () => {
  it('preserves stash item order', () => {
    const analysis = analyzeStash(stateWithItems, knowledgeBase)
    expect(analysis.items.map((entry) => entry.itemId)).toEqual([
      'rule-wire',
      'rule-bandage',
      'rule-ghost',
    ])
  })

  it('emits reasons in quest, project order', () => {
    const analysis = analyzeStash(
      stashHolding('rule-bandage', 9, ['rule-quest-bandage'], ['rule-shelter']),
      knowledgeAllSources
    )
    expect(row(analysis, 'rule-bandage').reasons.map((reason) => reason.code)).toEqual([
      'REQUIRED_BY_QUEST',
      'REQUIRED_BY_PROJECT',
    ])
  })

  it('returns deeply equal results for repeated calls', () => {
    const first = analyzeStash(stateWithItems, knowledgeBase)
    const second = analyzeStash(stateWithItems, knowledgeBase)
    expect(second).toEqual(first)
  })

  it('never mutates its inputs', () => {
    freezeDeep(stateWithItems)
    freezeDeep(knowledgeBase)
    const beforeState = JSON.stringify(stateWithItems)
    const beforeKnowledge = JSON.stringify(knowledgeBase)
    analyzeStash(stateWithItems, knowledgeBase)
    expect(JSON.stringify(stateWithItems)).toBe(beforeState)
    expect(JSON.stringify(knowledgeBase)).toBe(beforeKnowledge)
  })

  it('never emits SELL without explicit evidence', () => {
    for (const quantity of [0, 1, 5, 99]) {
      const analysis = analyzeStash(
        stashHolding('rule-wire', quantity, ['rule-quest']),
        knowledgeBase
      )
      expect(row(analysis, 'rule-wire').classification).not.toBe('SELL')
    }
    const unknown = analyzeStash(stashHolding('rule-ghost', 99), knowledgeBase)
    expect(row(unknown, 'rule-ghost').classification).not.toBe('SELL')
  })

  it('never emits RECYCLE without explicit evidence', () => {
    for (const quantity of [0, 1, 5, 99]) {
      const analysis = analyzeStash(
        stashHolding('rule-bandage', quantity, [], ['rule-shelter']),
        knowledgeBase
      )
      expect(row(analysis, 'rule-bandage').classification).not.toBe('RECYCLE')
    }
    const unknown = analyzeStash(stashHolding('rule-ghost', 99), knowledgeBase)
    expect(row(unknown, 'rule-ghost').classification).not.toBe('RECYCLE')
  })

  it('supports all five classifications in the result model', () => {
    const supported: ItemClassification[] = ['KEEP', 'RESERVE', 'SELL', 'RECYCLE', 'REVIEW']
    expect(supported).toHaveLength(5)
  })
})
