'use client'

import { useEffect, useState } from 'react'
import { createBundledGameDataSource, loadGameKnowledge } from '@raidvault/game-data'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import { buildVerifiedAiContext } from '@raidvault/ai-engine'
import { readSnapshot } from '../storage/snapshot-store'
import { StashBrowser } from './stash-browser'
import { PlanningSection } from './planning-section'
import { UnavailablePanel } from './unavailable-panel'
import { ArcAiChat } from '../arc-ai/arc-ai-chat'
import { buildStashRows, listCategories, describeSnapshot, summarizeStash } from './view-model'
import { enrichRows } from './analysis-model'
import { MOCK_PROVIDER_ID, MOCK_GAME_DATA_PAYLOAD, MOCK_GAME_DATA_SOURCE_ID } from './mock-data'

export async function restoreWorkspace(factory?: IDBFactory) {
  const restored = await readSnapshot(MOCK_PROVIDER_ID, factory)
  if (restored.status !== 'ready') return { status: restored.status, message: restored.message } as const
  const loaded = await loadGameKnowledge(createBundledGameDataSource(MOCK_GAME_DATA_SOURCE_ID, MOCK_GAME_DATA_PAYLOAD))
  if (!loaded.success) return { status: 'error', message: 'Bundled game knowledge is unavailable.' } as const
  const snapshot = restored.snapshot
  const knowledge = loaded.value
  const analysis = analyzeStash(snapshot.state, knowledge)
  const planning = buildPlanningSnapshot(snapshot.state, knowledge)
  const rows = buildStashRows(snapshot.state, knowledge)
  return { status: 'ready', snapshot, planning, rows: enrichRows(rows, analysis), categories: listCategories(rows),
    summary: summarizeStash(snapshot.state), statusView: describeSnapshot(snapshot),
    context: buildVerifiedAiContext({ playerState: snapshot.state, gameKnowledge: knowledge,
      analysis, planning, providerId: snapshot.providerId, stale: true }) } as const
}
type Workspace = Awaited<ReturnType<typeof restoreWorkspace>>

export function OfflineStash() {
  const [workspace, setWorkspace] = useState<Workspace>()
  useEffect(() => {
    let live = true
    void restoreWorkspace().then((next) => { if (live) setWorkspace(next) }).catch(() => {
      if (live) setWorkspace({ status: 'error', message: 'Local workspace could not be restored.' })
    })
    return () => { live = false }
  }, [])
  if (workspace === undefined) return <p role="status" className="text-sm text-vault-muted">Reading saved local snapshot…</p>
  if (workspace.status !== 'ready') return <UnavailablePanel title="Saved snapshot unavailable" detail={workspace.message} />
  return <>
    <p role="status" className="mb-4 rounded-sm border border-vault-amber/60 bg-vault-surface p-3 text-sm text-vault-text">
      Local restored snapshot · stale. Capture: {workspace.statusView.fetchedAt}.
      {' '}No provider refresh was performed. Browser connectivity cannot make this data fresh.
    </p>
    <StashBrowser rows={workspace.rows} categories={workspace.categories} summary={workspace.summary} status={workspace.statusView} />
    <div className="mt-4">
      <PlanningSection planning={workspace.planning} />
    </div>
    <section aria-labelledby="local-arc-ai-heading" className="mt-4">
      <h2 id="local-arc-ai-heading" className="mb-1 text-xl font-bold text-vault-text">ARC AI</h2>
      <p className="mb-3 text-sm text-vault-muted">No production model or secure Bridge connection is configured. Gaming Mode remains UNKNOWN; stash and planning facts remain available.</p>
      <ArcAiChat initialContext={workspace.context} />
    </section>
  </>
}
