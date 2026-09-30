/**
 * RaidVault — Player-data provider architecture (M3).
 *
 * Mock and local data only. This package defines a provider-independent
 * read-only contract, a deterministic mock provider backed by synthetic
 * local fixtures, and a minimal in-memory last-valid snapshot cache.
 *
 * Auditable pipeline:
 *
 * ```text
 * provider-specific raw payload (unknown, untrusted)
 *   -> raw-shape validation
 *   -> normalization through M1 domain constructors
 *   -> PlayerState
 *   -> validated in-memory snapshot
 *   -> future UI / Rules Engine consumers
 * ```
 *
 * Raw mock DTOs live in ./source and are never re-exported here.
 *
 * Out of scope by design: real providers, authentication, credentials,
 * network fetching, polling, persistent storage, Rules Engine behavior,
 * inventory classifications, UI, AI, WebGPU, and Bridge functionality.
 */

import {
  createPlayerState,
  type HideoutProgress,
  type PlayerLoadout,
  type PlayerProfile,
  type PlayerStash,
  type PlayerState,
  type ProjectProgress,
  type QuestProgress,
  type StashItem,
} from '@raidvault/domain'
import type {
  RawMockHideout,
  RawMockItemEntry,
  RawMockLoadout,
  RawMockObjective,
  RawMockPlayerPayload,
  RawMockProfile,
  RawMockStash,
} from './source'

// ---------------------------------------------------------------------------
// Result / error model (small and explicit)
// ---------------------------------------------------------------------------

/** Provider failure families. Kept to four on purpose. */
export type ProviderErrorKind =
  | 'unavailable'
  | 'validation-error'
  | 'normalization-error'
  | 'snapshot-unavailable'

/** Explicit provider error: family plus human-readable message. */
export interface ProviderError {
  readonly kind: ProviderErrorKind
  readonly message: string
}

/** Discriminated result shared by the provider boundary. */
export type ProviderResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: ProviderError }

function fail<T>(kind: ProviderErrorKind, message: string): ProviderResult<T> {
  return { success: false, error: { kind, message } }
}

// ---------------------------------------------------------------------------
// Provider-independent contract (no provider-specific names)
// ---------------------------------------------------------------------------

/**
 * Stable read-only provider contract. Future approved providers implement
 * this interface without changing domain code, Rules Engine logic, or UI.
 */
export interface PlayerDataProvider {
  readonly providerId: string
  loadPlayerState(): Promise<ProviderResult<PlayerState>>
}

/** Deterministic mock load modes. */
export type MockProviderMode = 'ok' | 'unavailable'

/**
 * Deterministic mock provider backed by a synthetic local payload.
 * No network, no auth, no game installation required. The payload is
 * validated and normalized on every load; invalid payloads never become
 * domain objects.
 */
export function createMockPlayerProvider(
  providerId: string,
  payload: unknown,
  mode: MockProviderMode = 'ok'
): PlayerDataProvider {
  return {
    providerId,
    loadPlayerState(): Promise<ProviderResult<PlayerState>> {
      if (!isNonEmptyString(providerId)) {
        return Promise.resolve(
          fail('validation-error', 'invalid provider id: expected a non-empty id')
        )
      }
      if (mode === 'unavailable') {
        return Promise.resolve(
          fail('unavailable', `provider '${providerId}' is unavailable`)
        )
      }
      return Promise.resolve(normalizeMockPayload(providerId, payload))
    },
  }
}

// ---------------------------------------------------------------------------
// Validated snapshot (small explicit wrapper around M1 metadata)
// ---------------------------------------------------------------------------

/**
 * Validated snapshot handed to future consumers. Freshness reuses the
 * state's M1 SnapshotMetadata capture timestamp as fetchedAt, so no clock
 * and no duplicate freshness model are needed. The stale flag marks
 * fallback reads explicitly.
 */
export interface PlayerStateSnapshot {
  readonly state: PlayerState
  readonly providerId: string
  readonly fetchedAt: number
  readonly stale: boolean
}

/**
 * Minimal in-memory last-valid snapshot cache bound to one provider. The
 * binding makes cross-provider fallback structurally impossible: refresh
 * operates only for the bound provider, and every stored snapshot carries
 * that same providerId. Stores only normalized, validated PlayerState
 * values, never raw provider payloads.
 */
