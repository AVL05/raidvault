import type { EnrichedStashRow } from './analysis-model'
import { ClassificationBadge, SectionLabel } from '../ui/vault'

/**
 * Presentational item inspector. Shows stable ID always, authoritative
 * deterministic facts, and structured reasons. Never invents data.
 */
export function StashDetail({ row }: { readonly row: EnrichedStashRow | null }) {
  if (row === null) {
    return (
      <section
        aria-label="Item details"
        className="rounded-sm border border-vault-line bg-vault-surface p-4"
      >
        <SectionLabel>Item inspector</SectionLabel>
        <p className="mt-2 text-sm text-vault-muted">Select an item to see deterministic facts.</p>
      </section>
    )
  }
  return (
    <section
      aria-label="Item details"
      aria-live="polite"
      className="rounded-sm border border-vault-line bg-vault-surface p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SectionLabel>Item inspector</SectionLabel>
        <ClassificationBadge value={row.classification} />
      </div>
      <h2 className="mt-2 truncate text-lg font-bold text-vault-text">
        {row.displayName ?? row.itemId}
      </h2>
      <p className="truncate font-mono text-[11px] text-vault-muted">ID: {row.itemId}</p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Quantity owned</dt>
          <dd className="font-mono text-vault-text">{row.quantity}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Category</dt>
          <dd className="text-vault-text">{row.category ?? 'Unknown'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Game data</dt>
          <dd className="text-vault-text">{row.metadataKnown ? 'Known' : 'Unknown'}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Required</dt>
          <dd className="font-mono text-vault-text">{row.required}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Reserved</dt>
          <dd className="font-mono text-vault-text">{row.reserved}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Missing</dt>
          <dd className="font-mono text-vault-text">{row.missing}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Surplus</dt>
          <dd className="font-mono text-vault-text">{row.surplus}</dd>
        </div>
      </dl>
      <div className="mt-3 border-t border-vault-line pt-3">
        <SectionLabel>Deterministic reasons</SectionLabel>
        <ul className="mt-2 space-y-1.5">
          {row.reasons.map((reason) => (
            <li key={`${reason.code}:${reason.message}`} className="text-xs leading-relaxed">
              <span className="font-mono font-bold text-vault-amber">{reason.code}</span>
              <span className="block text-vault-muted">{reason.message}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
