/**
 * Explicit empty/error panel for data failures. Used for unavailable
 * provider snapshots and game-data load failures alike.
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
      aria-label={title}
      className="rounded-lg border border-amber-300 bg-amber-50 p-6"
    >
      <h2 className="mb-2 text-xl font-semibold text-gray-900">{title}</h2>
      <p className="text-sm text-gray-700">{detail}</p>
    </section>
  )
}
