import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ClassificationBadge, ProgressBar, StatusChip } from '../ui/vault'
import { enrichRows } from '../stash/analysis-model'
import { buildStashRows, summarizeStash, describeSnapshot, listCategories } from '../stash/view-model'
import { Overview } from '../overview/overview'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'

const CAPTURED_AT = 1700000000000

const knowledge: GameKnowledge = {
  items: [{ id: 'demo-wire', name: 'Copper Wire', category: 'parts' }],
  quests: [
    {
      id: 'demo-quest',
      name: 'Demo Quest',
      requirements: [{ itemId: 'demo-wire', quantity: 2 }],
    },
  ],
  workshops: [],
  projects: [],
  metadata: { sourceId: 'test', datasetVersion: 't1', capturedAt: CAPTURED_AT },
}

const state: PlayerState = {
  profile: { playerId: 'player-1' },
  stash: {
    id: 'stash-1',
    items: [{ id: 'demo-wire', quantity: 5 }],
    capacity: { totalSlots: 10, usedSlots: 1 },
    freshness: { capturedAt: CAPTURED_AT },
  },
  questProgress: [{ questId: 'demo-quest', state: 'active', quantities: [] }],
  snapshotMetadata: { capturedAt: CAPTURED_AT },
}

describe('Tactical design foundations', () => {
  it.each(['KEEP', 'RESERVE', 'SELL', 'RECYCLE', 'REVIEW'] as const)(
    'renders classification %s as text, never color-only',
    (value) => {
      const html = renderToString(<ClassificationBadge value={value} />)
      expect(html).toContain(value)
    },
  )

  it('renders status chips with text', () => {
    const html = renderToString(<StatusChip tone="amber">Gaming Unknown</StatusChip>)
    expect(html).toContain('Gaming Unknown')
  })

  it('exposes deterministic progress through aria, not color', () => {
    const html = renderToString(<ProgressBar owned={1} required={4} label="Demo progress" />)
    expect(html).toContain('role="progressbar"')
    expect(html).toContain('aria-valuetext="1 of 4"')
    expect(html).toContain('25%')
  })

  it('defaults to REVIEW when analysis is missing', () => {
    const rows = buildStashRows(state, knowledge)
    const enriched = enrichRows(rows, { items: [], hasStash: true })
    expect(enriched[0]?.classification).toBe('REVIEW')
  })
})

describe('Overview composition', () => {
  function overviewHtml(stale: boolean): string {
    const snapshot = { state, providerId: 'mock-provider', fetchedAt: CAPTURED_AT, stale }
    const rows = buildStashRows(state, knowledge)
    const analysis = analyzeStash(state, knowledge)
    const planning = buildPlanningSnapshot(state, knowledge)
    return renderToString(
      <Overview
        data={{
          rows: enrichRows(rows, analysis),
          categories: listCategories(rows),
          summary: summarizeStash(state),
          status: describeSnapshot(snapshot),
          planning,
          analysis,
        }}
      />,
    )
  }

  it('shows occupancy, reserve, missing, and fresh state', () => {
    const html = overviewHtml(false)
    expect(html).toContain('Stash occupancy')
    expect(html).toContain('Reserved requirements')
    expect(html).toContain('Missing requirements')
    expect(html).toContain('Fresh')
    expect(html).toContain('aria-valuetext="1 of 10"')
  })

  it('marks stale snapshots distinctly and keeps Gaming/AI truthful', () => {
    const html = overviewHtml(true)
    expect(html).toContain('Stale fallback')
    expect(html).toContain('Gaming Mode')
    expect(html).toContain('Unknown')
    expect(html).toContain('Locked')
    expect(html).toContain('Not connected')
    expect(html).toContain('Unsupported')
  })

  it('renders raid priorities and stash sample without inventing recency', () => {
    const html = overviewHtml(false)
    expect(html).toContain('Current raid priorities')
    expect(html).toContain('stash order')
    expect(html).toContain('no live account integration')
    for (const forbidden of ['live provider data', 'Live provider', 'real-time loot']) {
      expect(html).not.toContain(forbidden)
    }
  })
})
