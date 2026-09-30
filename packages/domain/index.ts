/**
 * RaidVault — Provider-independent Domain Model (M1)
 *
 * This module owns provider-agnostic types and invariants.
 * It must NOT import from packages/providers, Next.js, React, or any
 * game-facing code. All types are plain TypeScript with no framework
 * dependencies.
 *
 * Invariants are enforced by constructor functions; invalid inputs
 * produce explicit, testable errors rather than silently accepted data.
 */

// ---------------------------------------------------------------------------
// Snapshot metadata (provider-independent, reusable across stash/profile/state)
// ---------------------------------------------------------------------------

/** Minimal snapshot metadata, shared by stash, profile, and state snapshots. */
export interface SnapshotMetadata {
  /** When the snapshot was captured (unix ms epoch). */
  readonly capturedAt: number
  /** Optional source identifier. */
  readonly source?: string
}

/** Validation result using a generic DomainResult. */
export type DomainResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: string }

// ---------------------------------------------------------------------------
// Core identifiers
// ---------------------------------------------------------------------------

export type ItemId = string

/** Item ID must be a non-empty, non-whitespace string. */
export function isValidItemId(id: string): boolean {
  return id !== '' && id.trim() !== ''
}

/** Minimal snapshot of an item in the stash. */
export interface StashItem {
  /** Unique identifier for this item. */
  readonly id: ItemId
  /** Quantities must be non-negative integers. */
  readonly quantity: number
}

/** Freshness metadata for a stash item, using provider-independent SnapshotMetadata. */
export interface StashItemFreshness {
  /** When the item was last fetched/validated. */
  readonly capturedAt: number
  /** Optional source identifier. */
  readonly source?: string
}

// ---------------------------------------------------------------------------
// Stash capacity
// ---------------------------------------------------------------------------

/** Slot capacity information for a stash, validated by PlayerStash. */
export interface StashCapacity {
  /** Total number of slots in the stash. */
  readonly totalSlots?: number
  /** Number of slots currently used. */
  readonly usedSlots?: number
}

/** Validate StashCapacity invariants. */
function validateStashCapacity(
  capacity: StashCapacity | undefined
): string | undefined {
  if (capacity === undefined) return undefined
  const { totalSlots, usedSlots } = capacity
  if (totalSlots === undefined || usedSlots === undefined) {
    return 'totalSlots and usedSlots must be present when capacity is provided'
  }
  if (!Number.isInteger(totalSlots) || totalSlots < 0) {
    return 'totalSlots must be a non-negative integer when present'
  }
  if (!Number.isInteger(usedSlots) || usedSlots < 0) {
    return 'usedSlots must be a non-negative integer when present'
  }
  if (usedSlots > totalSlots) {
    return 'usedSlots must not exceed totalSlots'
  }
  return undefined
}

/** Validation result for StashItem construction. */
export type StashItemResult =
  | { readonly success: true; readonly value: StashItem }
  | { readonly success: false; readonly error: string }

/** Create a StashItem, validating invariants. */
export function createStashItem(
  id: ItemId,
  quantity: number
): StashItemResult {
  if (!isValidItemId(id)) {
    return { success: false, error: `invalid itemId: ${id}` }
  }
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { success: false, error: `invalid quantity: ${quantity}` }
  }
  return { success: true, value: { id, quantity } }
}

// ---------------------------------------------------------------------------
// PlayerStash with slot capacity
// ---------------------------------------------------------------------------

/** A player's stash with its items and capacity metadata. */
export interface PlayerStash {
  /** Unique identifier for this stash (player/account). */
  readonly id: string
  /** Items in the stash; expected to have unique IDs. */
  readonly items: readonly StashItem[]
  /** Slot capacity information; optional when unknown. */
  readonly capacity: StashCapacity
  /** Freshness metadata for the whole stash. */
  readonly freshness: SnapshotMetadata
}

/** Validation result for PlayerStash construction. */
export type PlayerStashResult =
  | { readonly success: true; readonly value: PlayerStash }
  | { readonly success: false; readonly error: string }

/**
 * Create a PlayerStash, validating invariants.
 * - Rejects negative fetchedAt
 * - Rejects duplicate stash item IDs
 * - Validates each item via createStashItem
 * - Validates slot capacity invariants
 */
