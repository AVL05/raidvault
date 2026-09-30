import { describe, it, expect } from 'vitest'
import {
  createBundledGameDataSource,
  loadGameKnowledge,
  type GameDataError,
  type GameDataResult,
  type GameDataSource,
} from '../index'
import * as publicApi from '../index'

import {
  FIXTURE_CAPTURED_AT,
  FIXTURE_DATASET_VERSION,
  FIXTURE_SOURCE_ID,
  FIXTURE_STALE_AFTER,
  duplicateItemPayload,
  duplicateProjectPayload,
  duplicateQuestPayload,
  duplicateWorkshopPayload,
  emptyItemIdPayload,
  emptyItemNamePayload,
  emptyQuestIdPayload,
  expectedGameKnowledge,
  fractionalQuantityPayload,
  invalidMetadataPayload,
  invalidTimestampPayload,
  malformedCollectionPayload,
  malformedRecordPayload,
  minimalSourcePayload,
  negativeQuantityPayload,
  questWithoutNeedsPayload,
  unknownReferencePayload,
  validSourcePayload,
  zeroQuantityPayload,
} from '../fixtures'

// ---- Discriminated-union narrowing helpers ----

function assertSuccess<T>(result: GameDataResult<T>): asserts result is { success: true; value: T } {
  if (result.success !== true) throw new Error('expected success')
}

function assertFailure<T>(result: GameDataResult<T>): asserts result is { success: false; error: GameDataError } {
  if (result.success !== false) throw new Error('expected failure')
}

function loadPayload(payload: unknown) {
  return loadGameKnowledge(createBundledGameDataSource(FIXTURE_SOURCE_ID, payload))
}

// ---- Valid datasets ----

describe('GameData — valid datasets', () => {
  it('normalizes a valid deterministic source successfully', async () => {
    const result = await loadPayload(validSourcePayload)
    assertSuccess(result)
    expect(result.value).toEqual(expectedGameKnowledge)
  })

  it('normalizes a minimal empty dataset successfully', async () => {
    const result = await loadPayload(minimalSourcePayload)
    assertSuccess(result)
    expect(result.value.items).toEqual([])
    expect(result.value.quests).toEqual([])
    expect(result.value.workshops).toEqual([])
    expect(result.value.projects).toEqual([])
    expect(result.value.metadata.staleAfter).toBeUndefined()
  })

  it('normalizes a target without a needs list to empty requirements', async () => {
    const result = await loadPayload(questWithoutNeedsPayload)
    assertSuccess(result)
    expect(result.value.quests).toHaveLength(1)
    if (result.value.quests[0] === undefined) throw new Error('expected quest')
    expect(result.value.quests[0].requirements).toEqual([])
  })

  it('preserves source and version metadata', async () => {
    const result = await loadPayload(validSourcePayload)
    assertSuccess(result)
    expect(result.value.metadata).toEqual({
      sourceId: FIXTURE_SOURCE_ID,
      datasetVersion: FIXTURE_DATASET_VERSION,
      capturedAt: FIXTURE_CAPTURED_AT,
      staleAfter: FIXTURE_STALE_AFTER,
    })
  })

  it('produces deterministic normalized output', async () => {
    const first = await loadPayload(validSourcePayload)
    const second = await loadPayload(validSourcePayload)
    assertSuccess(first)
    assertSuccess(second)
    expect(second.value).toEqual(first.value)
    expect(second.value).toEqual(expectedGameKnowledge)
  })
})

// ---- Duplicate identifiers ----

describe('GameData — duplicate identifiers', () => {
  it('rejects a duplicate item id', async () => {
    const result = await loadPayload(duplicateItemPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('duplicate item id')
  })

  it('rejects a duplicate quest id', async () => {
    const result = await loadPayload(duplicateQuestPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('duplicate quest id')
  })

  it('rejects a duplicate workshop target id', async () => {
    const result = await loadPayload(duplicateWorkshopPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('duplicate workshop id')
  })

  it('rejects a duplicate project target id', async () => {
    const result = await loadPayload(duplicateProjectPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('duplicate project id')
  })
})

// ---- Required identifiers and names ----

describe('GameData — required identifiers and names', () => {
  it('rejects an empty item id', async () => {
    const result = await loadPayload(emptyItemIdPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid item id')
  })

  it('rejects a blank item name', async () => {
    const result = await loadPayload(emptyItemNamePayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid item name')
  })

  it('rejects an empty quest id', async () => {
    const result = await loadPayload(emptyQuestIdPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid quest id')
  })
})

// ---- Requirement quantities and references ----

describe('GameData — requirements', () => {
  it('rejects an unknown item reference', async () => {
    const result = await loadPayload(unknownReferencePayload)
    assertFailure(result)
    expect(result.error.kind).toBe('reference-error')
    expect(result.error.message).toContain('unknown item reference')
  })

  it('rejects a negative requirement quantity', async () => {
    const result = await loadPayload(negativeQuantityPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid requirement quantity')
  })

  it('rejects a zero requirement quantity', async () => {
    const result = await loadPayload(zeroQuantityPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid requirement quantity')
  })

  it('rejects a fractional requirement quantity', async () => {
    const result = await loadPayload(fractionalQuantityPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('invalid requirement quantity')
  })
})

// ---- Metadata, malformed records, source failures ----

describe('GameData — metadata and source boundary', () => {
  it('rejects an invalid dataset timestamp', async () => {
    const result = await loadPayload(invalidTimestampPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('generatedAt')
  })

  it('rejects invalid dataset metadata', async () => {
    const result = await loadPayload(invalidMetadataPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('origin')
  })

  it('rejects a malformed record', async () => {
    const result = await loadPayload(malformedRecordPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('expected an object')
  })

  it('rejects a malformed collection', async () => {
    const result = await loadPayload(malformedCollectionPayload)
    assertFailure(result)
    expect(result.error.kind).toBe('validation-error')
    expect(result.error.message).toContain('must be an array')
  })

  it('reports a source failure distinctly', async () => {
    const failingSource: GameDataSource = {
      sourceId: 'failing-source',
      load: () => Promise.reject(new Error('boom')),
    }
    const result = await loadGameKnowledge(failingSource)
    assertFailure(result)
    expect(result.error.kind).toBe('source-error')
    expect(result.error.message).toContain('source load failed')
  })

  it('does not leak raw source DTOs through the public model', async () => {
    const leaked = Object.keys(publicApi).filter((key) => key.startsWith('Raw'))
    expect(leaked).toEqual([])
    const result = await loadPayload(validSourcePayload)
    assertSuccess(result)
    const serialized = JSON.stringify(result.value)
    for (const rawKey of [
      '"uid"',
      '"label"',
      '"klass"',
      '"ref"',
      '"qty"',
      '"needs"',
      '"origin"',
      '"revision"',
      '"generatedAt"',
    ]) {
      expect(serialized).not.toContain(rawKey)
    }
  })
})
