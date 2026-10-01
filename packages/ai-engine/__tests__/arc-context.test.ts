import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import {
  MAX_CATALOG_ENTRIES,
  MAX_CONTEXT_ITEMS,
  MAX_CONTEXT_TARGETS,
  buildVerifiedAiContext,
} from '../index'
import { CAPTURED_AT, testContext, testKnowledge, testState } from './helpers'

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
