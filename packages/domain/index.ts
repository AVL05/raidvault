export type ItemId = string

export interface StashItem {
  readonly id: ItemId
  readonly quantity: number
  readonly slotCount?: number
  readonly usedSlots?: number
}

export interface StashItemFreshness {
  readonly fetchedAt: number
  readonly source?: string
}

export type StashItemResult =
  | { readonly success: true; readonly value: StashItem }
  | { readonly success: false; readonly error: string }

/** Create a StashItem, validating invariants. */
export function createStashItem(
  id: ItemId,
  quantity: number,
  slotCount?: number,
  usedSlots?: number
): StashItemResult {
  if (!Number.isInteger(quantity) || quantity < 0) {
    return { success: false, error: `invalid quantity: ${quantity}` }
  }
  if (slotCount !== undefined && (Number.isInteger(slotCount) === false || slotCount < 0)) {
    return { success: false, error: `invalid slotCount: ${slotCount}` }
  }
  if (usedSlots !== undefined && (Number.isInteger(usedSlots) === false || usedSlots < 0)) {
    return { success: false, error: `invalid usedSlots: ${usedSlots}` }
  }
  if (usedSlots !== undefined && slotCount !== undefined && usedSlots > slotCount) {
    return { success: false, error: `usedSlots (${usedSlots}) exceeds slotCount (${slotCount})` }
  }
  return { success: true, value: { id, quantity, slotCount, usedSlots } }
}

/** A player's stash with its items and freshness metadata. */
export interface PlayerStash {
  readonly id: string
  readonly items: readonly StashItem[]
  readonly freshness: StashItemFreshness
}

/** Validation result for PlayerStash construction. */
export type PlayerStashResult =
  | { readonly success: true; readonly value: PlayerStash }
  | { readonly success: false; readonly error: string }

/** Validation result for QuestProgress construction. */
export type QuestProgressResult =
  | { readonly success: true; readonly value: QuestProgress }
  | { readonly success: false; readonly error: string }

/** Validation result for ProjectProgress construction. */
export type ProjectProgressResult =
  | { readonly success: true; readonly value: ProjectProgress }
  | { readonly success: false; readonly error: string }

/** Validation result for HideoutProgress construction. */
export type HideoutProgressResult =
  | { readonly success: true; readonly value: HideoutProgress }
  | { readonly success: false; readonly error: string }

/** Validation result for PlayerLoadout construction. */
export type PlayerLoadoutResult =
  | { readonly success: true; readonly value: PlayerLoadout }
  | { readonly success: false; readonly error: string }

/** Create a QuestProgress, validating invariants. */
export function createPlayerStash(
  id: string,
  items: readonly StashItem[],
  fetchedAt: number,
  source?: string
): PlayerStashResult {
  if (!Number.isInteger(fetchedAt) || fetchedAt < 0) {
    return { success: false, error: `invalid fetchedAt: ${fetchedAt}` }
  }
  const idSet = new Set<string>()
  for (const item of items) {
    if (idSet.has(item.id)) {
      return { success: false, error: `duplicate stash item ID: ${item.id}` }
    }
    idSet.add(item.id)
    const itemResult = createStashItem(item.id, item.quantity, item.slotCount, item.usedSlots)
    if (itemResult.success === false) {
      return { success: false, error: `stash item ${item.id}: ${itemResult.error}` }
    }
  }
  return {
    success: true,
    value: {
      id,
      items,
      freshness: { fetchedAt, source },
    },
  }
}

/** Player profile with stash, hideout, projects, quests, and loadout. */
export interface PlayerProfile {
  readonly playerId: string
  readonly stash?: PlayerStash
  readonly hideoutProgress?: HideoutProgress
  readonly projects?: readonly ProjectProgress[]
  readonly questProgress?: readonly QuestProgress[]
  readonly loadout?: PlayerLoadout
}

/** Quest progress with state and quantities. */
export interface QuestProgress {
  readonly questId: string
  readonly state: string
  readonly quantities: readonly number[]
}

/** Project progress with state and quantities. */
export interface ProjectProgress {
  readonly projectId: string
  readonly state: string
  readonly quantities: readonly number[]
}

/** Hideout progress with state and resources. */
export interface HideoutProgress {
  readonly hideoutId: string
  readonly state: string
  readonly resources: readonly number[]
}

/** Player loadout with optional weapon, armor, and accessory IDs. */
export interface PlayerLoadout {
  readonly weaponId?: string
  readonly armorId?: string
  readonly accessoryId?: string
}

/** Validation result for PlayerProfile construction. */
export type PlayerProfileResult =
  | { readonly success: true; readonly value: PlayerProfile }
  | { readonly success: false; readonly error: string }

/**
 * Create a PlayerProfile, validating invariants.
 * - Rejects empty playerId
 * - Validates stash if present
 */
