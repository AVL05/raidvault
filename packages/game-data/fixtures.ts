/**
 * RaidVault — Deterministic synthetic game-data fixtures (M2).
 *
 * Obviously synthetic records with fixed timestamps and no real ARC Raiders
 * data. Used by game-data tests to verify validation and normalization.
 */

import type {
  GameKnowledge,
} from './index'
import type {
  RawGameDataPayload,
} from './source'

/** Fixed dataset capture timestamp shared by fixtures (unix ms epoch). */
export const FIXTURE_CAPTURED_AT = 1700000000000

/** Fixed stale-after timestamp: capture time plus 30 days. */
export const FIXTURE_STALE_AFTER = 1702592000000

/** Fixed source identifier used by fixtures. */
export const FIXTURE_SOURCE_ID = 'bundled-synthetic'

/** Fixed dataset version used by fixtures. */
export const FIXTURE_DATASET_VERSION = 'm2-fixture-1'

// ---------------------------------------------------------------------------
// Valid fixtures
// ---------------------------------------------------------------------------

/** A valid synthetic source payload covering items, quests, workshops, and projects. */
export const validSourcePayload: RawGameDataPayload = {
  items: [
    { uid: 'syn-bandage', label: 'Synthetic Bandage', klass: 'medical' },
    { uid: 'syn-wire', label: 'Synthetic Wire' },
    { uid: 'syn-fuel', label: 'Synthetic Fuel', klass: 'fuel' },
  ],
  quests: [
    {
      uid: 'syn-quest-recon',
      label: 'Synthetic Recon',
      needs: [
        { ref: 'syn-bandage', qty: 2 },
        { ref: 'syn-wire', qty: 1 },
      ],
    },
  ],
  workshops: [
    {
      uid: 'syn-workbench',
      label: 'Synthetic Workbench',
      needs: [{ ref: 'syn-fuel', qty: 3 }],
    },
  ],
  projects: [
    {
      uid: 'syn-shelter',
      label: 'Synthetic Shelter',
      needs: [{ ref: 'syn-wire', qty: 4 }],
    },
  ],
  metadata: {
    origin: FIXTURE_SOURCE_ID,
    revision: FIXTURE_DATASET_VERSION,
    generatedAt: FIXTURE_CAPTURED_AT,
    staleAfter: FIXTURE_STALE_AFTER,
  },
}

/** The normalized GameKnowledge expected from validSourcePayload. */
export const expectedGameKnowledge: GameKnowledge = {
  items: [
    { id: 'syn-bandage', name: 'Synthetic Bandage', category: 'medical' },
    { id: 'syn-wire', name: 'Synthetic Wire' },
    { id: 'syn-fuel', name: 'Synthetic Fuel', category: 'fuel' },
  ],
  quests: [
    {
      id: 'syn-quest-recon',
      name: 'Synthetic Recon',
      requirements: [
        { itemId: 'syn-bandage', quantity: 2 },
        { itemId: 'syn-wire', quantity: 1 },
      ],
    },
  ],
  workshops: [
    {
      id: 'syn-workbench',
      name: 'Synthetic Workbench',
      requirements: [{ itemId: 'syn-fuel', quantity: 3 }],
    },
  ],
  projects: [
    {
      id: 'syn-shelter',
      name: 'Synthetic Shelter',
      requirements: [{ itemId: 'syn-wire', quantity: 4 }],
    },
  ],
  metadata: {
    sourceId: FIXTURE_SOURCE_ID,
    datasetVersion: FIXTURE_DATASET_VERSION,
    capturedAt: FIXTURE_CAPTURED_AT,
    staleAfter: FIXTURE_STALE_AFTER,
  },
}

/** A valid minimal dataset: empty collections and metadata without staleAfter. */
export const minimalSourcePayload: RawGameDataPayload = {
  items: [],
  quests: [],
  workshops: [],
  projects: [],
  metadata: {
    origin: FIXTURE_SOURCE_ID,
    revision: FIXTURE_DATASET_VERSION,
    generatedAt: FIXTURE_CAPTURED_AT,
  },
}

/** A valid quest record without a needs list (no requirements). */
export const questWithoutNeedsPayload: RawGameDataPayload = {
  ...validSourcePayload,
  quests: [{ uid: 'syn-quest-empty', label: 'Synthetic Empty Quest' }],
  workshops: [],
  projects: [],
}

// ---------------------------------------------------------------------------
// Invalid fixtures (each carries exactly one defect)
// ---------------------------------------------------------------------------

function withItems(items: unknown): RawGameDataPayload {
  return { ...validSourcePayload, items }
}

function withQuests(quests: unknown): RawGameDataPayload {
  return { ...validSourcePayload, quests }
}

function withWorkshops(workshops: unknown): RawGameDataPayload {
  return { ...validSourcePayload, workshops }
}

function withProjects(projects: unknown): RawGameDataPayload {
  return { ...validSourcePayload, projects }
}

function withMetadata(metadata: unknown): RawGameDataPayload {
  return { ...validSourcePayload, metadata }
}

