import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { PlanningSnapshot } from '@raidvault/rules-engine'
import { PlanningSection } from './planning-section'

function basePlanning(overrides: Partial<PlanningSnapshot>): PlanningSnapshot {
  return {
    hasStash: true,
    targets: [],
    missingItems: [],
    raidPriorities: [],
    incompleteReferences: [],
    workshopPlanningSupported: false,
    ...overrides,
  }
}

function renderPlanning(overrides: Partial<PlanningSnapshot>): string {
  return renderToString(<PlanningSection planning={basePlanning(overrides)} />)
}

const questTarget = {
  targetType: 'QUEST' as const,
  targetId: 'qa',
  targetName: 'Quest qa',
  complete: false,
  requirements: [
    {
      targetType: 'QUEST' as const,
      targetId: 'qa',
      itemId: 'plan-wire',
      requiredForTarget: 5,
      owned: 2,
      missingForTarget: 3,
    },
  ],
}

describe('PlanningSection', () => {
  it('renders current targets with completion status', () => {
    const html = renderPlanning({ targets: [questTarget] })
    expect(html).toContain('Current targets')
    expect(html).toContain('Quest qa')
    expect(html).toContain('Incomplete')
    expect(html).toContain('plan-wire')
  })

  it('renders missing items with totals and sources', () => {
    const html = renderPlanning({
      targets: [questTarget],
      missingItems: [
        {
          itemId: 'plan-wire',
          displayName: 'Plan Wire',
          totalMissing: 3,
          sourceTypes: ['QUEST'],
          sourceTargetIds: ['qa'],
        },
      ],
    })
    expect(html).toContain('Missing items')
    expect(html).toContain('Plan Wire')
    expect(html).toContain('Missing:')
  })

  it('renders ranked raid priorities in order', () => {
    const html = renderPlanning({
      targets: [questTarget],
      missingItems: [
        {
          itemId: 'plan-wire',
          displayName: 'Plan Wire',
          totalMissing: 3,
          sourceTypes: ['QUEST'],
          sourceTargetIds: ['qa'],
        },
      ],
      raidPriorities: [
        {
          rank: 1,
          itemId: 'plan-wire',
          displayName: 'Plan Wire',
          missing: 3,
          sourceTargetIds: ['qa'],
        },
      ],
    })
    expect(html).toContain('Next raid priorities')
    expect(html).toContain('Plan Wire')
  })

  it('shows the no-current-requirements state', () => {
    const html = renderPlanning({})
    expect(html).toContain('No current requirements.')
  })

  it('shows the all-complete state', () => {
    const html = renderPlanning({
      targets: [{ ...questTarget, complete: true }],
    })
    expect(html).toContain('All current requirements are satisfied.')
  })

  it('shows planning unavailable without a stash', () => {
    const html = renderPlanning({ hasStash: false })
    expect(html).toContain('Planning unavailable')
  })

  it('lists unknown current progression references', () => {
    const html = renderPlanning({
      incompleteReferences: [{ targetType: 'QUEST', targetId: 'ghost-quest' }],
    })
    expect(html).toContain('Incomplete references')
    expect(html).toContain('ghost-quest')
  })

  it('states that workshop planning is unsupported', () => {
    const html = renderPlanning({})
    expect(html).toContain('Workshop planning is not supported yet.')
  })
})
