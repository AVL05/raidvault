import { describe, it, expect, vi } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { createHash, webcrypto } from 'node:crypto'
import { runInNewContext } from 'node:vm'
import { execFileSync } from 'node:child_process'
import manifest from '../app/manifest'
import { APP_VERSION, APP_BUILD } from './version'
import { registerWorker } from './register'

const root = 'apps/web/'
const workerSource = readFileSync(`${root}scripts/worker-template.js`, 'utf8')
const current = `raidvault-app-shell-v1-${'a'.repeat(64)}`
const obsolete = `raidvault-app-shell-v1-${'b'.repeat(64)}`
const entries = ['/offline', '/_next/static/chunks/shell.js'].map((path) => ({ path,
  sha256: createHash('sha256').update('shell').digest('hex') }))

function workerSetup() {
  type Event = { request: Request; waitUntil(work: Promise<unknown>): void; respondWith(work: Promise<Response>): void }
  const handlers = new Map<string, (event: Event) => void>()
  const cache = new Map<string, Response>()
  const names = [current, obsolete, 'raidvault-model-v1', 'other-site-cache', 'raidvault-app-shell-v1-invalid']
  const network = vi.fn(async () => new Response('shell'))
  const deleted: string[] = []
  const scope = {
    location: { origin: 'https://raidvault.test' }, crypto: webcrypto,
    addEventListener: (name: string, handler: (event: Event) => void) => { handlers.set(name, handler) },
    fetch: network,
    caches: {
      keys: async () => [...names],
      delete: async (name: string) => { deleted.push(name); names.splice(names.indexOf(name), 1); return true },
      open: async () => ({ put: async (path: string, response: Response) => { cache.set(path, response) }, match: async (path: string) => cache.get(path) }),
    },
  }
  runInNewContext(`${workerSource.replace(/^export /gm, '')}\ninstallShellPolicy(scope, entries, current)`,
    { scope, entries, current, URL, Uint8Array, Response })
  function fetchEvent(request: Request) {
    let response: Promise<Response> | undefined
    handlers.get('fetch')?.({ request, waitUntil: () => undefined, respondWith: (work) => { response = work } })
    return response
  }
  async function lifecycle(name: string) {
    let work: Promise<unknown> = Promise.resolve()
    handlers.get(name)?.({ request: new Request('https://raidvault.test'), waitUntil: (next) => { work = next }, respondWith: () => undefined })
    return work
  }
  return { network, cache, names, deleted, fetchEvent, lifecycle }
}

