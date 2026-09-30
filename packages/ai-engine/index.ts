/**
 * RaidVault — Optional local AI engine foundation (M8).
 *
 * Model lifecycle state machine, WebGPU capability detection, artifact
 * store and runtime abstractions, Gaming Mode gating, and storage
 * reporting. Infrastructure only: no chat, prompts, inference output,
 * planning explanations, or tool calling (M9 territory).
 *
 * Core rules enforced here:
 *
 * - AI is optional; every gate failure is a safe no-op, never a crash.
 * - Heavy work starts only with Gaming Mode definitively INACTIVE.
 * - ACTIVE or UNKNOWN blocks loads and unloads READY/LOADING work.
 * - Stale async completions can never restore READY or INSTALLED.
 * - Installed artifacts survive Gaming Mode unloads; remove() deletes.
 * - No production model descriptor exists yet, so production install
 *   and load paths stay unavailable by explicit design, not by omission.
 */

// ---------------------------------------------------------------------------
// Lifecycle model (exactly seven states)
// ---------------------------------------------------------------------------

/** Exact model lifecycle states. No additional states exist. */
export type ModelLifecycleState =
  | 'NOT_INSTALLED'
  | 'INSTALLING'
  | 'INSTALLED'
  | 'LOADING'
  | 'READY'
  | 'UNLOADING'
  | 'ERROR'

/** Model identity. No production descriptor is shipped in M8. */
export interface ModelDescriptor {
  readonly id: string
  readonly version: string
  readonly estimatedBytes?: number
}

/** Point-in-time lifecycle view for presentation layers. */
export interface ModelManagerSnapshot {
  readonly state: ModelLifecycleState
  readonly modelId: string | undefined
  readonly installed: boolean
  readonly progress: number | undefined
  readonly error: string | undefined
  readonly gamingMode: GamingModeStatus
}

// ---------------------------------------------------------------------------
// Runtime and artifact-store abstractions (fakes in tests only)
// ---------------------------------------------------------------------------

/** Concrete model runtime behind the lifecycle. Loading is the only operation. */
export interface LocalModelRuntime {
  load(descriptor: ModelDescriptor): Promise<LoadedModelSession>
}

/**
 * Owned model session returned by a successful runtime load. Exactly
 * one load operation owns each session: a stale completion disposes
 * only its own session, so cleanup can never tear down a newer load.
 * Implementations must release partial acquisitions before rejecting
 * load(), so a failed load never leaves an owned session behind.
 * Session release methods must tolerate sequential unload/dispose calls.
 */
export interface LoadedModelSession {
  unload(): Promise<void>
  dispose(): Promise<void>
}

/**
 * Owned model session returned by a successful runtime load. Exactly
 * one load operation owns each session: stale completions dispose only
 * their own session, so cleanup can never tear down a newer load.
 * Implementations must release partial acquisitions before rejecting
 * load(), so a failed load never leaves an owned session behind.
 */
export interface LoadedModelSession {
  unload(): Promise<void>
  dispose(): Promise<void>
}

/** Cached model artifact storage. Never browser localStorage. */
export interface ModelArtifactStore {
  isInstalled(descriptor: ModelDescriptor): Promise<boolean>
  install(descriptor: ModelDescriptor, onProgress: (progress: number) => void): Promise<void>
  remove(descriptor: ModelDescriptor): Promise<void>
  getStorageReport(descriptor: ModelDescriptor): Promise<StorageReport>
}

/** Storage facts. Unknown stays undefined, never fabricated. */
export interface StorageReport {
  readonly installed: boolean
  readonly modelBytes?: number
  readonly usageBytes?: number
  readonly quotaBytes?: number
}

// ---------------------------------------------------------------------------
// WebGPU capability detection (feature detection only)
// ---------------------------------------------------------------------------

/** Minimal device surface used by detection (existence plus release). */
export interface GpuDeviceLike {
  destroy?: () => void
}

/** Minimal adapter surface used by detection. */
export interface GpuAdapterLike {
  requestDevice(): Promise<GpuDeviceLike | null>
}

/** Minimal WebGPU surface used by detection. */
export interface GpuLike {
  requestAdapter(): Promise<GpuAdapterLike | null>
}

