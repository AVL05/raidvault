# RaidVault Release Process

## Release target

**RaidVault v0.1.0 — Public Preview (Pre-alpha)**; intended tag **`v0.1.0`**.
The tag and release do not exist as a result of this preparation. M0–M10 completion
does not establish production readiness or live ARC Raiders integration.

## Required toolchains

- Node **24.18.0** and pnpm **12.6.0**, recorded in the root manifest.
- Rust **1.98.0**, rustfmt and clippy, pinned in the Bridge toolchain file.

Use the exact versions locally and in CI. CI installs pnpm/Node explicitly and
does not depend on runner Corepack state. A different build environment must be
validated against existing budgets; do not weaken checks to accommodate drift.

## Pre-release validation

From the repository root, execute every command and record its result:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Then, in Bridge:

```text
cd apps/bridge
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
```

Return to the repository root:

```text
git diff --check
git status
git diff main...HEAD
```

Review uncommitted/untracked files too: `main...HEAD` alone does not show them.
Smoke-test the production build with `pnpm -C apps/web start`; development mode
does not register the worker. Record exact web/repository/Bridge test counts,
bundle budget output, SHA/build ID and outstanding failures. Do not substitute
past validation results for evidence from the intended release revision.

## CI gate

- [ ] Both **Web** (Ubuntu 24.04) and **Bridge** (Windows 2022) jobs are green
  on the intended release revision.
- [ ] Frozen installation and every documented check actually ran; none weakened.
- [ ] Immutable checkout/pnpm action commits were verified in their repositories.
- [ ] Only pnpm store caching is used, keyed from `pnpm-lock.yaml`.
- [ ] No deployment, secrets, write permissions or ignored command failures.

Workflow existence/local checks are not proof of a successful hosted CI run.
Rust is installed with the runner's rustup and an exact toolchain/component list;
there is no Rust cache or extra setup action.

## Repository gate

- [ ] Intended `main` SHA confirmed and working tree clean after approved merge.
- [ ] Documentation describes actual demo capabilities and unavailable integrations.
- [ ] No unresolved release blockers; accepted limitations recorded explicitly.
- [ ] No secrets/tokens/provider credentials in source, artifacts or client bundle.
- [ ] Changelog ready; web/packages/Bridge versions remain consistent at 0.1.0.
- [ ] No unrequested product, provider, model or Bridge changes.

Root is a private workspace orchestrator without a product version; it need not
acquire one solely to match app versions. Database/cache/protocol versions are
independent of the release tag.

## License gate

**UNRESOLVED OWNER DECISION. No license has been selected.**

The repository remains explicitly unlicensed; normal copyright rules apply.
Public visibility does not establish general reuse/redistribution rights. The
owner must determine licensing and public redistribution/contribution policy,
or explicitly accept and document the unlicensed policy, before publication.
This gate cannot be checked merely because the repository is already public.

- [ ] Owner decision explicitly recorded; no license is inferred or added by an agent.

## Deployment gate

**UNRESOLVED OWNER DECISION. No host has been selected.**

No provider configuration or deployment is authorized by this document.
The host must:

- Support the current Next 16.3.6 build/runtime and entire pnpm workspace.
- Use frozen installation and the full `pnpm build` pipeline, not bare `next build`.
- Preserve `public/sw.js` generated **after** Next builds, together with `.next`,
  icons, static resources and required runtime dependencies/configuration.
- Support `pnpm -C apps/web start` or a separately verified compatible packaging
  path. Current prerendered routes do not imply a configured static export.
- Serve public HTTPS at the origin root, including `/`, `/offline`, manifest,
  icons, Next assets and `/sw.js` with the correct scope.
- Serve `/sw.js` as JavaScript with `Cache-Control: no-store, max-age=0` and
  `X-Content-Type-Options: nosniff`.
- Preserve shell/manifest/asset bytes and avoid unintended HTML/asset rewriting,
  redirects or injected markup: worker installation verifies response SHA-256.
- Publish a coherent build; avoid mixed HTML/assets/worker revisions and document
  rollback behavior without clearing snapshots or unrelated/model storage.

Generated `sw.js` is gitignored. Its generator/template are source of truth.
Never commit an older worker to repair a host-packaging problem. A host adapter
must prove that post-build generation reaches its final public asset bundle.
See [PWA](./PWA.md) and [performance budgets](./PERFORMANCE.md).

