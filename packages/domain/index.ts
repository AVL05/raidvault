/**
 * RaidVault — Provider-independent Domain Model (M1)
 *
 * This module owns provider-agnostic types and invariants.
 * It must NOT import from packages/providers, Next.js, React, or game-facing
 * code. All types are plain TypeScript with no framework dependencies.
 *
 * Invariants are enforced by constructor functions; invalid inputs produce
 * explicit, testable errors rather than silently accepted data.
 */

// ---------------------------------------------------------------------------
// Snapshot metadata (provider-independent, reusable across stash and state)
// ---------------------------------------------------------------------------

/** Minimal snapshot metadata, shared by stash and state snapshots. */
export interface SnapshotMetadata {
  /** When the snapshot was captured (unix ms epoch). */
  readonly capturedAt: number
  /** Optional source identifier. */
  readonly source?: string
}

/** Discriminated validation result shared by all domain constructors. */
export type DomainResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: string }

/** Snapshot metadata must carry an integer non-negative capture timestamp. */
function validateSnapshotMetadata(metadata: SnapshotMetadata): string | undefined {
  if (!metadata) {
    return 'snapshot metadata is required'
  }
  if (!Number.isInteger(metadata.capturedAt) || metadata.capturedAt < 0) {
    return `invalid snapshotMetadata.capturedAt: ${metadata.capturedAt}`
  }
  return undefined
}

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

// ---------------------------------------------------------------------------
// Stash capacity
// ---------------------------------------------------------------------------

/** Slot capacity information for a stash. Both counts are always known. */
export interface StashCapacity {
  /** Total number of slots in the stash. */
  readonly totalSlots: number
  /** Number of slots currently used. */
  readonly usedSlots: number
}

/** Validate StashCapacity invariants. */
function validateStashCapacity(capacity: StashCapacity): string | undefined {
  if (!capacity) {
    return 'stash capacity is required'
  }
  const { totalSlots, usedSlots } = capacity
  if (!Number.isInteger(totalSlots) || totalSlots < 0) {
    return 'totalSlots must be a non-negative integer'
  }
  if (!Number.isInteger(usedSlots) || usedSlots < 0) {
    return 'usedSlots must be a non-negative integer'
  }
  if (usedSlots > totalSlots) {
    return 'usedSlots must not exceed totalSlots'
  }
  return undefined
}

/** Validation result for StashItem construction. */
export type StashItemResult = DomainResult<StashItem>

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
  /** Slot capacity information for the stash. */
  readonly capacity: StashCapacity
  /** Freshness metadata for the whole stash. */
  readonly freshness: SnapshotMetadata
}

/** Validation result for PlayerStash construction. */
export type PlayerStashResult = DomainResult<PlayerStash>

/**
 * Create a PlayerStash, validating invariants.
 * - Rejects invalid capturedAt
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

/**
 * PlayerProfile contains identity/profile-only data.
 * It must NOT contain gameplay state (stash, hideout, projects, quests,
 * loadout). Those belong exclusively in PlayerState.
 */
export interface PlayerProfile {
  /** Unique player identifier. */
  readonly playerId: string
}

/** Validation result for PlayerProfile construction. */
export type PlayerProfileResult = DomainResult<PlayerProfile>

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
export type QuestProgressResult = DomainResult<QuestProgress>

/**
 * Create a QuestProgress, validating invariants.
 * - Quantities must be non-negative integers.
 * - An empty quantities array is allowed.
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
  for (const [index, quantity] of quantities.entries()) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { success: false, error: `quantities[${index}] must be a non-negative integer` }
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
export type ProjectProgressResult = DomainResult<ProjectProgress>

/**
 * Create a ProjectProgress, validating invariants.
 * - Quantities must be non-negative integers.
 * - An empty quantities array is allowed.
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
  for (const [index, quantity] of quantities.entries()) {
    if (!Number.isInteger(quantity) || quantity < 0) {
      return { success: false, error: `quantities[${index}] must be a non-negative integer` }
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
export type HideoutProgressResult = DomainResult<HideoutProgress>

/**
 * Create a HideoutProgress, validating invariants.
 * - Resources must be non-negative integers.
 * - An empty resources array is allowed.
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
  for (const [index, resource] of resources.entries()) {
    if (!Number.isInteger(resource) || resource < 0) {
      return { success: false, error: `resources[${index}] must be a non-negative integer` }
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
export type PlayerLoadoutResult = DomainResult<PlayerLoadout>

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

/**
 * Full player state: profile, snapshot metadata, and all progression data.
 * Identity lives in exactly one place: profile.playerId. There is no
 * top-level playerId, so inconsistent identities cannot be represented.
 */