/** Injected capability environment. Keeps logic testable without a GPU. */
export interface GpuCapabilityEnvironment {
  readonly gpu?: GpuLike
}

/** Serializable capability verdict. No adapter or driver details. */
export interface AiCapabilities {
  readonly webgpuAvailable: boolean
  readonly adapterAvailable: boolean
  readonly deviceAvailable: boolean
  readonly supported: boolean
  readonly reason?: string
}

/**
 * Detect WebGPU support through feature probing only: navigator surface,
 * adapter acquisition, then device acquisition. Every failure path
 * resolves to unsupported with a fixed reason; nothing is thrown.
 * An acquired probe device is released immediately so detection leaves
 * no permanent GPU residency.
 */
export async function detectAiCapabilities(
  environment: GpuCapabilityEnvironment
): Promise<AiCapabilities> {
  const gpu = environment.gpu
  if (gpu === undefined) {
    return {
      webgpuAvailable: false,
      adapterAvailable: false,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU is not available in this browser',
    }
  }
  let adapter: GpuAdapterLike | null
  try {
    adapter = await gpu.requestAdapter()
  } catch {
    return {
      webgpuAvailable: true,
      adapterAvailable: false,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU adapter request failed',
    }
  }
  if (adapter === null) {
    return {
      webgpuAvailable: true,
      adapterAvailable: false,
      deviceAvailable: false,
      supported: false,
      reason: 'No WebGPU adapter is available',
    }
  }
  let device: GpuDeviceLike | null
  try {
    device = await adapter.requestDevice()
  } catch {
    return {
      webgpuAvailable: true,
      adapterAvailable: true,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU device acquisition failed',
    }
  }
  if (device === null) {
    return {
      webgpuAvailable: true,
      adapterAvailable: true,
      deviceAvailable: false,
      supported: false,
      reason: 'WebGPU device acquisition returned nothing',
    }
  }
  try {
    if (typeof device.destroy === 'function') {
      device.destroy()
    }
  } catch {
    /* Probe cleanup is best-effort; capability is already determined. */
  }
  return {
    webgpuAvailable: true,
    adapterAvailable: true,
    deviceAvailable: true,
    supported: true,
  }
}

// ---------------------------------------------------------------------------
// Gaming Mode gating (fail-safe, mirrors M7 values)
// ---------------------------------------------------------------------------

/** Gaming Mode status contract, mirroring the M7 Bridge values. */
export type GamingModeStatus = 'ACTIVE' | 'INACTIVE' | 'UNKNOWN'

/** Fail-safe default: absence of status information means UNKNOWN. */
export const UNKNOWN_GAMING_MODE: GamingModeStatus = 'UNKNOWN'

/** Source of Gaming Mode truth. Never treated as INACTIVE on failure. */
export interface GamingModeSource {
  getGamingMode(): Promise<GamingModeStatus>
}

/** Fixed status source for tests and the undescribed production default. */
export function createStaticGamingModeSource(status: GamingModeStatus): GamingModeSource {
  return {
    getGamingMode: () => Promise.resolve(status),
  }
}

/** Read status defensively: throw, garbage, and absence all mean UNKNOWN. */
async function readGamingMode(source: GamingModeSource): Promise<GamingModeStatus> {
  let status: unknown
  try {
    status = await source.getGamingMode()
  } catch {
    return UNKNOWN_GAMING_MODE
  }
  if (status !== 'ACTIVE' && status !== 'INACTIVE' && status !== 'UNKNOWN') {
    return UNKNOWN_GAMING_MODE
  }
  return status
}

/** Minimal fetch surface needed by the Bridge status client. */
export interface BridgeFetchInit {
  readonly signal: AbortSignal
}

/** Minimal response surface needed by the Bridge status client. */
export interface BridgeFetchResponse {
  readonly ok: boolean
  json(): Promise<unknown>
}

/** Injected fetch implementation (tests supply fakes; no globals used). */
export type BridgeFetch = (url: string, init: BridgeFetchInit) => Promise<BridgeFetchResponse>

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Bridge gaming-mode client contract: GET {baseUrl}/gaming-mode with a
 * short timeout and strict shape validation. Network failure, timeout,
 * non-OK status, and malformed payloads all resolve to UNKNOWN. Never
 * invents INACTIVE. Not wired in production UI: M7 exposes no CORS, so
 * browser fetch cannot consume the Bridge securely yet.
 */
