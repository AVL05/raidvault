/**
 * RaidVault — ARC AI over verified local context (M9).
 *
 * Assistant layer grounded only in validated RaidVault facts: the
 * deterministic core (domain, game-data, rules-engine, planning)
 * owns every number, name, and status surfaced here. The AI may
 * explain, summarize, compare, and phrase; it never invents facts,
 * mutates state, or overrides deterministic results.
 *
 * Flow: verified inputs -> VerifiedAiContext -> read-only tools or
 * deterministic short-circuit -> local generation session (when an
 * approved session exists) -> presentation-only response.
 *
 * No production model or runtime exists yet, so production generation
 * stays explicitly unavailable; deterministic facts still answer
 * directly without a model.
 */

import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import type {
  MissingItemPlan,
  PlanningSnapshot,
  RaidPriority,
  RuleReason,
  StashAnalysis,
  TargetPlan,
} from '@raidvault/rules-engine'
import type { GamingModeSource, GamingModeStatus } from './index'

// ---------------------------------------------------------------------------
// Bounds (exported, deterministic, no unbounded arrays or history)
// ---------------------------------------------------------------------------

/** Maximum item facts carried in one context. */
export const MAX_CONTEXT_ITEMS = 50

/** Maximum targets carried per quest/project list. */
export const MAX_CONTEXT_TARGETS = 20

/** Maximum catalog entries carried for search. */
export const MAX_CATALOG_ENTRIES = 100

/** Maximum missing-item entries carried in one context. */
export const MAX_CONTEXT_MISSING_ITEMS = 20

/** Maximum raid priorities carried in one context. */
export const MAX_CONTEXT_PRIORITIES = 20

/** Maximum incomplete references carried in one context. */
export const MAX_CONTEXT_INCOMPLETE_REFERENCES = 10

/** Default search result cap. */
export const MAX_SEARCH_RESULTS = 10

/** Maximum chat messages retained (system contract travels separately). */
export const MAX_CHAT_MESSAGES = 20

/** Maximum accepted user message characters. */
export const MAX_MESSAGE_CHARS = 2000

/** Maximum assistant output characters. */
export const MAX_OUTPUT_CHARS = 2000

/** Context schema version prefix for fingerprints. */
export const CONTEXT_SCHEMA_VERSION = 'v1'

// ---------------------------------------------------------------------------
// Verified AI context (provenance-preserving, serializable)
// ---------------------------------------------------------------------------

/** Structured source labels for every AI-visible fact. */
export type AiFactProvenance =
  | 'PLAYER_STATE'
  | 'GAME_KNOWLEDGE'
  | 'RULES_ENGINE'
  | 'PLANNING'

/** Knowledge availability for a fact. Never coerced to a value. */
export type AiKnowledgeState =
  | 'KNOWN'
  | 'UNKNOWN'
  | 'UNSUPPORTED'

/** One fact with its structured origin attached. */
export interface VerifiedAiFact<T> {
  readonly provenance: AiFactProvenance
  readonly state: AiKnowledgeState
  readonly value: T
}

/** Stash presence and size. Counts stay absent when no stash exists. */
export interface StashSummaryFact {
  readonly hasStash: boolean
  readonly itemCount?: number
  readonly usedSlots?: number
  readonly totalSlots?: number
}

/**
 * Item fact. Quantities and classification come from the Rules Engine;
 * displayName comes from game knowledge and stays undefined when the
 * catalog does not describe the item.
 */
export interface AiItemFact {
  readonly itemId: string
  readonly displayName: string | undefined
  readonly owned: number
  readonly required: number
  readonly reserved: number
  readonly missing: number
  readonly surplus: number
  readonly classification: string
  readonly reasons: readonly RuleReason[]
}

/** Searchable catalog entry. Display fields stay undefined when unknown. */
export interface CatalogEntry {
  readonly itemId: string
  readonly displayName?: string
  readonly category?: string
}

/** Progression reference with no matching catalog entry. */
export interface IncompleteReference {
  readonly targetType: 'QUEST' | 'PROJECT'
  readonly targetId: string
}

/**
 * Verified context handed to tools, router, and generation. Every
 * collection is bounded and deterministically ordered; every fact
 * carries provenance; unknown and unsupported stay explicit.
 */
