import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_CHARS,
  MODEL_UNAVAILABLE_MESSAGE,
  buildVerifiedAiContext,
  createArcAiController,
  type ArcAiController,
  type GamingModeSource,
  type GamingModeStatus,
} from '../index'
import {
  FakeTextGenerationSession,
  HeldGamingModeSource,
  ScriptedGamingModeSource,
} from '../fakes'
import { testContext, testKnowledge, testState } from './helpers'

function chatSetup(input: {
  readonly gaming?: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  readonly gamingSource?: GamingModeSource
  readonly session?: FakeTextGenerationSession
} = {}): {
  controller: ArcAiController
  session: FakeTextGenerationSession | undefined
  source: ScriptedGamingModeSource
} {
  const session = input.session
  const source = new ScriptedGamingModeSource(input.gaming ?? 'INACTIVE')
  const controller = createArcAiController({
    context: testContext(),
    gamingModeSource: input.gamingSource ?? source,
    sessionFactory: session === undefined ? undefined : () => session,
  })
  return { controller, session, source }
}

class ThrowingGamingSource implements GamingModeSource {
  async getGamingMode(): Promise<never> {
    throw new Error('bridge unreachable')
  }
}

async function waitForGeneration(session: FakeTextGenerationSession): Promise<void> {
  while (session.generateCalls.length === 0) {
    await Promise.resolve()
  }
}

