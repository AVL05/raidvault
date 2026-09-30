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
import type {
  GameKnowledge,
  ItemRequirement,
  ProjectRequirement,
  QuestKnowledge,
} from '@raidvault/game-data'

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

function indexTargetsById<Target extends { readonly id: string }>(
  targets: readonly Target[]
): Map<string, Target> {
  const index = new Map<string, Target>()
  for (const target of targets) {
    if (!index.has(target.id)) {
      index.set(target.id, target)
    }
  }
  return index
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
  const questIndex = indexTargetsById(gameKnowledge.quests)
  const projectIndex = indexTargetsById(gameKnowledge.projects)
  const workshopMentioned = collectWorkshopMentions(gameKnowledge)

  const activeQuests: QuestKnowledge[] = []
  let progressionGaps = false
  if (playerState.questProgress !== undefined) {
    for (const progress of playerState.questProgress) {
      const quest = questIndex.get(progress.questId)
      if (quest === undefined) {
        progressionGaps = true
      } else {
        activeQuests.push(quest)
      }
    }
  }
  const activeProjects: ProjectRequirement[] = []
  if (playerState.projects !== undefined) {
    for (const progress of playerState.projects) {
      const project = projectIndex.get(progress.projectId)
      if (project === undefined) {
        progressionGaps = true
      } else {
        activeProjects.push(project)
      }
    }
  }

  const items: ItemAnalysis[] = []
  for (const entry of playerState.stash.items) {
    if (!isKnownItem(gameKnowledge, entry.id)) {
      items.push(analyzeUnknownItem(entry.id, entry.quantity))
      continue
    }
    let questTotal = 0
    for (const quest of activeQuests) {
      questTotal += sumRequirements(quest.requirements, entry.id)
    }
    let projectTotal = 0
    for (const project of activeProjects) {
      projectTotal += sumRequirements(project.requirements, entry.id)
    }
    items.push(
      analyzeKnownItem(
        entry.id,
        entry.quantity,
        { quest: questTotal, project: projectTotal },
        workshopMentioned.has(entry.id),
        progressionGaps
      )
    )
  }
  return { items, hasStash: true }
}