export interface VerifiedAiContext {
  readonly version: string
  readonly snapshot: {
    readonly capturedAt: number
    readonly providerId?: string
    readonly stale?: boolean
  }
  readonly stash: VerifiedAiFact<StashSummaryFact>
  readonly items: readonly VerifiedAiFact<AiItemFact>[]
  readonly quests: readonly VerifiedAiFact<TargetPlan>[]
  readonly projects: readonly VerifiedAiFact<TargetPlan>[]
  readonly missingItems: readonly VerifiedAiFact<MissingItemPlan>[]
  readonly raidPriorities: readonly VerifiedAiFact<RaidPriority>[]
  readonly catalog: readonly CatalogEntry[]
  readonly incompleteReferences: readonly IncompleteReference[]
  readonly workshopPlanning: AiKnowledgeState
}

function displayNameOf(knowledge: GameKnowledge, itemId: string): string | undefined {
  for (const item of knowledge.items) {
    if (item.id === itemId) {
      return item.name
    }
  }
  return undefined
}

/**
 * Length-prefixed scalar encoding. Prefixing makes concatenation
 * unambiguous without relying on separator escaping.
 */
function field(value: string | number | boolean | undefined): string {
  if (value === undefined) {
    return '?:'
  }
  const text = typeof value === 'string' ? value : String(value)
  return `${text.length}:${text}`
}

function pushTargetPlan(parts: string[], fact: {
  readonly provenance: AiFactProvenance
  readonly state: AiKnowledgeState
  readonly value: TargetPlan
}): void {
  parts.push(field(fact.provenance))
  parts.push(field(fact.state))
  parts.push(field(fact.value.targetType))
  parts.push(field(fact.value.targetId))
  parts.push(field(fact.value.targetName))
  parts.push(field(fact.value.complete))
  for (const gap of fact.value.requirements) {
    parts.push(field(gap.targetType))
    parts.push(field(gap.targetId))
    parts.push(field(gap.itemId))
    parts.push(field(gap.requiredForTarget))
    parts.push(field(gap.owned))
    parts.push(field(gap.missingForTarget))
  }
}

/**
 * Deterministic fingerprint over the final bounded AI-visible payload.
 * Covers snapshot, stash, every item fact (quantities, classification,
 * reason codes and messages), every bounded target (identity, name,
 * completion, per-target gaps), priorities, catalog entries (id, name,
 * category), incomplete references, and the workshop flag. Field order
 * is fixed by construction; no clock, randomness, or hash involved.
 */
export function fingerprintVerifiedContext(
  context: Omit<VerifiedAiContext, 'version'>
): string {
  const parts: string[] = [CONTEXT_SCHEMA_VERSION]
  parts.push('snapshot')
  parts.push(field(context.snapshot.capturedAt))
  parts.push(field(context.snapshot.providerId))
  parts.push(field(context.snapshot.stale))
  parts.push('stash')
  parts.push(field(context.stash.provenance))
  parts.push(field(context.stash.state))
  parts.push(field(context.stash.value.hasStash))
  parts.push(field(context.stash.value.itemCount))
  parts.push(field(context.stash.value.usedSlots))
  parts.push(field(context.stash.value.totalSlots))
  parts.push('items')
  for (const fact of context.items) {
    parts.push('item')
    parts.push(field(fact.provenance))
    parts.push(field(fact.state))
    parts.push(field(fact.value.itemId))
    parts.push(field(fact.value.displayName))
    parts.push(field(fact.value.owned))
    parts.push(field(fact.value.required))
    parts.push(field(fact.value.reserved))
    parts.push(field(fact.value.missing))
    parts.push(field(fact.value.surplus))
    parts.push(field(fact.value.classification))
    for (const reason of fact.value.reasons) {
      parts.push(field(reason.code))
      parts.push(field(reason.message))
    }
  }
  parts.push('quests')
  for (const fact of context.quests) {
    pushTargetPlan(parts, fact)
  }
  parts.push('projects')
  for (const fact of context.projects) {
    pushTargetPlan(parts, fact)
  }
  parts.push('priorities')
  for (const fact of context.raidPriorities) {
    parts.push('priority')
    parts.push(field(fact.provenance))
    parts.push(field(fact.state))
    parts.push(field(fact.value.rank))
    parts.push(field(fact.value.itemId))
    parts.push(field(fact.value.displayName))
    parts.push(field(fact.value.missing))
    for (const targetId of fact.value.sourceTargetIds) {
      parts.push(field(targetId))
    }
  }
  parts.push('missing')
  for (const fact of context.missingItems) {
    parts.push('missing-item')
    parts.push(field(fact.provenance))
    parts.push(field(fact.state))
    parts.push(field(fact.value.itemId))
    parts.push(field(fact.value.displayName))
    parts.push(field(fact.value.totalMissing))
    for (const targetType of fact.value.sourceTypes) {
      parts.push(field(targetType))
    }
    for (const targetId of fact.value.sourceTargetIds) {
      parts.push(field(targetId))
    }
  }
  parts.push('catalog')
  for (const entry of context.catalog) {
    parts.push('catalog-entry')
    parts.push(field(entry.itemId))
    parts.push(field(entry.displayName))
    parts.push(field(entry.category))
  }
  parts.push('incomplete')
  for (const reference of context.incompleteReferences) {
    parts.push(field(reference.targetType))
    parts.push(field(reference.targetId))
  }
  parts.push('workshop')
  parts.push(field(context.workshopPlanning))
  return parts.join('|')
}

