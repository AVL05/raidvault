import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import {
  MAX_CATALOG_ENTRIES,
  MAX_CONTEXT_INCOMPLETE_REFERENCES,
  MAX_CONTEXT_ITEMS,
  MAX_CONTEXT_PRIORITIES,
  MAX_CONTEXT_TARGETS,
  buildVerifiedAiContext,
  fingerprintVerifiedContext,
  type VerifiedAiContext,
} from '../index'
import { CAPTURED_AT, testContext, testKnowledge, testState } from './helpers'

function contextFor(state: PlayerState, knowledge: GameKnowledge): VerifiedAiContext {
  return buildVerifiedAiContext({
    playerState: state,
    gameKnowledge: knowledge,
    analysis: analyzeStash(state, knowledge),
    planning: buildPlanningSnapshot(state, knowledge),
  })
}

function withStashQuantity(itemId: string, quantity: number): PlayerState {
  const state = testState()
  return {
    ...state,
    stash:
      state.stash === undefined
        ? undefined
        : {
            ...state.stash,
            items: state.stash.items.map((entry) =>
              entry.id === itemId ? { ...entry, quantity } : entry
            ),
          },
  }
}

describe('ARC context — builder', () => {
  it('builds context from validated inputs with exact facts', () => {
    const context = testContext()
    expect(context.stash).toEqual({
      provenance: 'PLAYER_STATE',
      state: 'KNOWN',
      value: { hasStash: true, itemCount: 2, usedSlots: 2, totalSlots: 10 },
    })
    expect(context.items).toHaveLength(2)
    expect(context.items[0]).toEqual({
      provenance: 'RULES_ENGINE',
      state: 'KNOWN',
      value: {
        itemId: 'arc-wire',
        displayName: 'Arc Wire',
        displayNameUnique: true,
        owned: 2,
        required: 5,
        reserved: 2,
        missing: 3,
        surplus: 0,
        classification: 'RESERVE',
        reasons: [
          {
            code: 'REQUIRED_BY_QUEST',
            message: 'Required by quests: quantity 5',
          },
        ],
      },
    })
    expect(context.snapshot.capturedAt).toBe(CAPTURED_AT)
    expect(context.snapshot.providerId).toBe('mock-provider')
    expect(context.snapshot.stale).toBe(false)
  })

  it('matches M5 item analyses exactly', () => {
    const context = testContext()
    const analysis = analyzeStash(testState(), testKnowledge())
    expect(context.items.map((fact) => fact.value)).toEqual(
      analysis.items.map((row) => ({
        itemId: row.itemId,
        displayName: row.itemId === 'arc-wire' ? 'Arc Wire' : 'Arc Cell',
        displayNameUnique: true,
        owned: row.owned,
        required: row.required,
        reserved: row.reserved,
        missing: row.missing,
        surplus: row.surplus,
        classification: row.classification,
        reasons: row.reasons,
      }))
    )
  })

  it('fingerprints bounded display-name uniqueness without exposing the duplicate catalog item', () => {
    const state = testState()
    const knowledge = testKnowledge()
    const base = contextFor(state, knowledge)
    const doubled = contextFor(state, {
      ...knowledge,
      items: [...knowledge.items, { id: 'arc-wire-spool', name: '  ARC   WIRE  ' }],
    })
    expect(base.items[0]?.value.displayNameUnique).toBe(true)
    expect(doubled.items[0]?.value.displayNameUnique).toBe(false)
    expect(doubled.items.map(({ value: { displayNameUnique, ...facts } }) => facts))
      .toEqual(base.items.map(({ value: { displayNameUnique, ...facts } }) => facts))
    expect(doubled.catalog).toEqual(base.catalog)
    expect(doubled.version).not.toBe(base.version)
  })

  it('marks absent display names as non-unique', () => {
    const context = contextFor(testState(), { ...testKnowledge(), items: [] })
    expect(context.items.every((fact) => fact.value.displayName === undefined && !fact.value.displayNameUnique))
      .toBe(true)
  })

  it('preserves unknown progression references explicitly', () => {
    const state = {
      ...testState(),
      questProgress: [{ questId: 'ghost-quest', state: 'active', quantities: [] }],
      projects: [],
    }
    const context = buildVerifiedAiContext({
      playerState: state,
      gameKnowledge: testKnowledge(),
      analysis: analyzeStash(state, testKnowledge()),
      planning: {
        hasStash: true,
        targets: [],
        missingItems: [],
        raidPriorities: [],
        incompleteReferences: [{ targetType: 'QUEST' as const, targetId: 'ghost-quest' }],
        workshopPlanningSupported: false,
      },
    })
    expect(context.incompleteReferences).toEqual([
      { targetType: 'QUEST', targetId: 'ghost-quest' },
    ])
  })

  it('marks workshop planning unsupported explicitly', () => {
    expect(testContext().workshopPlanning).toBe('UNSUPPORTED')
  })

  it('exposes planning raids with provenance', () => {
    const context = testContext()
    expect(context.raidPriorities).toHaveLength(1)
    const top = context.raidPriorities[0]
    if (top === undefined) throw new Error('expected priority')
    expect(top.provenance).toBe('PLANNING')
    expect(top.state).toBe('KNOWN')
    expect(top.value.itemId).toBe('arc-wire')
    expect(top.value.missing).toBe(3)
  })

  it('produces deterministic versions for identical inputs', () => {
    const first = testContext()
    const second = testContext()
    expect(second.version).toBe(first.version)
    expect(second).toEqual(first)
  })

  it('changes the version when relevant inputs change', () => {
    const base = testContext().version
    const changed: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'arc-wire', quantity: 9 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
      projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const knowledge = testKnowledge()
    const altered = buildVerifiedAiContext({
      playerState: changed,
      gameKnowledge: knowledge,
      analysis: analyzeStash(changed, knowledge),
      planning: {
        hasStash: true,
        targets: [],
        missingItems: [],
        raidPriorities: [],
        incompleteReferences: [],
        workshopPlanningSupported: false,
      },
    })
    expect(altered.version).not.toBe(base)
  })

  it('bounds items deterministically to the first entries', () => {
    const items = Array.from({ length: MAX_CONTEXT_ITEMS + 5 }, (_, index) => ({
      id: `bulk-${index}`,
      quantity: 1,
    }))
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items,
        capacity: { totalSlots: 200, usedSlots: 55 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
      projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const knowledge = testKnowledge()
    const context = buildVerifiedAiContext({
      playerState: state,
      gameKnowledge: knowledge,
      analysis: analyzeStash(state, knowledge),
      planning: {
        hasStash: true,
        targets: [],
        missingItems: [],
        raidPriorities: [],
        incompleteReferences: [],
        workshopPlanningSupported: false,
      },
    })
    expect(context.items).toHaveLength(MAX_CONTEXT_ITEMS)
    expect(context.items[0]?.value.itemId).toBe('bulk-0')
  })

  it('bounds quest and project targets deterministically', () => {
    const quests = Array.from({ length: MAX_CONTEXT_TARGETS + 3 }, (_, index) => ({
      targetType: 'QUEST' as const,
      targetId: `bulk-quest-${index}`,
      targetName: `Bulk Quest ${index}`,
      complete: true,
      requirements: [],
    }))
    const context = buildVerifiedAiContext({
      playerState: testState(),
      gameKnowledge: testKnowledge(),
      analysis: analyzeStash(testState(), testKnowledge()),
      planning: {
        hasStash: true,
        targets: quests,
        missingItems: [],
        raidPriorities: [],
        incompleteReferences: [],
        workshopPlanningSupported: false,
      },
    })
    expect(context.quests).toHaveLength(MAX_CONTEXT_TARGETS)
    expect(context.quests[0]?.value.targetId).toBe('bulk-quest-0')
  })

  it('never dumps the full game catalog', () => {
    const knowledge = {
      ...testKnowledge(),
      items: [
        ...testKnowledge().items,
        { id: 'arc-unreferenced', name: 'Arc Unreferenced', category: 'parts' },
      ],
    }
    const state = testState()
    const context = buildVerifiedAiContext({
      playerState: state,
      gameKnowledge: knowledge,
      analysis: analyzeStash(state, knowledge),
      planning: buildPlanningSnapshot(state, knowledge),
      providerId: 'mock-provider',
    })
    expect(context.catalog.map((entry) => entry.itemId)).not.toContain('arc-unreferenced')
    expect(context.catalog.length).toBeLessThanOrEqual(MAX_CATALOG_ENTRIES)
  })
})

describe('ARC context — version coverage', () => {
  it('changes when an item required or missing quantity changes', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const changed = contextFor(withStashQuantity('arc-wire', 9), testKnowledge()).version
    expect(changed).not.toBe(base)
  })

  it('changes when an item classification changes', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const state = testState()
    const dropped: PlayerState = { ...state, questProgress: [] }
    expect(contextFor(dropped, testKnowledge()).version).not.toBe(base)
  })

  it('changes when target structure changes with identical totals', () => {
    const knowledge = testKnowledge()
    const first = contextFor(testState(), knowledge).version
    const split: GameKnowledge = {
      ...knowledge,
      quests: [
        {
          id: 'arc-quest-a',
          name: 'Arc Quest A',
          requirements: [{ itemId: 'arc-wire', quantity: 2 }],
        },
        {
          id: 'arc-quest-b',
          name: 'Arc Quest B',
          requirements: [{ itemId: 'arc-wire', quantity: 3 }],
        },
      ],
    }
    const state = testState()
    const progressed: PlayerState = {
      ...state,
      questProgress: [
        { questId: 'arc-quest-a', state: 'active', quantities: [] },
        { questId: 'arc-quest-b', state: 'active', quantities: [] },
      ],
    }
    expect(contextFor(progressed, split).version).not.toBe(first)
  })

  it('changes when target completion flips', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const satisfied = withStashQuantity('arc-wire', 5)
    expect(contextFor(satisfied, testKnowledge()).version).not.toBe(base)
  })

  it('changes when a target requirement quantity changes', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const knowledge = testKnowledge()
    const edited: GameKnowledge = {
      ...knowledge,
      quests: [
        {
          id: 'arc-quest',
          name: 'Arc Quest',
          requirements: [{ itemId: 'arc-wire', quantity: 6 }],
        },
      ],
    }
    expect(contextFor(testState(), edited).version).not.toBe(base)
  })

  it('changes when incomplete references change', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const state = testState()
    const ghosted: PlayerState = {
      ...state,
      questProgress: [{ questId: 'ghost-quest', state: 'active', quantities: [] }],
    }
    expect(contextFor(ghosted, testKnowledge()).version).not.toBe(base)
  })

  it('changes when a catalog category changes', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const knowledge = testKnowledge()
    const recategorized: GameKnowledge = {
      ...knowledge,
      items: knowledge.items.map((item) =>
        item.id === 'arc-wire' ? { ...item, category: 'spare' } : item
      ),
    }
    expect(contextFor(testState(), recategorized).version).not.toBe(base)
  })

  it('changes when a catalog display name changes', () => {
    const base = contextFor(testState(), testKnowledge()).version
    const knowledge = testKnowledge()
    const renamed: GameKnowledge = {
      ...knowledge,
      items: knowledge.items.map((item) =>
        item.id === 'arc-wire' ? { ...item, name: 'Arc Wire Mk II' } : item
      ),
    }
    expect(contextFor(testState(), renamed).version).not.toBe(base)
  })

  it('keeps the same version for identical bounded contexts', () => {
    const first = contextFor(testState(), testKnowledge())
    const knowledge = testKnowledge()
    const state = testState()
    const second = contextFor(
      {
        ...state,
        stash:
          state.stash === undefined
            ? undefined
            : {
                id: 'stash-1',
                items: [
                  { id: 'arc-wire', quantity: 2 },
                  { id: 'arc-cell', quantity: 3 },
                ],
                capacity: { totalSlots: 10, usedSlots: 2 },
                freshness: { capturedAt: CAPTURED_AT },
              },
      },
      knowledge
    )
    expect(second.version).toBe(first.version)
    expect(second).toEqual(first)
  })

  it('ignores input changes beyond every truncation boundary', () => {
    const makeState = (tailId: string): PlayerState => ({
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [
          ...Array.from({ length: 100 }, (_, index) => ({
            id: `bulk-${index}`,
            quantity: 1,
          })),
          { id: tailId, quantity: 9 },
        ],
        capacity: { totalSlots: 200, usedSlots: 101 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    })
    const knowledge = testKnowledge()
    const first = contextFor(makeState('tail-a'), knowledge).version
    expect(contextFor(makeState('tail-b'), knowledge).version).toBe(first)
  })

  it('ignores input changes beyond the target truncation boundary', () => {
    const makeKnowledge = (tailId: string): GameKnowledge => ({
      ...testKnowledge(),
      quests: [
        ...Array.from({ length: 20 }, (_, index) => ({
          id: `bulk-quest-${index}`,
          name: `Bulk Quest ${index}`,
          requirements: [],
        })),
        { id: tailId, name: 'Tail Quest', requirements: [] },
      ],
    })
    const first = contextFor(testState(), makeKnowledge('tail-a')).version
    expect(contextFor(testState(), makeKnowledge('tail-b')).version).toBe(first)
  })

  it('fingerprints the workshop flag directly', () => {
    const full = testContext()
    const { version: _dropped, ...payload } = full
    void _dropped
    expect(fingerprintVerifiedContext(payload)).toBe(full.version)
    expect(
      fingerprintVerifiedContext({ ...payload, workshopPlanning: 'KNOWN' })
    ).not.toBe(full.version)
  })
})

