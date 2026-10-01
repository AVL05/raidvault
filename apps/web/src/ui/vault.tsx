import type { ItemClassification } from '@raidvault/rules-engine'

/** Shared shelter signage for every workspace route. */
export function PageHeader({ title, children, id }: {
  readonly title: string
  readonly children?: React.ReactNode
  readonly id?: string
}) {
  return (
    <header className="vault-page-heading">
      <h1 id={id}>{title}</h1>
      {children && <p>{children}</p>}
    </header>
  )
}

/** Uppercase micro-label with tracking — the Figma section-label language. */
export function SectionLabel({ children }: { readonly children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-muted">
      {children}
    </p>
  )
}

/** Squared data panel: thin border, restrained radius, dense hierarchy. */
export function Panel({
  children,
  label,
  className = '',
}: {
  readonly children: React.ReactNode
  readonly label?: string
  readonly className?: string
}) {
  return (
    <section
      aria-label={label}
      className={`vault-panel rounded-sm border border-vault-line bg-vault-surface p-4 ${className}`}
    >
      {children}
    </section>
  )
}

const CLASS_STYLES: Record<ItemClassification, string> = {
  KEEP: 'border-vault-safe/60 text-vault-safe',
  RESERVE: 'border-vault-signal/60 text-vault-signal',
  SELL: 'border-vault-amber/60 text-vault-amber',
  RECYCLE: 'border-vault-muted/60 text-vault-muted',
  REVIEW: 'border-vault-amber/60 text-vault-amber',
}

/**
 * Deterministic classification badge. Text label is always rendered;
 * color never carries meaning alone.
 */
export function ClassificationBadge({
  value,
}: {
  readonly value: ItemClassification
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-sm border px-2 py-0.5 font-mono text-[11px] font-bold tracking-wide ${CLASS_STYLES[value]}`}
    >
      {value}
    </span>
  )
}

/** Compact capsule status chip for header/system states. */
export function StatusChip({
  children,
  tone = 'neutral',
}: {
  readonly children: React.ReactNode
  readonly tone?: 'neutral' | 'amber' | 'safe' | 'signal' | 'danger'
}) {
  const tones: Record<string, string> = {
    neutral: 'border-vault-line text-vault-muted',
    amber: 'border-vault-amber/70 text-vault-amber',
    safe: 'border-vault-safe/70 text-vault-safe',
    signal: 'border-vault-signal/70 text-vault-signal',
    danger: 'border-vault-danger/70 text-vault-danger',
  }
  return (
    <span
      className={`vault-status inline-flex items-center gap-1 rounded-sm border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${tones[tone]}`}
    >
      {children}
    </span>
  )
}

/** Primary amber action vs neutral secondary — squared tactical buttons. */
export function VaultButton({
  children,
  variant = 'secondary',
  ...rest
}: {
  readonly children: React.ReactNode
  readonly variant?: 'primary' | 'secondary' | 'danger'
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const base =
    'inline-flex items-center justify-center rounded-sm px-3 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50'
  const variants: Record<string, string> = {
    primary: 'bg-vault-amber text-vault-amberink hover:brightness-110',
    secondary:
      'border border-vault-line bg-vault-raised text-vault-text hover:border-vault-muted',
    danger: 'border border-vault-danger/70 text-vault-danger hover:bg-vault-danger/10',
  }
  return (
    <button type="button" className={`${base} ${variants[variant]}`} {...rest}>
      {children}
    </button>
  )
}

/** Deterministic progress bar with text fallback (never color-only). */
export function ProgressBar({
  owned,
  required,
  label,
}: {
  readonly owned: number
  readonly required: number
  readonly label: string
}) {
  const pct = required <= 0 ? 100 : Math.min(100, Math.round((owned / required) * 100))
  return (
    <div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={required}
        aria-valuenow={Math.min(owned, required)}
        aria-valuetext={`${owned} of ${required}`}
        className="h-1.5 w-full overflow-hidden rounded-sm bg-vault-void"
      >
        <div className="h-full bg-vault-amber" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-mono text-[11px] text-vault-muted">
        {owned} / {required} · {pct}%
      </p>
    </div>
  )
}