/**
 * Build verified context from validated inputs only: player state, game
 * knowledge, M5 analysis, and M6 planning. Raw provider payloads,
 * network responses, and browser globals cannot enter here by
 * construction: the parameter types admit nothing else.
 */
export function buildVerifiedAiContext(input: {
  readonly playerState: PlayerState
  readonly gameKnowledge: GameKnowledge
  readonly analysis: StashAnalysis
  readonly planning: PlanningSnapshot
  readonly providerId?: string
  readonly stale?: boolean
}): VerifiedAiContext {
  const { playerState, gameKnowledge, analysis, planning } = input
  const stashSummary: StashSummaryFact =
    playerState.stash === undefined
      ? { hasStash: false }
      : {
          hasStash: true,
          itemCount: playerState.stash.items.length,
          usedSlots: playerState.stash.capacity.usedSlots,
          totalSlots: playerState.stash.capacity.totalSlots,
        }
  const items: VerifiedAiFact<AiItemFact>[] = []
  for (const row of analysis.items.slice(0, MAX_CONTEXT_ITEMS)) {
    items.push({
      provenance: 'RULES_ENGINE',
      state: 'KNOWN',
      value: {
        itemId: row.itemId,
        displayName: displayNameOf(gameKnowledge, row.itemId),
        owned: row.owned,
        required: row.required,
        reserved: row.reserved,
        missing: row.missing,
        surplus: row.surplus,
        classification: row.classification,
        reasons: row.reasons,
      },
    })
  }
  const quests: VerifiedAiFact<TargetPlan>[] = []
  for (const target of planning.targets
    .filter((entry) => entry.targetType === 'QUEST')
    .slice(0, MAX_CONTEXT_TARGETS)) {
    quests.push({ provenance: 'PLANNING', state: 'KNOWN', value: target })
  }
  const projects: VerifiedAiFact<TargetPlan>[] = []
  for (const target of planning.targets
    .filter((entry) => entry.targetType === 'PROJECT')
    .slice(0, MAX_CONTEXT_TARGETS)) {
    projects.push({ provenance: 'PLANNING', state: 'KNOWN', value: target })
  }
  const raidPriorities: VerifiedAiFact<RaidPriority>[] = []
  for (const priority of planning.raidPriorities.slice(0, MAX_CONTEXT_PRIORITIES)) {
    raidPriorities.push({ provenance: 'PLANNING', state: 'KNOWN', value: priority })
  }
  const missingItems: VerifiedAiFact<MissingItemPlan>[] = []
  for (const missing of planning.missingItems.slice(0, MAX_CONTEXT_MISSING_ITEMS)) {
    missingItems.push({ provenance: 'PLANNING', state: 'KNOWN', value: missing })
  }
  const catalog: CatalogEntry[] = []
  const catalogSeen = new Set<string>()
  const considerCatalog = (itemId: string): void => {
    if (catalog.length >= MAX_CATALOG_ENTRIES || catalogSeen.has(itemId)) {
      return
    }
    catalogSeen.add(itemId)
    const entry: CatalogEntry = { itemId }
    const known = findCatalogEntry(gameKnowledge, itemId)
    catalog.push(
      known === undefined
        ? entry
        : { ...entry, displayName: known.name, category: known.category }
    )
  }
  if (playerState.stash !== undefined) {
    for (const entry of playerState.stash.items) {
      considerCatalog(entry.id)
    }
  }
  for (const target of planning.targets) {
    for (const gap of target.requirements) {
      considerCatalog(gap.itemId)
    }
  }
  const incompleteReferences: IncompleteReference[] = []
  for (const reference of planning.incompleteReferences.slice(
    0,
    MAX_CONTEXT_INCOMPLETE_REFERENCES
  )) {
    incompleteReferences.push({ targetType: reference.targetType, targetId: reference.targetId })
  }
  const payload: Omit<VerifiedAiContext, 'version'> = {
    snapshot: {
      capturedAt: playerState.snapshotMetadata.capturedAt,
      ...(input.providerId === undefined ? {} : { providerId: input.providerId }),
      ...(input.stale === undefined ? {} : { stale: input.stale }),
    },
    stash: { provenance: 'PLAYER_STATE', state: 'KNOWN', value: stashSummary },
    items,
    quests,
    projects,
    missingItems,
    raidPriorities,
    catalog,
    incompleteReferences,
    workshopPlanning: 'UNSUPPORTED',
  }
  return { version: fingerprintVerifiedContext(payload), ...payload }
}

