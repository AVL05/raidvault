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
} from '../fakes'

function setup(): {
  manager: ModelManager
  runtime: FakeRuntime
  store: FakeArtifactStore
} {
  const runtime = new FakeRuntime()
  const store = new FakeArtifactStore()
  const manager = createModelManager({
    descriptor: FAKE_DESCRIPTOR,
    runtime,
    store,
    capabilities: SUPPORTED_CAPABILITIES,
    gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
  })
  return { manager, runtime, store }
}

describe('Races — stale completions', () => {
  it('keeps INSTALLED when a stale load resolves after unload', async () => {
    const { manager, runtime } = setup()
    await manager.install()
    runtime.holdLoads = true
    const pending = manager.load()
    expect(manager.snapshot().state).toBe('LOADING')
    const unloaded = await manager.unload()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    const settled = await pending
    expect(settled.state).toBe('INSTALLED')
    expect(manager.snapshot().state).toBe('INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(runtime.acquired).toBe(false)
  })

  it('keeps NOT_INSTALLED when a stale load resolves after remove', async () => {
    const { manager, runtime, store } = setup()
    await manager.install()
    runtime.holdLoads = true
    const pending = manager.load()
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    runtime.releaseLoads()
    await pending
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })

  it('creates a single runtime for two concurrent loads', async () => {
    const { manager, runtime } = setup()
    await manager.install()
    const first = manager.load()
    const second = manager.load()
    const [firstResult, secondResult] = await Promise.all([first, second])
    expect(firstResult.state).toBe('READY')
    expect(secondResult.state).toBe('LOADING')
    expect(manager.snapshot().state).toBe('READY')
    expect(runtime.loadCalls).toBe(1)
  })

  it('never lets a stale error overwrite current safe state', async () => {
    const { manager, runtime } = setup()
    await manager.install()
    runtime.holdLoads = true
    const pending = manager.load()
    runtime.loadError = new Error('late device loss')
    const unloaded = await manager.unload()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    const settled = await pending
    expect(settled.state).toBe('INSTALLED')
    expect(settled.error).toBeUndefined()
    expect(manager.snapshot().error).toBeUndefined()
  })

  it('cancels a held install deterministically on remove', async () => {
    const { manager, store } = setup()
    const pendingInstall = manager.install()
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    await pendingInstall
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })
})
