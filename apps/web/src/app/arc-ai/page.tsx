import { loadDemoWorkspace } from '../../data/workspace'
import { ArcAiChat } from '../../arc-ai/arc-ai-chat'
import { AiEnginePanel } from '../../ai/ai-panel'
import { UnavailablePanel } from '../../stash/unavailable-panel'
import { Panel, SectionLabel, StatusChip } from '../../ui/vault'

export default async function ArcAiPage() {
  const workspace = await loadDemoWorkspace()
  if (!workspace.ok) {
    return (
      <main id="main-content" tabIndex={-1}>
        <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Assistant</p>
        <h1 className="mt-1 text-[32px] font-bold text-vault-text">ARC AI</h1>
        <div className="mt-4">
          <UnavailablePanel title="ARC AI unavailable" detail="Validated context could not be built." />
        </div>
      </main>
    )
  }
  return (
    <main id="main-content" tabIndex={-1}>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Assistant</p>
      <h1 className="mt-1 text-[32px] font-bold text-vault-text">ARC AI</h1>
      <p className="mt-1 max-w-2xl text-sm text-vault-muted">
        Optional local assistant over verified facts. Deterministic Rules Engine
        facts stay authoritative — the assistant explains, never overrides.
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <ArcAiChat initialContext={workspace.aiContext} />
        <div className="grid content-start gap-3">
          <Panel label="Model and engine status">
            <SectionLabel>Verified facts</SectionLabel>
            <p className="mt-2 text-xs leading-relaxed text-vault-muted">
              Context {workspace.aiContext.version} · provider {workspace.snapshot.providerId} ·
              {' '}{workspace.analysis.items.length} analyzed items · {workspace.planning.missingItems.length} missing lines.
              Sources are stash, planning, and catalog facts only.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <StatusChip tone="amber">Gaming Unknown · fail-safe</StatusChip>
              <StatusChip tone="neutral">Model not installed</StatusChip>
            </div>
          </Panel>
          <AiEnginePanel />
        </div>
      </div>
    </main>
  )
}
