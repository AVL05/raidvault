import { VaultNav } from './nav'
import { StatusChip } from './vault'

/**
 * Tactical app shell: top header, left desktop rail, bottom mobile bar.
 * Server-rendered shell; only the nav itself is client-side for active state.
 */
export function AppShell({
  children,
  onlineHint,
}: {
  readonly children: React.ReactNode
  readonly onlineHint?: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-vault-void text-vault-text">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="sticky top-0 z-40 border-b border-vault-line bg-vault-surface">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-sm bg-vault-amber font-mono text-sm font-black text-vault-amberink">
            RV
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-wide">RAIDVAULT</p>
            <p className="truncate text-[11px] uppercase tracking-micro text-vault-muted">
              Local ARC companion · v0.1.0 preview
            </p>
          </div>
          <div className="ml-auto hidden items-center gap-2 sm:flex">
            <StatusChip tone="neutral">Demo snapshot</StatusChip>
            <StatusChip tone="amber">Gaming Unknown</StatusChip>
            <StatusChip tone="neutral">AI locked</StatusChip>
          </div>
        </div>
        {onlineHint}
      </header>
      <div className="mx-auto flex max-w-6xl gap-6 px-4 pb-24 pt-6 md:pb-10">
        <aside className="hidden w-52 shrink-0 md:block">
          <div className="sticky top-[68px]">
            <VaultNav orientation="rail" />
            <div className="mt-6 rounded-sm border border-vault-line bg-vault-surface p-3">
              <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-muted">
                Local-first
              </p>
              <p className="mt-1 text-xs leading-relaxed text-vault-muted">
                Snapshots stay in this browser. No telemetry. No cloud AI. No game
                integration.
              </p>
              <a href="/offline" className="mt-2 inline-block text-xs font-semibold text-vault-amber underline">
                Open saved local workspace
              </a>
            </div>
          </div>
        </aside>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
      <VaultNav orientation="bottom" />
    </div>
  )
}
