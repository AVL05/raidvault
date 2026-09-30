import { describe, it, expect } from 'vitest'
import {
  GAMING_MODE_BLOCKED_MESSAGE,
  describeAiControls,
  detectAiCapabilities,
  fetchGamingModeStatus,
  type AiCapabilities,
  type ModelManagerSnapshot,
} from '../index'
import {
  FakeGpuDevice,
  SUPPORTED_CAPABILITIES,
  failingFetch,
  gpuEnvAbsent,
  gpuEnvAdapterThrows,
  gpuEnvNoAdapter,
  gpuEnvNoDevice,
  gpuEnvNullDevice,
  gpuEnvSupported,
  hangingFetch,
  jsonFetch,
} from '../fakes'

function snapshotWith(overrides: Partial<ModelManagerSnapshot>): ModelManagerSnapshot {
  return {
    state: 'NOT_INSTALLED',
    modelId: 'fake-model',
    installed: false,
    progress: undefined,
    error: undefined,
    gamingMode: 'INACTIVE',
    ...overrides,
  }
}

describe('Capabilities — WebGPU feature detection', () => {
  it('reports unsupported without a GPU surface', async () => {
    const capabilities = await detectAiCapabilities(gpuEnvAbsent())
    expect(capabilities).toEqual({
      webgpuAvailable: false,
      adapterAvailable: false,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU is not available in this browser',
    })
  })

  it('reports unsupported when adapter acquisition resolves null', async () => {
    const capabilities = await detectAiCapabilities(gpuEnvNoAdapter())
    expect(capabilities.supported).toBe(false)
    expect(capabilities.adapterAvailable).toBe(false)
    expect(capabilities.reason).toBe('No WebGPU adapter is available')
  })

  it('reports unsupported when adapter acquisition throws', async () => {
    const capabilities = await detectAiCapabilities(gpuEnvAdapterThrows())
    expect(capabilities.supported).toBe(false)
    expect(capabilities.reason).toBe('WebGPU adapter request failed')
  })

  it('reports unsupported when device acquisition throws', async () => {
    const capabilities = await detectAiCapabilities(gpuEnvNoDevice())
    expect(capabilities.supported).toBe(false)
    expect(capabilities.webgpuAvailable).toBe(true)
    expect(capabilities.adapterAvailable).toBe(true)
    expect(capabilities.deviceAvailable).toBe(false)
    expect(capabilities.reason).toBe('WebGPU device acquisition failed')
  })

  it('reports unsupported when device acquisition resolves null', async () => {
    const capabilities = await detectAiCapabilities(gpuEnvNullDevice())
    expect(capabilities.supported).toBe(false)
    expect(capabilities.deviceAvailable).toBe(false)
  })

  it('reports supported for a working adapter and device', async () => {
    const device = new FakeGpuDevice()
    const capabilities = await detectAiCapabilities(gpuEnvSupported(device))
    expect(capabilities).toEqual({
      webgpuAvailable: true,
      adapterAvailable: true,
      deviceAvailable: true,
      supported: true,
    })
    expect(device.destroyCalls).toBe(1)
  })
})

describe('Bridge status client', () => {
  it('accepts the three M7 gaming-mode values', async () => {
    for (const mode of ['ACTIVE', 'INACTIVE', 'UNKNOWN'] as const) {
      const status = await fetchGamingModeStatus(
        'http://127.0.0.1:39313',
        jsonFetch({ gamingMode: mode }),
        1000
      )
      expect(status).toBe(mode)
    }
  })

  it('maps malformed payloads to UNKNOWN', async () => {
    for (const payload of [
      { gamingMode: 'BOGUS' },
      {},
      { gamingMode: 42 },
      'gaming-mode',
      null,
      [{ gamingMode: 'ACTIVE' }],
    ]) {
      const status = await fetchGamingModeStatus(
        'http://127.0.0.1:39313',
        jsonFetch(payload),
        1000
      )
      expect(status).toBe('UNKNOWN')
    }
  })

  it('maps non-OK responses to UNKNOWN', async () => {
    const status = await fetchGamingModeStatus(
      'http://127.0.0.1:39313',
      jsonFetch({ gamingMode: 'INACTIVE' }, false),
      1000
    )
    expect(status).toBe('UNKNOWN')
  })

  it('maps fetch failures to UNKNOWN', async () => {
    const status = await fetchGamingModeStatus(
      'http://127.0.0.1:39313',
      failingFetch(),
      1000
    )
    expect(status).toBe('UNKNOWN')
  })

  it('maps a hanging fetch to UNKNOWN through the timeout', async () => {
    const status = await fetchGamingModeStatus(
      'http://127.0.0.1:39313',
      hangingFetch(),
      10
    )
    expect(status).toBe('UNKNOWN')
  })
})

