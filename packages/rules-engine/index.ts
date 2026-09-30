/**
 * RaidVault — Deterministic Rules Engine (M5).
 *
 * Authoritative factual inventory calculations over validated inputs:
 * a PlayerState from @raidvault/domain and GameKnowledge from
 * @raidvault/game-data. Pure functions only: no AI, no network, no
 * clock, no randomness, no side effects, no input mutation.
 *
 * Quantity equations per stash item (all integers >= 0):
 *
 * ```text
 * owned    = stash quantity
 * required = sum of explicit requirement contributions from the
 *            player's current matched sources only (see scoping)
 * reserved = min(owned, required)
 * missing  = max(required - owned, 0)
 * surplus  = max(owned - reserved, 0)
 * ```
 *
 * Requirement-source scoping (fail-safe by design):
 *
 * - GameKnowledge is a catalog, not player state. Catalog entries
 *   contribute nothing unless the player's current progression
 *   references them by exact ID.
 * - Quests contribute only when questProgress holds the quest ID.
 * - Projects contribute only when projects holds the project ID.
 * - Progression state strings and progress quantities are never read:
 *   matching is by identifier only, with no string heuristics.
 * - Workshops cannot be scoped: no architecture or docs define a
 *   hideout-to-workshop correspondence, so workshop requirements are
 *   excluded from required entirely (never assumed active). Items
 *   referenced by a workshop while otherwise requirement-free become
 *   REVIEW instead of KEEP, since a KEEP verdict would be unfounded.
 * - Progression entries referencing catalog IDs absent from
 *   GameKnowledge mark requirement knowledge incomplete; rows that
 *   would otherwise be KEEP become REVIEW.
 *
 * Duplicate requirement contributions inside matched sources are summed,
 * never silently deduplicated: normalized GameKnowledge carries no
 * identity rule that would distinguish repeated entries.
 *
 * Conservative classification: unknown items become REVIEW, required
 * items become RESERVE (surplus exposed separately, never reclassifying
 * the row), cleanly unrequired items become KEEP. SELL and RECYCLE exist
 * in the result model but analyzeStash never emits them: current inputs
 * carry no deterministic economy evidence, and none is invented to
 * exercise those branches.
 */

import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge, ItemRequirement } from '@raidvault/game-data'
import { resolveActiveSources } from './active-sources'

// ---------------------------------------------------------------------------
// Result model (small, readonly, serializable)
// ---------------------------------------------------------------------------

/** Exact classification union. Production analysis emits KEEP, RESERVE, or REVIEW. */
export type ItemClassification =
  | 'KEEP'
  | 'RESERVE'
  | 'SELL'
  | 'RECYCLE'
  | 'REVIEW'

/** Machine-readable reason codes. Ordered deterministically where emitted. */
export type RuleReasonCode =
  | 'REQUIRED_BY_QUEST'
  | 'REQUIRED_BY_WORKSHOP'
  | 'REQUIRED_BY_PROJECT'
  | 'UNKNOWN_ITEM'
  | 'NO_KNOWN_REQUIREMENT'
  | 'INSUFFICIENT_DATA'

/** Structured reason: stable code plus readable text. */
export interface RuleReason {
  readonly code: RuleReasonCode
  readonly message: string
}

/** Factual analysis of one stash item. */
export interface ItemAnalysis {
  readonly itemId: string
  readonly owned: number
  readonly required: number
  readonly reserved: number
  readonly missing: number
  readonly surplus: number
  readonly classification: ItemClassification
  readonly reasons: readonly RuleReason[]
}

/** Stash-level analysis. Rows cover owned items only, in stash order. */
export interface StashAnalysis {
  readonly items: readonly ItemAnalysis[]
  readonly hasStash: boolean
}

// ---------------------------------------------------------------------------
// Requirement aggregation (factual only, no planning)
// ---------------------------------------------------------------------------

function sumRequirements(
  requirements: readonly ItemRequirement[],
  itemId: string
): number {
  let total = 0
  for (const requirement of requirements) {
    if (requirement.itemId === itemId) {
      total += requirement.quantity
    }
  }
  return total
}

