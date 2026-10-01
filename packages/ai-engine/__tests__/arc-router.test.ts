import { describe, it, expect } from 'vitest'
import {
  ARC_SYSTEM_CONTRACT,
  answerFactualQuestion,
  buildGenerationRequest,
  UNKNOWN_FACT_MESSAGE,
} from '../index'
import { testContext } from './helpers'

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
