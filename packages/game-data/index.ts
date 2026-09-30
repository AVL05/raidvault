/**
 * RaidVault — Normalized game-data knowledge (M2).
 *
 * Static/semi-static ARC Raiders knowledge: items, quests, workshop and
 * project requirements, plus dataset provenance metadata.
 *
 * Auditable pipeline:
 *
 * ```text
 * approved source
 *   -> source payload (unknown, untrusted)
 *   -> validation
 *   -> normalization
 *   -> GameKnowledge
 *   -> future consumers (rules-engine, UI)
 * ```
 *
 * Raw source DTOs live in ./source and are never re-exported here. Public
 * consumers only see the normalized model below.
 *
 * Out of scope by design: player data, provider credentials, Rules Engine
 * behavior, KEEP/SELL/RECYCLE classifications, inventory math, UI, AI,
 * WebGPU, and Bridge functionality.
 */

import type {
  RawDatasetMetadata,
  RawGameDataPayload,
  RawItemRecord,
  RawObjectiveRecord,
  RawRequirementEntry,
} from './source'

// ---------------------------------------------------------------------------
// Result / error model (small and explicit)
// ---------------------------------------------------------------------------

/** Game-data failure families. Kept to three on purpose. */
export type GameDataErrorKind =
  | 'source-error'
  | 'validation-error'
  | 'reference-error'

/** Explicit game-data error: family plus human-readable message. */
export interface GameDataError {
  readonly kind: GameDataErrorKind
  readonly message: string
}

/** Discriminated result shared by the game-data pipeline. */
export type GameDataResult<T> =
  | { readonly success: true; readonly value: T }
  | { readonly success: false; readonly error: GameDataError }

function fail<T>(kind: GameDataErrorKind, message: string): GameDataResult<T> {
  return { success: false, error: { kind, message } }
}

// ---------------------------------------------------------------------------
// Normalized GameKnowledge model (minimal, readonly)
// ---------------------------------------------------------------------------

/** Normalized static knowledge about one item. */
export interface GameItemKnowledge {
  /** Stable item identifier referenced by requirements. */
  readonly id: string
  /** Display name. */
  readonly name: string
  /** Optional grouping category. Carries no economic meaning. */
  readonly category?: string
}

/** Explicit item/quantity relation. Quantity is always a positive integer. */
export interface ItemRequirement {
  readonly itemId: string
  readonly quantity: number
}

/** Normalized quest with its item requirements. */
export interface QuestKnowledge {
  readonly id: string
  readonly name: string
  readonly requirements: readonly ItemRequirement[]
}

/** Normalized workshop target with its item requirements. */
export interface WorkshopRequirement {
  readonly id: string
  readonly name: string
  readonly requirements: readonly ItemRequirement[]
}

/** Normalized project target with its item requirements. */
export interface ProjectRequirement {
  readonly id: string
  readonly name: string
  readonly requirements: readonly ItemRequirement[]
}

/** Explicit dataset provenance. No hidden current-time defaults. */
export interface GameKnowledgeMetadata {
  /** Identifier of the approved source the dataset came from. */
  readonly sourceId: string
  /** Dataset/source version string. */
  readonly datasetVersion: string
  /** When the dataset was captured or generated (unix ms epoch). */
  readonly capturedAt: number
  /** Optional timestamp after which consumers should treat data as stale. */
  readonly staleAfter?: number
}

/** Normalized game knowledge handed to future consumers. */
export interface GameKnowledge {
  readonly items: readonly GameItemKnowledge[]
  readonly quests: readonly QuestKnowledge[]
  readonly workshops: readonly WorkshopRequirement[]
  readonly projects: readonly ProjectRequirement[]
  readonly metadata: GameKnowledgeMetadata
}

// ---------------------------------------------------------------------------
// Read-only game-data source abstraction
// ---------------------------------------------------------------------------

/** Loaded envelope: source identity plus an untrusted payload. */
export interface GameDataSourceSnapshot {
  readonly sourceId: string
  readonly payload: unknown
}

/**
 * Minimal read-only source for static/semi-static knowledge.
 * No credentials, no mutation endpoints, no game access of every kind.
 */
export interface GameDataSource {
  readonly sourceId: string
  load(): Promise<GameDataSourceSnapshot>
}

/**
 * Deterministic bundled/local source used for M2. The payload is provided
 * by the caller (bundled data or synthetic fixtures in tests); nothing is
 * fetched over the network and no live integration is performed.
 */