- [ ] Host selected by owner; packaging and HTTPS behavior proven.
- [ ] Matrix below completed on the actual public host before publication.

## First public deployment target

Target:
Vercel

Status:
Approved configuration, deployment not yet performed.

No Vercel project has been created. No deployment has been performed.
No tag, GitHub Release, license change, or product-code change is authorized
by this section.

Approved Vercel project settings:

- Root Directory: `apps/web`
- Framework Preset: Next.js
- Include source files outside Root Directory: ENABLED
- Node: 24.x
- Install Command:
  `npm exec --yes --package=pnpm@12.6.0 -- pnpm -C ../.. install --frozen-lockfile`
- Build Command:
  `node --version && npm exec --yes --package=pnpm@12.6.0 -- pnpm run build`
- Output Directory: Vercel Next.js framework default / no override
- Environment variables: NONE
- Production branch: `main`
- Custom domain: NONE for initial verification
- Initial domain: default `*.vercel.app`
- Toolbar: DISABLED for verification
- Verification origin must be publicly reachable without authentication
- No automatic production promotion until verification is complete

Node policy:

- Repository/CI/local reproducibility remains Node 24.18.0.
- Vercel deployment uses supported Node 24.x.
- Do NOT weaken or modify the repository Node requirement.
- Record the exact effective Node version from each hosted build.
- A Vercel 24.x patch/minor difference is an accepted
  deployment-environment variance, not a reason to modify `package.json`.

Environment variables:
None.

Bridge:
Not deployed.

AI:
No production model/runtime/cloud service.

Initial host:
Default `*.vercel.app`.

Custom domain:
Deferred.

Toolbar:
Disabled for verification.

Deployment protection:
Verification origin must be accessible without auth so service-worker
precache requests behave like real public clients.

## Service worker packaging

The required build pipeline is:

```text
prepare
→ next build
→ build-pwa
→ performance check
```

The deployment MUST use the full repository build script.

Bare `next build` is invalid for RaidVault deployment because it omits
generated `public/sw.js`.

Adapter/source inspection indicates post-build `public/sw.js` is
packageable, but this remains provisional until tested on the actual hosted
deployment.

Hosted compatibility is NOT proven yet.

## Hosted PWA verification

Complete this evidence checklist on the actual deployment. Record URL,
release SHA/build ID, exact hosted Node version, browser/version,
PASS/FAIL/NOT AVAILABLE, response headers, and hashes for each row.

Required HTTP checks:

- `/`
- `/offline`
- `/manifest.webmanifest`
- `/sw.js`
- `/icons/icon-192.png`
- `/icons/icon-512.png`
- maskable icon
- Apple icon
- every PWA inventory resource

For `/sw.js` require:

- HTTP 200
- no redirect
- JavaScript Content-Type
- `Cache-Control: no-store, max-age=0`
- `X-Content-Type-Options: nosniff`

For every inventory resource:

- HTTP 200
- correct final URL
- response body SHA-256 matches the inventory generated by that SAME
  hosted build

gzip/Brotli transfer encoding does not itself invalidate hashes after
browser decompression.

## Browser verification

Document evidence for each item below on the actual hosted origin.

Application > Manifest:

- valid metadata
- icons
- id `/`
- start_url `/`
- scope `/`

Application > Service Workers:

- registered
- activated
- scope `/`
- no errors

Application > Cache Storage:

- one exact `raidvault-app-shell-v1-<digest>`
- entry count equals hosted inventory
- no provider/API/Bridge/model URLs

Application > IndexedDB:

- `raidvault-local-state`
- version 1
- `snapshots` store
- normalized envelope only

Functional:

- stash
- planning
- stale local restore
- offline reload
- independent clearing
- truthful unavailable states

AI/Gaming:

- production AI unavailable
- no auto model download
- Gaming Mode UNKNOWN/fail-safe

Network:

- no telemetry
- no cloud AI
- no Bridge proxy
- no provider credentials
- no unexpected third party

Accessibility:

- keyboard
- skip link
- visible focus
- labels
- destructive confirmation focus behavior

## Production HTTPS verification matrix

Record URL, release SHA/build ID, browser/version, PASS/FAIL/NOT AVAILABLE and
evidence for each row. Test at least one Chromium browser for native installation.
This is a future gate, not a claim that deployment has been verified.

