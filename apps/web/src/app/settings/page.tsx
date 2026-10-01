import { loadDemoWorkspace } from '../../data/workspace'
import { PrivacyStorage } from '../../storage/privacy-storage'
import { AiEnginePanel } from '../../ai/ai-panel'
import { UnavailablePanel } from '../../stash/unavailable-panel'
import { Panel, SectionLabel, StatusChip } from '../../ui/vault'

export default async function SettingsPage() {
  const workspace = await loadDemoWorkspace()
  return (
    <main id="main-content" tabIndex={-1}>
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">Local control</p>
      <h1 className="mt-1 text-[32px] font-bold text-vault-text">Settings</h1>
      <p className="mt-1 max-w-2xl text-sm text-vault-muted">
        Local snapshots, offline shell, model, Gaming Mode, and version truth.
        Clearing one category never clears the others.
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div>
          {workspace.ok ? (
            <PrivacyStorage initialSnapshot={workspace.snapshot} />
          ) : (
            <UnavailablePanel title="Settings unavailable" detail="Validated snapshot could not be loaded; storage actions remain inspectable below." />
          )}
          {!workspace.ok && <div className="mt-3"><PrivacyStorage /></div>}
        </div>
        <div className="grid content-start gap-3">
          <Panel label="Gaming Mode">
            <SectionLabel>Gaming Mode</SectionLabel>
            <p className="mt-2"><StatusChip tone="amber">Unknown · fail-safe</StatusChip></p>
            <p className="mt-2 text-xs leading-relaxed text-vault-muted">
              No secure Bridge transport is configured, so status stays UNKNOWN.
              Heavy AI stays disabled. Browser connectivity never changes Gaming Mode.
            </p>
          </Panel>
          <AiEnginePanel />
          <Panel label="Version and privacy">
            <SectionLabel>Version / privacy</SectionLabel>
            <p className="mt-2 text-xs leading-relaxed text-vault-muted">
              RaidVault v0.1.0 public preview (pre-alpha). Unofficial companion —
              not affiliated with Embark Studios. No telemetry, no analytics, no
              cloud AI, no accounts, no game memory access.
            </p>
          </Panel>
        </div>
      </div>
    </main>
  )
}