function findCatalogEntry(
  knowledge: GameKnowledge,
  itemId: string
): { name: string; category: string | undefined } | undefined {
  for (const item of knowledge.items) {
    if (item.id === itemId) {
      return { name: item.name, category: item.category }
    }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Read-only tool surface (data already validated or derived)
// ---------------------------------------------------------------------------

/** Player summary view. No profile identifiers travel to tools. */
export interface PlayerSummaryView {
  readonly hasStash: boolean
  readonly itemCount: number
  readonly providerId?: string
  readonly stale?: boolean
}

/** Normalized knowledge search hit. */
export interface GameKnowledgeSearchResult {
  readonly itemId: string
  readonly displayName?: string
  readonly category?: string
}

/**
 * Read-only ARC AI tools operating on one immutable context. Method
 * names are deliberately get/search-only: no setters, refreshers, or
 * system access exist on this surface.
 */
export interface ArcAiTools {
  getPlayerState(): PlayerSummaryView
  getItemAnalysis(itemId: string): AiItemFact | undefined
  getQuestNeeds(): readonly TargetPlan[]
  getProjectNeeds(): readonly TargetPlan[]
  getRaidPriorities(): readonly RaidPriority[]
  searchGameKnowledge(query: string, limit?: number): readonly GameKnowledgeSearchResult[]
}

function clampSearchLimit(limit: number | undefined): number {
  if (limit === undefined || !Number.isInteger(limit)) {
    return MAX_SEARCH_RESULTS
  }
  if (limit < 1) {
    return 1
  }
  if (limit > MAX_SEARCH_RESULTS) {
    return MAX_SEARCH_RESULTS
  }
  return limit
}

/** Create the read-only tool surface bound to one verified context. */
export function createArcAiTools(context: VerifiedAiContext): ArcAiTools {
  return {
    getPlayerState(): PlayerSummaryView {
      return {
        hasStash: context.stash.value.hasStash,
        itemCount: context.stash.value.itemCount ?? 0,
        ...(context.snapshot.providerId === undefined
          ? {}
          : { providerId: context.snapshot.providerId }),
        ...(context.snapshot.stale === undefined ? {} : { stale: context.snapshot.stale }),
      }
    },
    getItemAnalysis(itemId: string): AiItemFact | undefined {
      for (const fact of context.items) {
        if (fact.value.itemId === itemId) {
          return fact.value
        }
      }
      return undefined
    },
    getQuestNeeds(): readonly TargetPlan[] {
      return context.quests.map((fact) => fact.value)
    },
    getProjectNeeds(): readonly TargetPlan[] {
      return context.projects.map((fact) => fact.value)
    },
    getRaidPriorities(): readonly RaidPriority[] {
      return context.raidPriorities.map((fact) => fact.value)
    },
    searchGameKnowledge(query: string, limit?: number): readonly GameKnowledgeSearchResult[] {
      const needle = query.trim().toLowerCase()
      if (needle === '') {
        return []
      }
      const capped = clampSearchLimit(limit)
      const exact: GameKnowledgeSearchResult[] = []
      const prefixed: GameKnowledgeSearchResult[] = []
      const partial: GameKnowledgeSearchResult[] = []
      for (const entry of context.catalog) {
        const id = entry.itemId.toLowerCase()
        const name = (entry.displayName ?? '').toLowerCase()
        const result: GameKnowledgeSearchResult = {
          itemId: entry.itemId,
          ...(entry.displayName === undefined ? {} : { displayName: entry.displayName }),
          ...(entry.category === undefined ? {} : { category: entry.category }),
        }
        if (id === needle) {
          exact.push(result)
        } else if (id.startsWith(needle) || (name !== '' && name.startsWith(needle))) {
          prefixed.push(result)
        } else if (
          id.includes(needle) ||
          (name !== '' && name.includes(needle)) ||
          (entry.category ?? '').toLowerCase().includes(needle)
        ) {
          partial.push(result)
        }
      }
      return [...exact, ...prefixed, ...partial].slice(0, capped)
    },
  }
}

// ---------------------------------------------------------------------------
// Deterministic factual router (no model needed for recognized facts)
// ---------------------------------------------------------------------------

/** Direct answer produced without model generation. */
export interface FactualAnswer {
  readonly text: string
}

/** Explicit safe reply when verified data cannot answer. */
export const UNKNOWN_FACT_MESSAGE =
  'I do not have verified data for that in the current RaidVault snapshot.'

function collapseWhitespace(question: string): string {
  return question.trim().replace(/\s+/g, ' ')
}

/**
 * Conservative identity normalization: trim, lowercase, collapse
 * whitespace, and treat hyphens as spaces so "arc wire" matches
 * "arc-wire" deterministically. No substring or token guessing.
 */
function normalizeIdentity(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ').replace(/-/g, ' ')
}

/**
 * Resolve an item when the question contains its full normalized ID or
 * its full normalized display name as a contiguous phrase. Partial
 * token overlap never resolves: "wire cutters" must not identify
 * "arc-wire". Zero or several distinct matches stay unresolved so the
 * router answers unknown instead of guessing.
 */
function resolveItemId(question: string, context: VerifiedAiContext): string | undefined {
  const text = normalizeIdentity(question)
  const matched: string[] = []
  const consider = (phrase: string, itemId: string): void => {
    if (phrase !== '' && text.includes(phrase) && !matched.includes(itemId)) {
      matched.push(itemId)
    }
  }
  for (const fact of context.items) {
    consider(normalizeIdentity(fact.value.itemId), fact.value.itemId)
  }
  for (const fact of context.items) {
    if (fact.value.displayName !== undefined) {
      consider(normalizeIdentity(fact.value.displayName), fact.value.itemId)
    }
  }
  if (matched.length === 1) {
    const only = matched[0]
    if (only !== undefined) {
      return only
    }
  }
  return undefined
}

function resolveTargetId(
  question: string,
  context: VerifiedAiContext
): { targetType: 'QUEST' | 'PROJECT'; targetId: string } | undefined {
  const text = normalizeIdentity(question)
  const targets = [
    ...context.quests.map((fact) => ({ kind: 'QUEST' as const, plan: fact.value })),
    ...context.projects.map((fact) => ({ kind: 'PROJECT' as const, plan: fact.value })),
  ]
  const matched: Array<{ targetType: 'QUEST' | 'PROJECT'; targetId: string }> = []
  const consider = (
    phrase: string,
    targetType: 'QUEST' | 'PROJECT',
    targetId: string
  ): void => {
    if (
      phrase !== '' &&
      text.includes(phrase) &&
      !matched.some((entry) => entry.targetType === targetType && entry.targetId === targetId)
    ) {
      matched.push({ targetType, targetId })
    }
  }
  for (const target of targets) {
    consider(normalizeIdentity(target.plan.targetId), target.kind, target.plan.targetId)
  }
  for (const target of targets) {
    if (target.plan.targetName !== undefined) {
      consider(normalizeIdentity(target.plan.targetName), target.kind, target.plan.targetId)
    }
  }
  if (matched.length === 1) {
    const only = matched[0]
    if (only !== undefined) {
      return only
    }
  }
  return undefined
}

function findItemFact(
  context: VerifiedAiContext,
  itemId: string
): AiItemFact | undefined {
  for (const fact of context.items) {
    if (fact.value.itemId === itemId) {
      return fact.value
    }
  }
  return undefined
}

function findPlannedMissing(
  context: VerifiedAiContext,
  itemId: string
): MissingItemPlan | undefined {
  for (const fact of context.missingItems) {
    if (fact.value.itemId === itemId) {
      return fact.value
    }
  }
  return undefined
}

function displayLabel(context: VerifiedAiContext, itemId: string): string {
  for (const fact of context.items) {
    if (fact.value.itemId === itemId) {
      return fact.value.displayName ?? itemId
    }
  }
  return itemId
}

/**
 * Answer safely recognizable factual intents directly from verified
 * context. Returns undefined when no intent is recognized, deferring
 * to model generation. Recognized intents with unresolvable subjects
 * produce the explicit unknown reply instead of a guess.
 */
export function answerFactualQuestion(
  question: string,
  context: VerifiedAiContext
): FactualAnswer | undefined {
  const text = collapseWhitespace(question)
  if (text === '') {
    return undefined
  }
  const lowered = text.toLowerCase()
  const wantsOwned =
    lowered.includes('owned') ||
    lowered.includes('own') ||
    (lowered.includes('how many') && lowered.includes('have')) ||
    lowered.includes('quantity owned')
  const wantsMissing =
    lowered.includes('missing') ||
    (lowered.includes('how many') && lowered.includes('need')) ||
    lowered.includes('need to find') ||
    lowered.includes('still need')
  const wantsClassification =
    lowered.includes('classif') ||
    lowered.includes('should i keep') ||
    lowered.includes('keep or') ||
    lowered.includes('verdict')
  const wantsExplanation = lowered.includes('why')
  const wantsPriority =
    lowered.includes('priorit') ||
    lowered.includes('next raid') ||
    lowered.includes('top ')
  const wantsCompletion =
    lowered.includes('complete') || lowered.includes('finished') || lowered.includes('done')
  if (wantsPriority) {
    if (!context.stash.value.hasStash || context.incompleteReferences.length > 0) {
      return { text: UNKNOWN_FACT_MESSAGE }
    }
    const top = context.raidPriorities[0]
    if (top === undefined) {
      return { text: 'No current raid priorities. All tracked requirements are satisfied.' }
    }
    return {
      text: `Top raid priority: ${displayLabel(context, top.value.itemId)} (missing ${top.value.missing}).`,
    }
  }
  if (wantsCompletion) {
    const resolved = resolveTargetId(text, context)
    if (resolved === undefined) {
      return { text: UNKNOWN_FACT_MESSAGE }
    }
    const plans =
      resolved.targetType === 'QUEST' ? context.quests : context.projects
    for (const fact of plans) {
      if (fact.value.targetId === resolved.targetId) {
        const name = fact.value.targetName ?? resolved.targetId
        return {
          text: fact.value.complete
            ? `${name} is complete.`
            : `${name} is incomplete.`,
        }
      }
    }
    return { text: UNKNOWN_FACT_MESSAGE }
  }
  const itemId = resolveItemId(text, context)
  if (itemId === undefined) {
    if (wantsOwned || wantsMissing || wantsClassification || wantsExplanation) {
      return { text: UNKNOWN_FACT_MESSAGE }
    }
    return undefined
  }
  const fact = findItemFact(context, itemId)
  if (fact === undefined) {
    return { text: UNKNOWN_FACT_MESSAGE }
  }
  const label = displayLabel(context, itemId)
  if (wantsExplanation || (wantsClassification && lowered.includes('why'))) {
    const reasons = fact.reasons.map((reason) => reason.message).join('; ')
    return { text: `${label} is ${fact.classification}: ${reasons}.` }
  }
  if (wantsClassification) {
    return { text: `${label} is classified ${fact.classification}.` }
  }
  if (wantsMissing) {
    const planned = findPlannedMissing(context, itemId)
    if (planned !== undefined) {
      const name = planned.displayName ?? label
      if (planned.totalMissing === 0) {
        return { text: `You are not missing any ${name}.` }
      }
      return { text: `You are missing ${planned.totalMissing} ${name}.` }
    }
    if (fact.missing === 0) {
      return { text: `You are not missing any ${label}.` }
    }
    return { text: UNKNOWN_FACT_MESSAGE }
  }
  if (wantsOwned) {
    return { text: `You own ${fact.owned} ${label}.` }
  }
  return undefined
}

// ---------------------------------------------------------------------------
// Prompt contract (deterministic, testable)
// ---------------------------------------------------------------------------

/**
 * Fixed system contract for an approved future generation session.
 * States the authority boundary the model must obey.
 */
export const ARC_SYSTEM_CONTRACT = [
  'You are ARC AI, a local companion explaining verified RaidVault facts.',
  'The provided RaidVault context is authoritative for quantities, classifications, priorities, and status.',
  'Never invent missing facts, item stats, spawn locations, requirements, prices, economy data, or quest and project status.',
  'Never claim to see the live game, access game memory, control the game, or perform actions.',
  'Never override Rules Engine classifications or planning quantities.',
  'Unknown facts stay unknown; unsupported capabilities stay unsupported.',
  'Gaming Mode restrictions are enforced by RaidVault; never attempt to bypass them.',
  'Reference deterministic reasons when explaining recommendations.',
].join('\n')

/** Narrow generation request over verified context. */
export interface AiGenerationRequest {
  readonly systemInstruction: string
  readonly context: VerifiedAiContext
  readonly messages: readonly AiMessage[]
}

/** Untrusted model output wrapper. */
export interface AiGenerationResult {
  readonly text: string
}

/** Narrow text-generation session owned by one controller generation. */
export interface TextGenerationSession {
  generate(request: AiGenerationRequest): Promise<AiGenerationResult>
  cancel(): Promise<void>
}

/** Chat message with a deterministic controller-owned identifier. */
export interface AiMessage {
  readonly id: string
  readonly role: 'USER' | 'ASSISTANT' | 'SYSTEM'
  readonly content: string
}

/** Assemble a deterministic generation request from context and history. */
export function buildGenerationRequest(
  context: VerifiedAiContext,
  messages: readonly AiMessage[]
): AiGenerationRequest {
  return {
    systemInstruction: ARC_SYSTEM_CONTRACT,
    context,
    messages: [...messages],
  }
}

// ---------------------------------------------------------------------------
// ARC AI controller (separate from React, generation-owned)
// ---------------------------------------------------------------------------

/** Chat controller states. Distinct from the M8 model lifecycle. */
export type ArcAiStatus =
  | 'UNAVAILABLE'
  | 'IDLE'
  | 'GENERATING'
  | 'ERROR'
  | 'BLOCKED'

/** Presentation snapshot for chat UI layers. */
export interface ArcAiSnapshot {
  readonly status: ArcAiStatus
  readonly messages: readonly AiMessage[]
  readonly error: string | undefined
  readonly contextVersion: string
  readonly gamingMode: GamingModeStatus
  readonly productionAvailable: boolean
}

/** Controller construction inputs. All collaborators are injected. */
export interface ArcAiControllerDeps {
  readonly context: VerifiedAiContext
  readonly gamingModeSource: GamingModeSource
  readonly sessionFactory: (() => TextGenerationSession) | undefined
}

/** Read-only chat controller with fail-safe generation ownership. */
export interface ArcAiController {
  snapshot(): ArcAiSnapshot
  submit(question: string): Promise<ArcAiSnapshot>
  cancel(): Promise<ArcAiSnapshot>
  updateContext(context: VerifiedAiContext): Promise<ArcAiSnapshot>
  /**
   * Apply a Gaming Mode transition immediately, without waiting for
   * in-flight work. ACTIVE or UNKNOWN detaches and cancels the active
   * generation (best-effort) and moves to BLOCKED; INACTIVE relaxes
   * IDLE or BLOCKED back to IDLE. Never resurrects settled work.
   */
  updateGamingMode(mode: GamingModeStatus): Promise<ArcAiSnapshot>
}

/** Fixed message shown when no production generation session exists. */
export const MODEL_UNAVAILABLE_MESSAGE =
  'Local AI is unavailable: no production model is configured.'

async function readControllerGamingMode(
  source: GamingModeSource
): Promise<GamingModeStatus> {
  let status: unknown
  try {
    status = await source.getGamingMode()
  } catch {
    return 'UNKNOWN'
  }
  if (status !== 'ACTIVE' && status !== 'INACTIVE' && status !== 'UNKNOWN') {
    return 'UNKNOWN'
  }
  return status
}

async function bestEffortCancel(session: TextGenerationSession): Promise<void> {
  try {
    await session.cancel()
  } catch {
    /* Cancellation stays best-effort; the generation token decides. */
  }
}

/**
 * Create the ARC AI controller. One active generation at a time: a
 * second submit while generating is a safe no-op. Every async
 * completion rechecks its generation token, the context version, and
 * Gaming Mode before appending anything, so stale work can never
 * surface. Deterministic factual intents answer directly from verified
 * context without model generation; anything else requires an approved
 * generation session.
 */
export function createArcAiController(deps: ArcAiControllerDeps): ArcAiController {
  let context = deps.context
  let status: ArcAiStatus = 'IDLE'
  let messages: AiMessage[] = []
  let error: string | undefined = undefined
  let gamingMode: GamingModeStatus = 'UNKNOWN'
  let generationId = 0
  let messageId = 0
  let activeSession: TextGenerationSession | undefined = undefined

  function nextMessageId(): string {
    messageId += 1
    return `msg-${messageId}`
  }

  function trimHistory(): void {
    while (messages.length > MAX_CHAT_MESSAGES) {
      messages.shift()
    }
  }

  function snapshot(): ArcAiSnapshot {
    return {
      status,
      messages: [...messages],
      error,
      contextVersion: context.version,
      gamingMode,
      productionAvailable: deps.sessionFactory !== undefined,
    }
  }

  /** True when another action already superseded the given operation. */
  function stale(operation: number): boolean {
    return operation !== generationId
  }

  async function settleSafe(operation: number): Promise<ArcAiSnapshot> {
    gamingMode = await readControllerGamingMode(deps.gamingModeSource)
    if (operation !== generationId) {
      return snapshot()
    }
    status = gamingMode === 'INACTIVE' ? 'IDLE' : 'BLOCKED'
    return snapshot()
  }

  async function submit(question: string): Promise<ArcAiSnapshot> {
    const trimmed = question.trim()
    if (trimmed === '') {
      return snapshot()
    }
    if (trimmed.length > MAX_MESSAGE_CHARS) {
      error = `Question exceeds ${MAX_MESSAGE_CHARS} characters`
      return snapshot()
    }
    if (status === 'GENERATING') {
      return snapshot()
    }
    generationId += 1
    const generation = generationId
    status = 'GENERATING'
    error = undefined
    const mode = await readControllerGamingMode(deps.gamingModeSource)
    if (stale(generation)) {
      return snapshot()
    }
    gamingMode = mode
    if (gamingMode !== 'INACTIVE') {
      status = 'BLOCKED'
      return snapshot()
    }
    messages.push({ id: nextMessageId(), role: 'USER', content: trimmed })
    trimHistory()
    const direct = answerFactualQuestion(trimmed, context)
    if (direct !== undefined) {
      messages.push({ id: nextMessageId(), role: 'ASSISTANT', content: direct.text })
      trimHistory()
      status = 'IDLE'
      return snapshot()
    }
    const factory = deps.sessionFactory
    if (factory === undefined) {
      messages.push({ id: nextMessageId(), role: 'ASSISTANT', content: MODEL_UNAVAILABLE_MESSAGE })
      trimHistory()
      status = 'UNAVAILABLE'
      return snapshot()
    }
    const version = context.version
    let session: TextGenerationSession
    try {
      session = factory()
    } catch {
      if (stale(generation)) {
        return snapshot()
      }
      activeSession = undefined
      status = 'ERROR'
      error = 'Local AI generation failed'
      return snapshot()
    }
    activeSession = session
    let result: AiGenerationResult
    try {
      result = await session.generate(buildGenerationRequest(context, messages))
    } catch {
      if (generation !== generationId) {
        return snapshot()
      }
      activeSession = undefined
      status = 'ERROR'
      error = 'Local AI generation failed'
      return snapshot()
    }
    if (generation !== generationId) {
      return snapshot()
    }
    activeSession = undefined
    const text = result.text.trim()
    if (text === '') {
      status = 'ERROR'
      error = 'Local AI generation failed'
      return snapshot()
    }
    const bounded = text.length > MAX_OUTPUT_CHARS ? text.slice(0, MAX_OUTPUT_CHARS) : text
    const freshMode = await readControllerGamingMode(deps.gamingModeSource)
    if (stale(generation)) {
      return snapshot()
    }
    gamingMode = freshMode
    if (version !== context.version || gamingMode !== 'INACTIVE') {
      return settleSafe(generation)
    }
    messages.push({ id: nextMessageId(), role: 'ASSISTANT', content: bounded })
    trimHistory()
    status = 'IDLE'
    return snapshot()
  }

  async function cancel(): Promise<ArcAiSnapshot> {
    generationId += 1
    const operation = generationId
    const session = activeSession
    activeSession = undefined
    if (session !== undefined) {
      await bestEffortCancel(session)
    }
    return settleSafe(operation)
  }

  async function updateContext(next: VerifiedAiContext): Promise<ArcAiSnapshot> {
    generationId += 1
    const operation = generationId
    const session = activeSession
    activeSession = undefined
    if (session !== undefined) {
      await bestEffortCancel(session)
    }
    context = next
    return settleSafe(operation)
  }

  async function updateGamingMode(mode: GamingModeStatus): Promise<ArcAiSnapshot> {
    gamingMode = mode
    if (mode === 'INACTIVE') {
      if (status === 'IDLE' || status === 'BLOCKED') {
        status = 'IDLE'
      }
      return snapshot()
    }
    generationId += 1
    const operation = generationId
    const session = activeSession
    activeSession = undefined
    if (session !== undefined) {
      await bestEffortCancel(session)
    }
    if (!stale(operation)) {
      if (status === 'IDLE' || status === 'GENERATING' || status === 'BLOCKED') {
        status = 'BLOCKED'
      }
    }
    return snapshot()
  }

  return { snapshot, submit, cancel, updateContext, updateGamingMode }
}