export async function fetchGamingModeStatus(
  baseUrl: string,
  fetchImpl: BridgeFetch,
  timeoutMs: number
): Promise<GamingModeStatus> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined = undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new Error(`bridge request timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })
  try {
    const response = await Promise.race([
      fetchImpl(`${baseUrl}/gaming-mode`, { signal: controller.signal }),
      timeout,
    ])
    if (!response.ok) {
      return UNKNOWN_GAMING_MODE
    }
    const payload: unknown = await response.json()
    if (!isRecord(payload)) {
      return UNKNOWN_GAMING_MODE
    }
    const mode = payload['gamingMode']
    if (mode !== 'ACTIVE' && mode !== 'INACTIVE' && mode !== 'UNKNOWN') {
      return UNKNOWN_GAMING_MODE
    }
    return mode
  } catch {
    return UNKNOWN_GAMING_MODE
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer)
    }
  }
}

// ---------------------------------------------------------------------------
// Model manager (explicit state machine with race protection)
// ---------------------------------------------------------------------------

/** Manager construction inputs. All collaborators are injected. */
export interface ModelManagerDeps {
  readonly descriptor: ModelDescriptor | undefined
  readonly runtime: LocalModelRuntime
  readonly store: ModelArtifactStore
  readonly capabilities: AiCapabilities
  readonly gamingModeSource: GamingModeSource
}

/** Model manager: explicit transitions, generation-guarded completions. */
export interface ModelManager {
  snapshot(): ModelManagerSnapshot
  install(): Promise<ModelManagerSnapshot>
  load(): Promise<ModelManagerSnapshot>
  unload(): Promise<ModelManagerSnapshot>
  remove(): Promise<ModelManagerSnapshot>
  refreshGamingMode(): Promise<ModelManagerSnapshot>
  storage(): Promise<StorageReport>
}

/**
 * Internal exclusive operation ownership. Exactly one lifecycle action
 * holds the lock at a time; it is acquired synchronously before the
 * first await. Never exposed publicly; the seven lifecycle states stay
 * the only public vocabulary.
 */
type ActiveOperation =
  | 'NONE'
  | 'INSTALL'
  | 'LOAD'
  | 'UNLOAD'
  | 'REMOVE'
  | 'GAMING_MODE_UNLOAD'

function clampProgress(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0
  }
  if (value < 0) {
    return 0
  }
  if (value > 1) {
    return 1
  }
  return value
}

function safeMessage(context: 'install' | 'load' | 'unload' | 'remove'): string {
  return `${context} failed`
}

async function bestEffort(work: () => Promise<void>): Promise<void> {
  try {
    await work()
  } catch {
    /* Release paths stay best-effort; the caller decides the outcome. */
  }
}

/**
 * Create a model manager. State transitions are set synchronously
 * before the first await of each accepted action, so concurrent
 * duplicate calls observe the transitional state and become safe
 * no-ops deterministically. Two mechanisms protect async completions:
 * an internal operation lock gives exactly one action exclusive
 * ownership at a time (remove preempts install and load; unload and
 * fail-safe enforcement preempt load; nothing preempts remove), and a
 * monotonically increasing generation invalidates stale completions, so
 * a superseded completion can never restore a lifecycle state.
 * remove() commits its terminal state once artifact deletion succeeds;
 * exclusivity guarantees no later load can supersede it.
 */
export function createModelManager(deps: ModelManagerDeps): ModelManager {
  let state: ModelLifecycleState = 'NOT_INSTALLED'
  let installed = false
  let progress: number | undefined = undefined
  let error: string | undefined = undefined
  let gamingMode: GamingModeStatus = UNKNOWN_GAMING_MODE
  let operationId = 0
  let activeOperation: ActiveOperation = 'NONE'
  let session: LoadedModelSession | undefined = undefined

  /**
   * Acquire exclusive operation ownership synchronously, bumping the
   * generation so earlier work goes stale. Returns undefined when the
   * requested action may not preempt the current owner.
   */
  function acquire(next: Exclude<ActiveOperation, 'NONE'>): number | undefined {
    const preempts =
      activeOperation === 'NONE' ||
      (next === 'REMOVE' &&
        (activeOperation === 'INSTALL' || activeOperation === 'LOAD')) ||
      (next === 'UNLOAD' && activeOperation === 'LOAD') ||
      (next === 'GAMING_MODE_UNLOAD' && activeOperation === 'LOAD')
    if (!preempts) {
      return undefined
    }
    operationId += 1
    activeOperation = next
    return operationId
  }

  /**
   * Release ownership after a terminal completion. Returns false (leaving
   * ownership untouched) when a newer action already superseded this one.
   */
  function release(operation: number): boolean {
    if (operation !== operationId) {
      return false
    }
    activeOperation = 'NONE'
    return true
  }

  function snapshot(): ModelManagerSnapshot {
    return {
      state,
      modelId: deps.descriptor === undefined ? undefined : deps.descriptor.id,
      installed,
      progress,
      error,
      gamingMode,
    }
  }

  async function install(): Promise<ModelManagerSnapshot> {
    const descriptor = deps.descriptor
    if (descriptor === undefined) {
      return snapshot()
    }
    if (state !== 'NOT_INSTALLED' && !(state === 'ERROR' && !installed)) {
      return snapshot()
    }
    const operation = acquire('INSTALL')
    if (operation === undefined) {
      return snapshot()
    }
    state = 'INSTALLING'
    progress = 0
    error = undefined
    try {
      await deps.store.install(descriptor, (value) => {
        if (operation !== operationId) {
          return
        }
        progress = clampProgress(value)
      })
    } catch {
      if (!release(operation)) {
        return snapshot()
      }
      state = 'ERROR'
      progress = undefined
      error = safeMessage('install')
      return snapshot()
    }
    if (!release(operation)) {
      return snapshot()
    }
    state = 'INSTALLED'
    installed = true
    progress = undefined
    return snapshot()
  }

  async function load(): Promise<ModelManagerSnapshot> {
    const descriptor = deps.descriptor
    if (descriptor === undefined) {
      return snapshot()
    }
    if (!deps.capabilities.supported) {
      return snapshot()
    }
    if (state !== 'INSTALLED' && !(state === 'ERROR' && installed)) {
      return snapshot()
    }
    const operation = acquire('LOAD')
    if (operation === undefined) {
      return snapshot()
    }
    const priorState = state
    const priorError = error
    state = 'LOADING'
    error = undefined
    const mode = await readGamingMode(deps.gamingModeSource)
    gamingMode = mode
    if (operation !== operationId) {
      return snapshot()
    }
    if (mode !== 'INACTIVE') {
      activeOperation = 'NONE'
      state = priorState
      error = priorError
      return snapshot()
    }
    let loaded: LoadedModelSession
    try {
      loaded = await deps.runtime.load(descriptor)
    } catch {
      if (!release(operation)) {
        return snapshot()
      }
      state = 'ERROR'
      error = safeMessage('load')
      return snapshot()
    }
    if (!release(operation)) {
      await bestEffort(() => loaded.dispose())
      return snapshot()
    }
    session = loaded
    state = 'READY'
    return snapshot()
  }

  async function unload(): Promise<ModelManagerSnapshot> {
    if (
      state !== 'READY' &&
      state !== 'LOADING' &&
      !(state === 'ERROR' && installed)
    ) {
      return snapshot()
    }
    const operation = acquire('UNLOAD')
    if (operation === undefined) {
      return snapshot()
    }
    state = 'UNLOADING'
    error = undefined
    const current = session
    session = undefined
    try {
      if (current !== undefined) {
        await current.unload()
        await current.dispose()
      }
    } catch {
      if (!release(operation)) {
        return snapshot()
      }
      session = current
      state = 'ERROR'
      error = safeMessage('unload')
      return snapshot()
    }
    if (!release(operation)) {
      return snapshot()
    }
    state = 'INSTALLED'
    return snapshot()
  }

  async function remove(): Promise<ModelManagerSnapshot> {
    const descriptor = deps.descriptor
    if (descriptor === undefined) {
      return snapshot()
    }
    if (state === 'NOT_INSTALLED') {
      return snapshot()
    }
    const operation = acquire('REMOVE')
    if (operation === undefined) {
      return snapshot()
    }
    error = undefined
    const current = session
    session = undefined
    if (current !== undefined) {
      await bestEffort(() => current.unload())
      await bestEffort(() => current.dispose())
    }
    try {
      await deps.store.remove(descriptor)
    } catch {
      if (!release(operation)) {
        return snapshot()
      }
      state = 'ERROR'
      error = safeMessage('remove')
      return snapshot()
    }
    if (!release(operation)) {
      return snapshot()
    }
    state = 'NOT_INSTALLED'
    installed = false
    progress = undefined
    return snapshot()
  }

  async function refreshGamingMode(): Promise<ModelManagerSnapshot> {
    const mode = await readGamingMode(deps.gamingModeSource)
    gamingMode = mode
    if (
      (mode === 'ACTIVE' || mode === 'UNKNOWN') &&
      (state === 'READY' || state === 'LOADING')
    ) {
      const operation = acquire('GAMING_MODE_UNLOAD')
      if (operation === undefined) {
        return snapshot()
      }
      state = 'UNLOADING'
      error = undefined
      const current = session
      session = undefined
      if (current !== undefined) {
        await bestEffort(() => current.unload())
        await bestEffort(() => current.dispose())
      }
      if (!release(operation)) {
        return snapshot()
      }
      state = 'INSTALLED'
      return snapshot()
    }
    return snapshot()
  }

  async function storage(): Promise<StorageReport> {
    const descriptor = deps.descriptor
    if (descriptor === undefined) {
      return { installed: false }
    }
    try {
      return await deps.store.getStorageReport(descriptor)
    } catch {
      return { installed }
    }
  }

  return { snapshot, install, load, unload, remove, refreshGamingMode, storage }
}

// ---------------------------------------------------------------------------
// Control-state helper (pure transition-validity rules for presentation)
// ---------------------------------------------------------------------------

/** One control's enabled state plus the reason shown when disabled. */
export interface AiControlState {
  readonly disabled: boolean
  readonly reason: string | undefined
}

/** Button states derived from a snapshot without side effects. */
export interface AiControls {
  readonly install: AiControlState
  readonly remove: AiControlState
  readonly load: AiControlState
  readonly unload: AiControlState
  readonly refresh: AiControlState
}

/** Blocked-load message shown whenever Gaming Mode is not INACTIVE. */
export const GAMING_MODE_BLOCKED_MESSAGE =
  'Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN'

/**
 * Describe valid controls for a snapshot. Mirrors the manager gates
 * declaratively so presentation can disable invalid transitions.
 */
export function describeAiControls(
  snapshot: ModelManagerSnapshot,
  capabilities: AiCapabilities
): AiControls {
  const gamingMode = snapshot.gamingMode
  const install: AiControlState =
    snapshot.modelId === undefined
      ? { disabled: true, reason: 'No model is configured' }
      : snapshot.state === 'NOT_INSTALLED' || (snapshot.state === 'ERROR' && !snapshot.installed)
        ? { disabled: false, reason: undefined }
        : { disabled: true, reason: 'Install is available only before installation' }
  const remove: AiControlState =
    snapshot.installed && snapshot.state !== 'NOT_INSTALLED'
      ? { disabled: false, reason: undefined }
      : { disabled: true, reason: 'Nothing is installed' }
  let load: AiControlState
  if (snapshot.modelId === undefined) {
    load = { disabled: true, reason: 'No model is configured' }
  } else if (snapshot.state !== 'INSTALLED') {
    load = { disabled: true, reason: 'Load is available only when installed' }
  } else if (!capabilities.supported) {
    load = { disabled: true, reason: 'WebGPU is not supported' }
  } else if (gamingMode !== 'INACTIVE') {
    load = { disabled: true, reason: GAMING_MODE_BLOCKED_MESSAGE }
  } else {
    load = { disabled: false, reason: undefined }
  }
  const unload: AiControlState =
    snapshot.state === 'READY' || snapshot.state === 'LOADING'
      ? { disabled: false, reason: undefined }
      : { disabled: true, reason: 'Nothing to unload' }
  return {
    install,
    remove,
    load,
    unload,
    refresh: { disabled: false, reason: undefined },
  }
}
