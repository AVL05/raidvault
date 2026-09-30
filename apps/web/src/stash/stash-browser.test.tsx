import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import type { PlayerState } from '@raidvault/domain'
import type { GameKnowledge } from '@raidvault/game-data'
import type { PlayerStateSnapshot } from '@raidvault/providers'
import { StashBrowser } from './stash-browser'
import { StashDetail } from './stash-detail'
import { UnavailablePanel } from './unavailable-panel'
import {
  buildStashRows,
  describeSnapshot,
  listCategories,
  summarizeStash,
} from './view-model'

const CAPTURED_AT = 1700000000000

const knowledge: GameKnowledge = {
  items: [
    { id: 'demo-bandage', name: 'Field Bandage', category: 'medical' },
    { id: 'demo-wire', name: 'Copper Wire', category: 'parts' },
  ],
  quests: [],
  workshops: [],
  projects: [],
  metadata: { sourceId: 'test-data', datasetVersion: 't1', capturedAt: CAPTURED_AT },
}

const state: PlayerState = {
  profile: { playerId: 'player-1' },
  stash: {
    id: 'stash-1',
    items: [
      { id: 'demo-bandage', quantity: 3 },
      { id: 'demo-relic', quantity: 1 },
    ],
    capacity: { totalSlots: 10, usedSlots: 2 },
    freshness: { capturedAt: CAPTURED_AT },
  },
  snapshotMetadata: { capturedAt: CAPTURED_AT },
}

function renderBrowser(snapshot: PlayerStateSnapshot): string {
  const rows = buildStashRows(snapshot.state, knowledge)
  return renderToString(
    <StashBrowser
      rows={rows}
      categories={listCategories(rows)}
      summary={summarizeStash(snapshot.state)}
      status={describeSnapshot(snapshot)}
    />
  )
}

function freshSnapshot(): PlayerStateSnapshot {
  return { state, providerId: 'mock-provider', fetchedAt: CAPTURED_AT, stale: false }
}

describe('StashBrowser', () => {
  it('renders item rows with names and quantities', () => {
    const html = renderBrowser(freshSnapshot())
    expect(html).toContain('Field Bandage')
    expect(html).toContain('demo-relic')
    expect(html).toContain('Quantity:')
    expect(html).toContain('Slots:')
  })

  it('shows fresh status without stale text', () => {
    const html = renderBrowser(freshSnapshot())
    expect(html).toContain('Fresh')
    expect(html).not.toContain('Stale fallback')
    expect(html).toContain('mock-provider')
  })

  it('shows stale fallback status distinctly', () => {
    const html = renderBrowser({ ...freshSnapshot(), stale: true })
    expect(html).toContain('Stale fallback')
  })

  it('renders the empty stash message', () => {
    const empty: PlayerState = {
      profile: { playerId: 'player-1' },
      stash: {
        id: 'stash-1',
        items: [],
        capacity: { totalSlots: 10, usedSlots: 0 },
        freshness: { capturedAt: CAPTURED_AT },
      },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const html = renderBrowser({ ...freshSnapshot(), state: empty })
    expect(html).toContain('Stash is empty.')
  })

  it('renders the missing stash message', () => {
    const stateless: PlayerState = {
      profile: { playerId: 'player-1' },
      snapshotMetadata: { capturedAt: CAPTURED_AT },
    }
    const html = renderBrowser({ ...freshSnapshot(), state: stateless })
    expect(html).toContain('No stash in this snapshot.')
  })
})

describe('StashDetail', () => {
  it('shows detail data for a known item', () => {
    const rows = buildStashRows(state, knowledge)
    const row = rows[0]
    if (row === undefined) throw new Error('expected row')
    const html = renderToString(<StashDetail row={row} />)
    expect(html).toContain('demo-bandage')
    expect(html).toContain('Field Bandage')
    expect(html).toContain('medical')
    expect(html).toContain('Known')
  })

  it('falls back safely for unknown metadata', () => {
    const rows = buildStashRows(state, knowledge)
    const row = rows[1]
    if (row === undefined) throw new Error('expected row')
    const html = renderToString(<StashDetail row={row} />)
    expect(html).toContain('demo-relic')
    expect(html).toContain('Unknown')
  })

  it('prompts when nothing is selected', () => {
    const html = renderToString(<StashDetail row={null} />)
    expect(html).toContain('Select an item to see details.')
  })
})

describe('UnavailablePanel', () => {
  it('renders an explicit unavailable state', () => {
    const html = renderToString(
      <UnavailablePanel title="Stash unavailable" detail="provider mock-provider is unavailable" />
    )
    expect(html).toContain('Stash unavailable')
    expect(html).toContain('provider mock-provider is unavailable')
  })
})
