import type { StashRow } from './view-model'

/**
 * Presentational item detail. Shows the stable ID always; name and
 * category only when GameKnowledge provided them. Never invents data.
 */
export function StashDetail({ row }: { readonly row: StashRow | null }) {
  if (row === null) {
    return <p className="text-sm text-gray-500">Select an item to see details.</p>
  }
  return (
    <section aria-label="Item details" aria-live="polite" className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-lg font-semibold text-gray-900">Item details</h2>
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">ID</dt>
          <dd className="text-right font-mono text-gray-900">{row.itemId}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Name</dt>
          <dd className="text-right text-gray-900">{row.displayName ?? 'Unknown — showing ID'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Quantity owned</dt>
          <dd className="text-right text-gray-900">{row.quantity}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Category</dt>
          <dd className="text-right text-gray-900">{row.category ?? 'Unknown'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Game data</dt>
          <dd className="text-right text-gray-900">{row.metadataKnown ? 'Known' : 'Unknown'}</dd>
        </div>
      </dl>
    </section>
  )
}