export interface PlayerState {
  readonly profile: PlayerProfile
  readonly stash?: PlayerStash
  readonly hideoutProgress?: HideoutProgress
  readonly projects?: readonly ProjectProgress[]
  readonly questProgress?: readonly QuestProgress[]
  readonly loadout?: PlayerLoadout
  readonly snapshotMetadata: SnapshotMetadata
}

/** Validation result for PlayerState construction. */
export type PlayerStateResult = DomainResult<PlayerState>

/**
 * Create a PlayerState, re-validating every nested value through the existing
 * constructors so invalid nested data cannot silently enter PlayerState.
 * Valid inputs are preserved as provided; only their invariants are checked.
 * SnapshotMetadata is required explicitly — no default is invented.
 */
export function createPlayerState(
  profile: PlayerProfile,
  stash: PlayerStash | undefined,
  hideoutProgress: HideoutProgress | undefined,
  projects: readonly ProjectProgress[] | undefined,
  questProgress: readonly QuestProgress[] | undefined,
  loadout: PlayerLoadout | undefined,
  snapshotMetadata: SnapshotMetadata
): PlayerStateResult {
  if (!profile) {
    return { success: false, error: 'profile is required' }
  }
  const profileResult = createPlayerProfile(profile.playerId)
  if (profileResult.success === false) {
    return { success: false, error: `invalid profile: ${profileResult.error}` }
  }
  const metadataError = validateSnapshotMetadata(snapshotMetadata)
  if (metadataError !== undefined) {
    return { success: false, error: metadataError }
  }
  if (stash !== undefined) {
    const stashResult = createPlayerStash(
      stash.id,
      stash.items,
      stash.capacity,
      stash.freshness.capturedAt,
      stash.freshness.source
    )
    if (stashResult.success === false) {
      return { success: false, error: `invalid stash: ${stashResult.error}` }
    }
  }
  if (hideoutProgress !== undefined) {
    const hideoutResult = createHideoutProgress(
      hideoutProgress.hideoutId,
      hideoutProgress.state,
      hideoutProgress.resources
    )
    if (hideoutResult.success === false) {
      return { success: false, error: `invalid hideoutProgress: ${hideoutResult.error}` }
    }
  }
  if (projects !== undefined) {
    if (!Array.isArray(projects)) {
      return { success: false, error: 'invalid projects: expected an array' }
    }
    for (const [index, project] of projects.entries()) {
      const projectResult = createProjectProgress(
        project.projectId,
        project.state,
        project.quantities
      )
      if (projectResult.success === false) {
        return { success: false, error: `invalid projects[${index}]: ${projectResult.error}` }
      }
    }
  }
  if (questProgress !== undefined) {
    if (!Array.isArray(questProgress)) {
      return { success: false, error: 'invalid questProgress: expected an array' }
    }
    for (const [index, quest] of questProgress.entries()) {
      const questResult = createQuestProgress(
        quest.questId,
        quest.state,
        quest.quantities
      )
      if (questResult.success === false) {
        return { success: false, error: `invalid questProgress[${index}]: ${questResult.error}` }
      }
    }
  }
  if (loadout !== undefined) {
    const loadoutResult = createPlayerLoadout(
      loadout.weaponId,
      loadout.armorId,
      loadout.accessoryId
    )
    if (loadoutResult.success === false) {
      return { success: false, error: `invalid loadout: ${loadoutResult.error}` }
    }
  }
  return {
    success: true,
    value: {
      profile,
      stash,
      hideoutProgress,
      projects,
      questProgress,
      loadout,
      snapshotMetadata,
    },
  }
}
