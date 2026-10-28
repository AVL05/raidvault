# Resume RaidVault — October 2026 handoff

> Snapshot based on `main` commit `51826cc25bde957caf0bad19bbbd9babb62509bf` as reviewed on 2026-10-28. Historical handoff, **not current release qualification**.

## What to preserve

RaidVault is an unofficial, local-first ARC Raiders companion. Its product value is deterministic stash and resource planning grounded in validated game/player data, with optional read-only AI as an explanation layer. It is **not** a game client, scraping/automation tool or game-memory reader.

Architecture boundaries:
- `apps/web`: Next.js browser/PWA interface and local IndexedDB storage.
- `apps/bridge`: optional Rust loopback health/version and fail-closed Gaming Mode; not integrated with the hosted browser for player state.
- `packages/domain`, `providers`, `game-data`: validation/normalization and data provenance.
- `packages/rules-engine`: authoritative KEEP / RESERVE / SELL / RECYCLE / REVIEW reasoning and planning.
- `packages/ai-engine`: optional AI and read-only tools over verified context; not a source of facts.

Read `AGENTS.md`, `ARCHITECTURE.md`, `SECURITY.md`, `docs/DATA_SOURCES.md` and the ADRs before changing any boundary.

## Honest status at handoff

- `v0.1.0` Public Preview / Pre-alpha **preparation**, not production-ready.
- M0–M10 implementation foundation is documented; bundled game knowledge and player state are **synthetic/demo**.
- No approved live ARC Raiders player account integration and no configured production AI model/generation.
- PWA shell, snapshot validation, offline restore and privacy controls are implemented; data restored offline stays marked stale.
- GitHub lists `https://raidvault-mauve.vercel.app` as homepage, **but the release document still states deployment verification is pending**. Re-test the hosted application and reconcile documentation rather than assuming HTTPS/PWA launch passed.
- The repository is publicly visible but has **no license**; publication, source reuse and game-content rights require an explicit owner decision.
- The key next issue is [#29 — M11 real game-data foundation](https://github.com/AVL05/raidvault/issues/29). It identifies MetaForge as a candidate and requires verification of API attribution, caching, permitted reuse, schema and rate limits. Do not assume any third-party license or endpoint is permanently stable.
- Do not assert current compatibility with the game's latest patch or current item data without refreshing sources.

## Restart checklist

1. Check `git status`, `git log -5 --oneline`, open PRs/issues and exact current dependency versions. Record target commit.
2. Use pinned versions in manifest: **Node 24.18.0**, **pnpm 12.6.0** and **Rust 1.98.0** (Bridge). Revalidate toolchain availability and security before any upgrades.
3. Run from repository root:
   ```bash
   pnpm install --frozen-lockfile
   pnpm lint
   pnpm typecheck
   pnpm test
   pnpm build
   pnpm -C apps/web dev
   ```
4. For the optional Bridge, run `cargo fmt --check`, `cargo check`, `cargo clippy -- -D warnings`, `cargo test` from `apps/bridge`. Do not add unapproved executable detection or access game memory/network.
5. Verify stash/planning with synthetic fixtures, local snapshot save/restore, offline page, stale indicators, PWA install/update, Gaming Mode UNKNOWN behavior and data clearing. Test the **deployed** build separately.
6. Record each command/platform/commit and result (PASS/FAIL/NOT_RUN) in the future audit. No tests were run as part of this documentation handoff.
7. Review the release gate `docs/RELEASE.md`, privacy/security policy, licenses and possible community API terms before publishing data or enabling any user-specific integration.

## Roadmap priority

**P0 — Reality check:** resolve mismatch between homepage deployment and unverified release documentation; reproduce CI/build/PWA on the current commit; audit dependencies and licensing.

**P1 — M11 real data:** complete [issue #29](https://github.com/AVL05/raidvault/issues/29) first. Implement allowed, reproducible validated/cached snapshots; show provenance and stale status. Never copy community-site data/assets without permission and never silently substitute dummy player state as real.

**P2 — Player-facing MVP:** manually managed stash or explicit import, real item database, deterministic requirements/quantities and explainable KEEP/RESERVE/SELL/RECYCLE advice. Validate with real player workflows before expanding.

**P3 — Broader planning:** quests, projects, workshop, tracker, maps and game updates only after trustworthy data exists. Any automatic player sync requires a separate, safe, authorized provider.

**P4 — Optional AI:** only if measured utility, available safe runtime and resource budget warrant it. Keep game performance and safe fail-closed Gaming Mode.

## Do not do on resumption

- Do not inject into the game, read memory, intercept packets, scrape accounts or automate gameplay.
- Do not advertise official Embark partnership, anti-cheat approval, production model or live account data.
- Do not remove the rules engine, source validation, data provenance, offline staleness or storage privacy protections.
- Do not add a hosted backend just to bypass provider caching terms or expose credentials to the browser.
- Do not merge unrelated feature expansions while trying to restore a clean baseline.

## Decision

**Keep for future development**, rather than archive/delete. Its reusable strengths are the rules engine, validated domain/provider contracts, offline PWA and carefully constrained AI architecture. The critical product gap is trustworthy game data and actual player workflows, not additional scaffolding.
