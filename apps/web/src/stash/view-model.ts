/**
 * RaidVault stash view-model (M4, presentation only).
 *
 * Pure helpers joining a validated PlayerStateSnapshot with normalized
 * GameKnowledge into display-ready rows. Presentation-only fields
 * (displayName, category, metadataKnown, searchText) are allowed here.
 * Business facts such as required, missing, surplus, reserve, sell,
 * recycle, or priority values are never computed in this module.
 */

import type { GameKnowledge } from '@raidvault/game-data'
import type { PlayerState } from '@raidvault/domain'
import type { PlayerStateSnapshot } from '@raidvault/providers'

/** Display-ready stash row. Unknown metadata stays undefined, never invented. */
export interface StashRow {
  readonly itemId: string
  readonly displayName: string | undefined
  readonly category: string | undefined
  readonly quantity: number
  readonly metadataKnown: boolean
  readonly searchText: string
}

/** Stash-level summary for headers and empty states. */
export interface StashSummary {
  readonly hasStash: boolean
  readonly itemCount: number
  readonly usedSlots: number | undefined
  readonly totalSlots: number | undefined
}

/** Snapshot status for the header. Mirrors M3 semantics exactly. */
export interface StashStatus {
  readonly providerId: string
  readonly fetchedAt: string
  readonly stale: boolean
}

/** Category filter value meaning "no category filtering". */
export const ALL_CATEGORIES = 'all'

/**
 * Join stash entries with GameKnowledge by item ID, preserving stash
 * order. Entries absent from GameKnowledge keep their stable ID with
 * undefined name/category and metadataKnown false.
 */
export function buildStashRows(
  state: PlayerState,
  knowledge: GameKnowledge
): StashRow[] {
  if (state.stash === undefined) {
    return []
  }
  const known = new Map<string, { name: string; category: string | undefined }>()
  for (const item of knowledge.items) {
    if (!known.has(item.id)) {
      known.set(item.id, { name: item.name, category: item.category })
    }
  }
  return state.stash.items.map((entry) => {
    const meta = known.get(entry.id)
    const displayName = meta === undefined ? undefined : meta.name
    const category = meta === undefined ? undefined : meta.category
    const searchText = [entry.id, displayName ?? '', category ?? '']
      .join(' ')
      .toLowerCase()
    return {
      itemId: entry.id,
      displayName,
      category,
      quantity: entry.quantity,
      metadataKnown: meta !== undefined,
      searchText,
    }
  })
}

/**
 * Case-insensitive substring search across ID, name, and category,
 * composed with an optional category filter. An empty query returns
 * every row that passes the category filter.
 */
export function filterStashRows(
  rows: readonly StashRow[],
  query: string,
  category: string
): StashRow[] {
  const needle = query.trim().toLowerCase()
  return rows.filter((row) => {
    if (category !== ALL_CATEGORIES && row.category !== category) {
      return false
    }
    if (needle === '') {
      return true
    }
    return row.searchText.includes(needle)
  })
}

/** Summarize stash presence, size, and capacity for headers. */
export function summarizeStash(state: PlayerState): StashSummary {
  if (state.stash === undefined) {
    return { hasStash: false, itemCount: 0, usedSlots: undefined, totalSlots: undefined }
  }
  return {
    hasStash: true,
    itemCount: state.stash.items.length,
    usedSlots: state.stash.capacity.usedSlots,
    totalSlots: state.stash.capacity.totalSlots,
  }
}

/** Sorted unique list of known categories across rows. */
export function listCategories(rows: readonly StashRow[]): string[] {
  const seen = new Set<string>()
  for (const row of rows) {
    if (row.category !== undefined) {
      seen.add(row.category)
    }
  }
  return [...seen].sort()
}

/** Present snapshot truth without transformation beyond formatting. */
export function describeSnapshot(snapshot: PlayerStateSnapshot): StashStatus {
  return {
    providerId: snapshot.providerId,
    fetchedAt: formatTimestamp(snapshot.fetchedAt),
    stale: snapshot.stale,
  }
}

/** Format a real snapshot timestamp deterministically (UTC ISO). */
export function formatTimestamp(value: number): string {
  return new Date(value).toISOString()
}
