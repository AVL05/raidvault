import { describe, it, expect } from 'vitest'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import {
  ARC_SYSTEM_CONTRACT,
  answerFactualQuestion,
  buildGenerationRequest,
  buildVerifiedAiContext,
  UNKNOWN_FACT_MESSAGE,
  type VerifiedAiContext,
} from '../index'
import { CAPTURED_AT, testContext, testKnowledge, testState } from './helpers'

function customContext(state: PlayerState, knowledge: GameKnowledge): VerifiedAiContext {
  return buildVerifiedAiContext({
    playerState: state,
    gameKnowledge: knowledge,
    analysis: analyzeStash(state, knowledge),
    planning: buildPlanningSnapshot(state, knowledge),
    providerId: 'mock-provider',
    stale: false,
  })
}

function statelessContext(): VerifiedAiContext {
  const state: PlayerState = {
    profile: { playerId: 'player-1' },
    snapshotMetadata: { capturedAt: CAPTURED_AT },
  }
  return customContext(state, testKnowledge())
}

describe('ARC router — deterministic factual answers', () => {
  it('answers owned quantity from verified state', () => {
    const answer = answerFactualQuestion('How many arc-wire do I own?', testContext())
    expect(answer?.text).toBe('You own 2 Arc Wire.')
  })

  it('answers missing quantity from planning', () => {
    const answer = answerFactualQuestion('How many arc-wire am I missing?', testContext())
    expect(answer?.text).toBe('You are missing 3 Arc Wire.')
  })

  it('answers classification from Rules Engine facts', () => {
    const answer = answerFactualQuestion('Should I keep arc-wire?', testContext())
    expect(answer?.text).toBe('Arc Wire is classified RESERVE.')
  })

  it('explains classification from structured reasons', () => {
    const answer = answerFactualQuestion('Why should I keep arc-wire?', testContext())
    expect(answer?.text).toContain('RESERVE')
    expect(answer?.text).toContain('Required by quests: quantity 5')
  })

  it('answers the top raid priority from planning', () => {
    const answer = answerFactualQuestion('What is my top raid priority?', testContext())
    expect(answer?.text).toContain('Arc Wire')
    expect(answer?.text).toContain('3')
  })

  it('answers target completion safely', () => {
    const answer = answerFactualQuestion('Is arc-quest complete?', testContext())
    expect(answer?.text).toBe('Arc Quest is incomplete.')
  })

  it('returns explicit unknown for unresolvable items', () => {
    const answer = answerFactualQuestion('How many ghost-part do I own?', testContext())
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('returns explicit unknown for ambiguous identity without guessing', () => {
    const answer = answerFactualQuestion('How many arc do I own?', testContext())
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('defers unrecognized intents without an answer', () => {
    expect(answerFactualQuestion('Tell me a story about raiders.', testContext())).toBeUndefined()
    expect(answerFactualQuestion('', testContext())).toBeUndefined()
  })
})

describe('ARC router — priority uncertainty', () => {
  it('returns unknown for priority questions without a stash', () => {
    const answer = answerFactualQuestion('What is my top raid priority?', statelessContext())
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('returns unknown for priority questions with incomplete quest refs', () => {
    const state = testState()
    const ghosted: PlayerState = {
      ...state,
      questProgress: [{ questId: 'ghost-quest', state: 'active', quantities: [] }],
    }
    const answer = answerFactualQuestion(
      'What is my top raid priority?',
      customContext(ghosted, testKnowledge())
    )
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('returns unknown for priority questions with incomplete project refs', () => {
    const state = testState()
    const ghosted: PlayerState = {
      ...state,
      projects: [{ projectId: 'ghost-project', state: 'active', quantities: [] }],
    }
    const answer = answerFactualQuestion(
      'What is my top raid priority?',
      customContext(ghosted, testKnowledge())
    )
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('answers satisfied only for known-complete planning', () => {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [
          { id: 'arc-wire', quantity: 5 },
          { id: 'arc-cell', quantity: 3 },
        ],
        capacity: { totalSlots: 10, usedSlots: 2 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
      projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const answer = answerFactualQuestion(
      'What is my top raid priority?',
      customContext(state, testKnowledge())
    )
    expect(answer?.text).toBe('No current raid priorities. All tracked requirements are satisfied.')
  })
})

describe('ARC router — planning missing facts', () => {
  function unownedContext(): VerifiedAiContext {
    const state: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [{ id: 'arc-cell', quantity: 3 }],
        capacity: { totalSlots: 10, usedSlots: 1 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      questProgress: [{ questId: 'arc-quest', state: 'active', quantities: [] }],
      projects: [{ projectId: 'arc-project', state: 'active', quantities: [] }],
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    return customContext(state, testKnowledge())
  }

  it('answers M6 totalMissing for an unowned required item', () => {
    const answer = answerFactualQuestion('How many arc-wire am I missing?', unownedContext())
    expect(answer?.text).toBe('You are missing 5 Arc Wire.')
  })
})

describe('ARC router — conservative identity', () => {
  it('resolves exact item IDs', () => {
    const answer = answerFactualQuestion('How many arc-wire do I own?', testContext())
    expect(answer?.text).toBe('You own 2 Arc Wire.')
  })

  it('resolves exact display names', () => {
    const answer = answerFactualQuestion('How many Arc Wire do I own?', testContext())
    expect(answer?.text).toBe('You own 2 Arc Wire.')
  })

  it('matches hyphen and space spellings both ways', () => {
    const hyphen = answerFactualQuestion('Do I own arc-wire?', testContext())
    expect(hyphen?.text).toContain('Arc Wire')
    const spaced = answerFactualQuestion('Do I own Arc Wire?', testContext())
    expect(spaced?.text).toContain('Arc Wire')
  })

  it('does not resolve wire cutters to Arc Wire', () => {
    const answer = answerFactualQuestion('How many wire cutters do I own?', testContext())
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('does not resolve bare tokens', () => {
    const answer = answerFactualQuestion('How many wire do I own?', testContext())
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })

  it('does not resolve ambiguous names', () => {
    const knowledge = testKnowledge()
    const doubled: GameKnowledge = {
      ...knowledge,
      items: [
        ...knowledge.items,
        { id: 'arc-wire-spool', name: 'Arc Wire', category: 'parts' },
      ],
    }
    const answer = answerFactualQuestion('How many Arc Wire do I own?', customContext(testState(), doubled))
    expect(answer?.text).toBe(UNKNOWN_FACT_MESSAGE)
  })
})

describe('ARC prompt contract', () => {
  it('states the authority boundary deterministically', () => {
    expect(ARC_SYSTEM_CONTRACT).toContain('authoritative')
    expect(ARC_SYSTEM_CONTRACT).toContain('Never invent')
    expect(ARC_SYSTEM_CONTRACT).toContain('Gaming Mode')
    expect(ARC_SYSTEM_CONTRACT).toContain('Never override Rules Engine')
    expect(ARC_SYSTEM_CONTRACT).toContain('Unknown facts stay unknown')
  })

  it('assembles generation requests from context and history', () => {
    const context = testContext()
    const messages = [{ id: 'msg-1', role: 'USER' as const, content: 'Hello' }]
    const first = buildGenerationRequest(context, messages)
    const second = buildGenerationRequest(context, messages)
    expect(first).toEqual(second)
    expect(first.systemInstruction).toBe(ARC_SYSTEM_CONTRACT)
    expect(first.context).toBe(context)
    expect(first.messages).toEqual(messages)
  })
})
