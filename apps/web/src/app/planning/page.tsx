import { loadDemoWorkspace } from '../../data/workspace'
import { PlanningSection } from '../../stash/planning-section'
import { UnavailablePanel } from '../../stash/unavailable-panel'
import { Panel, SectionLabel } from '../../ui/vault'

export default async function PlanningPage() {
  const workspace = await loadDemoWorkspace()
  if (!workspace.ok) {
    return (
      <main id="main-content" tabIndex={-1}>
        <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Targets</p>
        <h1 className="mt-1 text-[32px] font-bold text-vault-text">Planning</h1>
        <div className="mt-4">
          <UnavailablePanel title="Planning unavailable" detail="Validated snapshot or game knowledge could not be loaded." />
        </div>
      </main>
    )
  }
  const ready = workspace.planning.targets.filter((t) => t.complete).length
  return (
    <main id="main-content" tabIndex={-1}>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Targets</p>
      <h1 id="planning-heading" className="mt-1 text-[32px] font-bold text-vault-text">Planning</h1>
      <p className="mt-1 max-w-2xl text-sm text-vault-muted">
        Based solely on current deterministic missing requirements. Gross-gap semantics:
        owned units count against every pursuing target without implying allocation.
      </p>
      <Panel label="Raid readiness" className="mt-5">
        <SectionLabel>Raid readiness</SectionLabel>
        <p className="mt-2 font-mono text-2xl font-bold text-vault-text">
          {ready}<span className="text-sm text-vault-muted"> / {workspace.planning.targets.length} targets ready</span>
        </p>
        <p className="mt-1 text-xs text-vault-muted">
          {workspace.planning.missingItems.length} missing lines · {workspace.planning.raidPriorities.length} raid priorities · workshop unsupported
        </p>
      </Panel>
      <div className="mt-3">
        <PlanningSection planning={workspace.planning} />
      </div>
    </main>
  )
}
