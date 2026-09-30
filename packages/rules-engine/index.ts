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
 * required = sum of every explicit quest, workshop, and project
 *            requirement contribution for the item, each counted once
 * reserved = min(owned, required)
 * missing  = max(required - owned, 0)
 * surplus  = max(owned - reserved, 0)
 * ```
 *
 * Duplicate requirement contributions are summed, never silently
 * deduplicated: normalized GameKnowledge carries no identity rule that
 * would distinguish repeated entries, so each explicit entry counts.
 *
 * Conservative classification: unknown items become REVIEW, required
 * items become RESERVE (surplus exposed separately, never reclassifying
 * the row), known items without requirements become KEEP. SELL and
 * RECYCLE exist in the result model but analyzeStash never emits them:
 * current inputs carry no deterministic economy evidence, and none is
 * invented to exercise those branches.
 */

import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge, ItemRequirement } from '@raidvault/game-data'

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

interface SourceContributions {
  readonly quest: number
  readonly workshop: number
  readonly project: number
}

function emptyContributions(): { quest: number; workshop: number; project: number } {
  return { quest: 0, workshop: 0, project: 0 }
}

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

function collectContributions(
  knowledge: GameKnowledge,
  itemId: string
): SourceContributions {
  const contributions = emptyContributions()
  for (const quest of knowledge.quests) {
    contributions.quest += sumRequirements(quest.requirements, itemId)
  }
  for (const workshop of knowledge.workshops) {
    contributions.workshop += sumRequirements(workshop.requirements, itemId)
  }
  for (const project of knowledge.projects) {
    contributions.project += sumRequirements(project.requirements, itemId)
  }
  return contributions
}

function isKnownItem(knowledge: GameKnowledge, itemId: string): boolean {
  for (const item of knowledge.items) {
    if (item.id === itemId) {
      return true
    }
  }
  return false
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

function analyzeKnownItem(
  itemId: string,
  owned: number,
  contributions: SourceContributions
): ItemAnalysis {
  const required = contributions.quest + contributions.workshop + contributions.project
  const reserved = Math.min(owned, required)
  const missing = Math.max(required - owned, 0)
  const surplus = Math.max(owned - reserved, 0)
  if (required === 0) {
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
  const reasons: RuleReason[] = []
  if (contributions.quest > 0) {
    reasons.push(
      reason('REQUIRED_BY_QUEST', `Required by quests: quantity ${contributions.quest}`)
    )
  }
  if (contributions.workshop > 0) {
    reasons.push(
      reason('REQUIRED_BY_WORKSHOP', `Required by workshops: quantity ${contributions.workshop}`)
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Analyze every stash item against game knowledge. Rows follow stash
 * order; items the player does not own never produce rows. Inputs are
 * trusted as validated upstream and are never mutated.
 */
export function analyzeStash(
  playerState: PlayerState,
  gameKnowledge: GameKnowledge
): StashAnalysis {
  if (playerState.stash === undefined) {
    return { items: [], hasStash: false }
  }
  const items: ItemAnalysis[] = []
  for (const entry of playerState.stash.items) {
    if (isKnownItem(gameKnowledge, entry.id)) {
      items.push(
        analyzeKnownItem(entry.id, entry.quantity, collectContributions(gameKnowledge, entry.id))
      )
    } else {
      items.push(analyzeUnknownItem(entry.id, entry.quantity))
    }
  }
  return { items, hasStash: true }
}