describe('M10 manifest, versions and service worker policy', () => {
  it('has stable installable metadata and existing correctly sized PNG icons', () => {
    const data = manifest()
    expect(data).toMatchObject({ name: 'RaidVault', id: '/', start_url: '/', scope: '/', display: 'standalone' })
    expect(data.icons).toHaveLength(3)
    for (const icon of [...data.icons ?? [], { src: '/icons/apple-180.png', sizes: '180x180' }]) {
      const bytes = readFileSync(`${root}public${icon.src}`)
      const size = Number(icon.sizes?.split('x')[0])
      expect(bytes.readUInt32BE(16)).toBe(size); expect(bytes.readUInt32BE(20)).toBe(size)
      expect(bytes.length).toBeLessThanOrEqual(100 * 1024)
    }
    expect(existsSync(`${root}postcss.config.mjs`)).toBe(true)
  })
  it('uses package version and a deterministic content build identifier', () => {
    expect(APP_VERSION).toBe(JSON.parse(readFileSync(`${root}package.json`, 'utf8')).version)
    expect(APP_BUILD).toBe('development')
    const command = ['--input-type=module', '-e', "import {sourceBuildId} from './apps/web/scripts/build-info.mjs';console.log(sourceBuildId())"]
    const first = execFileSync(process.execPath, command, { encoding: 'utf8' }).trim()
    expect(first).toMatch(/^[a-f0-9]{64}$/)
    expect(execFileSync(process.execPath, command, { encoding: 'utf8' }).trim()).toBe(first)
  })
  it('generates and ignores the worker, removing stale output before build', () => {
    const pkg = JSON.parse(readFileSync(`${root}package.json`, 'utf8'))
    expect(pkg.scripts.build).toContain('build-pwa.mjs prepare && next build && node scripts/build-pwa.mjs')
    expect(readFileSync('.gitignore', 'utf8')).toContain('apps/web/public/sw.js')
  })
  it('never activates a waiting update or reloads automatically', () => {
    const registration = readFileSync(`${root}src/pwa/register.ts`, 'utf8')
    const status = readFileSync(`${root}src/pwa/pwa-status.tsx`, 'utf8')
    expect(workerSource + registration + status).not.toMatch(/skipWaiting|clients\.claim|location\.reload|BroadcastChannel|setInterval/)
    expect(status).toContain('Finish your work, then close all RaidVault tabs and reopen')
    expect(status).not.toMatch(/createArcAiController|updateContext|cancel\(/)
  })
  it('does not register in development', async () => {
    const container = { register: vi.fn() } as unknown as ServiceWorkerContainer
    const status = vi.fn()
    await registerWorker(false, container, status)
    expect(container.register).not.toHaveBeenCalled(); expect(status).toHaveBeenCalledWith('disabled')
  })
  it('degrades when registration is unsupported or rejected', async () => {
    const status = vi.fn()
    await expect(registerWorker(true, undefined, status)).resolves.toBeTypeOf('function')
    expect(status).toHaveBeenCalledWith('unsupported')
    await expect(registerWorker(true, { register: async () => { throw new Error('secret') } } as unknown as ServiceWorkerContainer, status)).resolves.toBeTypeOf('function')
    expect(status).toHaveBeenCalledWith('error')
  })
  it('announces waiting status without mutating current operations', async () => {
    const registration = { waiting: {}, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const status = vi.fn()
    const cleanup = await registerWorker(true, { register: async () => registration } as unknown as ServiceWorkerContainer, status)
    expect(status).toHaveBeenCalledWith('pending'); cleanup()
    expect(registration.removeEventListener).toHaveBeenCalled()
  })
  it('observes an already installing worker and sanitizes installation failure', async () => {
    let changed = () => undefined as void
    const worker = { state: 'installing', addEventListener: (_name: string, listener: () => void) => { changed = listener }, removeEventListener: vi.fn() }
    const registration = { waiting: null, installing: worker, addEventListener: vi.fn(), removeEventListener: vi.fn() }
    const status = vi.fn()
    const cleanup = await registerWorker(true, { register: async () => registration } as unknown as ServiceWorkerContainer, status)
    worker.state = 'redundant'; changed()
    expect(status).toHaveBeenCalledWith('error')
    cleanup(); expect(worker.removeEventListener).toHaveBeenCalled()
  })
  it('caches verified exact assets on install and serves only that cache', async () => {
    const worker = workerSetup(); await worker.lifecycle('install')
    expect([...worker.cache.keys()]).toEqual(entries.map((entry) => entry.path))
    expect(await (await worker.fetchEvent(new Request('https://raidvault.test/_next/static/chunks/shell.js')))?.text()).toBe('shell')
    expect(worker.network).toHaveBeenCalledTimes(entries.length)
    expect(worker.network).toHaveBeenCalledWith('/offline', { credentials: 'omit', redirect: 'error', cache: 'no-store' })
  })
  it.each([
    ['/_next/static/chunks/shell.js', { headers: { Authorization: 'Bearer secret' } }],
    ['/_next/static/chunks/shell.js?token=secret', {}],
    ['/_next/static/chunks/shell.js', { headers: { RSC: '1' } }],
    ['/_next/static/chunks/shell.js', { headers: { 'Next-Router-State-Tree': 'state' } }],
    ['/_next/static/chunks/unknown.js', {}], ['/api/provider', {}], ['/provider', {}],
    ['/models/model.bin', {}], ['/model-artifacts/runtime.js', {}],
    ['https://external.test/_next/static/chunks/shell.js', {}], ['http://127.0.0.1:3101/health', {}],
    ['/_next/static/chunks/shell.js', { method: 'POST' }], ['/offline?_rsc=abc', {}],
  ])('ignores unauthorized/non-allowlisted request %s %j', (path, init) => {
    const worker = workerSetup()
    expect(worker.fetchEvent(new Request(path.startsWith('http') ? path : `https://raidvault.test${path}`, init))).toBeUndefined()
    expect(worker.network).not.toHaveBeenCalled()
  })
  it('rejects poisoned assets and removes the incomplete installation cache', async () => {
    const worker = workerSetup(); worker.network.mockImplementation(async () => new Response('poison'))
    await expect(worker.lifecycle('install')).rejects.toThrow('Offline shell installation failed')
    expect(worker.deleted).toEqual([current])
  })
  it('rejects opaque, failed and redirected precache responses', async () => {
    for (const kind of ['opaque', 'failure', 'redirect']) {
      const worker = workerSetup()
      worker.network.mockImplementation(async () => {
        const response = new Response('shell', { status: kind === 'failure' ? 500 : 200 })
        if (kind === 'opaque') Object.defineProperty(response, 'type', { value: 'opaque' })
        if (kind === 'redirect') Object.defineProperty(response, 'redirected', { value: true })
        return response
      })
      await expect(worker.lifecycle('install')).rejects.toThrow('Offline shell installation failed')
    }
  })
  it('removes only obsolete valid shell caches during default activation', async () => {
    const worker = workerSetup(); await worker.lifecycle('activate')
    expect(worker.deleted).toEqual([obsolete])
    expect(worker.names).toEqual([current, 'raidvault-model-v1', 'other-site-cache', 'raidvault-app-shell-v1-invalid'])
  })
  it('serves a static offline shell on failed navigation, without caching SSR data', async () => {
    const worker = workerSetup(); await worker.lifecycle('install')
    worker.network.mockImplementation(async () => { throw new Error('offline') })
    const request = new Request('https://raidvault.test/')
    Object.defineProperty(request, 'mode', { value: 'navigate' })
    expect(await (await worker.fetchEvent(request))?.text()).toBe('shell')
    expect(worker.cache.has('/')).toBe(false)
    worker.cache.clear()
    expect((await worker.fetchEvent(request))?.status).toBe(503)
  })
})
