import { describe, it, expect } from 'vitest'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import {
  MAX_CHAT_MESSAGES,
  MAX_MESSAGE_CHARS,
  MODEL_UNAVAILABLE_MESSAGE,
  buildVerifiedAiContext,
  createArcAiController,
  type ArcAiController,
  type GamingModeSource,
} from '../index'
import {
  FakeTextGenerationSession,
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
  it('answers factual questions without invoking any model', async () => {
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
    const state = testState()
    const knowledge = testKnowledge()
    const changed = {
      ...state,
      stash:
        state.stash === undefined
          ? undefined
          : { ...state.stash, items: [{ id: 'arc-wire', quantity: 9 }] },
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
