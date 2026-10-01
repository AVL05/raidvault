import type { PlanningSnapshot, StashAnalysis } from '@raidvault/rules-engine'
import type { StashStatus, StashSummary } from '../stash/view-model'
import type { EnrichedStashRow } from '../stash/analysis-model'
import { ClassificationBadge, Panel, ProgressBar, SectionLabel, StatusChip } from '../ui/vault'

export interface OverviewData {
  readonly rows: readonly EnrichedStashRow[]
  readonly categories: readonly string[]
  readonly summary: StashSummary
  readonly status: StashStatus
  readonly planning: PlanningSnapshot
  readonly analysis: StashAnalysis
}

function occupancy(summary: StashSummary): { used: number; total: number; pct: number } | undefined {
  if (!summary.hasStash || summary.usedSlots === undefined || summary.totalSlots === undefined) {
    return undefined
  }
  const pct = summary.totalSlots <= 0 ? 0 : Math.round((summary.usedSlots / summary.totalSlots) * 100)
  return { used: summary.usedSlots, total: summary.totalSlots, pct }
}

export function Overview({ data }: { readonly data: OverviewData }) {
  const occ = occupancy(data.summary)
  const reservedUnits = data.analysis.items.reduce((n, i) => n + i.reserved, 0)
  const reservedLines = data.analysis.items.filter((i) => i.reserved > 0)
  const missingUnits = data.planning.missingItems.reduce((n, i) => n + i.totalMissing, 0)
  const sample = data.rows.slice(0, 4)
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">
        RaidVault · v0.1.0 public preview
      </p>
      <h1 className="mt-1 text-[32px] font-bold leading-tight text-vault-text">
        Overview
      </h1>
      <p className="mt-1 max-w-2xl text-sm text-vault-muted">
        Synthetic demo snapshot · no live account integration. Every number below
        comes from validated snapshot, game knowledge, and deterministic analysis.
      </p>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Panel label="Stash occupancy">
          <SectionLabel>Stash occupancy</SectionLabel>
          {occ === undefined ? (
            <p className="mt-2 text-sm text-vault-muted">No stash in this snapshot.</p>
          ) : (
            <>
              <p className="mt-2 font-mono text-2xl font-bold text-vault-text">
                {occ.used}<span className="text-sm text-vault-muted"> / {occ.total}</span>
              </p>
              <div className="mt-2">
                <ProgressBar owned={occ.used} required={occ.total} label="Stash occupancy" />
              </div>
            </>
          )}
        </Panel>
        <Panel label="Reserved requirements">
          <SectionLabel>Reserved requirements</SectionLabel>
          <p className="mt-2 font-mono text-2xl font-bold text-vault-text">{reservedUnits}</p>
          <p className="mt-1 text-xs text-vault-muted">
            {reservedLines.length} item{reservedLines.length === 1 ? '' : 's'} reserved for active targets
          </p>
        </Panel>
        <Panel label="Missing requirements">
          <SectionLabel>Missing requirements</SectionLabel>
          <p className="mt-2 font-mono text-2xl font-bold text-vault-text">{missingUnits}</p>
          <p className="mt-1 text-xs text-vault-muted">
            {data.planning.missingItems.length} missing line{data.planning.missingItems.length === 1 ? '' : 's'} · {data.planning.raidPriorities.length} raid priorit{data.planning.raidPriorities.length === 1 ? 'y' : 'ies'}
          </p>
        </Panel>
        <Panel label="Snapshot state">
          <SectionLabel>Snapshot state</SectionLabel>
          <p className="mt-2 flex flex-wrap gap-1.5">
            <StatusChip tone={data.status.stale ? 'amber' : 'safe'}>
              {data.status.stale ? 'Stale fallback' : 'Fresh'}
            </StatusChip>
          </p>
          <p className="mt-2 truncate font-mono text-[11px] text-vault-muted">{data.status.providerId}</p>
          <p className="truncate font-mono text-[11px] text-vault-muted">{data.status.fetchedAt}</p>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panel label="Raid priorities">
          <div className="flex items-center justify-between gap-2">
            <SectionLabel>Current raid priorities</SectionLabel>
            <a href="/planning" className="text-xs font-semibold text-vault-amber underline">
              Open planning
            </a>
          </div>
          {data.planning.raidPriorities.length === 0 ? (
            <p className="mt-3 text-sm text-vault-muted">
              {data.planning.hasStash
                ? 'No missing requirements — no raid priorities.'
                : 'Planning unavailable: no stash in this snapshot.'}
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {data.planning.raidPriorities.slice(0, 5).map((p) => (
                <li
                  key={p.itemId}
                  className="flex items-center gap-3 rounded-sm border border-vault-line bg-vault-void px-3 py-2"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-vault-amber font-mono text-sm font-black text-vault-amberink">
                    {p.rank}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-vault-text">
                      {p.displayName ?? p.itemId}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-vault-muted">
                      missing {p.missing} · {p.sourceTargetIds.join(', ')}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
          {reservedLines.length > 0 && (
            <div className="mt-4">
              <SectionLabel>Reserve summary</SectionLabel>
              <ul className="mt-2 space-y-1.5">
                {reservedLines.slice(0, 4).map((item) => (
                  <li key={item.itemId} className="flex items-center justify-between gap-2 text-xs">
                    <span className="truncate font-mono text-vault-muted">{item.itemId}</span>
                    <span className="shrink-0 font-mono text-vault-text">
                      reserved {item.reserved} / owned {item.owned}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
        <div className="grid gap-3">
          <Panel label="System status">
            <SectionLabel>System status</SectionLabel>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-vault-muted">Gaming Mode</dt>
                <dd><StatusChip tone="amber">Unknown · fail-safe</StatusChip></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-vault-muted">Local AI</dt>
                <dd><StatusChip tone="neutral">Locked · not installed</StatusChip></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-vault-muted">Bridge</dt>
                <dd><StatusChip tone="neutral">Not connected</StatusChip></dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-vault-muted">Workshop planning</dt>
                <dd><StatusChip tone="neutral">Unsupported</StatusChip></dd>
              </div>
            </dl>
            <p className="mt-3 text-xs leading-relaxed text-vault-muted">
              Gaming Mode UNKNOWN blocks AI generation. Browser connectivity alone
              never marks restored data fresh.
            </p>
          </Panel>
          <Panel label="Stash sample">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>Stash items · stash order</SectionLabel>
              <a href="/stash" className="text-xs font-semibold text-vault-amber underline">
                Open stash
              </a>
            </div>
            {sample.length === 0 ? (
              <p className="mt-3 text-sm text-vault-muted">No stash items in this snapshot.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sample.map((row) => (
                  <li
                    key={row.itemId}
                    className="flex items-center gap-2 rounded-sm border border-vault-line bg-vault-void px-3 py-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-vault-text">
                        {row.displayName ?? row.itemId}
                      </span>
                      <span className="block font-mono text-[11px] text-vault-muted">
                        qty {row.quantity}
                      </span>
                    </span>
                    <ClassificationBadge value={row.classification} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  )
}
