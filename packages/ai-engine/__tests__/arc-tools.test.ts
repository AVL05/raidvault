import { describe, it, expect } from 'vitest'
import { createArcAiTools } from '../index'
import { testContext } from './helpers'

describe('ARC tools — read-only surface', () => {
  it('reads an exact player summary without mutation surface', () => {
    const tools = createArcAiTools(testContext())
    const summary = tools.getPlayerState()
    expect(summary).toEqual({
      hasStash: true,
      itemCount: 2,
      providerId: 'mock-provider',
      stale: false,
    })
    expect(JSON.parse(JSON.stringify(summary))).toEqual(summary)
  })

  it('reads exact item analysis by ID', () => {
    const tools = createArcAiTools(testContext())
    const fact = tools.getItemAnalysis('arc-wire')
    expect(fact?.owned).toBe(2)
    expect(fact?.missing).toBe(3)
    expect(fact?.classification).toBe('RESERVE')
    expect(tools.getItemAnalysis('arc-ghost')).toBeUndefined()
  })

  it('reads exact quest needs', () => {
    const tools = createArcAiTools(testContext())
    const needs = tools.getQuestNeeds()
    expect(needs).toHaveLength(1)
    expect(needs[0]?.targetId).toBe('arc-quest')
    expect(needs[0]?.requirements).toEqual([
      {
        targetType: 'QUEST',
        targetId: 'arc-quest',
        itemId: 'arc-wire',
        requiredForTarget: 5,
        owned: 2,
        missingForTarget: 3,
      },
    ])
  })

  it('reads exact project needs', () => {
    const tools = createArcAiTools(testContext())
    const needs = tools.getProjectNeeds()
    expect(needs).toHaveLength(1)
    expect(needs[0]?.targetId).toBe('arc-project')
  })

  it('reads exact raid priorities', () => {
    const tools = createArcAiTools(testContext())
    const priorities = tools.getRaidPriorities()
    expect(priorities).toHaveLength(1)
    expect(priorities[0]).toEqual({
      rank: 1,
      itemId: 'arc-wire',
      displayName: 'Arc Wire',
      missing: 3,
      sourceTargetIds: ['arc-quest'],
    })
  })

  it('searches knowledge deterministically within bounds', () => {
    const tools = createArcAiTools(testContext())
    const first = tools.searchGameKnowledge('arc')
    const second = tools.searchGameKnowledge('arc')
    expect(first).toEqual(second)
    expect(first.length).toBeLessThanOrEqual(10)
    expect(first[0]?.itemId).toBe('arc-wire')
    expect(tools.searchGameKnowledge('   ')).toEqual([])
  })

  it('prefers exact ID matches in search ordering', () => {
    const tools = createArcAiTools(testContext())
    const results = tools.searchGameKnowledge('arc-cell')
    expect(results[0]?.itemId).toBe('arc-cell')
  })

  it('exposes no mutation-capable tool', () => {
    const tools = createArcAiTools(testContext())
    for (const name of Object.keys(tools)) {
      expect(name).not.toMatch(/^(set|update|delete|sell|recycle|equip|execute|send|write|refresh|fetch)/i)
    }
  })

  it('exposes no system, process, or network tool', () => {
    const tools = createArcAiTools(testContext())
    for (const name of Object.keys(tools)) {
      expect(name).not.toMatch(/(shell|process|network|fetch|socket|storage|credential|websocket)/i)
    }
    const priorities = tools.getRaidPriorities()
    expect(JSON.parse(JSON.stringify(priorities))).toEqual(priorities)
  })
})
