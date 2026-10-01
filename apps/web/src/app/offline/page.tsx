import { OfflineStash } from '../../stash/offline-stash'
import { PrivacyStorage } from '../../storage/privacy-storage'

export default function OfflinePage() {
  return <main id="main-content" tabIndex={-1}>
    <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Local workspace</p>
    <h1 className="mt-1 text-[32px] font-bold text-vault-text">RaidVault local workspace</h1>
    <p className="mt-1 max-w-2xl text-sm text-vault-muted">
      Offline-first restored snapshot. Stale stays stale — nothing here refreshes
      from a provider or Bridge.
    </p>
    <div className="mt-5">
      <OfflineStash />
    </div>
    <div className="mt-4">
      <PrivacyStorage />
    </div>
  </main>
}

export function OfflinePageShell() {
  return <OfflinePage />
}
