# RaidVault

Unofficial, local-first ARC Raiders companion. Deterministic calculations remain
authoritative; optional AI must use verified facts and stay read-only.

> RaidVault is an unofficial community project and is not affiliated with,
> endorsed by, or sponsored by Embark Studios.

## Status

**RaidVault v0.1.0 — Public Preview (Pre-alpha) preparation.**

M0–M10 architecture and capabilities exist. This is **not production-ready**:
current player data and bundled knowledge are synthetic/demo data, no real ARC
Raiders account integration exists, and no production AI model/runtime is
configured. Some functionality has implemented contracts and tests but remains
unavailable without separately approved integrations. Gaming Mode fails safely
when game-running status is UNKNOWN.

No public deployment, tag, or GitHub Release is approved by this preparation.
Hosting and license decisions remain unresolved.

## Current capabilities

- Provider-independent player/domain model with structural and domain validation.
- Validated game-knowledge adapters and normalized item/quest/project data.
- Provider abstraction, mock provider, and last-validated snapshot semantics.
- Stash browsing, search, category filters, item details, and capture/stale labels.
- Deterministic Rules Engine: KEEP / RESERVE / SELL / RECYCLE / REVIEW,
  quantities and structured reasons. These are engine capabilities, not live
  account recommendations or a separate classification UI.
- Deterministic quest/project requirements, missing items, and raid priorities
  from current requirements. Workshop planning is not supported in the UI yet.
- Minimal loopback-only Rust Bridge health/version/Gaming Mode endpoints;
  production detection reports UNKNOWN without an approved executable identity.
- Optional WebGPU capability and model-lifecycle architecture; installation,
  loading and removal are unavailable without a configured production model.
- Verified-context ARC AI controller, bounded chat and read-only tools; current
  production wiring has no generation session and retains fail-safe gating.
- PWA manifest/icons, narrowly allowlisted offline shell and waiting updates.
- Versioned IndexedDB persistence of normalized snapshots; validated restore
  recomputes Rules Engine/planning and marks data local/stale.
- Privacy / Storage reporting and independent confirmed snapshot/shell clearing.
- Keyboard/focus/status accessibility improvements and deterministic asset budgets.

## Current limitations

- Synthetic/demo provider only; no live account sync or real player credentials.
- Bundled knowledge is synthetic, not a complete/current ARC Raiders catalog.
- No approved production AI model, runtime, download URL or model artifact store.
- Bridge executable identity is not approved; production Gaming Mode is UNKNOWN.
  The browser is not connected to Bridge, and AI remains blocked safely.
- Public HTTPS PWA/deployment verification is still pending.
- Browser storage can be unsupported, restricted or evicted. Clearing the shell
  can remove offline reload support until a subsequent worker installation.
- No gameplay automation, game memory access, packet interception, anti-cheat
  interaction, rendering hooks or game-file modification.
- No official Embark affiliation or guarantee of anti-cheat compatibility.

## Development

Use **Node 24.18.0** and **pnpm 12.6.0**. Install that exact pnpm version with a
supported local installation method; do not assume Node includes Corepack.
The root manifest records both requirements. Rust **1.98.0** with rustfmt/clippy
is pinned for Bridge through `apps/bridge/rust-toolchain.toml`.

From the repository root:

```text
pnpm install --frozen-lockfile
pnpm -C apps/web dev
```

Validation, from the root:

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Serve the production build with `pnpm -C apps/web start`. Use `pnpm build`,
not bare `next build`, so worker generation and performance checks run.

Bridge is an optional separate local executable, not a web-host component:

```text
cd apps/bridge
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
cargo run
```

CI runs the same validation commands; no deployment or publication is automatic.
See [CONTRIBUTING.md](./CONTRIBUTING.md) and [release gates](./docs/RELEASE.md).

## Architecture

```text
External source → provider adapter → validation/normalization → PlayerState
Validated game knowledge + PlayerState → Rules Engine / planning → UI
Verified deterministic context → optional read-only local AI
```

`apps/web` composes the browser UI; `apps/bridge` contains the narrow Rust
loopback service. Packages separate domain, providers, game-data, rules-engine,
ai-engine and shared concerns. Provider DTOs do not become factual UI/AI state.

## PWA / offline

The build generates gitignored `apps/web/public/sw.js` from actual Next assets.
Only approved static shell resources are cached; provider/API/Bridge/model
traffic is excluded. Public PWA requires HTTPS and verified host packaging.

After a validated snapshot is saved locally, `/offline` restores it through
validation and recomputes deterministic facts. Restored data remains **stale**,
with its original capture time; browser connectivity cannot make it fresh.
No stored snapshot means unavailable, not fabricated player data.

Updates wait naturally: finish work, close all RaidVault tabs and reopen.
No automatic activation or forced reload discards a draft. Privacy / Storage
clears snapshots and shell independently; model removal is unavailable because
no real production model manager is configured.

## AI

Local WebGPU lifecycle contracts, verified-context tools and ARC AI orchestration
are implemented and tested. That does **not** mean generation is available:
this build has no configured production model/runtime, no cloud fallback and no
automatic model loading. UNKNOWN Gaming Mode keeps AI blocked; stash and
planning remain usable without AI.

## Documentation

- [AGENTS.md](./AGENTS.md) — agent scope and safety rules
- [ARCHITECTURE.md](./ARCHITECTURE.md) — package/data authority boundaries
- [SECURITY.md](./SECURITY.md) — mandatory security and game-safety constraints
- [CONTRIBUTING.md](./CONTRIBUTING.md) — local workflow and validation
- [ROADMAP.md](./docs/ROADMAP.md) — M0–M10 implementation roadmap
- [TESTING.md](./docs/TESTING.md) — validation strategy
- [DATA_SOURCES.md](./docs/DATA_SOURCES.md) — external-data policy
- [AI.md](./docs/AI.md) — optional local AI architecture
- [BRIDGE.md](./docs/BRIDGE.md) — Bridge scope and current status
- [PWA.md](./docs/PWA.md) — shell, snapshots and cache ownership
- [PERFORMANCE.md](./docs/PERFORMANCE.md) — measurements and budgets
- [RELEASE.md](./docs/RELEASE.md) — release/deployment approval gates
- [CHANGELOG.md](./CHANGELOG.md) — unreleased preview capabilities/limitations

## License

**No open-source license has been selected yet.** The repository is explicitly
unlicensed for this preparation; normal copyright rules apply. A public repository
does not itself grant general reuse or redistribution rights. License selection
and the public redistribution/contribution policy are unresolved owner decisions.
