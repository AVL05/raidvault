import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import type {
  GameItemKnowledge,
  GameKnowledge,
  ProjectRequirement,
  QuestKnowledge,
  WorkshopRequirement,
} from '@raidvault/game-data'
import {
  analyzeStash,
  buildPlanningSnapshot,
  type MissingItemPlan,
  type PlanningSnapshot,
  type TargetPlan,
} from '../index'

const CAPTURED_AT = 1700000000000

const wireItem: GameItemKnowledge = { id: 'plan-wire', name: 'Plan Wire', category: 'parts' }
const bandageItem: GameItemKnowledge = {
  id: 'plan-bandage',
  name: 'Plan Bandage',
  category: 'medical',
}

function makeKnowledge(input: {
  readonly items?: readonly GameItemKnowledge[]
  readonly quests?: readonly QuestKnowledge[]
  readonly workshops?: readonly WorkshopRequirement[]
  readonly projects?: readonly ProjectRequirement[]
}): GameKnowledge {
  return {
    items: input.items ?? [wireItem, bandageItem],
    quests: input.quests ?? [],
    workshops: input.workshops ?? [],
    projects: input.projects ?? [],
    metadata: {
      sourceId: 'plan-fixture-data',
      datasetVersion: 'm6-fixture-1',
      capturedAt: CAPTURED_AT,
    },
  }
}

function quest(
  id: string,
  needs: readonly (readonly [string, number])[]
): QuestKnowledge {
  return {
    id,
    name: `Quest ${id}`,
    requirements: needs.map(([itemId, quantity]) => ({ itemId, quantity })),
  }
}

function project(
  id: string,
  needs: readonly (readonly [string, number])[]
): ProjectRequirement {
  return {
    id,
    name: `Project ${id}`,
    requirements: needs.map(([itemId, quantity]) => ({ itemId, quantity })),
  }
}

function planState(
  stash: readonly { readonly id: string; readonly quantity: number }[] | undefined,
  questIds: readonly string[] = [],
  projectIds: readonly string[] = []
): PlayerState {
  return {
    profile: { playerId: 'player-1' },
    stash:
      stash === undefined
        ? undefined
        : {
            id: 'stash-1',
            items: stash.map((entry) => ({ id: entry.id, quantity: entry.quantity })),
            capacity: { totalSlots: 10, usedSlots: stash.length },
            freshness: { capturedAt: CAPTURED_AT },
          },
    questProgress: questIds.map((questId) => ({ questId, state: 'active', quantities: [] })),
    projects: projectIds.map((projectId) => ({ projectId, state: 'active', quantities: [] })),
    snapshotMetadata: { capturedAt: CAPTURED_AT },
  }
}

function target(planning: PlanningSnapshot, targetId: string): TargetPlan {
  const found = planning.targets.find((entry) => entry.targetId === targetId)
  if (found === undefined) throw new Error(`expected target ${targetId}`)
  return found
}

function missing(planning: PlanningSnapshot, itemId: string): MissingItemPlan {
  const found = planning.missingItems.find((entry) => entry.itemId === itemId)
  if (found === undefined) throw new Error(`expected missing item ${itemId}`)
  return found
}

function freezeDeep(value: unknown): void {
  if (typeof value !== 'object' || value === null) return
  Object.freeze(value)
  for (const child of Object.values(value)) {
    freezeDeep(child)
  }
}

describe('Planning — current requirement gaps', () => {
  it('exposes a matched quest gap with owned and missing amounts', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 2 }], ['qa']),
      knowledge
    )
    expect(planning.hasStash).toBe(true)
    const qa = target(planning, 'qa')
    expect(qa.targetType).toBe('QUEST')
    expect(qa.complete).toBe(false)
    expect(qa.requirements).toEqual([
      {
        targetType: 'QUEST',
        targetId: 'qa',
        itemId: 'plan-wire',
        requiredForTarget: 5,
        owned: 2,
        missingForTarget: 3,
      },
    ])
  })

  it('exposes a matched project gap', () => {
    const knowledge = makeKnowledge({ projects: [project('pa', [['plan-bandage', 3]])] })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-bandage', quantity: 1 }], [], ['pa']),
      knowledge
    )
    const pa = target(planning, 'pa')
    expect(pa.targetType).toBe('PROJECT')
    expect(pa.complete).toBe(false)
    expect(pa.requirements).toEqual([
      {
        targetType: 'PROJECT',
        targetId: 'pa',
        itemId: 'plan-bandage',
        requiredForTarget: 3,
        owned: 1,
        missingForTarget: 2,
      },
    ])
  })

  it('aggregates shared items to the authoritative M5 total, not summed gaps', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      projects: [project('pa', [['plan-wire', 5]])],
    })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 6 }], ['qa'], ['pa']),
      knowledge
    )
    expect(target(planning, 'qa').complete).toBe(true)
    expect(target(planning, 'pa').complete).toBe(true)
    expect(missing(planning, 'plan-wire').totalMissing).toBe(4)
  })

  it('marks a fully satisfied target complete', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 5 }], ['qa']),
      knowledge
    )
    expect(target(planning, 'qa').complete).toBe(true)
    expect(planning.missingItems).toEqual([])
    expect(planning.raidPriorities).toEqual([])
  })

  it('marks a partially satisfied target incomplete', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 2], ['plan-bandage', 1]])],
    })
    const planning = buildPlanningSnapshot(
      planState(
        [
          { id: 'plan-wire', quantity: 2 },
          { id: 'plan-bandage', quantity: 0 },
        ],
        ['qa']
      ),
      knowledge
    )
    expect(target(planning, 'qa').complete).toBe(false)
  })

  it('treats a zero-requirement target as complete', () => {
    const knowledge = makeKnowledge({
      quests: [{ id: 'qa', name: 'Quest qa', requirements: [] }],
    })
    const planning = buildPlanningSnapshot(planState([], ['qa']), knowledge)
    const qa = target(planning, 'qa')
    expect(qa.complete).toBe(true)
    expect(qa.requirements).toEqual([])
  })
})

