/**
 * RaidVault — Deterministic synthetic mock-provider fixtures (M3).
 *
 * Obviously synthetic records with fixed timestamps and no real player
 * data. Used by provider tests to verify validation, normalization, and
 * snapshot-cache behavior. Valid fixtures match the internal raw mock
 * DTOs; invalid fixtures are typed unknown on purpose.
 */

import type {
  RawMockPlayerPayload,
} from './source'

/** Fixed provider identifier used by fixtures. */
export const FIXTURE_PROVIDER_ID = 'mock-provider'

/** Fixed snapshot capture timestamp shared by fixtures (unix ms epoch). */
export const FIXTURE_CAPTURED_AT = 1700000000000

// ---------------------------------------------------------------------------
// Valid fixtures
// ---------------------------------------------------------------------------

/** A valid synthetic mock payload covering every supported section. */
export const validMockPayload: RawMockPlayerPayload = {
  profile: { pid: 'player-1' },
  stash: {
    owner: 'stash-1',
    goods: [
      { sku: 'syn-bandage', amount: 3 },
      { sku: 'syn-wire', amount: 1 },
    ],
    slotsTotal: 10,
    slotsUsed: 4,
  },
  hideout: { site: 'syn-den', stage: 'active', stores: [100, 50] },
  projects: [{ uid: 'syn-shelter', title: 'Synthetic Shelter', needs: [4] }],
  quests: [{ uid: 'syn-quest-recon', title: 'Synthetic Recon', needs: [2, 1] }],
  loadout: { primary: 'w-1', guard: 'a-1', trinket: 'acc-1' },
  takenAt: FIXTURE_CAPTURED_AT,
  source: 'mock-fixture',
}

/** A valid empty mock payload: identity and timestamp only. */
export const validEmptyMockPayload: RawMockPlayerPayload = {
  profile: { pid: 'player-2' },
  projects: [],
  quests: [],
  takenAt: FIXTURE_CAPTURED_AT,
}

// ---------------------------------------------------------------------------
// Invalid fixtures (each carries exactly one defect)
// ---------------------------------------------------------------------------

function withGoods(goods: unknown): RawMockPlayerPayload {
  return {
    ...validMockPayload,
    stash: {
      owner: 'stash-1',
      goods,
      slotsTotal: 10,
      slotsUsed: 4,
    },
  }
}

function withQuests(quests: unknown): RawMockPlayerPayload {
  return { ...validMockPayload, quests }
}

function withTakenAt(takenAt: unknown): RawMockPlayerPayload {
  return { ...validMockPayload, takenAt }
}

/** Invalid: payload is not an object. */
export const malformedPayload: unknown = 'not-an-object'

/** Invalid: stash section is not an object. */
export const malformedStashPayload: RawMockPlayerPayload = {
  ...validMockPayload,
  stash: 42,
}

/** Invalid: negative stash quantity. */
export const negativeQuantityPayload: RawMockPlayerPayload = withGoods([
  { sku: 'syn-wire', amount: -1 },
])

/** Invalid: fractional stash quantity. */
export const fractionalQuantityPayload: RawMockPlayerPayload = withGoods([
  { sku: 'syn-wire', amount: 1.5 },
])

/** Invalid: two stash entries share one id. */
export const duplicateStashIdsPayload: RawMockPlayerPayload = withGoods([
  { sku: 'syn-wire', amount: 1 },
  { sku: 'syn-wire', amount: 2 },
])

/** Invalid: used slots exceed total slots. */
export const invalidCapacityPayload: RawMockPlayerPayload = {
  ...validMockPayload,
  stash: {
    owner: 'stash-1',
    goods: [{ sku: 'syn-wire', amount: 1 }],
    slotsTotal: 3,
    slotsUsed: 5,
  },
}

/** Invalid: negative nested quest quantity. */
export const invalidQuestQuantityPayload: RawMockPlayerPayload = withQuests([
  { uid: 'syn-quest-recon', title: 'Synthetic Recon', needs: [-1] },
])

/** Invalid: negative nested hideout store. */
export const invalidHideoutPayload: RawMockPlayerPayload = {
  ...validMockPayload,
  hideout: { site: 'syn-den', stage: 'active', stores: [-5] },
}

/** Invalid: blank loadout id. */
export const invalidLoadoutPayload: RawMockPlayerPayload = {
  ...validMockPayload,
  loadout: { primary: '' },
}

/** Invalid: negative snapshot timestamp. */
export const invalidTimestampPayload: RawMockPlayerPayload = withTakenAt(-1)

/** Invalid: empty player id. */
export const emptyPlayerIdPayload: RawMockPlayerPayload = {
  ...validMockPayload,
  profile: { pid: '' },
}