export interface PlayerStateSnapshotCache {
  /**
   * Load through the bound provider and store the validated state on
   * success. When the bound provider is unavailable and a snapshot is
   * stored, return it marked stale without overwriting it. Validation and
   * normalization failures are always returned explicitly and never
   * converted into fallback reads. With an empty cache, return the
   * original failure explicitly.
   */
  refresh(): Promise<ProviderResult<PlayerStateSnapshot>>
  /**
   * Return the last validated snapshot exactly as stored, or an explicit
   * unavailable result when nothing was ever stored.
   */
  current(): ProviderResult<PlayerStateSnapshot>
}

/**
 * Create an empty in-memory snapshot cache bound to one provider.
 * No persistence involved.
 */
export function createPlayerStateSnapshotCache(
  provider: PlayerDataProvider
): PlayerStateSnapshotCache {
  let stored: PlayerStateSnapshot | undefined = undefined

  return {
    refresh(): Promise<ProviderResult<PlayerStateSnapshot>> {
      return provider.loadPlayerState().then((loaded) => {
        if (loaded.success === false) {
          if (loaded.error.kind === 'unavailable' && stored !== undefined) {
            return { success: true, value: { ...stored, stale: true } }
          }
          return { success: false, error: loaded.error }
        }
        stored = {
          state: loaded.value,
          providerId: provider.providerId,
          fetchedAt: loaded.value.snapshotMetadata.capturedAt,
          stale: false,
        }
        return { success: true, value: stored }
      })
    },
    current(): ProviderResult<PlayerStateSnapshot> {
      if (stored === undefined) {
        return fail('snapshot-unavailable', 'snapshot unavailable: no validated snapshot stored')
      }
      return { success: true, value: stored }
    },
  }
}

// ---------------------------------------------------------------------------
// Internal narrowing guards (no casts, no validation framework)
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.trim() !== ''
}

// ---------------------------------------------------------------------------
// Internal raw-shape readers (unknown -> DTO, still untrusted)
// ---------------------------------------------------------------------------

function readMockPayload(value: unknown): RawMockPlayerPayload | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return {
    profile: value['profile'],
    stash: value['stash'],
    hideout: value['hideout'],
    projects: value['projects'],
    quests: value['quests'],
    loadout: value['loadout'],
    takenAt: value['takenAt'],
    source: value['source'],
  }
}

function readMockProfile(value: unknown): RawMockProfile | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { pid: value['pid'] }
}

function readMockStash(value: unknown): RawMockStash | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return {
    owner: value['owner'],
    goods: value['goods'],
    slotsTotal: value['slotsTotal'],
    slotsUsed: value['slotsUsed'],
  }
}

function readMockItemEntry(value: unknown): RawMockItemEntry | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { sku: value['sku'], amount: value['amount'] }
}

function readMockObjective(value: unknown): RawMockObjective | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { uid: value['uid'], title: value['title'], needs: value['needs'] }
}

function readMockHideout(value: unknown): RawMockHideout | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { site: value['site'], stage: value['stage'], stores: value['stores'] }
}

function readMockLoadout(value: unknown): RawMockLoadout | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { primary: value['primary'], guard: value['guard'], trinket: value['trinket'] }
}

// ---------------------------------------------------------------------------
// Internal normalization (raw shapes -> M1 domain constructors)
// ---------------------------------------------------------------------------

/**
 * Validate raw shapes, then enforce every value invariant through a single
 * M1 createPlayerState call, which cascades through the stash, quest,
 * project, hideout, loadout, and profile constructors. Shape problems
 * yield validation-error; constructor rejections surface verbatim as
 * normalization-error so no domain invariant is duplicated here.
 */
