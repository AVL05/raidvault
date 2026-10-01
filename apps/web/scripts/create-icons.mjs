// Original geometric vault mark; no game assets or external artwork.
import { mkdirSync, writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

function crc32(bytes) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}
function chunk(name, bytes) {
  const body = Buffer.concat([Buffer.from(name), bytes])
  const size = Buffer.alloc(4); size.writeUInt32BE(bytes.length)
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body))
  return Buffer.concat([size, body, crc])
}
const root = fileURLToPath(new URL('../public/icons/', import.meta.url))
mkdirSync(root, { recursive: true })
for (const [file, size] of [['icon-192.png', 192], ['icon-512.png', 512], ['maskable-512.png', 512], ['apple-180.png', 180]]) {
  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y += 1) for (let x = 0; x < size; x += 1) {
    const u = x / size, v = y / size
    const frame = u > .22 && u < .78 && v > .22 && v < .78 && (u < .27 || u > .73 || v < .27 || v > .73)
    const wheel = Math.hypot(u - .5, v - .5) < .14 && Math.hypot(u - .5, v - .5) > .1
    const spokes = Math.abs(u - .5) < .018 && Math.abs(v - .5) < .16 || Math.abs(v - .5) < .018 && Math.abs(u - .5) < .16
    const color = frame || wheel || spokes ? [249, 250, 251] : [17, 24, 39]
    const offset = y * (size * 3 + 1) + 1 + x * 3
    color.forEach((value, index) => { raw[offset + index] = value })
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(size); header.writeUInt32BE(size, 4); header[8] = 8; header[9] = 2
  writeFileSync(join(root, file), Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk('IHDR', header), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]))
}