describe('Controls — transition validity', () => {
  function controlsFor(
    snapshot: ModelManagerSnapshot,
    capabilities: AiCapabilities = SUPPORTED_CAPABILITIES
  ) {
    return describeAiControls(snapshot, capabilities)
  }

  it('enables install only before installation', () => {
    expect(controlsFor(snapshotWith({})).install.disabled).toBe(false)
    expect(
      controlsFor(snapshotWith({ state: 'ERROR', installed: false })).install.disabled
    ).toBe(false)
    expect(controlsFor(snapshotWith({ state: 'INSTALLED', installed: true })).install.disabled).toBe(
      true
    )
    expect(controlsFor(snapshotWith({ state: 'READY', installed: true })).install.disabled).toBe(true)
  })

  it('disables install without a configured model', () => {
    const controls = controlsFor(snapshotWith({ modelId: undefined }))
    expect(controls.install.disabled).toBe(true)
    expect(controls.install.reason).toBe('No model is configured')
  })

  it('enables remove only with installed artifacts', () => {
    expect(
      controlsFor(snapshotWith({ state: 'INSTALLED', installed: true })).remove.disabled
    ).toBe(false)
    expect(controlsFor(snapshotWith({ state: 'READY', installed: true })).remove.disabled).toBe(false)
    expect(
      controlsFor(snapshotWith({ state: 'ERROR', installed: true })).remove.disabled
    ).toBe(false)
    expect(controlsFor(snapshotWith({})).remove.disabled).toBe(true)
  })

  it('gates load on installed state, support, and INACTIVE mode', () => {
    const installed = snapshotWith({ state: 'INSTALLED', installed: true })
    expect(controlsFor(installed).load.disabled).toBe(false)
    expect(
      controlsFor({ ...installed, modelId: undefined }).load.reason
    ).toBe('No model is configured')
    expect(controlsFor({ ...installed, state: 'READY' }).load.disabled).toBe(true)
    const unsupported = controlsFor(installed, {
      webgpuAvailable: false,
      adapterAvailable: false,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU is not available in this browser',
    })
    expect(unsupported.load.disabled).toBe(true)
    expect(unsupported.load.reason).toBe('WebGPU is not supported')
    const active = controlsFor({ ...installed, gamingMode: 'ACTIVE' })
    expect(active.load.disabled).toBe(true)
    expect(active.load.reason).toBe(GAMING_MODE_BLOCKED_MESSAGE)
    const unknown = controlsFor({ ...installed, gamingMode: 'UNKNOWN' })
    expect(unknown.load.disabled).toBe(true)
    expect(unknown.load.reason).toBe(GAMING_MODE_BLOCKED_MESSAGE)
  })

  it('enables unload only while work may exist', () => {
    expect(
      controlsFor(snapshotWith({ state: 'READY', installed: true })).unload.disabled
    ).toBe(false)
    expect(
      controlsFor(snapshotWith({ state: 'LOADING', installed: true })).unload.disabled
    ).toBe(false)
    expect(controlsFor(snapshotWith({ state: 'INSTALLED', installed: true })).unload.disabled).toBe(
      true
    )
    expect(controlsFor(snapshotWith({})).unload.disabled).toBe(true)
  })

  it('always enables refresh', () => {
    expect(controlsFor(snapshotWith({})).refresh.disabled).toBe(false)
  })
})
