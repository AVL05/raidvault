# M10 performance budgets

## Measured M9 baseline

Commit: `f8e7d31e48a5640f6898aa97ca9461f0dd046d27`.
Two identical clean production builds on Windows, Next 16.3.6, produced
identical initial route asset paths, SHA-256 digests, bytes, and gzip sizes:

- Initial `/` JavaScript: 7 unique files, 586,968 bytes, 178,420 gzip bytes.
- Initial CSS: 187 bytes (the baseline had three unprocessed Tailwind warnings).
- Detailed measurements and runtime dependency inventory:
  `apps/web/scripts/m9-baseline.json`.

Measurement reads unique `/_next/static/*.js` script/preload references from
`.next/server/app/index.html`, including Next/React runtime and polyfills.
Each file is compressed independently with Node gzip level 9 and mtime 0.
This is an asset transfer budget, not an execution-time or Lighthouse guarantee.
Next/build environment changes require re-measuring the baseline twice.

## Enforced budgets

`pnpm build` runs `scripts/check-performance.mjs` after generating the worker:

| Budget | Limit |
| --- | --- |
| Initial route JS | 209,140 gzip bytes (M9 + 30 KiB) |
| New runtime dependencies | Zero, compared with recorded manifests |
| Worker template / generated worker | Each <= 20 KiB |
| Each icon | <= 100 KiB |
| Combined icons | <= 300 KiB |

Unit tests protect zero automatic model load/generation, no new periodic polling,
bounded M9 context/history, and that connectivity cannot manufacture freshness.
Snapshots persist only normalized domain state; calculations run once after restore,
not after connectivity events or ordinary UI renders. No full catalog is passed into
the AI context. The synthetic bundled knowledge is used only through validation.
Optional offline calculation code is isolated to the `/offline` client workspace.

No WebGPU runtime/model dependency, automatic model download, telemetry,
background sync, broad cache population loop, or recurring update timer is added.
Capability probing in the existing M8 panel remains distinct from model loading.

## Verification

Run `pnpm exec vitest run apps/web`, `pnpm test`, `pnpm lint`, `pnpm typecheck`,
and `pnpm build`. Test real production offline reloads and keyboard navigation
separately: SSR markup tests do not establish browser accessibility or installability.
