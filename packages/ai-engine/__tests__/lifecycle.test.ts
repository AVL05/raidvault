import { describe, it, expect } from 'vitest'
import {
  createModelManager,
  type AiCapabilities,
  type GamingModeStatus,
  type ModelDescriptor,
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

function setup(options: {
  readonly capabilities?: AiCapabilities
  readonly gamingStatus?: GamingModeStatus
} = {}): {
  manager: ModelManager
  runtime: FakeRuntime
  store: FakeArtifactStore
  source: ScriptedGamingModeSource
} {
  const runtime = new FakeRuntime()
  const store = new FakeArtifactStore()
  const source = new ScriptedGamingModeSource(options.gamingStatus ?? 'INACTIVE')
  const manager = createModelManager({
    descriptor: FAKE_DESCRIPTOR,
    runtime,
    store,
    capabilities: options.capabilities ?? SUPPORTED_CAPABILITIES,
    gamingModeSource: source,
  })
  return { manager, runtime, store, source }
}

function undescribed(): {
  manager: ModelManager
  runtime: FakeRuntime
  store: FakeArtifactStore
} {
  const runtime = new FakeRuntime()
  const store = new FakeArtifactStore()
  const descriptor: ModelDescriptor | undefined = undefined
  const manager = createModelManager({
    descriptor,
    runtime,
    store,
    capabilities: SUPPORTED_CAPABILITIES,
    gamingModeSource: new ScriptedGamingModeSource('INACTIVE'),
  })
  return { manager, runtime, store }
}

async function installedFixture(): Promise<ReturnType<typeof setup>> {
  const context = setup()
  const result = await context.manager.install()
  if (result.state !== 'INSTALLED') throw new Error('expected INSTALLED fixture')
  return context
}

function liveSession(runtime: FakeRuntime): FakeModelSession {
  const session = runtime.sessions[runtime.sessions.length - 1]
  if (session === undefined) throw new Error('expected a live session')
  return session
}

describe('Lifecycle — install', () => {
  it('starts NOT_INSTALLED with no side effects', () => {
    const { manager, store } = setup()
    const snapshot = manager.snapshot()
    expect(snapshot.state).toBe('NOT_INSTALLED')
    expect(snapshot.installed).toBe(false)
    expect(snapshot.modelId).toBe('fake-model')
    expect(snapshot.progress).toBeUndefined()
    expect(snapshot.error).toBeUndefined()
    expect(snapshot.gamingMode).toBe('UNKNOWN')
    expect(store.installCalls).toBe(0)
  })

  it('moves NOT_INSTALLED through INSTALLING to INSTALLED', async () => {
    const { manager, store } = setup()
    const pending = manager.install()
    expect(manager.snapshot().state).toBe('INSTALLING')
    const finished = await pending
    expect(finished.state).toBe('INSTALLED')
    expect(finished.installed).toBe(true)
    expect(finished.progress).toBeUndefined()
    expect(store.installCalls).toBe(1)
  })

  it('reports deterministic install progress', async () => {
    const { manager, store } = setup()
    await manager.install()
    expect(store.seenProgress).toEqual([0, 0.5, 1])
  })

  it('moves install failure to ERROR with recovery', async () => {
    const { manager, store } = setup()
    store.installError = new Error('disk full')
    const failed = await manager.install()
    expect(failed.state).toBe('ERROR')
    expect(failed.installed).toBe(false)
    expect(failed.error).toContain('install')
    store.installError = undefined
    const retried = await manager.install()
    expect(retried.state).toBe('INSTALLED')
    expect(retried.error).toBeUndefined()
  })

  it('rejects repeated install safely', async () => {
    const { manager, store } = setup()
    await manager.install()
    const repeated = await manager.install()
    expect(repeated.state).toBe('INSTALLED')
    expect(store.installCalls).toBe(1)
    const first = manager.install()
    const second = manager.install()
    await first
    await second
    expect(store.installCalls).toBe(1)
  })

  it('stays NOT_INSTALLED without a configured descriptor', async () => {
    const { manager, store } = undescribed()
    expect(manager.snapshot().modelId).toBeUndefined()
    const attempted = await manager.install()
    expect(attempted.state).toBe('NOT_INSTALLED')
    expect(store.installCalls).toBe(0)
  })
})

describe('Lifecycle — load', () => {
  it('moves INSTALLED through LOADING to READY', async () => {
    const { manager, runtime } = await installedFixture()
    const pending = manager.load()
    expect(manager.snapshot().state).toBe('LOADING')
    const finished = await pending
    expect(finished.state).toBe('READY')
    expect(runtime.loadCalls).toBe(1)
    expect(runtime.acquired).toBe(true)
  })

  it('moves load failure to ERROR with retry', async () => {
    const { manager, runtime } = await installedFixture()
    runtime.loadError = new Error('device lost')
    const failed = await manager.load()
    expect(failed.state).toBe('ERROR')
    expect(failed.installed).toBe(true)
    expect(failed.error).toContain('load')
    runtime.loadError = undefined
    const retried = await manager.load()
    expect(retried.state).toBe('READY')
  })

  it('never creates duplicate runtimes on repeated load', async () => {
    const { manager, runtime } = await installedFixture()
    await manager.load()
    await manager.load()
    expect(runtime.loadCalls).toBe(1)
    const first = manager.load()
    const second = manager.load()
    await first
    await second
    expect(runtime.loadCalls).toBe(1)
  })

  it('blocks load without a configured descriptor', async () => {
    const { manager, runtime } = undescribed()
    const attempted = await manager.load()
    expect(attempted.state).toBe('NOT_INSTALLED')
    expect(runtime.loadCalls).toBe(0)
  })
})

describe('Lifecycle — unload', () => {
  it('moves READY through UNLOADING to INSTALLED and releases the runtime', async () => {
    const { manager, runtime, store } = await installedFixture()
    await manager.load()
    const session = liveSession(runtime)
    const pending = manager.unload()
    expect(manager.snapshot().state).toBe('UNLOADING')
    const finished = await pending
    expect(finished.state).toBe('INSTALLED')
    expect(session.unloadCalls).toBe(1)
    expect(session.released).toBe(true)
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
  })

  it('treats repeated unload as a safe no-op', async () => {
    const { manager, runtime } = await installedFixture()
    await manager.load()
    const session = liveSession(runtime)
    await manager.unload()
    const repeated = await manager.unload()
    expect(repeated.state).toBe('INSTALLED')
    expect(session.unloadCalls).toBe(1)
  })

  it('recovers from unload failure without claiming READY', async () => {
    const { manager, runtime } = await installedFixture()
    await manager.load()
    liveSession(runtime).unloadError = new Error('release failed')
    const failed = await manager.unload()
    expect(failed.state).toBe('ERROR')
    expect(manager.snapshot().state).not.toBe('READY')
    liveSession(runtime).unloadError = undefined
    const retried = await manager.unload()
    expect(retried.state).toBe('INSTALLED')
  })
})

describe('Lifecycle — remove', () => {
  it('removes from INSTALLED back to NOT_INSTALLED', async () => {
    const { manager, store } = await installedFixture()
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(removed.installed).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })

  it('unloads first when removing from READY', async () => {
    const { manager, runtime, store } = await installedFixture()
    await manager.load()
    const session = liveSession(runtime)
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(session.unloadCalls).toBe(1)
    expect(session.disposeCalls).toBe(1)
    expect(session.released).toBe(true)
    expect(runtime.acquired).toBe(false)
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(false)
  })

  it('keeps artifacts on failed remove with an explicit error', async () => {
    const { manager, store } = await installedFixture()
    store.removeError = new Error('delete failed')
    const failed = await manager.remove()
    expect(failed.state).toBe('ERROR')
    expect(failed.error).toContain('remove')
    expect(await store.isInstalled(FAKE_DESCRIPTOR)).toBe(true)
  })

  it('treats remove without installation as a safe no-op', async () => {
    const { manager, store } = setup()
    const removed = await manager.remove()
    expect(removed.state).toBe('NOT_INSTALLED')
    expect(store.removeCalls).toBe(0)
  })

  it('exposes fixed deterministic errors without collaborator details', async () => {
    const hostile = 'C:\\Users\\victim\\secrets GPU driver internal 0xDEAD secret-token-abc'
    const { manager, runtime, store } = setup()
    store.installError = new Error(hostile)
    const installFailed = await manager.install()
    expect(installFailed.error).toBe('install failed')
    store.installError = undefined
    await manager.install()
    runtime.loadError = new Error(hostile)
    const loadFailed = await manager.load()
    expect(loadFailed.error).toBe('load failed')
    runtime.loadError = undefined
    await manager.load()
    liveSession(runtime).unloadError = new Error(hostile)
    const unloadFailed = await manager.unload()
    expect(unloadFailed.error).toBe('unload failed')
    liveSession(runtime).unloadError = undefined
    await manager.unload()
    store.removeError = new Error(hostile)
    const removeFailed = await manager.remove()
    expect(removeFailed.error).toBe('remove failed')
    for (const message of [
      installFailed.error,
      loadFailed.error,
      unloadFailed.error,
      removeFailed.error,
    ]) {
      expect(message).not.toContain('C:\\Users')
      expect(message).not.toContain('driver internal')
      expect(message).not.toContain('secret-token')
    }
  })
})

describe('Lifecycle — storage', () => {
  it('reports known artifact bytes after install', async () => {
    const { manager } = await installedFixture()
    const report = await manager.storage()
    expect(report.installed).toBe(true)
    expect(report.modelBytes).toBe(1024)
    expect(report.usageBytes).toBe(2048)
    expect(report.quotaBytes).toBe(4096)
  })

  it('reports unknown values without fabrication', async () => {
    const { manager, store } = setup()
    store.usageBytes = undefined
    store.quotaBytes = undefined
    const report = await manager.storage()
    expect(report.installed).toBe(false)
    expect(report.modelBytes).toBeUndefined()
    expect(report.usageBytes).toBeUndefined()
    expect(report.quotaBytes).not.toBe(0)
  })

  it('reports uninstalled storage without a descriptor', async () => {
    const { manager } = undescribed()
    const report = await manager.storage()
    expect(report.installed).toBe(false)
    expect(report.modelBytes).toBeUndefined()
  })
})