function normalizeMockPayload(
  providerId: string,
  payload: unknown
): ProviderResult<PlayerState> {
  const raw = readMockPayload(payload)
  if (raw === undefined) {
    return fail('validation-error', `invalid provider payload from '${providerId}': expected an object`)
  }

  const profileRecord = readMockProfile(raw.profile)
  if (profileRecord === undefined) {
    return fail('validation-error', `invalid provider profile from '${providerId}': expected an object`)
  }
  const pid = profileRecord.pid
  if (typeof pid !== 'string') {
    return fail('validation-error', `invalid provider profile from '${providerId}': pid must be a string`)
  }
  const profile: PlayerProfile = { playerId: pid }

  const takenAt = raw.takenAt
  if (typeof takenAt !== 'number') {
    return fail('validation-error', `invalid provider snapshot from '${providerId}': takenAt must be a number`)
  }
  const source = raw.source
  if (source !== undefined && typeof source !== 'string') {
    return fail('validation-error', `invalid provider snapshot from '${providerId}': source must be a string`)
  }

  const stashResult = readMockStashSection(providerId, raw.stash, takenAt, source)
  if (stashResult.success === false) {
    return stashResult
  }
  const hideoutResult = readMockHideoutSection(providerId, raw.hideout)
  if (hideoutResult.success === false) {
    return hideoutResult
  }
  const projectsResult = readMockProjectSection(providerId, raw.projects)
  if (projectsResult.success === false) {
    return projectsResult
  }
  const questsResult = readMockQuestSection(providerId, raw.quests)
  if (questsResult.success === false) {
    return questsResult
  }
  const loadoutResult = readMockLoadoutSection(providerId, raw.loadout)
  if (loadoutResult.success === false) {
    return loadoutResult
  }

  const stateResult = createPlayerState(
    profile,
    stashResult.value,
    hideoutResult.value,
    projectsResult.value,
    questsResult.value,
    loadoutResult.value,
    source === undefined ? { capturedAt: takenAt } : { capturedAt: takenAt, source }
  )
  if (stateResult.success === false) {
    return fail('normalization-error', stateResult.error)
  }
  return { success: true, value: stateResult.value }
}

function readMockStashSection(
  providerId: string,
  stash: unknown,
  takenAt: number,
  source: string | undefined
): ProviderResult<PlayerStash | undefined> {
  if (stash === undefined) {
    return { success: true, value: undefined }
  }
  const record = readMockStash(stash)
  if (record === undefined) {
    return fail('validation-error', `invalid provider stash from '${providerId}': expected an object`)
  }
  const owner = record.owner
  if (typeof owner !== 'string') {
    return fail('validation-error', `invalid provider stash from '${providerId}': owner must be a string`)
  }
  if (!isUnknownArray(record.goods)) {
    return fail('validation-error', `invalid provider stash from '${providerId}': goods must be an array`)
  }
  const items: StashItem[] = []
  for (const [index, entryValue] of record.goods.entries()) {
    const entry = readMockItemEntry(entryValue)
    if (entry === undefined) {
      return fail(
        'validation-error',
        `invalid provider stash entry from '${providerId}' at index ${index}: expected an object`
      )
    }
    if (typeof entry.sku !== 'string') {
      return fail(
        'validation-error',
        `invalid provider stash entry from '${providerId}' at index ${index}: sku must be a string`
      )
    }
    if (typeof entry.amount !== 'number') {
      return fail(
        'validation-error',
        `invalid provider stash entry from '${providerId}' at index ${index}: amount must be a number`
      )
    }
    items.push({ id: entry.sku, quantity: entry.amount })
  }
  const slotsTotal = record.slotsTotal
  const slotsUsed = record.slotsUsed
  if (typeof slotsTotal !== 'number' || typeof slotsUsed !== 'number') {
    return fail(
      'validation-error',
      `invalid provider stash from '${providerId}': slotsTotal and slotsUsed must be numbers`
    )
  }
  return {
    success: true,
    value: {
      id: owner,
      items,
      capacity: { totalSlots: slotsTotal, usedSlots: slotsUsed },
      freshness: source === undefined ? { capturedAt: takenAt } : { capturedAt: takenAt, source },
    },
  }
}

function readMockHideoutSection(
  providerId: string,
  hideout: unknown
): ProviderResult<HideoutProgress | undefined> {
  if (hideout === undefined) {
    return { success: true, value: undefined }
  }
  const record = readMockHideout(hideout)
  if (record === undefined) {
    return fail('validation-error', `invalid provider hideout from '${providerId}': expected an object`)
  }
  const site = record.site
  const stage = record.stage
  if (typeof site !== 'string' || typeof stage !== 'string') {
    return fail(
      'validation-error',
      `invalid provider hideout from '${providerId}': site and stage must be strings`
    )
  }
  if (!isUnknownArray(record.stores)) {
    return fail(
      'validation-error',
      `invalid provider hideout from '${providerId}': stores must be an array`
    )
  }
  const stores: number[] = []
  for (const [index, storeValue] of record.stores.entries()) {
    if (typeof storeValue !== 'number') {
      return fail(
        'validation-error',
        `invalid provider hideout store from '${providerId}' at index ${index}: expected a number`
      )
    }
    stores.push(storeValue)
  }
  return {
    success: true,
    value: { hideoutId: site, state: stage, resources: stores },
  }
}

