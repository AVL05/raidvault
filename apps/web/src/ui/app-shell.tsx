import { VaultNav } from './nav'
import { StatusChip } from './vault'
import Image from 'next/image'
import Link from 'next/link'

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
    <div className="vault-app min-h-screen text-vault-text">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <header className="vault-header sticky top-0 z-40">
        <div className="vault-header-inner">
          <Link href="/" aria-label="RaidVault home" className="vault-brand">
            <Image src="/brand/wordmark.webp" alt="RaidVault" width={1000} height={177} priority unoptimized />
          </Link>
          <p className="vault-header-caption">Unofficial ARC Raiders companion<br /><span>v0.1.0 / public preview</span></p>
          <div className="ml-auto hidden flex-wrap items-center justify-end gap-2 sm:flex">
            <StatusChip tone="neutral">Demo snapshot</StatusChip>
            <StatusChip tone="amber">Gaming Unknown</StatusChip>
            <StatusChip tone="neutral">AI locked</StatusChip>
          </div>
        </div>
        {onlineHint}
      </header>
      <div className="vault-workspace">
        <aside className="vault-rail hidden md:block">
          <div className="sticky top-[132px]">
            <VaultNav orientation="rail" />
            <div className="vault-local-note">
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
      <footer className="vault-footer"><span>RAIDVAULT / LOCAL-FIRST</span><span>Unofficial companion · Not affiliated with Embark Studios</span></footer>
      <VaultNav orientation="bottom" />
    </div>
  )
}