| Area | Procedure and expected result |
| --- | --- |
| Manifest/icons | Manifest name/start/scope/display valid; 192/512/maskable/Apple PNGs load with expected dimensions. Native install succeeds in Chromium. |
| Worker response | `/sw.js` is 200 JavaScript with required headers; matches generated bytes. Every precache response matches `.next/raidvault-pwa.json` hashes. |
| Worker lifecycle/cache | Worker installed/activated without runtime errors; cache matches `raidvault-app-shell-v1-<64 lowercase hex digest>`. Unrelated caches survive activation. |
| Reload/offline shell | Reload normally, then disconnect and reload `/` and `/offline` after installation; local shell works without network. |
| Waiting update | Deploy a controlled subsequent revision only with approval; worker waits and announces pending update. Draft remains intact; no forced reload/activation. Closing all tabs and reopening activates naturally. |
| Saved snapshot/refresh | Online demo hydration saves normalized envelope in `raidvault-local-state`, schema 1, `snapshots`; `/offline` restores after refresh with original capture and `stale: true`. |
| Freshness | Browser online/offline changes do not mark restored data fresh or verify provider/Bridge health. |
| Clear snapshots only | Confirm snapshot clearing; shell caches remain. Reopen offline workspace: absent snapshot is unavailable, not a mock fallback. Open in-memory views may remain. |
| Clear shell only | Confirm shell clearing; snapshot remains. Explain offline reload may fail until a subsequent worker installation restores the shell; no automatic repopulation claim. |
| Models unaffected | Production remove action unavailable with truthful reason. Snapshot/shell operations do not call model removal or delete model/unrelated caches; no production model artifact is fabricated to test this. |
| Stash/planning | Demo search, filters, detail, quantities and quest/project facts agree with validated fixtures; missing references/unsupported workshop states remain explicit. |
| Deterministic classification | Run existing Rules Engine tests and review fixture expectations/invariants. Current browser UI has no independent classification panel; do not claim a nonexistent UI smoke test. |
| Unavailable/error | No record, corrupt/incompatible record and denied storage produce explicit unavailable/error states, no inferred repair/freshness. Use a disposable browser profile and existing tests where faults are not reproducible manually. |
| AI/Gaming Mode | No production model/runtime or generation availability is claimed. UNKNOWN remains fail-safe; no automatic loading/generation or cloud fallback. Active-generation cancellation remains covered by existing lifecycle tests, not fabricated production sessions. |
| Excluded traffic | Inspect Cache Storage and existing policy tests: provider/API, Authorization, RSC/data, Bridge localhost, external and model requests are never shell entries. Do not connect a real provider/Bridge merely to run this test. |
| Privacy/secrets | Network and console show no unexpected external requests, telemetry or sensitive logging; source/client artifacts contain no credentials/secrets/cloud AI endpoint. |
| Accessibility | Keyboard traversal, skip link, labels, visible focus and status/error semantics work. Destructive confirmations are named; Cancel/Escape and trigger focus restoration work without a focus trap. |

Cases unavailable through the current production UI must be marked honestly and
backed by existing automated tests. Do not introduce test controls/product
features or assert unsupported integrations for release evidence.

## Security gate

- [ ] No telemetry, analytics, remote sensitive logging or cloud AI.
- [ ] No real provider credentials or committed deployment secrets.
- [ ] No game memory access, anti-cheat interaction or packet interception.
- [ ] No gameplay automation, injection, rendering hooks or game-file changes.
- [ ] No Bridge expansion or process inspection outside existing boundaries.
- [ ] No broad service-worker caching; exact namespace and model separation intact.
- [ ] Rules Engine authority and fail-safe Gaming Mode remain unchanged.

## Approval gate

- [ ] Repository/CI/local validation, license and deployment gates reviewed.
- [ ] Release notes and actual known limitations approved by owner.
- [ ] Explicit owner approval obtained separately for deployment, tag and GitHub Release.

Preparation is not authorization to deploy, create `v0.1.0`, publish a GitHub
Release, push changes or add a license. A future release must be labelled
**Public Preview (Pre-alpha)** and marked prerelease; never claim production
readiness or official Embark affiliation. This is release readiness, not M11.