function isKnownItem(knowledge: GameKnowledge, itemId: string): boolean {
  for (const item of knowledge.items) {
    if (item.id === itemId) {
      return true
    }
  }
  return false
}

function collectWorkshopMentions(knowledge: GameKnowledge): ReadonlySet<string> {
  const mentioned = new Set<string>()
  for (const workshop of knowledge.workshops) {
    for (const requirement of workshop.requirements) {
      mentioned.add(requirement.itemId)
    }
  }
  return mentioned
}

// ---------------------------------------------------------------------------
// Item analysis (pure, deterministic)
// ---------------------------------------------------------------------------

function reason(code: RuleReasonCode, message: string): RuleReason {
  return { code, message }
}

function analyzeUnknownItem(itemId: string, owned: number): ItemAnalysis {
  return {
    itemId,
    owned,
    required: 0,
    reserved: 0,
    missing: 0,
    surplus: owned,
    classification: 'REVIEW',
    reasons: [
      reason('UNKNOWN_ITEM', `Item '${itemId}' is absent from game knowledge`),
      reason('INSUFFICIENT_DATA', `Cannot assess requirements for unknown item '${itemId}'`),
    ],
  }
}

interface ScopedContributions {
  readonly quest: number
  readonly project: number
}

function analyzeKnownItem(
  itemId: string,
  owned: number,
  contributions: ScopedContributions,
  workshopMentioned: boolean,
  progressionGaps: boolean
): ItemAnalysis {
  const required = contributions.quest + contributions.project
  const reserved = Math.min(owned, required)
  const missing = Math.max(required - owned, 0)
  const surplus = Math.max(owned - reserved, 0)
  if (required > 0) {
    const reasons: RuleReason[] = []
    if (contributions.quest > 0) {
      reasons.push(
        reason('REQUIRED_BY_QUEST', `Required by quests: quantity ${contributions.quest}`)
      )
    }
    if (contributions.project > 0) {
      reasons.push(
        reason('REQUIRED_BY_PROJECT', `Required by projects: quantity ${contributions.project}`)
      )
    }
    return {
      itemId,
      owned,
      required,
      reserved,
      missing,
      surplus,
      classification: 'RESERVE',
      reasons,
    }
  }
  if (workshopMentioned) {
    return {
      itemId,
      owned,
      required,
      reserved,
      missing,
      surplus,
      classification: 'REVIEW',
      reasons: [
        reason(
          'INSUFFICIENT_DATA',
          `Workshop requirements reference item '${itemId}' but cannot be scoped to current progression`
        ),
      ],
    }
  }
  if (progressionGaps) {
    return {
      itemId,
      owned,
      required,
      reserved,
      missing,
      surplus,
      classification: 'REVIEW',
      reasons: [
        reason('NO_KNOWN_REQUIREMENT', `No known requirement references item '${itemId}'`),
        reason(
          'INSUFFICIENT_DATA',
          'Player progression references catalog entries absent from game knowledge'
        ),
      ],
    }
  }
  return {
    itemId,
    owned,
    required,
    reserved,
    missing,
    surplus,
    classification: 'KEEP',
    reasons: [reason('NO_KNOWN_REQUIREMENT', `No known requirement references item '${itemId}'`)],
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze every stash item against game knowledge, counting only
 * requirements from the player's current matched progression. Rows
 * follow stash order; items the player does not own never produce rows.
 * Inputs are trusted as validated upstream and are never mutated.
 */
export function analyzeStash(
  playerState: PlayerState,
  gameKnowledge: GameKnowledge
): StashAnalysis {
  if (playerState.stash === undefined) {
    return { items: [], hasStash: false }
  }
  const sources = resolveActiveSources(playerState, gameKnowledge)
  const workshopMentioned = collectWorkshopMentions(gameKnowledge)

  const items: ItemAnalysis[] = []
  for (const entry of playerState.stash.items) {
    if (!isKnownItem(gameKnowledge, entry.id)) {
      items.push(analyzeUnknownItem(entry.id, entry.quantity))
      continue
    }
    let questTotal = 0
    for (const quest of sources.quests) {
      questTotal += sumRequirements(quest.requirements, entry.id)
    }
    let projectTotal = 0
    for (const project of sources.projects) {
      projectTotal += sumRequirements(project.requirements, entry.id)
    }
    items.push(
      analyzeKnownItem(
        entry.id,
        entry.quantity,
        { quest: questTotal, project: projectTotal },
        workshopMentioned.has(entry.id),
        sources.progressionGaps
      )
    )
  }
  return { items, hasStash: true }
}

// ---------------------------------------------------------------------------
// Deterministic planning (M6)
// ---------------------------------------------------------------------------

/**
 * Planning turns M5 analysis plus per-target requirement gaps into
 * deterministic views. Gross-gap semantics apply per target: owned units
 * are counted against every pursuing target without implying allocation,
 * so per-target gaps must never be summed as aggregates. Aggregate
 * missing quantities use the same matched sources and the same missing
 * equation as M5 (pinned equal by test), which additionally covers
 * required items the player does not own and therefore have no M5 row.
 * Workshops are excluded everywhere: workshopPlanningSupported is false
 * and no workshop requirement enters totals.
 */

/** Requirement source kinds with deterministic planning support. */
export type PlanningTargetType = 'QUEST' | 'PROJECT'

/**
 * Gross requirement gap for one item within one target. owned repeats
 * the stash total per target on purpose; missingForTarget is the
 * per-target shortfall against that total, not an allocated share.
 */
export interface RequirementGap {
  readonly targetType: PlanningTargetType
  readonly targetId: string
  readonly itemId: string
  readonly requiredForTarget: number
  readonly owned: number
  readonly missingForTarget: number
}

/** One pursued target with its per-item gaps and completion state. */
export interface TargetPlan {
  readonly targetType: PlanningTargetType
  readonly targetId: string
  readonly targetName: string | undefined
  readonly complete: boolean
  readonly requirements: readonly RequirementGap[]
}

/** Aggregated missing quantity for one item across pursued targets. */
export interface MissingItemPlan {
  readonly itemId: string
  readonly displayName: string | undefined
  readonly totalMissing: number
  readonly sourceTypes: readonly PlanningTargetType[]
  readonly sourceTargetIds: readonly string[]
}

/** Next-raid priority entry, ranked by missing quantity. */
export interface RaidPriority {
  readonly rank: number
  readonly itemId: string
  readonly displayName: string | undefined
  readonly missing: number
  readonly sourceTargetIds: readonly string[]
}

/** Progression reference with no matching catalog entry. */
export interface IncompleteReference {
  readonly targetType: PlanningTargetType
  readonly targetId: string
}

/** Deterministic planning snapshot for presentation layers. */
export interface PlanningSnapshot {
  readonly hasStash: boolean
  readonly targets: readonly TargetPlan[]
  readonly missingItems: readonly MissingItemPlan[]
  readonly raidPriorities: readonly RaidPriority[]
  readonly incompleteReferences: readonly IncompleteReference[]
  readonly workshopPlanningSupported: boolean
}

function displayNameOf(knowledge: GameKnowledge, itemId: string): string | undefined {
  for (const item of knowledge.items) {
    if (item.id === itemId) {
      return item.name
    }
  }
  return undefined
}

function buildTargetPlan(
  targetType: PlanningTargetType,
  targetId: string,
  targetName: string | undefined,
  requirements: readonly ItemRequirement[],
  ownedByItem: ReadonlyMap<string, number>
): TargetPlan {
  const gaps: RequirementGap[] = requirements.map((requirement) => {
    const owned = ownedByItem.get(requirement.itemId) ?? 0
    return {
      targetType,
      targetId,
      itemId: requirement.itemId,
      requiredForTarget: requirement.quantity,
      owned,
      missingForTarget: Math.max(requirement.quantity - owned, 0),
    }
  })
  return {
    targetType,
    targetId,
    targetName,
    complete: gaps.every((gap) => gap.missingForTarget === 0),
    requirements: gaps,
  }
}

function sourceTypesFor(itemId: string, targets: readonly TargetPlan[]): PlanningTargetType[] {
  const types: PlanningTargetType[] = []
  for (const target of targets) {
    if (types.includes(target.targetType)) {
      continue
    }
    for (const gap of target.requirements) {
      if (gap.itemId === itemId) {
        types.push(target.targetType)
        break
      }
    }
  }
  return types
}

function sourceTargetIdsFor(itemId: string, targets: readonly TargetPlan[]): string[] {
  const ids: string[] = []
  for (const target of targets) {
    if (ids.includes(target.targetId)) {
      continue
    }
    for (const gap of target.requirements) {
      if (gap.itemId === itemId) {
        ids.push(target.targetId)
        break
      }
    }
  }
  return ids
}

function compareMissing(left: MissingItemPlan, right: MissingItemPlan): number {
  if (left.totalMissing !== right.totalMissing) {
    return right.totalMissing - left.totalMissing
  }
  if (left.itemId === right.itemId) {
    return 0
  }
  return left.itemId < right.itemId ? -1 : 1
}

/**
 * Build a deterministic planning snapshot. Targets follow progression
 * order (quests then projects), deduplicated by identity. Aggregate
 * missing quantities come from M5 analysis, never from summing
 * per-target gaps. Without a stash, owned quantities are unknown rather
 * than zero, so targets and missing math stay empty while incomplete
 * references are still surfaced. Inputs are never mutated.
 */
export function buildPlanningSnapshot(
  playerState: PlayerState,
  gameKnowledge: GameKnowledge
): PlanningSnapshot {
  const sources = resolveActiveSources(playerState, gameKnowledge)
  const incompleteReferences: IncompleteReference[] = []
  for (const targetId of sources.unknownQuestIds) {
    incompleteReferences.push({ targetType: 'QUEST', targetId })
  }
  for (const targetId of sources.unknownProjectIds) {
    incompleteReferences.push({ targetType: 'PROJECT', targetId })
  }
  if (playerState.stash === undefined) {
    return {
      hasStash: false,
      targets: [],
      missingItems: [],
      raidPriorities: [],
      incompleteReferences,
      workshopPlanningSupported: false,
    }
  }

  const ownedByItem = new Map<string, number>()
  for (const entry of playerState.stash.items) {
    ownedByItem.set(entry.id, entry.quantity)
  }

  const seenTargets = new Set<string>()
  const targets: TargetPlan[] = []
  for (const quest of sources.quests) {
    const key = `QUEST:${quest.id}`
    if (seenTargets.has(key)) {
      continue
    }
    seenTargets.add(key)
    targets.push(buildTargetPlan('QUEST', quest.id, quest.name, quest.requirements, ownedByItem))
  }
  for (const project of sources.projects) {
    const key = `PROJECT:${project.id}`
    if (seenTargets.has(key)) {
      continue
    }
    seenTargets.add(key)
    targets.push(
      buildTargetPlan('PROJECT', project.id, project.name, project.requirements, ownedByItem)
    )
  }

  const requiredByItem = new Map<string, number>()
  for (const target of targets) {
    for (const gap of target.requirements) {
      requiredByItem.set(gap.itemId, (requiredByItem.get(gap.itemId) ?? 0) + gap.requiredForTarget)
    }
  }
  const missingItems: MissingItemPlan[] = []
  for (const [itemId, required] of requiredByItem) {
    const owned = ownedByItem.get(itemId) ?? 0
    const totalMissing = Math.max(required - owned, 0)
    if (totalMissing <= 0) {
      continue
    }
    missingItems.push({
      itemId,
      displayName: displayNameOf(gameKnowledge, itemId),
      totalMissing,
      sourceTypes: sourceTypesFor(itemId, targets),
      sourceTargetIds: sourceTargetIdsFor(itemId, targets),
    })
  }

  const ranked = [...missingItems].sort(compareMissing)
  const raidPriorities: RaidPriority[] = ranked.map((item, index) => ({
    rank: index + 1,
    itemId: item.itemId,
    displayName: item.displayName,
    missing: item.totalMissing,
    sourceTargetIds: item.sourceTargetIds,
  }))

  return {
    hasStash: true,
    targets,
    missingItems,
    raidPriorities,
    incompleteReferences,
    workshopPlanningSupported: false,
  }
}
