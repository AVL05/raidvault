/**
 * Explicit empty/error panel for data failures. Tactical dark treatment;
 * destructive meaning carried by text + border, never color alone.
 */
export function UnavailablePanel({
  title,
  detail,
}: {
  readonly title: string
  readonly detail: string
}) {
  return (
    <section
      role="alert"
      aria-label={title}
      className="rounded-sm border border-vault-amber/60 bg-vault-surface p-6"
    >
      <p className="text-[11px] font-semibold uppercase tracking-micro text-vault-amber">
        Unavailable
      </p>
      <h2 className="mt-1 text-xl font-bold text-vault-text">{title}</h2>
      <p className="mt-2 text-sm text-vault-muted">{detail}</p>
    </section>
  )
}
