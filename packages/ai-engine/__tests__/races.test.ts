import { describe, it, expect } from 'vitest'
import {
  createModelManager,
  type ModelManager,
} from '../index'
import {
  FAKE_DESCRIPTOR,
  FakeArtifactStore,
  FakeModelSession,
  FakeRuntime,
  ScriptedGamingModeSource,
  SUPPORTED_CAPABILITIES,
} from '../fakes'

function setup(): {
  manager: ModelManager
  runtime: FakeRuntime
  store: FakeArtifactStore
  source: ScriptedGamingModeSource
} {
  const runtime = new FakeRuntime()
  const store = new FakeArtifactStore()
  const source = new ScriptedGamingModeSource('INACTIVE')
  const manager = createModelManager({
    descriptor: FAKE_DESCRIPTOR,
    runtime,
    store,
    capabilities: SUPPORTED_CAPABILITIES,
    gamingModeSource: source,
  })
  return { manager, runtime, store, source }
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

describe('Races — stale load resource cleanup', () => {
  async function installedContext(): Promise<ReturnType<typeof setup>> {
    const context = setup()
    const installed = await context.manager.install()
    if (installed.state !== 'INSTALLED') throw new Error('expected INSTALLED fixture')
    return context
  }

  async function waitForLoadCalls(runtime: FakeRuntime, count: number): Promise<void> {
    while (runtime.loadCalls < count) {
      await Promise.resolve()
    }
  }

  function sessionAt(runtime: FakeRuntime, index: number): FakeModelSession {
    const session = runtime.sessions[index]
    if (session === undefined) throw new Error('expected session')
    return session
  }

  it('disposes the stale session after remove preempts a held load', async () => {
    const { manager, runtime, store } = await installedContext()
    runtime.holdLoads = true
    const pending = manager.load()
    await waitForLoadCalls(runtime, 1)
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    runtime.releaseLoads()
    await pending
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(sessionAt(runtime, 0).released).toBe(true)
    expect(sessionAt(runtime, 0).disposeCalls).toBe(1)
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })

  it('disposes the stale session after unload preempts a held load', async () => {
    const { manager, runtime } = await installedContext()
    runtime.holdLoads = true
    const pending = manager.load()
    await waitForLoadCalls(runtime, 1)
    const unloaded = await manager.unload()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    await pending
    expect(manager.snapshot().state).toBe('INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(sessionAt(runtime, 0).released).toBe(true)
    expect(runtime.acquired).toBe(false)
  })

  it('disposes the stale session on ACTIVE fail-safe during a held load', async () => {
    const { manager, runtime, source } = await installedContext()
    runtime.holdLoads = true
    const pending = manager.load()
    await waitForLoadCalls(runtime, 1)
    source.status = 'ACTIVE'
    const unloaded = await manager.refreshGamingMode()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    await pending
    expect(manager.snapshot().state).toBe('INSTALLED')
    expect(manager.snapshot().gamingMode).toBe('ACTIVE')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(sessionAt(runtime, 0).released).toBe(true)
    expect(runtime.acquired).toBe(false)
  })

  it('disposes the stale session on UNKNOWN fail-safe during a held load', async () => {
    const { manager, runtime, source } = await installedContext()
    runtime.holdLoads = true
    const pending = manager.load()
    await waitForLoadCalls(runtime, 1)
    source.status = 'UNKNOWN'
    const unloaded = await manager.refreshGamingMode()
    expect(unloaded.state).toBe('INSTALLED')
    runtime.releaseLoads()
    await pending
    expect(manager.snapshot().state).toBe('INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(sessionAt(runtime, 0).released).toBe(true)
    expect(runtime.acquired).toBe(false)
  })

  it('never lets stale cleanup destroy a newer legitimate session', async () => {
    const { manager, runtime, store } = await installedContext()
    runtime.holdLoads = true
    const pendingA = manager.load()
    await waitForLoadCalls(runtime, 1)
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    runtime.holdLoads = false
    await manager.install()
    runtime.holdLoads = true
    const pendingB = manager.load()
    await waitForLoadCalls(runtime, 2)
    runtime.releaseLoads()
    const [, settledB] = await Promise.all([pendingA, pendingB])
    expect(manager.snapshot().state).toBe('READY')
    expect(settledB.state).toBe('READY')
    expect(sessionAt(runtime, 0).released).toBe(true)
    expect(sessionAt(runtime, 0).disposeCalls).toBe(1)
    expect(sessionAt(runtime, 1).released).toBe(false)
    expect(sessionAt(runtime, 1).disposeCalls).toBe(0)
    expect(runtime.acquired).toBe(true)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
  })
})
describe('Races — remove operation ownership', () => {
  async function installedContext(): Promise<ReturnType<typeof setup>> {
    const context = setup()
    const installed = await context.manager.install()
    if (installed.state !== 'INSTALLED') throw new Error('expected INSTALLED fixture')
    return context
  }

  // Async functions never settle synchronously, so calling load()
  // synchronously after remove() guarantees remove is still in flight
  // with exclusive ownership. No timers or holds are needed for the
  // adversarial ordering below.
  it('blocks a concurrent load while remove holds the operation', async () => {
    const { manager, runtime, store } = await installedContext()
    const removing = manager.remove()
    const blocked = await manager.load()
    expect(blocked.state).toBe('INSTALLED')
    expect(runtime.loadCalls).toBe(0)
    const removed = await removing
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(removed.installed).toBe(false)
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })

  it('blocks a concurrent load while remove runs from ERROR with artifacts', async () => {
    const { manager, runtime, store } = await installedContext()
    runtime.loadError = new Error('device lost')
    const failed = await manager.load()
    expect(failed.state).toBe('ERROR')
    runtime.loadError = undefined
    const removing = manager.remove()
    const blocked = await manager.load()
    expect(blocked.state).toBe('ERROR')
    expect(runtime.loadCalls).toBe(1)
    const removed = await removing
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
  })

  it('blocks a concurrent load while remove runs from READY', async () => {
    const { manager, runtime, store } = await installedContext()
    const ready = await manager.load()
    expect(ready.state).toBe('READY')
    const removing = manager.remove()
    const blocked = await manager.load()
    expect(blocked.state).toBe('READY')
    expect(runtime.loadCalls).toBe(1)
    const removed = await removing
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).not.toBe('READY')
  })

  it('treats a second concurrent remove as a safe no-op', async () => {
    const { manager, store } = await installedContext()
    const first = manager.remove()
    const second = await manager.remove()
    expect(second.state).toBe('INSTALLED')
    const done = await first
    expect(done.state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
    expect(store.removeCalls).toBe(1)
  })

  it('keeps remove failure authoritative against a blocked stale load', async () => {
    const { manager, runtime, store } = await installedContext()
    store.removeError = new Error('delete failed')
    const removing = manager.remove()
    const blocked = await manager.load()
    expect(blocked.state).toBe('INSTALLED')
    expect(runtime.loadCalls).toBe(0)
    const failed = await removing
    expect(failed.state).toBe('ERROR')
    expect(failed.error).toBe('remove failed')
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
    expect(manager.snapshot().state).toBe('ERROR')
  })

  it('lets refresh track status without disturbing an in-flight remove', async () => {
    const { manager, store, source } = await installedContext()
    store.holdRemoves = true
    const removing = manager.remove()
    while (!store.removeHeld) {
      await Promise.resolve()
    }
    source.status = 'ACTIVE'
    const refreshed = await manager.refreshGamingMode()
    expect(refreshed.state).toBe('INSTALLED')
    expect(refreshed.gamingMode).toBe('ACTIVE')
    store.releaseRemoves()
    expect((await removing).state).toBe('NOT_INSTALLED')
    expect(manager.snapshot().state).toBe('NOT_INSTALLED')
  })
})
