import { afterEach, describe, expect, it, vi } from 'vitest'
import { detectAiCapabilities } from '@raidvault/ai-engine'
import { readBrowserCapabilityEnvironment } from './capability-env'

afterEach(() => {
  vi.unstubAllGlobals()
})

function strictEnvironment(): { adapter: number; device: number; destroy: number } {
  const calls = { adapter: 0, device: 0, destroy: 0 }
  const device = {
    destroy() {
      if (this !== device) throw new Error('destroy called with wrong receiver')
      calls.destroy += 1
    },
  }
  const adapter = {
    requestDevice() {
      if (this !== adapter) {
        return Promise.reject(new Error('requestDevice called with wrong receiver'))
      }
      calls.device += 1
      return Promise.resolve(device)
    },
  }
  const gpu = {
    requestAdapter() {
      if (this !== gpu) {
        return Promise.reject(new Error('requestAdapter called with wrong receiver'))
      }
      calls.adapter += 1
      return Promise.resolve(adapter)
    },
  }
  vi.stubGlobal('navigator', { gpu })
  return calls
}

describe('Capability environment', () => {
  it('preserves native receiver identity through the full probe', async () => {
    const calls = strictEnvironment()
    const capabilities = await detectAiCapabilities(readBrowserCapabilityEnvironment())
    expect(capabilities.supported).toBe(true)
    expect(capabilities.deviceAvailable).toBe(true)
    expect(calls).toEqual({ adapter: 1, device: 1, destroy: 1 })
  })

  it('fails safely on misshapen surfaces', async () => {
    for (const gpu of [{}, { requestAdapter: 42 }, { requestDevice: 7 }]) {
      vi.stubGlobal('navigator', { gpu })
      const capabilities = await detectAiCapabilities(readBrowserCapabilityEnvironment())
      expect(capabilities.supported).toBe(false)
    }
  })

  it('fails safely without a gpu surface', async () => {
    vi.stubGlobal('navigator', {})
    const capabilities = await detectAiCapabilities(readBrowserCapabilityEnvironment())
    expect(capabilities.supported).toBe(false)
    expect(capabilities.reason).toBe('WebGPU is not available in this browser')
  })
})
