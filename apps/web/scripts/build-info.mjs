import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative } from 'node:path'

export const webRoot = fileURLToPath(new URL('../', import.meta.url))

export function sourceBuildId() {
  const hash = createHash('sha256')
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const path = join(directory, entry.name)
      if (entry.isDirectory()) visit(path)
      else if (!entry.name.includes('.test.')) {
        hash.update(relative(webRoot, path).replaceAll('\\', '/'))
        hash.update(readFileSync(path))
      }
    }
  }
  for (const directory of ['src', 'scripts', 'public/icons']) visit(join(webRoot, directory))
  for (const file of ['package.json', 'next.config.mjs', 'postcss.config.mjs', 'tailwind.config.mjs']) {
    hash.update(file).update(readFileSync(join(webRoot, file)))
  }
  return hash.digest('hex')
}
