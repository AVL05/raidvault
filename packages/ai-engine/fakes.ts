/**
 * RaidVault — Deterministic ai-engine test doubles (M8, internal).
 *
 * Fake runtime, artifact store, gaming-mode sources, and capability
 * environments for tests. Never exported from the package public API
 * and never used by production code.
 */

import type {
  AiCapabilities,
  BridgeFetch,
  BridgeFetchResponse,
  GamingModeSource,
  GamingModeStatus,
  GpuAdapterLike,
  GpuCapabilityEnvironment,
  GpuDeviceLike,
  GpuLike,
  LocalModelRuntime,
  ModelArtifactStore,
  ModelDescriptor,
  StorageReport,
} from './index'

/** Synthetic descriptor shared by lifecycle tests. No production model. */
export const FAKE_DESCRIPTOR: ModelDescriptor = {
  id: 'fake-model',
  version: 'm8-fake-1',
  estimatedBytes: 1024,
}

/** Supported capability fixture. */
export const SUPPORTED_CAPABILITIES: AiCapabilities = {
  webgpuAvailable: true,
  adapterAvailable: true,
  deviceAvailable: true,
  supported: true,
}

/** Unsupported capability fixture. */
export const UNSUPPORTED_CAPABILITIES: AiCapabilities = {
  webgpuAvailable: false,
  adapterAvailable: false,
  deviceAvailable: false,
  supported: false,
  reason: 'WebGPU is not available in this browser',
}

/** Deterministic runtime double with call counters and scripted faults. */
export class FakeRuntime implements LocalModelRuntime {
  public loadCalls = 0
  public unloadCalls = 0
  public disposeCalls = 0
  public acquired = false
  public loadError: Error | undefined = undefined
  public unloadError: Error | undefined = undefined
  public holdLoads = false
  private gated: Array<() => void> = []

  async load(): Promise<void> {
    this.loadCalls += 1
    if (this.loadError !== undefined) {
      throw this.loadError
    }
    if (this.holdLoads) {
      await new Promise<void>((resolve) => {
        this.gated.push(resolve)
      })
    }
    this.acquired = true
  }

  /** Resolve every held load completion in order. */
  releaseLoads(): void {
    const pending = this.gated
    this.gated = []
    for (const resolve of pending) {
      resolve()
    }
  }

  async unload(): Promise<void> {
    this.unloadCalls += 1
    if (this.unloadError !== undefined) {
      throw this.unloadError
    }
    this.acquired = false
  }

  async dispose(): Promise<void> {
    this.disposeCalls += 1
    this.acquired = false
  }
}

/** Deterministic artifact-store double with scripted faults and reports. */
export class FakeArtifactStore implements ModelArtifactStore {
  public installCalls = 0
  public removeCalls = 0
  public installError: Error | undefined = undefined
  public removeError: Error | undefined = undefined
  public progressSequence: readonly number[] = [0, 0.5, 1]
  public seenProgress: number[] = []
  public modelBytes: number | undefined = 1024
  public usageBytes: number | undefined = 2048
  public quotaBytes: number | undefined = 4096
  private installedIds = new Set<string>()

  async isInstalled(descriptor: ModelDescriptor): Promise<boolean> {
    return this.installedIds.has(descriptor.id)
  }

  async install(
    descriptor: ModelDescriptor,
    onProgress: (progress: number) => void
  ): Promise<void> {
    this.installCalls += 1
    if (this.installError !== undefined) {
      throw this.installError
    }
    for (const progress of this.progressSequence) {
      this.seenProgress.push(progress)
      onProgress(progress)
    }
    this.installedIds.add(descriptor.id)
  }

  async remove(descriptor: ModelDescriptor): Promise<void> {
    this.removeCalls += 1
    if (this.removeError !== undefined) {
      throw this.removeError
    }
    this.installedIds.delete(descriptor.id)
  }

  async getStorageReport(descriptor: ModelDescriptor): Promise<StorageReport> {
    const installed = this.installedIds.has(descriptor.id)
    return {
      installed,
      modelBytes: installed ? this.modelBytes : undefined,
      usageBytes: this.usageBytes,
      quotaBytes: this.quotaBytes,
    }
  }
}

/** Mutable gaming-mode source for fail-safe transition tests. */
export class ScriptedGamingModeSource implements GamingModeSource {
  constructor(public status: GamingModeStatus) {}

  async getGamingMode(): Promise<GamingModeStatus> {
    return this.status
  }
}

/** Throwing gaming-mode source modeling Bridge failure. */
export class ThrowingGamingModeSource implements GamingModeSource {
  async getGamingMode(): Promise<GamingModeStatus> {
    throw new Error('bridge unreachable')
  }
}

/** Capability environment with no GPU surface present. */
export function gpuEnvAbsent(): GpuCapabilityEnvironment {
  return {}
}

/** Capability environment whose adapter request resolves null. */
export function gpuEnvNoAdapter(): GpuCapabilityEnvironment {
  const gpu: GpuLike = {
    requestAdapter: () => Promise.resolve(null),
  }
  return { gpu }
}

/** Capability environment whose adapter request rejects. */
export function gpuEnvAdapterThrows(): GpuCapabilityEnvironment {
  const gpu: GpuLike = {
    requestAdapter: () => Promise.reject(new Error('adapter boom')),
  }
  return { gpu }
}

/** Capability environment whose device request rejects. */
export function gpuEnvNoDevice(): GpuCapabilityEnvironment {
  const adapter: GpuAdapterLike = {
    requestDevice: () => Promise.reject(new Error('device boom')),
  }
  const gpu: GpuLike = {
    requestAdapter: () => Promise.resolve(adapter),
  }
  return { gpu }
}

/** Capability environment whose device request resolves null. */
export function gpuEnvNullDevice(): GpuCapabilityEnvironment {
  const adapter: GpuAdapterLike = {
    requestDevice: () => Promise.resolve(null),
  }
  const gpu: GpuLike = {
    requestAdapter: () => Promise.resolve(adapter),
  }
  return { gpu }
}

/** Fake GPU device recording release calls. */
export class FakeGpuDevice {
  public destroyCalls = 0

  destroy(): void {
    this.destroyCalls += 1
  }
}

/** Capability environment with a working adapter and device. */
export function gpuEnvSupported(device: GpuDeviceLike): GpuCapabilityEnvironment {
  const adapter: GpuAdapterLike = {
    requestDevice: () => Promise.resolve(device),
  }
  const gpu: GpuLike = {
    requestAdapter: () => Promise.resolve(adapter),
  }
  return { gpu }
}

/** Bridge fetch double resolving one JSON payload. */
export function jsonFetch(payload: unknown, ok = true): BridgeFetch {
  const response: BridgeFetchResponse = {
    ok,
    json: () => Promise.resolve(payload),
  }
  return () => Promise.resolve(response)
}

/** Bridge fetch double that never settles, for timeout tests. */
export function hangingFetch(): BridgeFetch {
  return () => new Promise<BridgeFetchResponse>(() => undefined)
}

/** Bridge fetch double that always rejects, for failure tests. */
export function failingFetch(): BridgeFetch {
  return () => Promise.reject(new Error('network down'))
}
