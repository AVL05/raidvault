/**
 * RaidVault — Deterministic synthetic fixtures (M1)
 *
 * Fixed-timestamp fixtures with no real player data.
 * Used by domain tests to verify invariant behavior reliably.
 */

export const FIXTURE_TIMESTAMP = 1700000000000

// ---------------------------------------------------------------------------
// Valid fixtures
// ---------------------------------------------------------------------------

/** A valid minimal player state fixture. */
export const validPlayerState: {
  playerId: string
  profile: { playerId: string }
  snapshotMetadata: { capturedAt: number; source?: string }
} = {
  playerId: 'player-1',
  profile: { playerId: 'player-1' },
  snapshotMetadata: { capturedAt: FIXTURE_TIMESTAMP },
}

/** A valid empty player state fixture (no stash, no progression). */
export const validEmptyPlayerState: {
  playerId: string
  profile: { playerId: string }
  stash?: undefined
  hideoutProgress?: undefined
  projects?: {}
  questProgress?: {}
  loadout?: undefined
  snapshotMetadata: { capturedAt: number; source?: string }
} = {
  playerId: 'player-2',
  profile: { playerId: 'player-2' },
  snapshotMetadata: { capturedAt: FIXTURE_TIMESTAMP },
  stash: undefined,
  hideoutProgress: undefined,
  projects: [],
  questProgress: [],
  loadout: undefined,
}

/** A valid stash fixture with capacity. */
export const validStashFixture: {
  id: string
  items: readonly { id: string; quantity: number }[]
  capacity: { totalSlots: number; usedSlots: number }
  capturedAt: number
} = {
  id: 'stash-1',
  items: [{ id: 'item-1', quantity: 3 }],
  capacity: { totalSlots: 10, usedSlots: 3 },
  capturedAt: FIXTURE_TIMESTAMP,
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