/** Invalid: two items share one id. */
export const duplicateItemPayload: RawGameDataPayload = withItems([
  { uid: 'syn-wire', label: 'Synthetic Wire' },
  { uid: 'syn-wire', label: 'Synthetic Wire Copy' },
])

/** Invalid: two quests share one id. */
export const duplicateQuestPayload: RawGameDataPayload = withQuests([
  { uid: 'syn-quest-recon', label: 'First', needs: [] },
  { uid: 'syn-quest-recon', label: 'Second', needs: [] },
])

/** Invalid: two workshop targets share one id. */
export const duplicateWorkshopPayload: RawGameDataPayload = withWorkshops([
  { uid: 'syn-workbench', label: 'First', needs: [] },
  { uid: 'syn-workbench', label: 'Second', needs: [] },
])

/** Invalid: two project targets share one id. */
export const duplicateProjectPayload: RawGameDataPayload = withProjects([
  { uid: 'syn-shelter', label: 'First', needs: [] },
  { uid: 'syn-shelter', label: 'Second', needs: [] },
])

/** Invalid: item with an empty id. */
export const emptyItemIdPayload: RawGameDataPayload = withItems([
  { uid: '', label: 'Nameless' },
])

/** Invalid: item with a blank name. */
export const emptyItemNamePayload: RawGameDataPayload = withItems([
  { uid: 'syn-blank', label: '   ' },
])

/** Invalid: quest with an empty id. */
export const emptyQuestIdPayload: RawGameDataPayload = withQuests([
  { uid: '', label: 'Nameless Quest', needs: [] },
])

/** Invalid: requirement references an item id absent from the dataset. */
export const unknownReferencePayload: RawGameDataPayload = withQuests([
  {
    uid: 'syn-quest-recon',
    label: 'Synthetic Recon',
    needs: [{ ref: 'syn-ghost-part', qty: 1 }],
  },
])

/** Invalid: negative requirement quantity. */
export const negativeQuantityPayload: RawGameDataPayload = withQuests([
  {
    uid: 'syn-quest-recon',
    label: 'Synthetic Recon',
    needs: [{ ref: 'syn-wire', qty: -2 }],
  },
])

/** Invalid: zero requirement quantity. */
export const zeroQuantityPayload: RawGameDataPayload = withQuests([
  {
    uid: 'syn-quest-recon',
    label: 'Synthetic Recon',
    needs: [{ ref: 'syn-wire', qty: 0 }],
  },
])

/** Invalid: fractional requirement quantity. */
export const fractionalQuantityPayload: RawGameDataPayload = withQuests([
  {
    uid: 'syn-quest-recon',
    label: 'Synthetic Recon',
    needs: [{ ref: 'syn-wire', qty: 1.5 }],
  },
])

/** Invalid: negative dataset capture timestamp. */
export const invalidTimestampPayload: RawGameDataPayload = withMetadata({
  origin: FIXTURE_SOURCE_ID,
  revision: FIXTURE_DATASET_VERSION,
  generatedAt: -1,
})

/** Invalid: empty dataset origin identifier. */
export const invalidMetadataPayload: RawGameDataPayload = withMetadata({
  origin: '',
  revision: FIXTURE_DATASET_VERSION,
  generatedAt: FIXTURE_CAPTURED_AT,
})

/** Invalid: requirement references an empty item id with a positive quantity. */
export const emptyRequirementRefPayload: RawGameDataPayload = withQuests([
  {
    uid: 'syn-quest-recon',
    label: 'Synthetic Recon',
    needs: [{ ref: '', qty: 1 }],
  },
])

/** Invalid: dataset origin disagrees with the loading source identity. */
export const originMismatchPayload: RawGameDataPayload = withMetadata({
  origin: 'foreign-origin',
  revision: FIXTURE_DATASET_VERSION,
  generatedAt: FIXTURE_CAPTURED_AT,
  staleAfter: FIXTURE_STALE_AFTER,
})

/** Invalid: staleAfter precedes the capture timestamp. */
export const staleBeforeCapturePayload: RawGameDataPayload = withMetadata({
  origin: FIXTURE_SOURCE_ID,
  revision: FIXTURE_DATASET_VERSION,
  generatedAt: FIXTURE_CAPTURED_AT,
  staleAfter: FIXTURE_CAPTURED_AT - 1,
})

/** Valid: staleAfter equals the capture timestamp. */
export const staleEqualCapturePayload: RawGameDataPayload = withMetadata({
  origin: FIXTURE_SOURCE_ID,
  revision: FIXTURE_DATASET_VERSION,
  generatedAt: FIXTURE_CAPTURED_AT,
  staleAfter: FIXTURE_CAPTURED_AT,
})

/** Invalid: item collection holds a non-object record. */
export const malformedRecordPayload: RawGameDataPayload = withItems(['not-an-object'])

/** Invalid: quest collection is not an array. */
export const malformedCollectionPayload: RawGameDataPayload = withQuests({})
