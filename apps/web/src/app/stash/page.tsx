import { PageHeader } from '../../ui/vault'
import { loadDemoWorkspace } from '../../data/workspace'
import { enrichRows } from '../../stash/analysis-model'
import { StashBrowser } from '../../stash/stash-browser'
import { UnavailablePanel } from '../../stash/unavailable-panel'

export default async function StashPage() {
  const workspace = await loadDemoWorkspace()
  if (!workspace.ok) {
    return (
      <main id="main-content" tabIndex={-1}>
        <PageHeader title="Stash" />
        <div className="mt-4">
          <UnavailablePanel title="Stash unavailable" detail="A validated player snapshot could not be obtained." />
        </div>
      </main>
    )
  }
  return (
    <main id="main-content" tabIndex={-1}>
      <PageHeader title="Stash">
        Deterministic classifications only — KEEP, RESERVE, SELL, RECYCLE, REVIEW.
        Select an item for requirement facts and structured reasons.
      </PageHeader>
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