describe('Planning — active source scoping', () => {
  it('excludes unrelated catalog quests', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 2]]), quest('qb', [['plan-wire', 50]])],
    })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 1 }], ['qa']),
      knowledge
    )
    expect(planning.targets.map((entry) => entry.targetId)).toEqual(['qa'])
    expect(missing(planning, 'plan-wire').totalMissing).toBe(1)
  })

  it('excludes unrelated catalog projects', () => {
    const knowledge = makeKnowledge({
      projects: [project('pa', [['plan-wire', 2]]), project('pb', [['plan-wire', 50]])],
    })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 1 }], [], ['pa']),
      knowledge
    )
    expect(planning.targets.map((entry) => entry.targetId)).toEqual(['pa'])
    expect(missing(planning, 'plan-wire').totalMissing).toBe(1)
  })

  it('contributes nothing when progression is undefined', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 2]])] })
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'plan-wire', quantity: 1 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const planning = buildPlanningSnapshot(state, knowledge)
    expect(planning.hasStash).toBe(true)
    expect(planning.targets).toEqual([])
    expect(planning.missingItems).toEqual([])
    expect(planning.raidPriorities).toEqual([])
  })

  it('surfaces unknown quest references explicitly without contributing', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 2]])] })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 1 }], ['ghost-quest']),
      knowledge
    )
    expect(planning.incompleteReferences).toEqual([{ targetType: 'QUEST', targetId: 'ghost-quest' }])
    expect(planning.targets).toEqual([])
  })

  it('surfaces unknown project references explicitly without contributing', () => {
    const knowledge = makeKnowledge({ projects: [project('pa', [['plan-wire', 2]])] })
    const planning = buildPlanningSnapshot(
      planState([{ id: 'plan-wire', quantity: 1 }], [], ['ghost-project']),
      knowledge
    )
    expect(planning.incompleteReferences).toEqual([
      { targetType: 'PROJECT', targetId: 'ghost-project' },
    ])
    expect(planning.targets).toEqual([])
  })

  it('never lets workshop catalog entries enter planning totals', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      workshops: [
        {
          id: 'wx',
          name: 'Workshop wx',
          requirements: [{ itemId: 'plan-wire', quantity: 40 }],
        },
      ],
    })
    const state: PlayerState = {
      ...planState([{ id: 'plan-wire', quantity: 0 }], ['qa']),
      hideoutProgress: { hideoutId: 'wx', state: 'active', resources: [] },
    }
    const planning = buildPlanningSnapshot(state, knowledge)
    expect(missing(planning, 'plan-wire').totalMissing).toBe(5)
    expect(planning.workshopPlanningSupported).toBe(false)
  })

  it('matches progression by ID without reading state strings or quantities', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'plan-wire', quantity: 2 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'qa', state: 'done', quantities: [7] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    expect(target(buildPlanningSnapshot(state, knowledge), 'qa').requirements).toEqual([
      {
        targetType: 'QUEST',
        targetId: 'qa',
        itemId: 'plan-wire',
        requiredForTarget: 5,
        owned: 2,
        missingForTarget: 3,
      },
    ])
  })
})

describe('Planning — stash states', () => {
  it('computes known-zero math for a present empty stash', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const planning = buildPlanningSnapshot(planState([], ['qa']), knowledge)
    expect(planning.hasStash).toBe(true)
    expect(target(planning, 'qa').complete).toBe(false)
    expect(missing(planning, 'plan-wire').totalMissing).toBe(5)
  })

  it('represents a missing stash without fabricating math', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const planning = buildPlanningSnapshot(planState(undefined, ['qa']), knowledge)
    expect(planning.hasStash).toBe(false)
    expect(planning.targets).toEqual([])
    expect(planning.missingItems).toEqual([])
    expect(planning.raidPriorities).toEqual([])
  })

  it('still surfaces incomplete references without a stash', () => {
    const knowledge = makeKnowledge({ quests: [quest('qa', [['plan-wire', 5]])] })
    const planning = buildPlanningSnapshot(planState(undefined, ['ghost-quest']), knowledge)
    expect(planning.hasStash).toBe(false)
    expect(planning.incompleteReferences).toEqual([
      { targetType: 'QUEST', targetId: 'ghost-quest' },
    ])
  })
})

