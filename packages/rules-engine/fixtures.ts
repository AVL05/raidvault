/**
 * RaidVault — Deterministic Rules Engine fixtures (M5).
 *
 * Validated-shaped PlayerState and GameKnowledge inputs with fixed
 * timestamps and synthetic identifiers. No real game or player data.
 * The engine trusts inputs as validated upstream, so fixtures mirror
 * the shapes produced by the M1/M2 pipelines.
 */

import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'

/** Fixed timestamp shared by fixtures (unix ms epoch). */
export const FIXTURE_CAPTURED_AT = 1700000000000

/**
 * Base knowledge: wire required 2 by quest + 1 by workshop (total 3);
 * bandage required 3 by workshop + 1 by project (total 4).
 */
export const knowledgeBase: GameKnowledge = {
  items: [
    { id: 'rule-wire', name: 'Rule Wire', category: 'parts' },
    { id: 'rule-bandage', name: 'Rule Bandage', category: 'medical' },
  ],
  quests: [
    {
      id: 'rule-quest',
      name: 'Rule Quest',
      requirements: [{ itemId: 'rule-wire', quantity: 2 }],
    },
  ],
  workshops: [
    {
      id: 'rule-workbench',
      name: 'Rule Workbench',
      requirements: [
        { itemId: 'rule-wire', quantity: 1 },
        { itemId: 'rule-bandage', quantity: 3 },
      ],
    },
  ],
  projects: [
    {
      id: 'rule-shelter',
      name: 'Rule Shelter',
      requirements: [{ itemId: 'rule-bandage', quantity: 1 }],
    },
  ],
  metadata: {
    sourceId: 'rules-fixture-data',
    datasetVersion: 'm5-fixture-1',
    capturedAt: FIXTURE_CAPTURED_AT,
  },
}

/** Knowledge with two quests referencing one item (aggregation case). */
export const knowledgeTwoQuests: GameKnowledge = {
  ...knowledgeBase,
  quests: [
    {
      id: 'rule-quest-a',
      name: 'Rule Quest A',
      requirements: [{ itemId: 'rule-wire', quantity: 2 }],
    },
    {
      id: 'rule-quest-b',
      name: 'Rule Quest B',
      requirements: [{ itemId: 'rule-wire', quantity: 5 }],
    },
  ],
  workshops: [],
  projects: [],
}

/** Knowledge with no requirements at all. */
export const knowledgeNoRequirements: GameKnowledge = {
  ...knowledgeBase,
  quests: [],
  workshops: [],
  projects: [],
}

/** Knowledge where one item is required by all three source kinds. */
export const knowledgeAllSources: GameKnowledge = {
  ...knowledgeBase,
  quests: [
    ...knowledgeBase.quests,
    {
      id: 'rule-quest-bandage',
      name: 'Rule Quest Bandage',
      requirements: [{ itemId: 'rule-bandage', quantity: 2 }],
    },
  ],
}

/** Knowledge with an empty item catalog. */
export const knowledgeEmptyCatalog: GameKnowledge = {
  ...knowledgeBase,
  items: [],
  quests: [],
  workshops: [],
  projects: [],
}

/** State holding required, surplus, and unknown items. */
export const stateWithItems: PlayerState = {
  profile: { playerId: 'player-1' },
  stash: {
    id: 'stash-1',
    items: [
      { id: 'rule-wire', quantity: 5 },
      { id: 'rule-bandage', quantity: 2 },
      { id: 'rule-ghost', quantity: 4 },
    ],
    capacity: { totalSlots: 10, usedSlots: 3 },
    freshness: { capturedAt: FIXTURE_CAPTURED_AT },
  },
  questProgress: [{ questId: 'rule-quest', state: 'active', quantities: [] }],
  projects: [{ projectId: 'rule-shelter', state: 'active', quantities: [] }],
  snapshotMetadata: { capturedAt: FIXTURE_CAPTURED_AT },
}

/** State with a present but empty stash. */
export const emptyStashState: PlayerState = {
  profile: { playerId: 'player-2' },
  stash: {
    id: 'stash-2',
    items: [],
    capacity: { totalSlots: 10, usedSlots: 0 },
    freshness: { capturedAt: FIXTURE_CAPTURED_AT },
  },
  snapshotMetadata: { capturedAt: FIXTURE_CAPTURED_AT },
}

/** State with no stash. */
export const missingStashState: PlayerState = {
  profile: { playerId: 'player-3' },
  snapshotMetadata: { capturedAt: FIXTURE_CAPTURED_AT },
}
