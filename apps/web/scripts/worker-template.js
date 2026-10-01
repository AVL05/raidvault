/* RaidVault shell only. This source is embedded into the generated worker. */
export function installShellPolicy(scope, entries, cacheName) {
  const allowed = new Map(entries.map((entry) => [entry.path, entry]))
  const namespace = /^raidvault-app-shell-v1-[a-f0-9]{64}$/
  const eligible = (request) => {
    const url = new URL(request.url)
    return request.method === 'GET' && url.origin === scope.location.origin &&
      url.search === '' && !request.headers.has('Authorization') &&
      !request.headers.has('RSC') && !request.headers.has('Next-Router-State-Tree') &&
      !request.headers.has('Next-Action')
  }
  const validResponse = (response) => response.ok && !response.redirected &&
    response.type !== 'opaque' && response.type !== 'opaqueredirect'
  const cached = async (path) => {
    try { return await (await scope.caches.open(cacheName)).match(path) }
    catch { return undefined }
  }

  scope.addEventListener('install', (event) => {
    event.waitUntil((async () => {
      try {
        const cache = await scope.caches.open(cacheName)
        for (const entry of entries) {
          const response = await scope.fetch(entry.path, { credentials: 'omit', redirect: 'error', cache: 'no-store' })
          if (!validResponse(response)) throw new Error('Shell response rejected')
          const bytes = await response.clone().arrayBuffer()
          const digest = await scope.crypto.subtle.digest('SHA-256', bytes)
          const hex = [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
          if (hex !== entry.sha256) throw new Error('Shell version mismatch')
          await cache.put(entry.path, response)
        }
      } catch {
        await scope.caches.delete(cacheName)
        throw new Error('Offline shell installation failed')
      }
    })())
  })
  scope.addEventListener('activate', (event) => {
    // Default waiting lifecycle means old controlling clients have already closed.
    event.waitUntil((async () => {
      const names = await scope.caches.keys()
      await Promise.all(names.filter((name) => namespace.test(name) && name !== cacheName)
        .map((name) => scope.caches.delete(name)))
    })())
  })
  scope.addEventListener('fetch', (event) => {
    if (!eligible(event.request)) return
    const url = new URL(event.request.url)
    if (event.request.mode === 'navigate' && (url.pathname === '/' || url.pathname === '/offline')) {
      event.respondWith((async () => {
        try { return await scope.fetch(event.request) }
        catch {
          return await cached('/offline') ?? new Response('Offline shell unavailable. Reconnect to open RaidVault.',
            { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
        }
      })())
    } else if (allowed.has(url.pathname) && url.pathname !== '/offline') {
      event.respondWith((async () => {
        return await cached(url.pathname) ?? scope.fetch(event.request)
      })())
    }
  })
}
