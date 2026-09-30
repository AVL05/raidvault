'use client'

import { useState } from 'react'
import {
  ALL_CATEGORIES,
  filterStashRows,
  type StashRow,
  type StashStatus,
  type StashSummary,
} from './view-model'
import { StashDetail } from './stash-detail'

export interface StashBrowserProps {
  readonly rows: readonly StashRow[]
  readonly categories: readonly string[]
  readonly summary: StashSummary
  readonly status: StashStatus
}

/**
 * Interactive stash browser: search, category filter, list, and detail.
 * All data arrives as validated props; filtering is pure and local.
 * Selection persists across filtering and always resolves against the
 * full row list.
 */
export function StashBrowser({ rows, categories, summary, status }: StashBrowserProps) {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(ALL_CATEGORIES)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const visibleRows = filterStashRows(rows, query, category)
  const selectedRow = rows.find((row) => row.itemId === selectedId) ?? null

  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="stash-items-heading" className="min-w-0">
        <div className="mb-4 rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-700">
            <span className="font-medium">Provider:</span> {status.providerId}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Snapshot:</span> {status.fetchedAt}
          </p>
          <p className="text-sm text-gray-700">
            <span className="font-medium">Status:</span>{' '}
            <span className="font-semibold">{status.stale ? 'Stale fallback' : 'Fresh'}</span>
          </p>
          {summary.hasStash && summary.usedSlots !== undefined && summary.totalSlots !== undefined && (
            <p className="text-sm text-gray-700">
              <span className="font-medium">Slots:</span> {summary.usedSlots} / {summary.totalSlots}
            </p>
          )}
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="stash-search" className="mb-1 block text-sm font-medium text-gray-700">
              Search items
            </label>
            <input
              id="stash-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Name, ID, or category"
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="stash-category" className="mb-1 block text-sm font-medium text-gray-700">
              Category
            </label>
            <select
              id="stash-category"
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
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

        <h2 id="stash-items-heading" className="mb-2 text-lg font-semibold text-gray-900">
          Items
        </h2>
        <p aria-live="polite" className="mb-2 text-sm text-gray-600">
          {visibleRows.length} of {rows.length} items
        </p>

        {!summary.hasStash && (
          <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
            No stash in this snapshot.
          </p>
        )}
        {summary.hasStash && rows.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">Stash is empty.</p>
        )}
        {summary.hasStash && rows.length > 0 && visibleRows.length === 0 && (
          <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
            No items match the current search or filter.
          </p>
        )}
        {visibleRows.length > 0 && (
          <ul className="space-y-2">
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
                        ? 'w-full rounded-lg border-2 border-gray-900 bg-white p-3 text-left shadow'
                        : 'w-full rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm'
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {row.displayName ?? row.itemId}
                      </span>
                      {selected && (
                        <span className="shrink-0 rounded bg-gray-900 px-2 py-0.5 text-xs font-medium text-white">
                          Selected
                        </span>
                      )}
                    </span>
                    {row.displayName !== undefined && (
                      <span className="block truncate font-mono text-xs text-gray-500">
                        ID: {row.itemId}
                      </span>
                    )}
                    <span className="mt-1 block text-xs text-gray-600">
                      Quantity: {row.quantity} · Category: {row.category ?? 'unknown'}
                      {!row.metadataKnown && ' · Game data unknown'}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <div className="min-w-0">
        <StashDetail row={selectedRow} />
      </div>
    </div>
  )
}