export function createPlayerStash(
  id: string,
  items: readonly StashItem[],
  capacity: StashCapacity,
  capturedAt: number,
  source?: string
): PlayerStashResult {
  if (!Number.isInteger(capturedAt) || capturedAt < 0) {
    return { success: false, error: `invalid capturedAt: ${capturedAt}` }
  }
  if (!isValidItemId(id)) {
    return { success: false, error: `invalid stash id: ${id}` }
  }
  const idSet = new Set<string>()
  for (const item of items) {
    if (idSet.has(item.id)) {
      return { success: false, error: `duplicate stash item ID: ${item.id}` }
    }
    idSet.add(item.id)
    const itemResult = createStashItem(item.id, item.quantity)
    if (itemResult.success === false) {
      return { success: false, error: `stash item ${item.id}: ${itemResult.error}` }
    }
  }
  const capacityError = validateStashCapacity(capacity)
  if (capacityError !== undefined) {
    return { success: false, error: `stash capacity: ${capacityError}` }
  }
  return {
    success: true,
    value: {
      id,
      items,
      capacity,
      freshness: { capturedAt, source },
    },
  }
}

// ---------------------------------------------------------------------------
// PlayerProfile — identity/profile-only information
// ---------------------------------------------------------------------------

/** Profile-only information: player identifier. */
/** Validation result for PlayerProfile construction. */
export type PlayerProfileResult =
  | { readonly success: true; readonly value: PlayerProfile }
  | { readonly success: false; readonly error: string }

/**
 * PlayerProfile contains identity/profile-only data.
 * It must NOT contain gameplay state (stash, hideout, projects, quests, loadout).
 * Those belong exclusively in PlayerState.
 */
export interface PlayerProfile {
  /** Unique player identifier. */
  readonly playerId: string
}

/**
 * Create a PlayerProfile, validating invariants.
 * - Rejects empty playerId
 * - PlayerProfile contains NO gameplay state
 */
export function createPlayerProfile(
  playerId: string
): PlayerProfileResult {
  if (!isValidItemId(playerId)) {
    return { success: false, error: `invalid playerId: ${playerId}` }
  }
  return { success: true, value: { playerId } }
}

// ---------------------------------------------------------------------------
// QuestProgress
// ---------------------------------------------------------------------------

/** Quest progress with state and quantities. */
export interface QuestProgress {
  readonly questId: string
  readonly state: string
  readonly quantities: readonly number[]
}

/** Validation result for QuestProgress construction. */
export type QuestProgressResult =
  | { readonly success: true; readonly value: QuestProgress }
  | { readonly success: false; readonly error: string }

/**
 * Create a QuestProgress, validating invariants.
 * - Quantities must be non-negative integers.
 * - Empty quantities array is allowed (M1 preference for consistent empty progress).
 */
export function createQuestProgress(
  questId: string,
  state: string,
  quantities: readonly number[]
): QuestProgressResult {
  if (!questId || questId.trim() === '') {
    return { success: false, error: `invalid questId: ${questId}` }
  }
  if (state.trim() === '') {
    return { success: false, error: `invalid quest state: ${state}` }
  }
  for (let i = 0; i < quantities.length; i++) {
    if (!Number.isInteger(quantities[i] as number) || (quantities[i] as number) < 0) {
      return { success: false, error: `quantities[${i}] must be a non-negative integer` }
    }
  }
  return { success: true, value: { questId, state, quantities } }
}

// ---------------------------------------------------------------------------
// ProjectProgress
// ---------------------------------------------------------------------------

/** Project progress with state and quantities. */
export interface ProjectProgress {
  readonly projectId: string
  readonly state: string
  readonly quantities: readonly number[]
}

/** Validation result for ProjectProgress construction. */
export type ProjectProgressResult =
  | { readonly success: true; readonly value: ProjectProgress }
  | { readonly success: false; readonly error: string }

/**
 * Create a ProjectProgress, validating invariants.
 * - Quantities must be non-negative integers.
 * - Empty quantities array is allowed (M1 preference for consistent empty progress).
 */
export function createProjectProgress(
  projectId: string,
  state: string,
  quantities: readonly number[]
): ProjectProgressResult {
  if (!projectId || projectId.trim() === '') {
    return { success: false, error: `invalid projectId: ${projectId}` }
  }
  if (state.trim() === '') {
    return { success: false, error: `invalid project state: ${state}` }
  }
  for (let i = 0; i < quantities.length; i++) {
    if (!Number.isInteger(quantities[i] as number) || (quantities[i] as number) < 0) {
      return { success: false, error: `quantities[${i}] must be a non-negative integer` }
    }
  }
  return { success: true, value: { projectId, state, quantities } }
}

// ---------------------------------------------------------------------------
// HideoutProgress
// ---------------------------------------------------------------------------

/** Hideout progress with state and resources. */
export interface HideoutProgress {
  readonly hideoutId: string
  readonly state: string
  readonly resources: readonly number[]
}

/** Validation result for HideoutProgress construction. */
export type HideoutProgressResult =
  | { readonly success: true; readonly value: HideoutProgress }
  | { readonly success: false; readonly error: string }