export function createBundledGameDataSource(
  sourceId: string,
  payload: unknown
): GameDataSource {
  return {
    sourceId,
    load: () => Promise.resolve({ sourceId, payload }),
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

function isValidGameId(value: unknown): value is string {
  return typeof value === 'string' && value !== '' && value.trim() !== ''
}

function isValidRequirementQuantity(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isValidTimestamp(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isInteger(value) && value >= 0
  )
}

function isValidName(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

// ---------------------------------------------------------------------------
// Internal raw-shape readers (unknown -> DTO, still untrusted)
// ---------------------------------------------------------------------------

function readPayload(value: unknown): RawGameDataPayload | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return {
    items: value['items'],
    quests: value['quests'],
    workshops: value['workshops'],
    projects: value['projects'],
    metadata: value['metadata'],
  }
}

function readItemRecord(value: unknown): RawItemRecord | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { uid: value['uid'], label: value['label'], klass: value['klass'] }
}

function readObjectiveRecord(value: unknown): RawObjectiveRecord | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { uid: value['uid'], label: value['label'], needs: value['needs'] }
}

function readRequirementEntry(value: unknown): RawRequirementEntry | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return { ref: value['ref'], qty: value['qty'] }
}

function readDatasetMetadata(value: unknown): RawDatasetMetadata | undefined {
  if (!isRecord(value)) {
    return undefined
  }
  return {
    origin: value['origin'],
    revision: value['revision'],
    generatedAt: value['generatedAt'],
    staleAfter: value['staleAfter'],
  }
}

// ---------------------------------------------------------------------------
// Internal normalization (DTO -> normalized model, validating)
// ---------------------------------------------------------------------------

function normalizeItem(
  record: RawItemRecord,
  index: number
): GameDataResult<GameItemKnowledge> {
  const uid = record.uid
  if (!isValidGameId(uid)) {
    return fail('validation-error', `invalid item id at items[${index}]: expected a non-empty id`)
  }
  const label = record.label
  if (!isValidName(label)) {
    return fail('validation-error', `invalid item name for id '${uid}': expected a non-empty name`)
  }
  const klass = record.klass
  if (klass !== undefined && !isValidName(klass)) {
    return fail('validation-error', `invalid item category for id '${uid}': expected a non-empty name`)
  }
  if (klass === undefined) {
    return { success: true, value: { id: uid, name: label } }
  }
  return { success: true, value: { id: uid, name: label, category: klass } }
}

interface NormalizedObjective {
  readonly id: string
  readonly name: string
  readonly requirements: readonly ItemRequirement[]
}

function normalizeObjective(
  record: RawObjectiveRecord,
  kind: 'quest' | 'workshop' | 'project',
  index: number,
  knownItemIds: ReadonlySet<string>
): GameDataResult<NormalizedObjective> {
  const uid = record.uid
  if (!isValidGameId(uid)) {
    return fail('validation-error', `invalid ${kind} id at ${kind}s[${index}]: expected a non-empty id`)
  }
  const label = record.label
  if (!isValidName(label)) {
    return fail('validation-error', `invalid ${kind} name for id '${uid}': expected a non-empty name`)
  }
  const needs = record.needs
  if (needs === undefined) {
    return { success: true, value: { id: uid, name: label, requirements: [] } }
  }
  if (!isUnknownArray(needs)) {
    return fail('validation-error', `invalid requirements for ${kind} '${uid}': expected an array`)
  }
  const requirements: ItemRequirement[] = []
  for (const [entryIndex, entryValue] of needs.entries()) {
    const entry = readRequirementEntry(entryValue)
    if (entry === undefined) {
      return fail(
        'validation-error',
        `invalid requirement entry for ${kind} '${uid}' at index ${entryIndex}: expected an object`
      )
    }
    const ref = entry.ref
    if (!isValidGameId(ref)) {
      return fail(
        'validation-error',
        `invalid requirement item id for ${kind} '${uid}' at index ${entryIndex}: expected a non-empty id`
      )
    }
    const qty = entry.qty
    if (!isValidRequirementQuantity(qty)) {
      return fail(
        'validation-error',
        `invalid requirement quantity for ${kind} '${uid}' item '${ref}': ${String(qty)}`
      )
    }
    if (!knownItemIds.has(ref)) {
      return fail(
        'reference-error',
        `unknown item reference for ${kind} '${uid}': '${ref}'`
      )
    }
    requirements.push({ itemId: ref, quantity: qty })
  }
  return { success: true, value: { id: uid, name: label, requirements } }
}

function normalizeMetadata(
  record: RawDatasetMetadata
): GameDataResult<GameKnowledgeMetadata> {
  const origin = record.origin
  if (!isValidGameId(origin)) {
    return fail('validation-error', 'invalid dataset metadata: origin must be a non-empty id')
  }
  const revision = record.revision
  if (!isValidGameId(revision)) {
    return fail('validation-error', 'invalid dataset metadata: revision must be a non-empty id')
  }
  const generatedAt = record.generatedAt
  if (!isValidTimestamp(generatedAt)) {
    return fail(
      'validation-error',
      `invalid dataset metadata: generatedAt must be a non-negative integer timestamp, got ${String(generatedAt)}`
    )
  }
  const staleAfter = record.staleAfter
  if (staleAfter !== undefined && !isValidTimestamp(staleAfter)) {
    return fail(
      'validation-error',
      `invalid dataset metadata: staleAfter must be a non-negative integer timestamp, got ${String(staleAfter)}`
    )
  }
  if (staleAfter === undefined) {
    return {
      success: true,
      value: { sourceId: origin, datasetVersion: revision, capturedAt: generatedAt },
    }
  }
  if (staleAfter < generatedAt) {
    return fail(
      'validation-error',
      `invalid dataset metadata: staleAfter (${staleAfter}) precedes capturedAt (${generatedAt})`
    )
  }
  return {
    success: true,
    value: { sourceId: origin, datasetVersion: revision, capturedAt: generatedAt, staleAfter },
  }
}

