/**
 * RaidVault — Active requirement sources (M5/M6, internal).
 *
 * Single source of truth for requirement-source scoping, shared by item
 * analysis and planning so the two cannot diverge. A GameKnowledge entry
 * contributes only when the player's current progression references its
 * exact ID. Progression state strings and progress quantities are never
 * read: matching is by identifier only, with no string heuristics.
 * Workshops are intentionally absent here: no architecture or docs define
 * a hideout-to-workshop correspondence, so workshop requirements are
 * never treated as active (see the M5/M6 workshop safety boundary).
 */

import type { PlayerState } from '@raidvault/domain'
import type {
  GameKnowledge,
  ProjectRequirement,
  QuestKnowledge,
} from '@raidvault/game-data'

/** Quests and projects the player currently pursues, in progression order. */
export interface ActiveSources {
  readonly quests: readonly QuestKnowledge[]
  readonly projects: readonly ProjectRequirement[]
  readonly unknownQuestIds: readonly string[]
  readonly unknownProjectIds: readonly string[]
  readonly progressionGaps: boolean
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

/**
 * Resolve current progression references against the knowledge catalog.
 * Each logical quest or project ID contributes at most once: repeated
 * progression references resolve to the first occurrence in progression
 * order, so M5 and M6 share one authoritative active-source semantic.
 * Unknown references are collected deduplicated and never contribute
 * requirements.
 */
export function resolveActiveSources(
  playerState: PlayerState,
  gameKnowledge: GameKnowledge
): ActiveSources {
  const questIndex = indexTargetsById(gameKnowledge.quests)
  const projectIndex = indexTargetsById(gameKnowledge.projects)

  const quests: QuestKnowledge[] = []
  const unknownQuestIds: string[] = []
  const seenQuestIds = new Set<string>()
  const seenUnknownQuests = new Set<string>()
  if (playerState.questProgress !== undefined) {
    for (const progress of playerState.questProgress) {
      const quest = questIndex.get(progress.questId)
      if (quest === undefined) {
        if (!seenUnknownQuests.has(progress.questId)) {
          seenUnknownQuests.add(progress.questId)
          unknownQuestIds.push(progress.questId)
        }
      } else if (!seenQuestIds.has(progress.questId)) {
        seenQuestIds.add(progress.questId)
        quests.push(quest)
      }
    }
  }

  const projects: ProjectRequirement[] = []
  const unknownProjectIds: string[] = []
  const seenProjectIds = new Set<string>()
  const seenUnknownProjects = new Set<string>()
  if (playerState.projects !== undefined) {
    for (const progress of playerState.projects) {
      const project = projectIndex.get(progress.projectId)
      if (project === undefined) {
        if (!seenUnknownProjects.has(progress.projectId)) {
          seenUnknownProjects.add(progress.projectId)
          unknownProjectIds.push(progress.projectId)
        }
      } else if (!seenProjectIds.has(progress.projectId)) {
        seenProjectIds.add(progress.projectId)
        projects.push(project)
      }
    }
  }

  return {
    quests,
    projects,
    unknownQuestIds,
    unknownProjectIds,
    progressionGaps: unknownQuestIds.length > 0 || unknownProjectIds.length > 0,
  }
}