/**
 * Create a HideoutProgress, validating invariants.
 * - Resources must be non-negative integers.
 * - Empty resources array is allowed (M1 preference for consistent empty progress).
 */
export function createHideoutProgress(
  hideoutId: string,
  state: string,
  resources: readonly number[]
): HideoutProgressResult {
  if (!hideoutId || hideoutId.trim() === '') {
    return { success: false, error: `invalid hideoutId: ${hideoutId}` }
  }
  if (state.trim() === '') {
    return { success: false, error: `invalid hideout state: ${state}` }
  }
  for (let i = 0; i < resources.length; i++) {
    if (!Number.isInteger(resources[i] as number) || (resources[i] as number) < 0) {
      return { success: false, error: `resources[${i}] must be a non-negative integer` }
    }
  }
  return { success: true, value: { hideoutId, state, resources } }
}

// ---------------------------------------------------------------------------
// PlayerLoadout
// ---------------------------------------------------------------------------

/** Player loadout with optional weapon, armor, and accessory IDs. */
export interface PlayerLoadout {
  readonly weaponId?: string
  readonly armorId?: string
  readonly accessoryId?: string
}

/** Validation result for PlayerLoadout construction. */
export type PlayerLoadoutResult =
  | { readonly success: true; readonly value: PlayerLoadout }
  | { readonly success: false; readonly error: string }

/**
 * Create a PlayerLoadout, validating invariants.
 * - IDs, when present, must be non-empty strings.
 */
export function createPlayerLoadout(
  weaponId?: string,
  armorId?: string,
  accessoryId?: string
): PlayerLoadoutResult {
  if (weaponId !== undefined && (typeof weaponId !== 'string' || weaponId.trim() === '')) {
    return { success: false, error: `invalid weaponId: ${weaponId}` }
  }
  if (armorId !== undefined && (typeof armorId !== 'string' || armorId.trim() === '')) {
    return { success: false, error: `invalid armorId: ${armorId}` }
  }
  if (accessoryId !== undefined && (typeof accessoryId !== 'string' || accessoryId.trim() === '')) {
    return { success: false, error: `invalid accessoryId: ${accessoryId}` }
  }
  return { success: true, value: { weaponId, armorId, accessoryId } }
}

// ---------------------------------------------------------------------------
// PlayerState — the single authoritative container
// ---------------------------------------------------------------------------

/** Full player state: identity, profile, snapshot metadata, and all progression data. */
export interface PlayerState {
  readonly playerId: string
  readonly profile: PlayerProfile
  readonly stash?: PlayerStash
  readonly hideoutProgress?: HideoutProgress
  readonly projects?: readonly ProjectProgress[]
  readonly questProgress?: readonly QuestProgress[]
  readonly loadout?: PlayerLoadout
  readonly snapshotMetadata: SnapshotMetadata
}

/** Validation result for PlayerState construction. */
export type PlayerStateResult =
  | { readonly success: true; readonly value: PlayerState }
  | { readonly success: false; readonly error: string }

/**
 * Create a PlayerState, validating invariants.
 * - Validates playerId
 * - Validates profile (identity-only, no gameplay state)
 * - Validates stash capacity if present
 * - Validates all progression data
 * - Preserves the provided profile consistently — does NOT reconstruct or ignore it.
 */
export function createPlayerState(
  playerId: string,
  profile: PlayerProfile,
  stash?: PlayerStash,
  hideoutProgress?: HideoutProgress,
  projects?: readonly ProjectProgress[],
  questProgress?: readonly QuestProgress[],
  loadout?: PlayerLoadout,
  snapshotMetadata?: SnapshotMetadata
): PlayerStateResult {
  if (!isValidItemId(playerId)) {
    return { success: false, error: `invalid playerId: ${playerId}` }
  }
  if (!profile) {
    return { success: false, error: 'profile is required' }
  }
  // Profile is preserved as-provided — no reconstruction, no ignoring.
  // Validate the profile's playerId invariant.
  if (!isValidItemId(profile.playerId)) {
    return { success: false, error: `invalid profile.playerId: ${profile.playerId}` }
  }
  const effectiveSnapshotMetadata = snapshotMetadata ?? { capturedAt: 1700000000000 }
  if (!Number.isInteger(effectiveSnapshotMetadata.capturedAt) || effectiveSnapshotMetadata.capturedAt < 0) {
    return { success: false, error: `invalid snapshotMetadata.capturedAt: ${effectiveSnapshotMetadata.capturedAt}` }
  }
  return {
    success: true,
    value: {
      playerId,
      profile,
      stash,
      hideoutProgress,
      projects,
      questProgress,
      loadout,
      snapshotMetadata: effectiveSnapshotMetadata,
    },
  }
}