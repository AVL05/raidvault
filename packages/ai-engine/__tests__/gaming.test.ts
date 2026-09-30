import { describe, it, expect } from 'vitest'
import {
  createModelManager,
  type ModelManager,
} from '../index'
import {
  FAKE_DESCRIPTOR,
  FakeArtifactStore,
  FakeRuntime,
  ScriptedGamingModeSource,
  SUPPORTED_CAPABILITIES,
  ThrowingGamingModeSource,
} from '../fakes'

function setup(gamingStatus: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'): {
  manager: ModelManager
  runtime: FakeRuntime
  store: FakeArtifactStore
  source: ScriptedGamingModeSource
} {
  const runtime = new FakeRuntime()
  const store = new FakeArtifactStore()
  const source = new ScriptedGamingModeSource(gamingStatus)
  const manager = createModelManager({
    descriptor: FAKE_DESCRIPTOR,
    runtime,
    store,
    capabilities: SUPPORTED_CAPABILITIES,
    gamingModeSource: source,
  })
  return { manager, runtime, store, source }
}

async function readyFixture(): Promise<ReturnType<typeof setup>> {
  const context = setup('INACTIVE')
  await context.manager.install()
  const loaded = await context.manager.load()
  if (loaded.state !== 'READY') throw new Error('expected READY fixture')
  return context
}

describe('Gaming Mode — load gating', () => {
  it('allows load while INACTIVE', async () => {
    const { manager } = setup('INACTIVE')
    await manager.install()
    const loaded = await manager.load()
    expect(loaded.state).toBe('READY')
  })

  it('blocks load while ACTIVE without touching the runtime', async () => {
    const { manager, runtime } = setup('ACTIVE')
    await manager.install()
    const blocked = await manager.load()
    expect(blocked.state).toBe('INSTALLED')
    expect(runtime.loadCalls).toBe(0)
  })

  it('blocks load while UNKNOWN without touching the runtime', async () => {
    const { manager, runtime } = setup('UNKNOWN')
    await manager.install()
    const blocked = await manager.load()
    expect(blocked.state).toBe('INSTALLED')
    expect(runtime.loadCalls).toBe(0)
  })

  it('treats Bridge failure as UNKNOWN and blocks load', async () => {
    const runtime = new FakeRuntime()
    const store = new FakeArtifactStore()
    const manager = createModelManager({
      descriptor: FAKE_DESCRIPTOR,
      runtime,
      store,
      capabilities: SUPPORTED_CAPABILITIES,
      gamingModeSource: new ThrowingGamingModeSource(),
    })
    await manager.install()
    const blocked = await manager.load()
    expect(blocked.state).toBe('INSTALLED')
    expect(blocked.gamingMode).toBe('UNKNOWN')
    expect(runtime.loadCalls).toBe(0)
  })
})

describe('Gaming Mode — fail-safe unload', () => {
  it('unloads READY work when ACTIVE arrives', async () => {
    const { manager, runtime, store, source } = await readyFixture()
    source.status = 'ACTIVE'
    const unloaded = await manager.refreshGamingMode()
    expect(unloaded.state).toBe('INSTALLED')
    expect(unloaded.gamingMode).toBe('ACTIVE')
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
  })

  it('unloads READY work when UNKNOWN arrives', async () => {
    const { manager, runtime, store, source } = await readyFixture()
    source.status = 'UNKNOWN'
    const unloaded = await manager.refreshGamingMode()
    expect(unloaded.state).toBe('INSTALLED')
    expect(unloaded.gamingMode).toBe('UNKNOWN')
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
  })

  it('invalidates a stale load completion when ACTIVE arrives mid-load', async () => {
    const { manager, runtime, source } = setup('INACTIVE')
    await manager.install()
    runtime.holdLoads = true
    const pending = manager.load()
    expect(manager.snapshot().state).toBe('LOADING')
    source.status = 'ACTIVE'
    const unloaded = await manager.refreshGamingMode()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    const settled = await pending
    expect(settled.state).toBe('INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
  })

  it('invalidates a stale load completion when UNKNOWN arrives mid-load', async () => {
    const { manager, runtime, source } = setup('INACTIVE')
    await manager.install()
    runtime.holdLoads = true
    const pending = manager.load()
    source.status = 'UNKNOWN'
    await manager.refreshGamingMode()
    runtime.releaseLoads()
    const settled = await pending
    expect(settled.state).toBe('INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
  })
})