// ---------------------------------------------------------------------------
// Public pipeline entry point
// ---------------------------------------------------------------------------

/**
 * Load a source snapshot, validate the untrusted payload, and normalize it
 * into GameKnowledge. Fails fast with an explicit error; invalid records
 * are never silently discarded. The snapshot identity and the dataset origin
 * must both match the loading source identity; mismatches are rejected so a
 * foreign payload can never be normalized under the wrong source.
 */
export async function loadGameKnowledge(
  source: GameDataSource
): Promise<GameDataResult<GameKnowledge>> {
  let snapshot: GameDataSourceSnapshot
  try {
    snapshot = await source.load()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    return fail('source-error', `source load failed: ${detail}`)
  }
  if (!isRecord(snapshot) || !isValidGameId(snapshot['sourceId'])) {
    return fail('source-error', 'invalid source snapshot: missing sourceId')
  }
  const snapshotSourceId = snapshot['sourceId']
  if (snapshotSourceId !== source.sourceId) {
    return fail(
      'source-error',
      `source identity mismatch: snapshot sourceId '${snapshotSourceId}' does not match source '${source.sourceId}'`
    )
  }

  const payload = readPayload(snapshot['payload'])
  if (payload === undefined) {
    return fail('validation-error', 'invalid source payload: expected an object')
  }

  if (!isUnknownArray(payload.items)) {
    return fail('validation-error', 'invalid source payload: items must be an array')
  }
  const items: GameItemKnowledge[] = []
  const itemIds = new Set<string>()
  for (const [index, entryValue] of payload.items.entries()) {
    const record = readItemRecord(entryValue)
    if (record === undefined) {
      return fail('validation-error', `invalid item record at items[${index}]: expected an object`)
    }
    const itemResult = normalizeItem(record, index)
    if (itemResult.success === false) {
      return itemResult
    }
    if (itemIds.has(itemResult.value.id)) {
      return fail('validation-error', `duplicate item id: '${itemResult.value.id}'`)
    }
    itemIds.add(itemResult.value.id)
    items.push(itemResult.value)
  }

  const quests = collectObjectives(payload.quests, 'quest', 'quests', itemIds)
  if (quests.success === false) {
    return quests
  }
  const workshops = collectObjectives(payload.workshops, 'workshop', 'workshops', itemIds)
  if (workshops.success === false) {
    return workshops
  }
  const projects = collectObjectives(payload.projects, 'project', 'projects', itemIds)
  if (projects.success === false) {
    return projects
  }

  const metadataRecord = readDatasetMetadata(payload.metadata)
  if (metadataRecord === undefined) {
    return fail('validation-error', 'invalid dataset metadata: expected an object')
  }
  const metadataResult = normalizeMetadata(metadataRecord)
  if (metadataResult.success === false) {
    return metadataResult
  }
  if (metadataResult.value.sourceId !== source.sourceId) {
    return fail(
      'source-error',
      `source identity mismatch: metadata origin '${metadataResult.value.sourceId}' does not match source '${source.sourceId}'`
    )
  }

  return {
    success: true,
    value: {
      items,
      quests: quests.value,
      workshops: workshops.value,
      projects: projects.value,
      metadata: metadataResult.value,
    },
  }
}

function collectObjectives(
  collection: unknown,
  kind: 'quest' | 'workshop' | 'project',
  collectionName: 'quests' | 'workshops' | 'projects',
  knownItemIds: ReadonlySet<string>
): GameDataResult<readonly NormalizedObjective[]> {
  if (!isUnknownArray(collection)) {
    return fail('validation-error', `invalid source payload: ${collectionName} must be an array`)
  }
  const seen = new Set<string>()
  const objectives: NormalizedObjective[] = []
  for (const [index, entryValue] of collection.entries()) {
    const record = readObjectiveRecord(entryValue)
    if (record === undefined) {
      return fail('validation-error', `invalid ${kind} record at ${collectionName}[${index}]: expected an object`)
    }
    const objectiveResult = normalizeObjective(record, kind, index, knownItemIds)
    if (objectiveResult.success === false) {
      return objectiveResult
    }
    if (seen.has(objectiveResult.value.id)) {
      return fail('validation-error', `duplicate ${kind} id: '${objectiveResult.value.id}'`)
    }
    seen.add(objectiveResult.value.id)
    objectives.push(objectiveResult.value)
  }
  return { success: true, value: objectives }
}
