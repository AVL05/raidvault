import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  describeAiControls,
  type AiCapabilities,
  type ModelManagerSnapshot,
  type StorageReport,
} from '@raidvault/ai-engine'
import { AiStatusView } from './ai-panel'

const SUPPORTED: AiCapabilities = {
  webgpuAvailable: true,
  adapterAvailable: true,
  deviceAvailable: true,
  supported: true,
}

const UNSUPPORTED: AiCapabilities = {
  webgpuAvailable: false,
  adapterAvailable: false,
  deviceAvailable: false,
  supported: false,
  reason: 'WebGPU is not available in this browser',
}

function snapshotWith(overrides: Partial<ModelManagerSnapshot>): ModelManagerSnapshot {
  return {
    state: 'NOT_INSTALLED',
    modelId: undefined,
    installed: false,
    progress: undefined,
    error: undefined,
    gamingMode: 'UNKNOWN',
    ...overrides,
  }
}

function renderView(input: {
  readonly capabilities?: AiCapabilities
  readonly gamingMode?: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'
  readonly snapshot?: ModelManagerSnapshot
  readonly storage?: StorageReport
}): string {
  const snapshot = input.snapshot ?? snapshotWith({})
  const capabilities = input.capabilities ?? UNSUPPORTED
  const gamingMode = input.gamingMode ?? snapshot.gamingMode
  return renderToString(
    <AiStatusView
      capabilities={capabilities}
      gamingMode={gamingMode}
      snapshot={snapshot}
      storage={input.storage ?? { installed: false }}
      controls={describeAiControls(snapshot, capabilities)}
      onRefresh={() => undefined}
    />
  )
}

describe('AiStatusView', () => {
  it('renders the NOT_INSTALLED state', () => {
    const html = renderView({})
    expect(html).toContain('NOT_INSTALLED')
    expect(html).toContain('Not installed')
    expect(html).toContain('No model is configured')
    expect(html).toContain('Install')
  })

  it('renders the INSTALLED state', () => {
    const html = renderView({
      snapshot: snapshotWith({ state: 'INSTALLED', modelId: 'fake-model', installed: true }),
    })
    expect(html).toContain('INSTALLED')
    expect(html).toContain('Installed')
    expect(html).toContain('fake-model')
  })

  it('renders the READY state', () => {
    const html = renderView({
      snapshot: snapshotWith({ state: 'READY', modelId: 'fake-model', installed: true }),
    })
    expect(html).toContain('READY')
  })

  it('renders ERROR with its message', () => {
    const html = renderView({
      snapshot: snapshotWith({
        state: 'ERROR',
        modelId: 'fake-model',
        installed: false,
        error: 'install failed: disk full',
      }),
    })
    expect(html).toContain('ERROR')
    expect(html).toContain('install failed: disk full')
  })

  it('renders unsupported WebGPU with its reason', () => {
    const html = renderView({ capabilities: UNSUPPORTED })
    expect(html).toContain('Unsupported')
    expect(html).toContain('WebGPU is not available in this browser')
  })

  it('renders supported WebGPU', () => {
    const html = renderView({ capabilities: SUPPORTED })
    expect(html).toContain('Supported')
  })

  it('shows the blocked message while ACTIVE', () => {
    const html = renderView({ gamingMode: 'ACTIVE' })
    expect(html).toContain('Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN')
  })

  it('shows the blocked message while UNKNOWN', () => {
    const html = renderView({ gamingMode: 'UNKNOWN' })
    expect(html).toContain('Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN')
  })

  it('renders unknown storage without fabrication', () => {
    const html = renderView({ storage: { installed: false } })
    expect(html).toContain('Unknown')
  })

  it('disables lifecycle actions without a configured model', () => {
    const html = renderView({})
    expect(html).toContain('disabled')
    expect(html).toContain('No model is configured')
  })

  it('contains no assistant interface strings', () => {
    const html = renderView({
      capabilities: SUPPORTED,
      snapshot: snapshotWith({ state: 'READY', modelId: 'fake-model', installed: true }),
    })
    for (const forbidden of ['chat', 'Chat', 'Ask ARC', 'embedding', 'RAG']) {
      expect(html).not.toContain(forbidden)
    }
  })
})
