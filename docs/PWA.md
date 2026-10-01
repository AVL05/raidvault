# M10 PWA, local snapshots and privacy

## Build and serving contract

Supported production path: repository `pnpm build`, then `pnpm -C apps/web start`.
The web build removes an older `public/sw.js`, runs Next, generates a fresh worker
from that build's actual assets, and checks budgets. Never run bare `next build`
as the deployment build command. The worker is gitignored; its source of truth
is `scripts/build-pwa.mjs` and `scripts/worker-template.js`, with regression tests.

`next start` was verified to serve the post-build generated `/sw.js` byte-for-byte
with JavaScript MIME and `Cache-Control: no-store, max-age=0`. All generated
precache response digests were verified against the production server. A deployment
must retain the generated `public` directory alongside `.next`; no remote host,
standalone export packaging, or third-party deployment is configured/verified here.

Manifest: `/manifest.webmanifest`; start URL/scope/id `/`, standalone display,
192/512 PNG icons, maskable 512, and Apple 180. Icons are an original geometric
vault mark, reproducible with `node apps/web/scripts/create-icons.mjs`.
Production registration is progressive enhancement; development does not register.
Installation remains the browser's native UI and requires its supported secure
context (HTTPS or trusted localhost). No install prompt, push, or background sync.

Application version comes from the web package. Build identifier is a deterministic
SHA-256 over web source, generator/template, configuration, and icons, exposed by
Next configuration. No timestamps or random build identifiers are generated.

## Exact cache ownership

Only `raidvault-app-shell-v1-<64 lowercase hex characters>` belongs to this worker.
The digest covers the ordered actual asset paths/hashes and worker policy source.
The exact name/allowlist for each build is also in `.next/raidvault-pwa.json`.

Approved entries: public `/offline` HTML, manifest, four icons, and exact emitted
static JS/CSS/WOFF2 files. No runtime prefix matching/cache-all policy exists.
Installation fetches with credentials omitted, disallows redirects, and verifies
each response's SHA-256. A failed install rejects and removes its incomplete cache.
Only successful, non-opaque responses can enter precache.

Runtime intercepts only GET requests of this origin without queries, Authorization,
RSC, router-state, or server-action headers. Exact listed static assets use the
installed cache; cache misses pass through without being cached. Only document
navigations to `/` or `/offline` may fall back to the public offline shell when
the network fails. SSR root HTML and player context are never put in Cache Storage.
API/provider/model/Bridge/external requests pass through untouched.

Default worker lifecycle is preserved: no forced activation, takeover, or reload.
A waiting update is announced with instructions to finish work, close all RaidVault
tabs, and reopen. Default activation happens after old controlled clients close;
only then are obsolete recognized shell caches removed. Other origin caches,
provider state, future model caches, and IndexedDB are excluded from cleanup.

## IndexedDB authority

Database `raidvault-local-state`, version 1; object store `snapshots`.
Provider ID is the key; current UI restores only `mock-provider` (no new provider
integration). Value is JSON: `{ schema: 1, providerId, state: PlayerState }`.
No AI context, planning output, analysis, reasons, classifications, messages,
credentials or raw provider DTOs are persisted.

The current server path validates its synthetic provider snapshot and knowledge,
calculates authoritative facts server-side, and renders the existing UI. After
hydration only the normalized snapshot is saved to IndexedDB. A later online
load can save a newly validated snapshot again after the user clears local copies.

The separate `/offline` Client Component reads IndexedDB, parses bytes as unknown,
checks exact supported structure/schema/provider identity, reconstructs and checks
all domain invariants, and marks the result stale/local. Original capture/source
metadata is preserved. It validates bundled synthetic knowledge and recomputes
Rules Engine, planning, and verified AI context through existing APIs. Empty,
corrupt, incompatible, blocked, or unavailable storage produces explicit states;
there is no silent repair, mock player fallback, or localStorage fallback.

`navigator.onLine` is a browser connectivity hint only: it never refreshes a
snapshot, verifies provider/Bridge health, or changes Gaming Mode.
Production Gaming Mode remains UNKNOWN, no model/runtime is configured, and ARC
AI generation remains unavailable. M9 gates are unchanged; deterministic stash
and planning views work locally even while the chat remains blocked.

## Privacy / Storage

Displays version/build, saved provider/capture, bundled knowledge version, exact
owned shell caches, approximate origin-wide usage/quota, persistence capability,
and truthful M8 model unavailability. Undefined/rejected estimates never become
zero bytes. Persistence is reported, not automatically requested or required.

Independent confirmed actions:

- Clear saved snapshots: clears only `snapshots`; open UI remains in memory.
- Clear offline shell: deletes only recognized app-shell caches. Offline reload
  may then fail until a subsequent worker installation repopulates the shell;
  the worker does not secretly repopulate after a manual deletion.
- Remove model: disabled because no actual M8 manager exists. An eventual
  integration must call the actual M8 manager's `remove()`, never generic cleanup.

There is no clear-all-origin action. Partial cache deletion reports completed
operations and failure without exposing browser errors. Confirmation is an inline
named group, focuses Cancel, supports Escape and returns focus to its trigger;
it is not a modal and adds no focus trap.

Browser eviction, restricted APIs, unsupported service workers, and install/update
failure can remove offline capability; the online application remains available.
Cache deletion does not claim to erase immutable bundled game knowledge or models.

## Hosting verification

First candidate host: Vercel.

- Root Directory: `apps/web`.
- Full `pnpm run build` must execute; bare `next build` is not valid.
- Post-build `public/sw.js` packaging is expected from inspected Vercel
  adapter behavior but remains unverified until hosted test.
- Exact hosted bytes and response headers are authoritative.
- No custom domain for first verification.
- Different origins have independent IndexedDB/Cache Storage.
- Toolbar/content injection should remain disabled for verification.
- Protected previews are unsuitable for normal public precache validation
  unless explicitly made accessible.

See [RELEASE.md](./RELEASE.md) for the full hosted verification matrix.

## Release / deployment verification

Public PWA behavior is not considered verified until the production HTTPS
matrix in [RELEASE.md](./RELEASE.md) passes on the owner-selected host.
`public/sw.js` is generated after Next builds; the host must package that
generated file and preserve the expected shell/asset bytes and worker headers.
Local `next start` verification alone does not establish hosted compatibility.
