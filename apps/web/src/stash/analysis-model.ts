import type { StashAnalysis } from '@raidvault/rules-engine'
import type { StashRow } from './view-model'

/** Presentation row enriched with authoritative deterministic analysis. */
export interface EnrichedStashRow extends StashRow {
  readonly classification: import('@raidvault/rules-engine').ItemClassification
  readonly owned: number
  readonly required: number
  readonly reserved: number
  readonly missing: number
  readonly surplus: number
  readonly reasons: readonly { readonly code: string; readonly message: string }[]
}

/** Join display rows with M5 analysis by item ID. Analysis is authoritative. */
export function enrichRows(
  rows: readonly StashRow[],
  analysis: StashAnalysis,
): EnrichedStashRow[] {
  const byId = new Map(analysis.items.map((item) => [item.itemId, item]))
  return rows.map((row) => {
    const found = byId.get(row.itemId)
    if (found === undefined) {
      return {
        ...row,
        classification: 'REVIEW' as const,
        owned: row.quantity,
        required: 0,
        reserved: 0,
        missing: 0,
        surplus: row.quantity,
        reasons: [
          { code: 'INSUFFICIENT_DATA', message: 'No deterministic analysis row for this item' },
        ],
      }
    }
    return {
      ...row,
      classification: found.classification,
      owned: found.owned,
      required: found.required,
      reserved: found.reserved,
      missing: found.missing,
      surplus: found.surplus,
      reasons: found.reasons,
    }
  })
}