export function createPlayerProfile(
  playerId: string,
  stash?: PlayerStash,
  hideoutProgress?: HideoutProgress,
  projects?: readonly ProjectProgress[],
  questProgress?: readonly QuestProgress[],
  loadout?: PlayerLoadout
): PlayerProfileResult {
  if (!playerId || playerId.trim() === '') {
    return { success: false, error: `invalid playerId: ${playerId}` }
  }
  if (stash) {
    const stashResult = createPlayerStash(stash.id, stash.items, stash.freshness.fetchedAt, stash.freshness.source)
    if (stashResult.success === false) {
      return { success: false, error: `stash: ${stashResult.error}` }
    }
  }
  return {
    success: true,
    value: { playerId, stash, hideoutProgress, projects, questProgress, loadout },
  }
}

/** Full player state including profile and all progression data. */
export interface PlayerState {
  readonly playerId: string
  readonly stash?: PlayerStash
  readonly profile: PlayerProfile
  readonly hideoutProgress?: HideoutProgress
  readonly projects?: readonly ProjectProgress[]
  readonly questProgress?: readonly QuestProgress[]
  readonly loadout?: PlayerLoadout
}

/** Validation result for PlayerState construction. */
export type PlayerStateResult =
  | { readonly success: true; readonly value: PlayerState }
  | { readonly success: false; readonly error: string }

/**
 * Create a PlayerState, validating invariants.
 * - Rejects empty playerId
 * - Validates profile (which includes stash, hideout, projects, quests, loadout)
 * - Also validates the profile's playerId field
 */
export function createPlayerState(
  playerId: string,
  profile: PlayerProfile,
  stash?: PlayerStash,
  hideoutProgress?: HideoutProgress,
  projects?: readonly ProjectProgress[],
  questProgress?: readonly QuestProgress[],
  loadout?: PlayerLoadout
): PlayerStateResult {
  if (!playerId || playerId.trim() === '') {
    return { success: false, error: `invalid playerId: ${playerId}` }
  }
  if (!profile.playerId || profile.playerId.trim() === '') {
    return { success: false, error: `invalid profile playerId: ${profile.playerId}` }
  }
  const profileResult = createPlayerProfile(playerId, stash, hideoutProgress, projects, questProgress, loadout)
  if (profileResult.success === false) {
    return { success: false, error: `profile: ${profileResult.error}` }
  }
  return {
    success: true,
    value: { playerId, stash, profile: profileResult.value, hideoutProgress, projects, questProgress, loadout },
  }
}

/** Quest progress with state and quantities. */
export function createQuestProgress(
  questId: string,
  state: string,
  quantities: readonly number[]
): QuestProgressResult {
  if (!questId || questId.trim() === '') {
    return { success: false, error: `invalid questId: ${questId}` }
  }
  if (!state || state.trim() === '') {
    return { success: false, error: `invalid quest state: ${state}` }
  }
  if (!Array.isArray(quantities)) {
    return { success: false, error: `quantities must be an array` }
  }
  for (let i = 0; i < quantities.length; i++) {
    if (!Number.isInteger(quantities[i]) || quantities[i] < 0) {
      return { success: false, error: `quantities[${i}] must be a non-negative integer` }
    }
  }
  if (quantities.length === 0) {
    return { success: false, error: `quantities must have at least one entry` }
  }
  return { success: true, value: { questId, state, quantities } }
}

/** Project progress with state and quantities. */
export function createProjectProgress(
  projectId: string,
  state: string,
  quantities: readonly number[]
): ProjectProgressResult {
  if (!projectId || projectId.trim() === '') {
    return { success: false, error: `invalid projectId: ${projectId}` }
  }
  if (!state || state.trim() === '') {
    return { success: false, error: `invalid project state: ${state}` }
  }
  if (!Array.isArray(quantities)) {
    return { success: false, error: `quantities must be an array` }
  }
  for (let i = 0; i < quantities.length; i++) {
    if (!Number.isInteger(quantities[i]) || quantities[i] < 0) {
      return { success: false, error: `quantities[${i}] must be a non-negative integer` }
    }
  }
  return { success: true, value: { projectId, state, quantities } }
}

/** Hideout progress with state and resources. */
export function createHideoutProgress(
  hideoutId: string,
  state: string,
  resources: readonly number[]
): HideoutProgressResult {
  if (!hideoutId || hideoutId.trim() === '') {
    return { success: false, error: `invalid hideoutId: ${hideoutId}` }
  }
  if (!state || state.trim() === '') {
    return { success: false, error: `invalid hideout state: ${state}` }
  }
  if (!Array.isArray(resources)) {
    return { success: false, error: `resources must be an array` }
  }
  for (let i = 0; i < resources.length; i++) {
    if (!Number.isInteger(resources[i]) || resources[i] < 0) {
      return { success: false, error: `resources[${i}] must be a non-negative integer` }
    }
  }
  return { success: true, value: { hideoutId, state, resources } }
}

/** Player loadout with optional weapon, armor, and accessory IDs. */
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