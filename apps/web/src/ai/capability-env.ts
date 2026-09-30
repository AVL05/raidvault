/**
 * RaidVault browser capability reader (M8).
 *
 * Bridges the untyped browser WebGPU surface (absent from the TypeScript
 * DOM library) into the ai-engine capability model. Each narrow
 * structural assertion below is immediately verified by behavior:
 * misshapen surfaces resolve to an absent GPU, and detection treats
 * every failure as unsupported. No user-agent inspection anywhere.
 */

import type {
  GpuAdapterLike,
  GpuCapabilityEnvironment,
  GpuDeviceLike,
  GpuLike,
} from '@raidvault/ai-engine'

function asGpuLike(value: unknown): GpuLike | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const holder = value as { requestAdapter?: unknown }
  if (typeof holder.requestAdapter !== 'function') {
    return undefined
  }
  // Invoke through the original receiver: native Web APIs may
  // brand-check `this`, so a detached call could fail incorrectly.
  const requestAdapter = holder.requestAdapter as () => Promise<unknown>
  return {
    requestAdapter: () =>
      requestAdapter.call(value).then((adapter) => {
        if (typeof adapter !== 'object' || adapter === null) {
          return null
        }
        const holderAdapter = adapter as { requestDevice?: unknown }
        if (typeof holderAdapter.requestDevice !== 'function') {
          return null
        }
        const requestDevice = holderAdapter.requestDevice as () => Promise<unknown>
        const wrapped: GpuAdapterLike = {
          requestDevice: () =>
            requestDevice.call(adapter).then((device): GpuDeviceLike | null => {
              if (typeof device !== 'object' || device === null) {
                return null
              }
              const holderDevice = device as { destroy?: unknown }
              if (typeof holderDevice.destroy !== 'function') {
                const bare: GpuDeviceLike = {}
                return bare
              }
              const destroy = holderDevice.destroy as () => void
              const releasable: GpuDeviceLike = {
                destroy: () => destroy.call(device),
              }
              return releasable
            }),
        }
        return wrapped
      }),
  }
}

/** Read the browser GPU surface without assuming typings or presence. */
export function readBrowserCapabilityEnvironment(): GpuCapabilityEnvironment {
  if (typeof globalThis.navigator !== 'object' || globalThis.navigator === null) {
    return {}
  }
  const holder = globalThis.navigator as { gpu?: unknown }
  const gpu = asGpuLike(holder.gpu)
  if (gpu === undefined) {
    return {}
  }
  return { gpu }
}
