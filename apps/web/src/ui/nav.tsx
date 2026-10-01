'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LINKS = [
  { href: '/', label: 'Overview' },
  { href: '/stash', label: 'Stash' },
  { href: '/planning', label: 'Planning' },
  { href: '/arc-ai', label: 'ARC AI' },
  { href: '/settings', label: 'Settings' },
] as const

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false
  if (href === '/') return pathname === '/'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavIcon({ label }: { readonly label: string }) {
  const paths: Record<string, React.ReactNode> = {
    Overview: (
      <path d="M3 11.5 12 4l9 7.5M5.5 10.5V19h13v-8.5" strokeWidth={1.6} />
    ),
    Stash: (
      <path d="M4 8.5 12 4l8 4.5v7L12 20l-8-4.5v-7Z M4 8.5 12 13l8-4.5 M12 13v7" strokeWidth={1.6} />
    ),
    Planning: (
      <path d="M5 4h14v13H5z M5 8h14 M9 12h6 M9 15.5h4" strokeWidth={1.6} />
    ),
    'ARC AI': (
      <path d="M12 3.5c3.5 2 6 5 6 8.5a6 6 0 0 1-12 0C6 8.5 8.5 5.5 12 3.5Z M9.5 12h5" strokeWidth={1.6} />
    ),
    Settings: (
      <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5 3.5 3.5 0 0 0 12 8.5Z M4.5 12h2 M17.5 12h2 M12 4.5v2 M12 17.5v2 M6.8 6.8l1.4 1.4 M15.8 15.8l1.4 1.4 M17.2 6.8l-1.4 1.4 M8.2 15.8l-1.4 1.4" strokeWidth={1.6} />
    ),
  }
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
    >
      {paths[label] ?? <circle cx="12" cy="12" r="7" strokeWidth={1.6} />}
    </svg>
  )
}

/** Desktop left rail + mobile bottom bar share one link definition. */
export function VaultNav({ orientation }: { readonly orientation: 'rail' | 'bottom' }) {
  const pathname = usePathname()
  if (orientation === 'rail') {
    return (
      <nav aria-label="Primary" className="vault-navigation flex flex-col gap-1">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href)
          return (
            <Link
              key={link.href}
              href={link.href}
              aria-current={active ? 'page' : undefined}
              className={`vault-nav-link ${active ? 'vault-nav-active' : ''}`}
            >
              <span aria-hidden="true" className={active ? 'text-vault-amber' : ''}>
                <NavIcon label={link.label} />
              </span>
              {link.label}
            </Link>
          )
        })}
      </nav>
    )
  }
  return (
    <nav
      aria-label="Primary"
      className="vault-bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-vault-line bg-vault-surface md:hidden"
    >
      <ul className="grid grid-cols-5">
        {LINKS.map((link) => {
          const active = isActive(pathname, link.href)
          return (
            <li key={link.href}>
              <Link
                href={link.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-vault-amber'
                    : 'flex min-h-[56px] flex-col items-center justify-center gap-0.5 text-[11px] font-medium text-vault-muted'
                }
              >
                <NavIcon label={link.label} />
                {link.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