function readMockQuestSection(
  providerId: string,
  quests: unknown
): ProviderResult<readonly QuestProgress[] | undefined> {
  if (quests === undefined) {
    return { success: true, value: undefined }
  }
  if (!isUnknownArray(quests)) {
    return fail('validation-error', `invalid provider quests from '${providerId}': expected an array`)
  }
  const normalized: QuestProgress[] = []
  for (const [index, entryValue] of quests.entries()) {
    const record = readMockObjective(entryValue)
    if (record === undefined) {
      return fail(
        'validation-error',
        `invalid provider quest from '${providerId}' at index ${index}: expected an object`
      )
    }
    const shaped = shapeMockObjective(providerId, 'quest', index, record)
    if (shaped.success === false) {
      return shaped
    }
    normalized.push({ questId: shaped.value.id, state: shaped.value.state, quantities: shaped.value.quantities })
  }
  return { success: true, value: normalized }
}

function readMockProjectSection(
  providerId: string,
  projects: unknown
): ProviderResult<readonly ProjectProgress[] | undefined> {
  if (projects === undefined) {
    return { success: true, value: undefined }
  }
  if (!isUnknownArray(projects)) {
    return fail(
      'validation-error',
      `invalid provider projects from '${providerId}': expected an array`
    )
  }
  const normalized: ProjectProgress[] = []
  for (const [index, entryValue] of projects.entries()) {
    const record = readMockObjective(entryValue)
    if (record === undefined) {
      return fail(
        'validation-error',
        `invalid provider project from '${providerId}' at index ${index}: expected an object`
      )
    }
    const shaped = shapeMockObjective(providerId, 'project', index, record)
    if (shaped.success === false) {
      return shaped
    }
    normalized.push({
      projectId: shaped.value.id,
      state: shaped.value.state,
      quantities: shaped.value.quantities,
    })
  }
  return { success: true, value: normalized }
}

interface ShapedObjective {
  readonly id: string
  readonly state: string
  readonly quantities: readonly number[]
}

function shapeMockObjective(
  providerId: string,
  kind: 'quest' | 'project',
  index: number,
  record: RawMockObjective
): ProviderResult<ShapedObjective> {
  const uid = record.uid
  const title = record.title
  if (typeof uid !== 'string' || typeof title !== 'string') {
    return fail(
      'validation-error',
      `invalid provider ${kind} from '${providerId}' at index ${index}: uid and title must be strings`
    )
  }
  const needs = record.needs
  if (needs === undefined) {
    return { success: true, value: { id: uid, state: title, quantities: [] } }
  }
  if (!isUnknownArray(needs)) {
    return fail(
      'validation-error',
      `invalid provider ${kind} needs for '${uid}' from '${providerId}': expected an array`
    )
  }
  const quantities: number[] = []
  for (const [entryIndex, entryValue] of needs.entries()) {
    if (typeof entryValue !== 'number') {
      return fail(
        'validation-error',
        `invalid provider ${kind} need for '${uid}' from '${providerId}' at index ${entryIndex}: qty must be a number`
      )
    }
    quantities.push(entryValue)
  }
  return { success: true, value: { id: uid, state: title, quantities } }
}

function readMockLoadoutSection(
  providerId: string,
  loadout: unknown
): ProviderResult<PlayerLoadout | undefined> {
  if (loadout === undefined) {
    return { success: true, value: undefined }
  }
  const record = readMockLoadout(loadout)
  if (record === undefined) {
    return fail('validation-error', `invalid provider loadout from '${providerId}': expected an object`)
  }
  const primary = record.primary
  const guard = record.guard
  const trinket = record.trinket
  if (
    (primary !== undefined && typeof primary !== 'string') ||
    (guard !== undefined && typeof guard !== 'string') ||
    (trinket !== undefined && typeof trinket !== 'string')
  ) {
    return fail(
      'validation-error',
      `invalid provider loadout from '${providerId}': ids must be strings`
    )
  }
  return {
    success: true,
    value: { weaponId: primary, armorId: guard, accessoryId: trinket },
  }
}
