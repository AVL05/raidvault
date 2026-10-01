import { readFileSync, statSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'
import { webRoot } from './build-info.mjs'

const baseline = JSON.parse(readFileSync(join(webRoot, 'scripts/m9-baseline.json'), 'utf8'))
for (const [file, expected] of Object.entries(baseline.dependencies)) {
  const current = JSON.parse(readFileSync(join(webRoot, '../..', file), 'utf8')).dependencies ?? {}
  if (JSON.stringify(current) !== JSON.stringify(expected)) throw new Error(`Runtime dependency budget exceeded: ${file}`)
}

const html = readFileSync(join(webRoot, '.next/server/app/index.html'), 'utf8')
const js = [...new Set([...html.matchAll(/(?:src|href)="(\/_next\/static\/[^"?]+\.js)"/g)].map((match) => match[1]))].sort()
const gzipBytes = js.reduce((total, path) => total + gzipSync(readFileSync(join(webRoot, `.next/${path.slice(7)}`)), { level: 9, mtime: 0 }).length, 0)
if (gzipBytes > baseline.jsGzip + 30 * 1024) throw new Error(`Initial JS budget exceeded: ${gzipBytes} gzip bytes`)
if (statSync(join(webRoot, 'public/sw.js')).size > 20 * 1024) throw new Error('Worker output budget exceeded')
if (statSync(join(webRoot, 'scripts/worker-template.js')).size > 20 * 1024) throw new Error('Worker source budget exceeded')
let iconBytes = 0
for (const file of readdirSync(join(webRoot, 'public/icons'))) {
  const bytes = statSync(join(webRoot, 'public/icons', file)).size
  if (bytes > 100 * 1024) throw new Error('Icon budget exceeded')
  iconBytes += bytes
}
if (iconBytes > 300 * 1024) throw new Error('Combined icon budget exceeded')
console.log(`Performance PASS: initial JS ${gzipBytes} gzip bytes / ${baseline.jsGzip + 30 * 1024}; icons ${iconBytes} bytes`)
