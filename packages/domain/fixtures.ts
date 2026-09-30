/**
 * RaidVault — Deterministic synthetic fixtures (M1)
 *
 * Fixed-timestamp fixtures with no real player data.
 * Used by domain tests to verify invariant behavior reliably.
 */

import type {
  PlayerProfile,
  PlayerStash,
  HideoutProgress,
  ProjectProgress,
  QuestProgress,
  PlayerLoadout,
  SnapshotMetadata,
  StashCapacity,
  StashItem,
} from './index'

export const FIXTURE_TIMESTAMP = 1700000000000

// ---------------------------------------------------------------------------
// Valid fixtures (shaped as createPlayerState / createPlayerStash inputs)
// ---------------------------------------------------------------------------

/** A valid minimal player state fixture. */
export const validPlayerState: {
  profile: PlayerProfile
  stash: undefined
  hideoutProgress: undefined
  projects: readonly ProjectProgress[]
  questProgress: readonly QuestProgress[]
  loadout: undefined
  snapshotMetadata: SnapshotMetadata
} = {
  profile: { playerId: 'player-1' },
  stash: undefined,
  hideoutProgress: undefined,
  projects: [],
  questProgress: [],
  loadout: undefined,
  snapshotMetadata: { capturedAt: FIXTURE_TIMESTAMP },
}

/** A valid empty player state fixture (no stash, no progression). */
export const validEmptyPlayerState: {
  profile: PlayerProfile
  stash: undefined
  hideoutProgress: undefined
  projects: readonly ProjectProgress[]
  questProgress: readonly QuestProgress[]
  loadout: undefined
  snapshotMetadata: SnapshotMetadata
} = {
  profile: { playerId: 'player-2' },
  stash: undefined,
  hideoutProgress: undefined,
  projects: [],
  questProgress: [],
  loadout: undefined,
  snapshotMetadata: { capturedAt: FIXTURE_TIMESTAMP },
}

/** A valid stash fixture with capacity. */
export const validStashFixture: {
  id: string
  items: readonly StashItem[]
  capacity: StashCapacity
  capturedAt: number
} = {
  id: 'stash-1',
  items: [{ id: 'item-1', quantity: 3 }],
  capacity: { totalSlots: 10, usedSlots: 3 },
  capturedAt: FIXTURE_TIMESTAMP,
}

/** A valid stash value fixture (resolved PlayerStash shape). */
export const validStashValue: PlayerStash = {
  id: 'stash-1',
  items: [{ id: 'item-1', quantity: 3 }],
  capacity: { totalSlots: 10, usedSlots: 3 },
  freshness: { capturedAt: FIXTURE_TIMESTAMP },
}

/** A valid hideout progress fixture. */
export const validHideoutValue: HideoutProgress = {
  hideoutId: 'h-1',
  state: 'active',
  resources: [100, 50],
}

/** A valid loadout fixture. */
export const validLoadoutValue: PlayerLoadout = {
  weaponId: 'w-1',
  armorId: 'a-1',
  accessoryId: 'acc-1',
}

// ---------------------------------------------------------------------------
// Invalid fixtures (used by invariant tests)
// ---------------------------------------------------------------------------

/** Invalid: empty itemId. */
export const invalidEmptyItemId = ''

/** Invalid: whitespace-only itemId. */
export const invalidWhitespaceItemId = '  '

/** Invalid: negative quantity. */
export const invalidNegativeQuantity = -1

/** Invalid: fractional quantity. */
export const invalidFractionalQuantity = 2.5

/** Invalid: negative totalSlots. */
export const invalidNegativeTotalSlots = -5

/** Invalid: negative usedSlots. */
export const invalidNegativeUsedSlots = -1

/** Invalid: usedSlots > totalSlots. */
export const invalidUsedSlotsExceedsTotal = {
  totalSlots: 3,
  usedSlots: 5,
}

/** Valid: usedSlots === totalSlots. */
export const validUsedSlotsEqualsTotal = {
  totalSlots: 5,
  usedSlots: 5,
}
