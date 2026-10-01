import { loadDemoWorkspace } from '../data/workspace'
import { enrichRows } from '../stash/analysis-model'
import { UnavailablePanel } from '../stash/unavailable-panel'
import { Overview } from '../overview/overview'

export default async function Home() {
  const workspace = await loadDemoWorkspace()
  if (!workspace.ok) {
    return (
      <main id="main-content" tabIndex={-1}>
        <h1 className="text-[32px] font-bold text-vault-text">Overview</h1>
        <div className="mt-4">
          <UnavailablePanel
            title={workspace.kind === 'snapshot' ? 'Stash unavailable' : 'Game data unavailable'}
            detail="A validated snapshot or game knowledge could not be obtained. Open the saved local workspace for previously validated data."
          />
        </div>
      </main>
    )
  }
  return (
    <main id="main-content" tabIndex={-1}>
      <Overview
        data={{
          rows: enrichRows(workspace.rows, workspace.analysis),
          categories: workspace.categories,
          summary: workspace.summary,
          status: workspace.status,
          planning: workspace.planning,
          analysis: workspace.analysis,
        }}
      />
    </main>
  )
}