describe('ARC context — collection bounds', () => {
  it('caps raid priorities to the first deterministic entries', () => {
    const priorities = Array.from({ length: MAX_CONTEXT_PRIORITIES + 5 }, (_, index) => ({
      rank: index + 1,
      itemId: `bulk-item-${index}`,
      displayName: `Bulk Item ${index}`,
      missing: 30 - index,
      sourceTargetIds: ['bulk-quest'],
    }))
    const context = buildVerifiedAiContext({
      playerState: testState(),
      gameKnowledge: testKnowledge(),
      analysis: analyzeStash(testState(), testKnowledge()),
      planning: {
        hasStash: true,
        targets: [],
        missingItems: [],
        raidPriorities: priorities,
        incompleteReferences: [],
        workshopPlanningSupported: false,
      },
    })
    expect(context.raidPriorities).toHaveLength(MAX_CONTEXT_PRIORITIES)
    expect(context.raidPriorities[0]?.value.itemId).toBe('bulk-item-0')
  })

  it('caps incomplete references to the first deterministic entries', () => {
    const references = Array.from(
      { length: MAX_CONTEXT_INCOMPLETE_REFERENCES + 4 },
      (_, index) => ({ targetType: 'QUEST' as const, targetId: `ghost-${index}` })
    )
    const context = buildVerifiedAiContext({
      playerState: testState(),
      gameKnowledge: testKnowledge(),
      analysis: analyzeStash(testState(), testKnowledge()),
      planning: {
        hasStash: true,
        targets: [],
        missingItems: [],
        raidPriorities: [],
        incompleteReferences: references,
        workshopPlanningSupported: false,
      },
    })
    expect(context.incompleteReferences).toHaveLength(MAX_CONTEXT_INCOMPLETE_REFERENCES)
    expect(context.incompleteReferences[0]).toEqual({
      targetType: 'QUEST',
      targetId: 'ghost-0',
    })
  })
})
