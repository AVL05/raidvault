import { OfflineStash } from '../../stash/offline-stash'
import { PrivacyStorage } from '../../storage/privacy-storage'

export default function OfflinePage() {
  return <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 p-4 sm:p-8">
    <div className="mx-auto max-w-5xl">
      <h1 className="mb-4 text-3xl font-bold text-gray-900">RaidVault local workspace</h1>
      <OfflineStash />
      <PrivacyStorage />
    </div>
  </main>
}