describe('Planning — aggregates and priorities', () => {
  function twoMissingScenario() {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      projects: [project('pa', [['plan-bandage', 3]])],
    })
    const state = planState(
      [
        { id: 'plan-wire', quantity: 0 },
        { id: 'plan-bandage', quantity: 1 },
      ],
      ['qa'],
      ['pa']
    )
    return buildPlanningSnapshot(state, knowledge)
  }

  it('aggregates missing items with source types and target IDs', () => {
    const planning = twoMissingScenario()
    expect(missing(planning, 'plan-wire')).toEqual({
      itemId: 'plan-wire',
      displayName: 'Plan Wire',
      totalMissing: 5,
      sourceTypes: ['QUEST'],
      sourceTargetIds: ['qa'],
    })
    expect(missing(planning, 'plan-bandage')).toEqual({
      itemId: 'plan-bandage',
      displayName: 'Plan Bandage',
      totalMissing: 2,
      sourceTypes: ['PROJECT'],
      sourceTargetIds: ['pa'],
    })
  })

  it('orders priorities by higher missing first', () => {
    const planning = twoMissingScenario()
    expect(planning.raidPriorities.map((entry) => entry.itemId)).toEqual([
      'plan-wire',
      'plan-bandage',
    ])
    expect(planning.raidPriorities[0]).toEqual({
      rank: 1,
      itemId: 'plan-wire',
      displayName: 'Plan Wire',
      missing: 5,
      sourceTargetIds: ['qa'],
    })
  })

  it('breaks priority ties by item ID ascending with sequential ranks', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 3]])],
      projects: [project('pa', [['plan-bandage', 3]])],
    })
    const planning = buildPlanningSnapshot(
      planState(
        [
          { id: 'plan-wire', quantity: 0 },
          { id: 'plan-bandage', quantity: 0 },
        ],
        ['qa'],
        ['pa']
      ),
      knowledge
    )
    expect(planning.raidPriorities.map((entry) => entry.itemId)).toEqual([
      'plan-bandage',
      'plan-wire',
    ])
    expect(planning.raidPriorities.map((entry) => entry.rank)).toEqual([1, 2])
  })

  it('matches M5 row missing values for owned items', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      projects: [project('pa', [['plan-bandage', 3], ['plan-wire', 1]])],
    })
    const state = planState(
      [
        { id: 'plan-wire', quantity: 2 },
        { id: 'plan-bandage', quantity: 1 },
      ],
      ['qa'],
      ['pa']
    )
    const planning = buildPlanningSnapshot(state, knowledge)
    const analysis = analyzeStash(state, knowledge)
    for (const item of planning.missingItems) {
      const row = analysis.items.find((entry) => entry.itemId === item.itemId)
      if (row === undefined) throw new Error(`expected M5 row for ${item.itemId}`)
      expect(item.totalMissing).toBe(row.missing)
    }
    expect(missing(planning, 'plan-wire').totalMissing).toBe(4)
    expect(missing(planning, 'plan-bandage').totalMissing).toBe(2)
  })

  it('keeps missing quantities non-negative', () => {
    const planning = twoMissingScenario()
    for (const gap of planning.targets.flatMap((entry) => entry.requirements)) {
      expect(gap.missingForTarget).toBeGreaterThanOrEqual(0)
    }
    for (const item of planning.missingItems) {
      expect(item.totalMissing).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('Planning — determinism and safety', () => {
  it('returns deeply equal snapshots for repeated calls', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      projects: [project('pa', [['plan-bandage', 3]])],
    })
    const state = planState(
      [
        { id: 'plan-wire', quantity: 2 },
        { id: 'plan-bandage', quantity: 1 },
      ],
      ['qa'],
      ['pa']
    )
    expect(buildPlanningSnapshot(state, knowledge)).toEqual(
      buildPlanningSnapshot(state, knowledge)
    )
  })

  it('never mutates its inputs', () => {
    const knowledge = makeKnowledge({
      quests: [quest('qa', [['plan-wire', 5]])],
      projects: [project('pa', [['plan-bandage', 3]])],
    })
    const state = planState(
      [
        { id: 'plan-wire', quantity: 2 },
        { id: 'plan-bandage', quantity: 1 },
      ],
      ['qa'],
      ['pa']
    )
    freezeDeep(state)
    freezeDeep(knowledge)
    const beforeState = JSON.stringify(state)
    const beforeKnowledge = JSON.stringify(knowledge)
    buildPlanningSnapshot(state, knowledge)
    expect(JSON.stringify(state)).toBe(beforeState)
    expect(JSON.stringify(knowledge)).toBe(beforeKnowledge)
  })
})
