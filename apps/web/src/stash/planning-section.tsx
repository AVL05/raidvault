import type {
  MissingItemPlan,
  PlanningSnapshot,
  RaidPriority,
  TargetPlan,
} from '@raidvault/rules-engine'
import { Panel, ProgressBar, SectionLabel, StatusChip } from '../ui/vault'

/**
 * Deterministic planning section. Renders a PlanningSnapshot verbatim:
 * current targets, missing items, next-raid priorities, and explicit
 * states. No business math lives here; every number arrives computed.
 * Priorities reflect current missing requirements only — never value,
 * rarity, location, or preference scoring.
 */

function targetLabel(target: TargetPlan): string {
  return target.targetName ?? target.targetId
}

function itemLabel(itemId: string, displayName: string | undefined): string {
  return displayName ?? itemId
}

function TargetCard({ target }: { readonly target: TargetPlan }) {
  const owned = target.requirements.reduce((n, g) => n + Math.min(g.owned, g.requiredForTarget), 0)
  const required = target.requirements.reduce((n, g) => n + g.requiredForTarget, 0)
  return (
    <li className="rounded-sm border border-vault-line bg-vault-void p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-bold text-vault-text">{targetLabel(target)}</span>
        <span className="flex gap-1.5">
          <StatusChip tone="neutral">{target.targetType === 'QUEST' ? 'Quest' : 'Project'}</StatusChip>
          <StatusChip tone={target.complete ? 'safe' : 'amber'}>
            {target.complete ? 'Complete' : 'Incomplete'}
          </StatusChip>
        </span>
      </div>
      {target.targetName !== undefined && (
        <p className="mt-1 truncate font-mono text-[11px] text-vault-muted">ID: {target.targetId}</p>
      )}
      {required > 0 && (
        <div className="mt-3">
          <ProgressBar owned={owned} required={required} label={`${targetLabel(target)} progress`} />
        </div>
      )}
      {target.requirements.length === 0 ? (
        <p className="mt-2 text-xs text-vault-muted">No requirements listed for this target.</p>
      ) : (
        <ul className="mt-2 space-y-1.5">
          {target.requirements.map((gap) => (
            <li
              key={gap.itemId}
              className="flex flex-wrap items-baseline justify-between gap-2 border-t border-vault-line pt-1.5 text-xs"
            >
              <span className="font-mono text-vault-muted">{gap.itemId}</span>
              <span className="font-mono text-vault-text">
                required: {gap.requiredForTarget} · owned: {gap.owned} · missing: {gap.missingForTarget}
              </span>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function MissingItemRow({ item }: { readonly item: MissingItemPlan }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-sm border border-vault-line bg-vault-void px-3 py-2.5 text-sm">
      <span className="min-w-0">
        <span className="block truncate font-bold text-vault-text">{itemLabel(item.itemId, item.displayName)}</span>
        {item.displayName !== undefined && (
          <span className="block truncate font-mono text-[11px] text-vault-muted">ID: {item.itemId}</span>
        )}
      </span>
      <span className="shrink-0 text-right font-mono text-xs text-vault-text">
        Missing: {item.totalMissing}
        <span className="block text-[11px] text-vault-muted">{item.sourceTargetIds.join(', ')}</span>
      </span>
    </li>
  )
}

function PriorityRow({ priority }: { readonly priority: RaidPriority }) {
  return (
    <li className="flex items-center gap-3 rounded-sm border border-vault-line bg-vault-void px-3 py-2.5 text-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-vault-amber font-mono text-sm font-black text-vault-amberink">
        {priority.rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold text-vault-text">
          {itemLabel(priority.itemId, priority.displayName)}
        </span>
        <span className="block font-mono text-[11px] text-vault-muted">
          Missing: {priority.missing} · Sources: {priority.sourceTargetIds.join(', ')}
        </span>
      </span>
    </li>
  )
}

export function PlanningSection({ planning }: { readonly planning: PlanningSnapshot }) {
  const allComplete =
    planning.hasStash && planning.targets.length > 0 && planning.missingItems.length === 0
  const readyCount = planning.targets.filter((t) => t.complete).length
  return (
    <section aria-labelledby="planning-heading">
      {!planning.hasStash && (
        <p className="rounded-sm border border-vault-line bg-vault-surface p-4 text-sm text-vault-muted">
          Planning unavailable: no stash in this snapshot.
        </p>
      )}

      {planning.hasStash && planning.targets.length === 0 && (
        <p className="rounded-sm border border-vault-line bg-vault-surface p-4 text-sm text-vault-muted">
          No current requirements.
        </p>
      )}

      {planning.targets.length > 0 && (
        <Panel label="Current targets">
          <div className="flex items-baseline justify-between gap-2">
            <SectionLabel>Current targets</SectionLabel>
            <span className="font-mono text-[11px] text-vault-muted">
              {readyCount}/{planning.targets.length} ready
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {planning.targets.map((target) => (
              <TargetCard
                key={`${target.targetType}:${target.targetId}`}
                target={target}
              />
            ))}
          </ul>
        </Panel>
      )}

      {planning.incompleteReferences.length > 0 && (
        <Panel label="Incomplete references" className="mt-3">
          <SectionLabel>Incomplete references</SectionLabel>
          <ul className="mt-2 space-y-1.5">
            {planning.incompleteReferences.map((reference) => (
              <li
                key={`${reference.targetType}:${reference.targetId}`}
                className="rounded-sm border border-vault-amber/40 bg-vault-void p-3 text-xs text-vault-muted"
              >
                {reference.targetType === 'QUEST' ? 'Quest' : 'Project'} reference{' '}
                <span className="font-mono text-vault-text">{reference.targetId}</span> has no matching game data.
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {planning.hasStash && planning.targets.length > 0 && planning.missingItems.length > 0 && (
        <Panel label="Missing items" className="mt-3">
          <SectionLabel>Missing items</SectionLabel>
          <ul className="mt-2 space-y-2">
            {planning.missingItems.map((item) => (
              <MissingItemRow key={item.itemId} item={item} />
            ))}
          </ul>
        </Panel>
      )}

      {allComplete && (
        <p className="mt-3 rounded-sm border border-vault-safe/40 bg-vault-surface p-4 text-sm text-vault-text">
          All current requirements are satisfied.
        </p>
      )}

      {planning.raidPriorities.length > 0 && (
        <Panel label="Next raid priorities" className="mt-3">
          <SectionLabel>Next raid priorities</SectionLabel>
          <ul className="mt-2 space-y-2">
            {planning.raidPriorities.map((priority) => (
              <PriorityRow key={priority.itemId} priority={priority} />
            ))}
          </ul>
        </Panel>
      )}

      <p className="mt-3 rounded-sm border border-vault-line bg-vault-surface p-4 text-xs text-vault-muted">
        Workshop planning is not supported yet.
      </p>
    </section>
  )
}
