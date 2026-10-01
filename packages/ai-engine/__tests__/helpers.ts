/**
 * Shared deterministic builders for ARC AI tests (M9, test-only).
 * Constructs validated-shaped inputs plus a verified context through
 * the real builder, so tests exercise honest composition.
 */

import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import { buildVerifiedAiContext, type VerifiedAiContext } from '../index'

export const CAPTURED_AT = 1700000000000

export function testKnowledge(): GameKnowledge {
  return {
    items: [
      { id: 'arc-wire', name: 'Arc Wire', category: 'parts' },
      { id: 'arc-cell', name: 'Arc Cell', category: 'energy' },
    ],
    quests: [
      {
        id: 'arc-quest',
        name: 'Arc Quest',
        requirements: [{ itemId: 'arc-wire', quantity: 5 }],
      },
    ],
    workshops: [],
    projects: [
      {
        id: 'arc-project',
        name: 'Arc Project',
        requirements: [{ itemId: 'arc-cell', quantity: 3 }],
      },
    ],
    metadata: {
      sourceId: 'arc-fixture-data',
      datasetVersion: 'm9-fixture-1',
      capturedAt: CAPTURED_AT,
    },
  }
}

export function testState(): PlayerState {
  return {
    profile: { playerId: 'player-1' },
    stash: {
      id: 'stash-1',
      items: [
        { id: 'arc-wire', quantity: 2 },
        { id: 'arc-cell', quantity: 3 },
      ],
      capacity: { totalSlots: 10, usedSlots: 2 },
      freshness: { capturedAt: CAPTURED_AT },
    },
    questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
    projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
    snapshotMetadata: { capturedAt: CAPTURED_AT },
  }
}

/**
 * Verified context built through the real pipeline: M5 analysis and M6
 * planning feed the builder exactly as production would provide them.
 */
export function testContext(): VerifiedAiContext {
  const playerState = testState()
  const gameKnowledge = testKnowledge()
  return buildVerifiedAiContext({
    playerState,
    gameKnowledge,
    analysis: analyzeStash(playerState, gameKnowledge),
    planning: buildPlanningSnapshot(playerState, gameKnowledge),
    providerId: 'mock-provider',
    stale: false,
  })
}
