'use client'

import { useState } from 'react'
import {
  ALL_CATEGORIES,
  filterStashRows,
  type StashStatus,
  type StashSummary,
} from './view-model'
import type { EnrichedStashRow } from './analysis-model'
import { StashDetail } from './stash-detail'
import { ClassificationBadge, SectionLabel } from '../ui/vault'

export interface StashBrowserProps {
  readonly rows: readonly EnrichedStashRow[]
  readonly categories: readonly string[]
  readonly summary: StashSummary
  readonly status: StashStatus
}

/**
 * Inventory-style stash browser: search/filter, dense grid, inspector.
 * Filtering is pure and local; selection resolves against the full list.
 * Empty slots are presentation-only placeholders and never alter capacity facts.
 */
export function StashBrowser({ rows, categories, summary, status }: StashBrowserProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL_CATEGORIES)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleRows = filterStashRows(rows, query, category)
  const selectedRow = rows.find((row) => row.itemId === selectedId) ?? null
  const emptySlots =
    summary.hasStash &&
    summary.usedSlots !== undefined &&
    summary.totalSlots !== undefined
      ? Math.max(summary.totalSlots - rows.length, 0)
      : 0

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <section aria-labelledby="stash-items-heading" className="min-w-0">
        <div className="rounded-sm border border-vault-line bg-vault-surface p-4">
          <SectionLabel>Snapshot</SectionLabel>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-vault-muted">
            <span>
              <span className="font-semibold text-vault-text">Provider:</span>{' '}
              <span className="font-mono">{status.providerId}</span>
            </span>
            <span>
              <span className="font-semibold text-vault-text">Capture:</span>{' '}
              <span className="font-mono">{status.fetchedAt}</span>
            </span>
            <span>
              <span className="font-semibold text-vault-text">Status:</span>{' '}
              <span className="font-bold">{status.stale ? 'Stale fallback' : 'Fresh'}</span>
            </span>
            {summary.hasStash && summary.usedSlots !== undefined && summary.totalSlots !== undefined && (
              <span>
                <span className="font-semibold text-vault-text">Slots:</span>{' '}
                <span className="font-mono">{summary.usedSlots} / {summary.totalSlots}</span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 grid gap-3 rounded-sm border border-vault-line bg-vault-surface p-4 sm:grid-cols-2">
          <div>
            <label htmlFor="stash-search" className="mb-1 block text-[11px] font-semibold uppercase tracking-micro text-vault-muted">
              Search items
            </label>
            <input
              id="stash-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, ID, or category"
              className="w-full rounded-sm border border-vault-line bg-vault-void px-3 py-2 text-sm text-vault-text placeholder:text-vault-muted/70"
            />
          </div>
          <div>
            <label htmlFor="stash-category" className="mb-1 block text-[11px] font-semibold uppercase tracking-micro text-vault-muted">
              Category
            </label>
            <select
              id="stash-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-sm border border-vault-line bg-vault-void px-3 py-2 text-sm text-vault-text"
            >
              <option value={ALL_CATEGORIES}>All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex items-baseline justify-between gap-2">
          <h2 id="stash-items-heading" className="text-lg font-bold text-vault-text">
            Items
          </h2>
          <p aria-live="polite" className="font-mono text-xs text-vault-muted">
            {visibleRows.length} of {rows.length} items
          </p>
        </div>

        {!summary.hasStash && (
          <p className="mt-2 rounded-sm border border-vault-line bg-vault-surface p-4 text-sm text-vault-muted">
            No stash in this snapshot.
          </p>
        )}
        {summary.hasStash && rows.length === 0 && (
          <p className="mt-2 rounded-sm border border-vault-line bg-vault-surface p-4 text-sm text-vault-muted">Stash is empty.</p>
        )}
        {summary.hasStash && rows.length > 0 && visibleRows.length === 0 && (
          <p className="mt-2 rounded-sm border border-vault-line bg-vault-surface p-4 text-sm text-vault-muted">
            No items match the current search or filter.
          </p>
        )}
        {visibleRows.length > 0 && (
          <ul className="vault-inventory mt-2 grid gap-2 sm:grid-cols-2">
            {visibleRows.map((row) => {
              const selected = row.itemId === selectedId
              return (
                <li key={row.itemId}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(row.itemId)}
                    aria-pressed={selected}
                    className={
                      selected
                        ? 'vault-item w-full rounded-sm border-2 border-vault-amber bg-vault-raised p-3 text-left'
                        : 'vault-item w-full rounded-sm border-2 border-vault-line bg-vault-surface p-3 text-left hover:border-vault-muted'
                    }
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-vault-text">
                          {row.displayName ?? row.itemId}
                        </span>
                        {row.displayName !== undefined && (
                          <span className="block truncate font-mono text-[11px] text-vault-muted">
                            ID: {row.itemId}
                          </span>
                        )}
                      </span>
                      <ClassificationBadge value={row.classification} />
                    </span>
                    <span className="mt-2 flex items-center justify-between gap-2 font-mono text-[11px] text-vault-muted">
                      <span>QTY {row.quantity}</span>
                      <span className="truncate">{row.category ?? 'unknown'}</span>
                    </span>
                    {!row.metadataKnown && (
                      <span className="mt-1 block text-[11px] text-vault-amber">
                        Game data unknown — REVIEW
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
            {emptySlots > 0 &&
              Array.from({ length: Math.min(emptySlots, 12) }, (_, i) => (
                <li
                  key={`empty-${i}`}
                  aria-hidden="true"
                  className="rounded-sm border border-dashed border-vault-line p-3 text-center text-[11px] uppercase tracking-micro text-vault-muted/60"
                >
                  Empty slot
                </li>
              ))}
          </ul>
        )}
        {emptySlots > 12 && (
          <p className="mt-2 font-mono text-[11px] text-vault-muted">
            + {emptySlots - 12} further empty slots (presentation only).
          </p>
        )}
      </section>

      <div className="min-w-0">
        <div className="lg:sticky lg:top-[68px]">
          <StashDetail row={selectedRow} />
        </div>
      </div>
    </div>
  )
}