describe('ARC chat — direct answers and sessions', () => {
  it('answers factual questions without model calls', async () => {
    const session = new FakeTextGenerationSession()
    const { controller } = chatSetup({ session })
    const snapshot = await controller.submit('How many arc-wire do I own?')
    expect(snapshot.status).toBe('IDLE')
    expect(session.generateCalls).toHaveLength(0)
    const last = snapshot.messages[snapshot.messages.length - 1]
    expect(last?.role).toBe('ASSISTANT')
    expect(last?.content).toContain('You own 2')
  })

  it('generates through the session for unhandled intents', async () => {
    const session = new FakeTextGenerationSession()
    session.scriptedText = 'Here is a summary of your stash.'
    const { controller } = chatSetup({ session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('IDLE')
    expect(session.generateCalls).toHaveLength(1)
    expect(session.generateCalls[0]?.systemInstruction).toContain('authoritative')
    const last = snapshot.messages[snapshot.messages.length - 1]
    expect(last?.content).toBe('Here is a summary of your stash.')
  })

  it('reports unavailable without a production session', async () => {
    const { controller } = chatSetup({})
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('UNAVAILABLE')
    expect(snapshot.productionAvailable).toBe(false)
    const last = snapshot.messages[snapshot.messages.length - 1]
    expect(last?.content).toBe(MODEL_UNAVAILABLE_MESSAGE)
  })

  it('uses deterministic message identifiers in order', async () => {
    const { controller } = chatSetup({})
    await controller.submit('How many arc-wire do I own?')
    const snapshot = await controller.submit('How many arc-cell do I own?')
    expect(snapshot.messages.map((message) => message.id)).toEqual([
      'msg-1',
      'msg-2',
      'msg-3',
      'msg-4',
    ])
  })

  it('bounds history deterministically to the newest messages', async () => {
    const { controller } = chatSetup({})
    for (let index = 0; index < MAX_CHAT_MESSAGES + 10; index += 1) {
      await controller.submit('How many arc-wire do I own?')
    }
    const snapshot = controller.snapshot()
    expect(snapshot.messages).toHaveLength(MAX_CHAT_MESSAGES)
    const last = snapshot.messages[snapshot.messages.length - 1]
    expect(last?.role).toBe('ASSISTANT')
    expect(snapshot.messages[0]?.id).not.toBe('msg-1')
  })

  it('rejects empty input as a no-op', async () => {
    const { controller } = chatSetup({})
    const snapshot = await controller.submit('   ')
    expect(snapshot.messages).toEqual([])
    expect(snapshot.status).toBe('IDLE')
  })

  it('rejects oversized input with an explicit error', async () => {
    const { controller } = chatSetup({})
    const snapshot = await controller.submit(`x${'y'.repeat(MAX_MESSAGE_CHARS)}`)
    expect(snapshot.messages).toEqual([])
    expect(snapshot.error).toContain(`${MAX_MESSAGE_CHARS}`)
  })

  it('answers M6 missing facts without invoking any model', async () => {
    const session = new FakeTextGenerationSession()
    const state = testState()
    const unowned: PlayerState = {
      ...state,
      stash:
        state.stash === undefined
          ? undefined
          : { ...state.stash, items: [{ id: 'arc-cell', quantity: 3 }] },
    }
    const knowledge = testKnowledge()
    const controller = createArcAiController({
      context: buildVerifiedAiContext({
        playerState: unowned,
        gameKnowledge: knowledge,
        analysis: analyzeStash(unowned, knowledge),
        planning: buildPlanningSnapshot(unowned, knowledge),
      }),
      gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
      sessionFactory: () => session,
    })
    const snapshot = await controller.submit('How many arc-wire am I missing?')
    expect(snapshot.status).toBe('IDLE')
    expect(session.generateCalls).toHaveLength(0)
    const last = snapshot.messages[snapshot.messages.length - 1]
    expect(last?.content).toBe('You are missing 5 Arc Wire.')
  })

  it('turns generation failure into a fixed sanitized error', async () => {
    const session = new FakeTextGenerationSession()
    session.generateError = new Error('C:\\gpu\\driver secret-token-xyz')
    const { controller } = chatSetup({ session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('ERROR')
    expect(snapshot.error).toBe('Local AI generation failed')
  })

  it('turns empty generation output into a safe error', async () => {
    const session = new FakeTextGenerationSession()
    session.scriptedText = '   '
    const { controller } = chatSetup({ session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('ERROR')
    expect(snapshot.error).toBe('Local AI generation failed')
  })

  it('resolves a throwing session factory to a sanitized error', async () => {
    const controller = createArcAiController({
      context: testContext(),
      gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
      sessionFactory: () => {
        throw new Error('C:\\secret\\driver token-123')
      },
    })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('ERROR')
    expect(snapshot.error).toBe('Local AI generation failed')
    expect(snapshot.status).not.toBe('GENERATING')
  })
})

describe('ARC chat — Gaming Mode gating', () => {
  it('blocks generation while ACTIVE', async () => {
    const session = new FakeTextGenerationSession()
    const { controller } = chatSetup({ gaming: 'ACTIVE', session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('BLOCKED')
    expect(session.generateCalls).toHaveLength(0)
    expect(snapshot.messages).toEqual([])
  })

  it('blocks generation while UNKNOWN', async () => {
    const session = new FakeTextGenerationSession()
    const { controller } = chatSetup({ gaming: 'UNKNOWN', session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('BLOCKED')
    expect(session.generateCalls).toHaveLength(0)
  })

  it('treats Bridge failure as blocking UNKNOWN', async () => {
    const session = new FakeTextGenerationSession()
    const { controller } = chatSetup({ gamingSource: new ThrowingGamingSource(), session })
    const snapshot = await controller.submit('Summarize my stash please.')
    expect(snapshot.status).toBe('BLOCKED')
    expect(snapshot.gamingMode).toBe('UNKNOWN')
    expect(session.generateCalls).toHaveLength(0)
  })

  it('discards a late result after ACTIVE arrives mid-generation', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const source = new ScriptedGamingModeSource('INACTIVE')
    const { controller } = chatSetup({ gamingSource: source, session })
    const pending = controller.submit('Summarize my stash please.')
    expect(controller.snapshot().status).toBe('GENERATING')
    await waitForGeneration(session)
    source.status = 'ACTIVE'
    session.releaseGeneration()
    const settled = await pending
    expect(settled.status).toBe('BLOCKED')
    expect(settled.messages.filter((message) => message.role === 'ASSISTANT')).toEqual([])
  })

  it('discards a late result after UNKNOWN arrives mid-generation', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const source = new ScriptedGamingModeSource('INACTIVE')
    const { controller } = chatSetup({ gamingSource: source, session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    source.status = 'UNKNOWN'
    session.releaseGeneration()
    const settled = await pending
    expect(settled.status).toBe('BLOCKED')
    expect(settled.messages.filter((message) => message.role === 'ASSISTANT')).toEqual([])
  })

  it('cancels generation back to a safe idle state', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    expect(controller.snapshot().status).toBe('GENERATING')
    await waitForGeneration(session)
    const cancelled = await controller.cancel()
    expect(cancelled.status).toBe('IDLE')
    expect(session.cancelCalls).toBe(1)
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
  })

  it('rejects a second submit while generating', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    const rejected = await controller.submit('How many arc-wire do I own?')
    expect(rejected.status).toBe('GENERATING')
    expect(session.generateCalls).toHaveLength(1)
    session.releaseGeneration()
    await pending
  })
})

describe('ARC chat — context staleness', () => {
  it('discards answers when context changes mid-generation', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    await controller.updateContext(testContext())
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
  })

  it('never lets stale cleanup destroy a newer generation', async () => {
    const first = new FakeTextGenerationSession()
    first.holdGeneration = true
    first.scriptedText = 'stale answer'
    const second = new FakeTextGenerationSession()
    second.scriptedText = 'fresh answer'
    const made: FakeTextGenerationSession[] = []
    const controller = createArcAiController({
      context: testContext(),
      gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
      sessionFactory: () => {
        const next = made.length === 0 ? first : second
        made.push(next)
        return next
      },
    })
    const pendingFirst = controller.submit('Summarize please A.')
    expect(controller.snapshot().status).toBe('GENERATING')
    await waitForGeneration(first)
    await controller.cancel()
    expect(controller.snapshot().status).toBe('IDLE')
    const pendingSecond = controller.submit('Summarize please B.')
    first.releaseGeneration()
    const settledFirst = await pendingFirst
    const settledSecond = await pendingSecond
    expect(first.cancelCalls).toBe(1)
    expect(second.cancelCalls).toBe(0)
    expect(settledFirst.messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
    expect(
      settledSecond.messages.filter((m) => m.role === 'ASSISTANT').map((m) => m.content)
    ).toEqual(['fresh answer'])
  })

  it('answers from new facts after a context update', async () => {
    const { controller } = chatSetup({})
    const before = await controller.submit('How many arc-wire do I own?')
    expect(before.messages[before.messages.length - 1]?.content).toContain('You own 2')
    const knowledge = testKnowledge()
    const changed: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'arc-wire', quantity: 9 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: 1700000000000 },
      },
      questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
      projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
      snapshotMetadata: { capturedAt: 1700000000000 },
    }
    await controller.updateContext(
      buildVerifiedAiContext({
        playerState: changed,
        gameKnowledge: knowledge,
        analysis: analyzeStash(changed, knowledge),
        planning: buildPlanningSnapshot(changed, knowledge),
      })
    )
    const after = await controller.submit('How many arc-wire do I own?')
    expect(after.messages[after.messages.length - 1]?.content).toContain('You own 9')
  })
})

describe('ARC chat — gaming mode updates', () => {
  async function waitForGeneration(session: FakeTextGenerationSession): Promise<void> {
    while (session.generateCalls.length === 0) {
      await Promise.resolve()
    }
  }

  it('cancels a held generation immediately on ACTIVE', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    const updated = await controller.updateGamingMode('ACTIVE')
    expect(updated.status).toBe('BLOCKED')
    expect(session.cancelCalls).toBe(1)
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
    expect(controller.snapshot().status).toBe('BLOCKED')
  })

  it('cancels a held generation immediately on UNKNOWN', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    const updated = await controller.updateGamingMode('UNKNOWN')
    expect(updated.status).toBe('BLOCKED')
    expect(session.cancelCalls).toBe(1)
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
  })

  it('stays fail-safe when cancel throws during an update', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    session.cancelError = new Error('cancel exploded')
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    const updated = await controller.updateGamingMode('ACTIVE')
    expect(updated.status).toBe('BLOCKED')
    session.cancelError = undefined
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
    expect(controller.snapshot().status).toBe('BLOCKED')
  })

  it('lets a newer generation proceed after an ACTIVE interruption', async () => {
    const first = new FakeTextGenerationSession()
    first.holdGeneration = true
    first.scriptedText = 'stale answer'
    const second = new FakeTextGenerationSession()
    second.scriptedText = 'fresh answer'
    const made: FakeTextGenerationSession[] = []
    const controller = createArcAiController({
      context: testContext(),
      gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
      sessionFactory: () => {
        const next = made.length === 0 ? first : second
        made.push(next)
        return next
      },
    })
    const pendingFirst = controller.submit('Summarize please A.')
    while (first.generateCalls.length === 0) {
      await Promise.resolve()
    }
    await controller.updateGamingMode('ACTIVE')
    expect(first.cancelCalls).toBe(1)
    await controller.updateGamingMode('INACTIVE')
    expect(controller.snapshot().status).toBe('IDLE')
    const pendingSecond = controller.submit('Summarize please B.')
    first.releaseGeneration()
    const settledFirst = await pendingFirst
    const settledSecond = await pendingSecond
    expect(first.cancelCalls).toBe(1)
    expect(second.cancelCalls).toBe(0)
    expect(settledFirst.messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
    expect(
      settledSecond.messages.filter((m) => m.role === 'ASSISTANT').map((m) => m.content)
    ).toEqual(['fresh answer'])
  })

  it('does not double-cancel an already detached session', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    const { controller } = chatSetup({ session })
    const pending = controller.submit('Summarize my stash please.')
    await waitForGeneration(session)
    await controller.updateGamingMode('ACTIVE')
    expect(session.cancelCalls).toBe(1)
    await controller.updateGamingMode('ACTIVE')
    expect(session.cancelCalls).toBe(1)
    session.releaseGeneration()
    await pending
    expect(controller.snapshot().status).toBe('BLOCKED')
  })

  it('invalidates a submit held at its initial status read', async () => {
    const session = new FakeTextGenerationSession()
    const source = new HeldGamingModeSource()
    const controller = createArcAiController({
      context: testContext(),
      gamingModeSource: source,
      sessionFactory: () => session,
    })
    const pending = controller.submit('Summarize my stash please.')
    const updated = await controller.updateGamingMode('ACTIVE')
    expect(updated.status).toBe('BLOCKED')
    source.releaseAll('INACTIVE')
    const settled = await pending
    expect(settled.status).toBe('BLOCKED')
    expect(settled.gamingMode).toBe('ACTIVE')
    expect(session.generateCalls).toHaveLength(0)
    expect(settled.messages.filter((m) => m.role === 'ASSISTANT')).toEqual([])
  })

  it('invalidates UNKNOWN the same way during the initial read', async () => {
    const session = new FakeTextGenerationSession()
    const source = new HeldGamingModeSource()
    const controller = createArcAiController({
      context: testContext(),
      gamingModeSource: source,
      sessionFactory: () => session,
    })
    const pending = controller.submit('Summarize my stash please.')
    const updated = await controller.updateGamingMode('UNKNOWN')
    expect(updated.status).toBe('BLOCKED')
    source.releaseAll('INACTIVE')
    const settled = await pending
    expect(settled.status).toBe('BLOCKED')
    expect(session.generateCalls).toHaveLength(0)
  })

  it('discards answers when the final status read goes stale', async () => {
    const session = new FakeTextGenerationSession()
    session.holdGeneration = true
    let reads = 0
    const finalReads: Array<(status: GamingModeStatus) => void> = []
    const source: GamingModeSource = {
      getGamingMode: () => {
        reads += 1
        if (reads === 1) {
          return Promise.resolve('INACTIVE')
        }
        return new Promise<GamingModeStatus>((resolve) => {
          finalReads.push(resolve)
        })
      },
    }
    const { controller } = chatSetup({ gamingSource: source, session })
    const pending = controller.submit('Summarize my stash please.')
    while (session.generateCalls.length === 0) {
      await Promise.resolve()
    }
    session.releaseGeneration()
    while (finalReads.length === 0) {
      await Promise.resolve()
    }
    const updated = await controller.updateGamingMode('ACTIVE')
    expect(updated.status).toBe('BLOCKED')
    const release = finalReads.shift()
    if (release === undefined) throw new Error('expected held final read')
    release('INACTIVE')
    const settled = await pending
    expect(settled.status).toBe('BLOCKED')
    expect(settled.gamingMode).toBe('ACTIVE')
    expect(settled.messages.filter((message) => message.role === 'ASSISTANT')).toEqual([])
  })
})
