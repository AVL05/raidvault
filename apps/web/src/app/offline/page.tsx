import { PageHeader } from '../../ui/vault'
import { OfflineStash } from '../../stash/offline-stash'
import { PrivacyStorage } from '../../storage/privacy-storage'

export default function OfflinePage() {
  return <main id="main-content" tabIndex={-1}>
    <PageHeader title="RaidVault local workspace">
      Offline-first restored snapshot. Stale stays stale — nothing here refreshes
      from a provider or Bridge.
    </PageHeader>
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
