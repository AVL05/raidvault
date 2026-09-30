/**
 * RaidVault — Raw game-data source records (M2, internal boundary).
 *
 * These DTOs describe the untrusted shape of an approved static/semi-static
 * source payload BEFORE validation. They are intentionally isolated in this
 * module and must never be re-exported from the package public API
 * (packages/game-data/index.ts). Future consumers (rules-engine, UI,
 * providers) work only with the normalized GameKnowledge model.
 *
 * Field names here are source-shaped on purpose and differ from the
 * normalized model so leakage is detectable by test.
 */

/** Untrusted raw item record from a source payload. */
export interface RawItemRecord {
  readonly uid: unknown
  readonly label: unknown
  readonly klass?: unknown
}

/** Untrusted raw item/quantity entry inside a requirement list. */
export interface RawRequirementEntry {
  readonly ref: unknown
  readonly qty: unknown
}

/** Untrusted raw quest/workshop/project record from a source payload. */
export interface RawObjectiveRecord {
  readonly uid: unknown
  readonly label: unknown
  readonly needs?: unknown
}

/** Untrusted raw dataset provenance record from a source payload. */
export interface RawDatasetMetadata {
  readonly origin: unknown
  readonly revision: unknown
  readonly generatedAt: unknown
  readonly staleAfter?: unknown
}

/** Untrusted raw top-level source payload. */
export interface RawGameDataPayload {
  readonly items: unknown
  readonly quests: unknown
  readonly workshops: unknown
  readonly projects: unknown
  readonly metadata: unknown
}
