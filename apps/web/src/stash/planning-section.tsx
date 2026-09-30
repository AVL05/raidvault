import type {
  MissingItemPlan,
  PlanningSnapshot,
  RaidPriority,
  TargetPlan,
} from '@raidvault/rules-engine'

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
  return (
    <li className="rounded-lg bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-gray-900">{targetLabel(target)}</span>
        <span className="flex gap-2 text-xs">
          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
            {target.targetType === 'QUEST' ? 'Quest' : 'Project'}
          </span>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">
            {target.complete ? 'Complete' : 'Incomplete'}
          </span>
        </span>
      </div>
      {target.targetName !== undefined && (
        <p className="mt-1 truncate font-mono text-xs text-gray-500">ID: {target.targetId}</p>
      )}
      {target.requirements.length === 0 ? (
        <p className="mt-2 text-xs text-gray-600">No requirements listed for this target.</p>
      ) : (
        <ul className="mt-2 space-y-1">
          {target.requirements.map((gap) => (
            <li key={gap.itemId} className="text-xs text-gray-700">
              <span className="font-mono">{gap.itemId}</span>
              {' — required: '}
              {gap.requiredForTarget}
              {' · owned: '}
              {gap.owned}
              {' · missing: '}
              {gap.missingForTarget}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

function MissingItemRow({ item }: { readonly item: MissingItemPlan }) {
  return (
    <li className="rounded-lg bg-white p-3 text-sm shadow-sm">
      <span className="font-semibold text-gray-900">{itemLabel(item.itemId, item.displayName)}</span>
      {item.displayName !== undefined && (
        <span className="block truncate font-mono text-xs text-gray-500">ID: {item.itemId}</span>
      )}
      <span className="mt-1 block text-xs text-gray-600">
        Missing: {item.totalMissing} · Sources: {item.sourceTargetIds.join(', ')}
      </span>
    </li>
  )
}

function PriorityRow({ priority }: { readonly priority: RaidPriority }) {
  return (
    <li className="rounded-lg bg-white p-3 text-sm shadow-sm">
      <span className="font-semibold text-gray-900">
        {priority.rank}. {itemLabel(priority.itemId, priority.displayName)}
      </span>
      <span className="mt-1 block text-xs text-gray-600">
        Missing: {priority.missing} · Sources: {priority.sourceTargetIds.join(', ')}
      </span>
    </li>
  )
}

export function PlanningSection({ planning }: { readonly planning: PlanningSnapshot }) {
  const allComplete =
    planning.hasStash && planning.targets.length > 0 && planning.missingItems.length === 0
  return (
    <section aria-labelledby="planning-heading" className="mt-8">
      <h2 id="planning-heading" className="mb-1 text-xl font-bold text-gray-900">
        Planning
      </h2>
      <p className="mb-4 text-sm text-gray-600">
        Based solely on current deterministic missing requirements.
      </p>

      {!planning.hasStash && (
        <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
          Planning unavailable: no stash in this snapshot.
        </p>
      )}

      {planning.hasStash && planning.targets.length === 0 && (
        <p className="rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
          No current requirements.
        </p>
      )}

      {planning.targets.length > 0 && (
        <>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Current targets</h3>
          <ul className="mb-6 space-y-2">
            {planning.targets.map((target) => (
              <TargetCard
                key={`${target.targetType}:${target.targetId}`}
                target={target}
              />
            ))}
          </ul>
        </>
      )}

      {planning.incompleteReferences.length > 0 && (
        <>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Incomplete references</h3>
          <ul className="mb-6 space-y-1">
            {planning.incompleteReferences.map((reference) => (
              <li
                key={`${reference.targetType}:${reference.targetId}`}
                className="rounded-lg bg-white p-3 text-xs text-gray-700 shadow-sm"
              >
                {reference.targetType === 'QUEST' ? 'Quest' : 'Project'} reference{' '}
                <span className="font-mono">{reference.targetId}</span> has no matching game data.
              </li>
            ))}
          </ul>
        </>
      )}

      {planning.hasStash && planning.targets.length > 0 && planning.missingItems.length > 0 && (
        <>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Missing items</h3>
          <ul className="mb-6 space-y-2">
            {planning.missingItems.map((item) => (
              <MissingItemRow key={item.itemId} item={item} />
            ))}
          </ul>
        </>
      )}

      {allComplete && (
        <p className="mb-6 rounded-lg bg-white p-4 text-sm text-gray-600 shadow">
          All current requirements are satisfied.
        </p>
      )}

      {planning.raidPriorities.length > 0 && (
        <>
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Next raid priorities</h3>
          <ul className="mb-6 space-y-2">
            {planning.raidPriorities.map((priority) => (
              <PriorityRow key={priority.itemId} priority={priority} />
            ))}
          </ul>
        </>
      )}

      <p className="rounded-lg bg-white p-4 text-xs text-gray-500 shadow">
        Workshop planning is not supported yet.
      </p>
    </section>
  )
}
