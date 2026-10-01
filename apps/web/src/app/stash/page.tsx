import { loadDemoWorkspace } from '../../data/workspace'
import { enrichRows } from '../../stash/analysis-model'
import { StashBrowser } from '../../stash/stash-browser'
import { UnavailablePanel } from '../../stash/unavailable-panel'

export default async function StashPage() {
  const workspace = await loadDemoWorkspace()
  if (!workspace.ok) {
    return (
      <main id="main-content" tabIndex={-1}>
        <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Inventory</p>
        <h1 className="mt-1 text-[32px] font-bold text-vault-text">Stash</h1>
        <div className="mt-4">
          <UnavailablePanel title="Stash unavailable" detail="A validated player snapshot could not be obtained." />
        </div>
      </main>
    )
  }
  return (
    <main id="main-content" tabIndex={-1}>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Inventory</p>
      <h1 className="mt-1 text-[32px] font-bold text-vault-text">Stash</h1>
      <p className="mt-1 max-w-2xl text-sm text-vault-muted">
        Deterministic classifications only — KEEP, RESERVE, SELL, RECYCLE, REVIEW.
        Select an item for requirement facts and structured reasons.
      </p>
      <div className="mt-5">
        <StashBrowser
          rows={enrichRows(workspace.rows, workspace.analysis)}
          categories={workspace.categories}
          summary={workspace.summary}
          status={workspace.status}
        />
      </div>
    </main>
  )
}
