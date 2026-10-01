import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  createArcAiController,
  createStaticGamingModeSource,
  type ArcAiSnapshot,
  type TextGenerationSession,
  type VerifiedAiContext,
} from '@raidvault/ai-engine'
import { ArcAiChatView } from './arc-ai-chat'

function snapshotWith(overrides: Partial<ArcAiSnapshot>): ArcAiSnapshot {
  return {
    status: 'IDLE',
    messages: [],
    error: undefined,
    contextVersion: 'v1|test',
    gamingMode: 'UNKNOWN',
    productionAvailable: false,
    ...overrides,
  }
}

function stubSession(text: string): TextGenerationSession {
  return {
    generate: () => Promise.resolve({ text }),
    cancel: () => Promise.resolve(),
  }
}

function renderView(snapshot: ArcAiSnapshot): string {
  return renderToString(
    <ArcAiChatView
      snapshot={snapshot}
      draft=""
      onDraftChange={() => undefined}
      onSubmit={() => undefined}
      onCancel={() => undefined}
    />
  )
}

describe('ArcAiChatView', () => {
  it('shows the no-model-configured state', () => {
    const html = renderView(snapshotWith({ status: 'UNAVAILABLE' }))
    expect(html).toContain('No production model is configured')
  })

  it('shows the ACTIVE blocked state', () => {
    const html = renderView(snapshotWith({ status: 'BLOCKED', gamingMode: 'ACTIVE' }))
    expect(html).toContain('Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN')
  })

  it('shows the UNKNOWN blocked state', () => {
    const html = renderView(snapshotWith({ status: 'BLOCKED', gamingMode: 'UNKNOWN' }))
    expect(html).toContain('Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN')
  })

  it('shows the idle empty state with a prompt', () => {
    const html = renderView(snapshotWith({}))
    expect(html).toContain('Ask about stash quantities')
    expect(html).toContain('Send')
  })

  it('renders user messages', () => {
    const html = renderView(
      snapshotWith({
        messages: [{ id: 'msg-1', role: 'USER', content: 'How many wires?' }],
      })
    )
    expect(html).toContain('You')
    expect(html).toContain('How many wires?')
  })

  it('renders assistant messages', () => {
    const html = renderView(
      snapshotWith({
        messages: [
          { id: 'msg-1', role: 'USER', content: 'How many wires?' },
          { id: 'msg-2', role: 'ASSISTANT', content: 'You own 2 Arc Wire.' },
        ],
      })
    )
    expect(html).toContain('ARC AI')
    expect(html).toContain('You own 2 Arc Wire.')
  })

  it('shows generating state with a cancel control', () => {
    const html = renderView(snapshotWith({ status: 'GENERATING' }))
    expect(html).toContain('Generating')
    expect(html).toContain('Cancel')
  })

  it('hides cancel when idle', () => {
    const html = renderView(snapshotWith({}))
    expect(html).not.toContain('Cancel')
  })

  it('renders error states', () => {
    const html = renderView(
      snapshotWith({ status: 'ERROR', error: 'Local AI generation failed' })
    )
    expect(html).toContain('Local AI generation failed')
  })

  it('states verified-snapshot wording', () => {
    const html = renderView(snapshotWith({}))
    expect(html).toContain('validated RaidVault snapshot')
  })

  it('contains no gameplay-control wording', () => {
    const html = renderView(
      snapshotWith({
        messages: [{ id: 'msg-1', role: 'USER', content: 'Hello' }],
      })
    )
    for (const forbidden of ['sell ', 'Sell ', 'recycle', 'equip', 'attack', 'loot']) {
      expect(html).not.toContain(forbidden)
    }
  })

  it('contains no live-game-memory wording', () => {
    const html = renderView(snapshotWith({}))
    for (const forbidden of ['live game', 'game memory', 'control ARC', 'Connected']) {
      expect(html).not.toContain(forbidden)
    }
  })
})

describe('ArcAiChat controller wiring', () => {
  const context: VerifiedAiContext = {
    version: 'v1|test',
    snapshot: { capturedAt: 1700000000000 },
    stash: { provenance: 'PLAYER_STATE', state: 'KNOWN', value: { hasStash: false } },
    items: [],
    quests: [],
    projects: [],
    raidPriorities: [],
    catalog: [],
    incompleteReferences: [],
    workshopPlanning: 'UNSUPPORTED',
  }

  it('renders controller-driven unavailable flow without a session', async () => {
    const controller = createArcAiController({
      context,
      gamingModeSource: createStaticGamingModeSource('INACTIVE'),
      sessionFactory: undefined,
    })
    const snapshot = await controller.submit('Summarize everything please.')
    expect(snapshot.status).toBe('UNAVAILABLE')
    const html = renderView(snapshot)
    expect(html).toContain('No production model is configured')
  })

  it('renders controller-driven assistant answers end to end', async () => {
    const controller = createArcAiController({
      context,
      gamingModeSource: createStaticGamingModeSource('INACTIVE'),
      sessionFactory: () => stubSession('Starter summary here.'),
    })
    const snapshot = await controller.submit('Summarize everything please.')
    expect(snapshot.status).toBe('IDLE')
    const html = renderView(snapshot)
    expect(html).toContain('Starter summary here.')
  })
})
