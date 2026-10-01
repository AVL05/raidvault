'use client'

import { useEffect, useRef, useState } from 'react'
import type { PlayerStateSnapshot } from '@raidvault/providers'
import { APP_BUILD, APP_VERSION } from '../pwa/version'
import { MOCK_GAME_DATA_PAYLOAD, MOCK_PROVIDER_ID } from '../stash/mock-data'
import { clearSnapshots, readSnapshot, saveSnapshot, type SnapshotResult, type StorageAction } from './snapshot-store'
import { clearShellCaches, shellCacheNames, storageInfo, type BrowserStorageInfo } from './storage-info'

type ClearCategory = 'snapshots' | 'shell'
const descriptions = {
  snapshots: 'Delete saved player snapshots from this browser. Open views remain in memory. App-shell caches and models are preserved.',
  shell: 'Delete only RaidVault app-shell caches. Offline reloads may be unavailable until a subsequent worker installation restores the shell. Snapshots and models are preserved.',
}
const bytes = (value: number | undefined) => value === undefined ? 'Unknown' : `${value} bytes (approximate)`

export function PrivacyStorage({ initialSnapshot }: { readonly initialSnapshot?: PlayerStateSnapshot }) {
  const [snapshot, setSnapshot] = useState<SnapshotResult>()
  const [info, setInfo] = useState<BrowserStorageInfo>()
  const [cacheNames, setCacheNames] = useState<readonly string[]>()
  const [cacheStatus, setCacheStatus] = useState('Checking')
  const [notice, setNotice] = useState<StorageAction>()
  const [confirm, setConfirm] = useState<ClearCategory>()
  const [busy, setBusy] = useState(false)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)

  useEffect(() => {
    let live = true
    async function inspect() {
      if (initialSnapshot !== undefined) {
        const saved = await saveSnapshot(initialSnapshot)
        if (live) setNotice(saved)
      }
      const current = await readSnapshot(MOCK_PROVIDER_ID)
      const estimate = await storageInfo(navigator.storage)
      if (live) { setSnapshot(current); setInfo(estimate) }
      try {
        const names = await shellCacheNames(window.caches)
        if (live) { setCacheNames(names); setCacheStatus(names === undefined ? 'Unsupported' : 'Supported') }
      } catch { if (live) setCacheStatus('Unknown — cache inspection failed') }
    }
    void inspect().catch(() => {
      if (live) {
        setSnapshot({ status: 'error', message: 'Saved snapshot storage could not be inspected.' })
        setInfo({ status: 'error', persistent: 'error' })
        setCacheStatus('Unknown — cache inspection failed')
        setNotice({ status: 'error', message: 'Browser storage could not be inspected.' })
      }
    })
    return () => { live = false }
  }, [initialSnapshot])
  useEffect(() => {
    if (confirm !== undefined) cancelRef.current?.focus()
    else triggerRef.current?.focus()
  }, [confirm])

  function closeConfirmation() { setConfirm(undefined) }
  async function clear() {
    if (confirm === undefined || busy) return
    setBusy(true)
    try {
      const result = confirm === 'snapshots' ? await clearSnapshots() : await clearShellCaches(window.caches)
      setNotice(result)
      setSnapshot(await readSnapshot(MOCK_PROVIDER_ID))
      try { setCacheNames(await shellCacheNames(window.caches)) }
      catch { setCacheStatus('Unknown — cache inspection failed') }
      setInfo(await storageInfo(navigator.storage))
    } catch { setNotice({ status: 'error', message: 'Storage operation failed. Completion could not be confirmed.' }) }
    finally { setBusy(false); closeConfirmation() }
  }
  return <section aria-labelledby="privacy-heading" className="rounded-sm border border-vault-line bg-vault-surface p-4">
    <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-muted">Local data</p>
    <h2 id="privacy-heading" className="mt-1 text-xl font-bold text-vault-text">Privacy / Storage</h2>
    <p className="mb-4 mt-1 text-sm text-vault-muted">RaidVault core works locally without telemetry, analytics, or cloud AI. This build uses synthetic demo data and no real player account.</p>
    <dl className="space-y-2 break-words text-sm text-vault-muted">
      <dt className="font-semibold text-vault-text">Application</dt><dd>RaidVault {APP_VERSION} · Build {APP_BUILD}</dd>
      <dt className="font-semibold text-vault-text">Local snapshots</dt><dd>{snapshot === undefined ? 'Checking' : snapshot.status === 'ready'
        ? `Saved · ${snapshot.snapshot.providerId} · captured ${new Date(snapshot.snapshot.state.snapshotMetadata.capturedAt).toISOString()}`
        : snapshot.message}</dd>
      <dt className="font-semibold text-vault-text">Game knowledge</dt><dd>Bundled synthetic dataset · {MOCK_GAME_DATA_PAYLOAD.metadata.origin} · {MOCK_GAME_DATA_PAYLOAD.metadata.revision}. No independently stored game-data cache.</dd>
      <dt className="font-semibold text-vault-text">Offline shell cache</dt><dd>{cacheStatus}{cacheNames === undefined ? '' : ` · ${cacheNames.length} owned cache(s)`}</dd>
      {cacheNames !== undefined && cacheNames.length > 0 && <dd><ul className="font-mono text-[11px]">{cacheNames.map((name) => <li key={name} className="truncate">{name}</li>)}</ul></dd>}
      <dt className="font-semibold text-vault-text">Browser origin storage</dt><dd>{info === undefined ? 'Checking' : info.status === 'unsupported' ? 'Unsupported' : info.status === 'error' ? 'Unknown — estimate failed' : `Usage: ${bytes(info.usage)} · Quota: ${bytes(info.quota)}`}. Estimates cover the whole origin, not individual categories.</dd>
      <dt className="font-semibold text-vault-text">Persistent storage</dt><dd>{info?.persistent ?? 'Checking'}. Persistence is not required; the browser may evict local data.</dd>
      <dt className="font-semibold text-vault-text">M8 model storage</dt><dd>No production model, descriptor, or artifact store is configured. Model size is unavailable.</dd>
    </dl>
    <div className="mt-4 flex flex-wrap gap-2">
      {(['snapshots', 'shell'] as const).map((category) => <button key={category} type="button"
        disabled={busy || confirm !== undefined || (category === 'snapshots'
          ? snapshot === undefined || snapshot.status === 'unsupported'
          : cacheStatus === 'Checking' || cacheStatus === 'Unsupported')}
        className="rounded-sm border border-vault-line bg-vault-raised px-3 py-2 text-sm font-semibold text-vault-text disabled:opacity-50"
        onClick={(event) => { triggerRef.current = event.currentTarget; setConfirm(category) }}>
        {category === 'snapshots' ? 'Clear saved snapshots' : 'Clear offline app-shell caches'}
      </button>)}
      <button type="button" disabled aria-describedby="model-removal-reason" className="rounded-sm border border-vault-line px-3 py-2 text-sm text-vault-muted disabled:opacity-50">Remove local model</button>
    </div>
    <p id="model-removal-reason" className="mt-2 text-sm text-vault-muted">Model removal is unavailable: no actual M8 model manager is configured.</p>
    {confirm !== undefined && <div role="group" aria-labelledby="clear-confirmation-title" aria-busy={busy}
      className="mt-4 rounded-sm border border-vault-amber/60 bg-vault-void p-4"
      onKeyDown={(event) => { if (event.key === 'Escape' && !busy) closeConfirmation() }}>
      <h3 id="clear-confirmation-title" className="font-semibold text-vault-text">Confirm {confirm === 'snapshots' ? 'snapshot deletion' : 'app-shell cache deletion'}</h3>
      <p className="my-2 text-sm text-vault-muted">{descriptions[confirm]}</p>
      <button ref={cancelRef} type="button" disabled={busy} className="mr-3 rounded-sm border border-vault-line bg-vault-raised px-3 py-2 text-vault-text" onClick={closeConfirmation}>Cancel</button>
      <button type="button" disabled={busy} className="rounded-sm bg-vault-amber px-3 py-2 font-semibold text-vault-amberink" onClick={() => { void clear() }}>{busy ? 'Clearing…' : 'Confirm deletion'}</button>
    </div>}
    <p role={notice?.status === 'error' ? 'alert' : 'status'} className="mt-3 text-sm text-vault-muted">{notice?.message ?? 'Only RaidVault-owned categories can be cleared here.'}</p>
  </section>
}
