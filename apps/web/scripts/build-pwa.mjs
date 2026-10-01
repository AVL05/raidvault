import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { webRoot } from './build-info.mjs'

const workerPath = join(webRoot, 'public/sw.js')
if (process.argv[2] === 'prepare') {
  // Remove the previous output before Next inventories public files.
  if (existsSync(workerPath)) unlinkSync(workerPath)
} else {
  const offline = readFileSync(join(webRoot, '.next/server/app/offline.html'))
  const paths = new Set(['/offline', '/manifest.webmanifest',
    '/icons/icon-192.png', '/icons/icon-512.png', '/icons/maskable-512.png', '/icons/apple-180.png',
    '/icons/favicon-32.png', '/brand/wordmark.webp', '/brand/emblem.webp', '/fonts/barlow-condensed-bold.ttf'])
  // Explicit build inventory; never a runtime URL/prefix cache rule.
  const visit = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) visit(join(directory, entry.name), `${prefix}/${entry.name}`)
      else if (/\.(js|css|woff2)$/.test(entry.name)) paths.add(`${prefix}/${entry.name}`)
    }
  }
  visit(join(webRoot, '.next/static'), '/_next/static')
  const entries = [...paths].sort().map((path) => {
    const bytes = path === '/offline' ? offline : path === '/manifest.webmanifest'
      ? readFileSync(join(webRoot, '.next/server/app/manifest.webmanifest.body'))
      : readFileSync(join(webRoot, path.startsWith('/_next/') ? `.next/${path.slice(7)}` : `public${path}`))
    return { path, sha256: createHash('sha256').update(bytes).digest('hex') }
  })
  const template = readFileSync(join(webRoot, 'scripts/worker-template.js'), 'utf8').replace(/^export /gm, '')
  const digest = createHash('sha256').update(JSON.stringify(entries)).update(template).digest('hex')
  const cacheName = `raidvault-app-shell-v1-${digest}`
  mkdirSync(join(webRoot, 'public'), { recursive: true })
  writeFileSync(workerPath, `${template}\ninstallShellPolicy(self, ${JSON.stringify(entries)}, ${JSON.stringify(cacheName)})\n`)
  writeFileSync(join(webRoot, '.next/raidvault-pwa.json'), JSON.stringify({ cacheName, entries }, null, 2))
  console.log(`Generated ${cacheName}: ${entries.length} exact shell assets`)
}
