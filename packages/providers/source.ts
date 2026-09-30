/**
 * RaidVault — Internal raw mock-provider records (M3, internal boundary).
 *
 * These DTOs describe the untrusted shape of the deterministic mock
 * provider payload BEFORE validation. They are intentionally isolated in
 * this module and must never be re-exported from the package public API
 * (packages/providers/index.ts). Future consumers work only with M1 domain
 * types and the provider-independent contract.
 *
 * Field names are mock-shaped on purpose and differ from the domain model
 * so leakage is detectable by test. No DTOs for real or future providers
 * are defined here.
 */

/** Untrusted raw mock profile record. */
export interface RawMockProfile {
  readonly pid: unknown
}

/** Untrusted raw mock stash item entry. */
export interface RawMockItemEntry {
  readonly sku: unknown
  readonly amount: unknown
}

/** Untrusted raw mock stash record. */
export interface RawMockStash {
  readonly owner: unknown
  readonly goods: unknown
  readonly slotsTotal: unknown
  readonly slotsUsed: unknown
}

/** Untrusted raw mock quest/project record. Needs holds plain quantities. */
export interface RawMockObjective {
  readonly uid: unknown
  readonly title: unknown
  readonly needs?: unknown
}

/** Untrusted raw mock hideout record. */
export interface RawMockHideout {
  readonly site: unknown
  readonly stage: unknown
  readonly stores: unknown
}

/** Untrusted raw mock loadout record. */
export interface RawMockLoadout {
  readonly primary?: unknown
  readonly guard?: unknown
  readonly trinket?: unknown
}

/** Untrusted raw top-level mock provider payload. */
export interface RawMockPlayerPayload {
  readonly profile: unknown
  readonly stash?: unknown
  readonly hideout?: unknown
  readonly projects?: unknown
  readonly quests?: unknown
  readonly loadout?: unknown
  readonly takenAt: unknown
  readonly source?: unknown
}
