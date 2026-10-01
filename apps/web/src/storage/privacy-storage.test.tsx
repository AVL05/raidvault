import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { readFileSync } from 'node:fs'
import { PrivacyStorage } from './privacy-storage'
import { PwaStatus } from '../pwa/pwa-status'
import OfflinePage from '../app/offline/page'
import RootLayout from '../app/layout'

describe('M10 privacy, offline, accessibility and performance contracts', () => {
  it('shows truthful independent categories and unavailable model removal', () => {
    const html = renderToString(<PrivacyStorage />)
    expect(html).toContain('Privacy / Storage')
    expect(html).toContain('Clear saved snapshots'); expect(html).toContain('Clear offline app-shell caches')
    expect(html).toMatch(/disabled=""[^>]*>Remove local model/)
    expect(html).toContain('no actual M8 model manager')
    expect(html).toContain('Estimates cover the whole origin')
    expect(html).not.toContain('0 bytes')
    expect(html).toContain('role="status"')
  })
  it('uses explicit accessible confirmations before destructive operations', () => {
    const source = readFileSync('apps/web/src/storage/privacy-storage.tsx', 'utf8')
    expect(source).toContain('aria-labelledby="clear-confirmation-title"')
    expect(source).toContain('Confirm deletion'); expect(source).toContain('Cancel')
    expect(source).toContain("event.key === 'Escape'")
    expect(source).toContain('cancelRef.current?.focus()'); expect(source).toContain('triggerRef.current?.focus()')
    expect(source).not.toMatch(/deleteDatabase|\.remove\(|localStorage/)
  })
  it('provides skip navigation and a static offline shell with no player state embedded', () => {
    const html = renderToString(<RootLayout><OfflinePage /></RootLayout>)
    expect(html).toContain('Skip to content'); expect(html).toContain('href="#main-content"')
    expect(html).toContain('id="main-content"'); expect(html).toContain('Reading saved local snapshot')
    expect(html).not.toContain('demo-raider'); expect(html).not.toContain('demo-stash')
  })
  it('keeps browser connectivity separate from provider/Bridge freshness', () => {
    const html = renderToString(<PwaStatus />)
    expect(html).toContain('Browser network:'); expect(html).toContain('Unknown')
    expect(html).toContain('does not verify provider or Bridge')
    const source = readFileSync('apps/web/src/pwa/pwa-status.tsx', 'utf8')
    expect(source).not.toMatch(/refresh\(|stale: false|setInterval|setTimeout/)
  })
  it('does not load models or generate on render, and retains labels and busy semantics', () => {
    const local = readFileSync('apps/web/src/ai/ai-panel.tsx', 'utf8')
    const chat = readFileSync('apps/web/src/arc-ai/arc-ai-chat.tsx', 'utf8')
    expect(local).not.toMatch(/\.load\(|\.install\(/)
    expect(chat).not.toMatch(/\.generate\(|useEffect|setInterval|setTimeout/)
    expect(chat).toContain('htmlFor="arc-ai-input"'); expect(chat).toContain('aria-busy={generating}')
    expect(chat).toContain('controller.snapshot().status')
    expect(local).toContain('reason}</span>')
  })
  it('adds no periodic polling or gameplay controls to M10 surfaces', () => {
    const sources = ['pwa/pwa-status.tsx', 'pwa/register.ts', 'storage/privacy-storage.tsx', 'stash/offline-stash.tsx']
      .map((path) => readFileSync(`apps/web/src/${path}`, 'utf8')).join('\n')
    expect(sources).not.toMatch(/setInterval|setTimeout|ReadProcessMemory|WriteProcessMemory|dispatchEvent|requestPointerLock/)
  })
})
