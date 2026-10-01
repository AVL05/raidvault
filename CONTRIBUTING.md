# Contributing to RaidVault

## Development philosophy

RaidVault is developed in small, auditable milestones.

Safety and correctness take priority over feature velocity.

## Before starting work

1. Read `AGENTS.md`.
2. Read documentation relevant to the area being changed.
3. Inspect the current repository state.
4. Confirm the requested milestone/scope.
5. Check relevant ADRs.

## Local setup

Use Node **24.18.0** and pnpm **12.6.0**, as recorded in the root manifest.
Install the exact pnpm version with a supported local installation method;
do not assume Corepack is bundled with Node. CI installs pnpm/Node explicitly.

From the repository root:

```text
pnpm install --frozen-lockfile
pnpm -C apps/web dev
```

Bridge requires rustup and Rust **1.98.0**, with rustfmt/clippy pinned in
`apps/bridge/rust-toolchain.toml`. It is optional for the demo web application;
there is no browser-to-Bridge integration. Run it separately with:

```text
cd apps/bridge
cargo run
```

## Branches

Prefer short-lived branches with descriptive names, for example:

```text
chore/project-foundation
feat/domain-model
feat/mock-provider
feat/rules-engine
feat/bridge-health
fix/stash-surplus-calculation
```

Do not force-push shared branches without explicit agreement.

## Commits

Use clear, scoped commit messages.

Examples:

```text
chore: bootstrap project foundation
docs: define bridge security boundary
feat(domain): add player stash model
test(rules): protect required items from sell classification
fix(provider): reject invalid stash quantities
```

Do not mix unrelated changes into one commit.

## Pull requests

A PR should:

- address one coherent scope;
- explain why the change exists;
- list important implementation decisions;
- list validation commands and results;
- identify security implications;
- identify known limitations;
- avoid unrelated cleanup.

Use the repository PR template.

## Agent workflow

Codex/OpenCode should normally be given a specific milestone or bounded task.

Good:

> Implement the provider-agnostic PlayerStash domain model and tests. Do not add providers or UI.

Bad:

> Improve RaidVault.

For high-risk components, use independent review:

1. one agent implements;
2. another agent audits without editing;
3. fix findings;
4. merge only after checks pass.

High-risk areas include:

- Bridge;
- provider authentication;
- Rules Engine;
- AI tool boundary;
- storage of credentials;
- game-process detection.

## Quality gates

From the repository root, run the same checks as the Web CI job:

```text
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Use `pnpm -C apps/web start` to inspect the production build. Bare `next build`
omits post-build worker generation and budgets; development does not register
the worker. See [PWA.md](./docs/PWA.md).

From `apps/bridge`, run the same checks as the Bridge CI job:

```text
cargo fmt --check
cargo check
cargo clippy -- -D warnings
cargo test
```

Do not disable checks simply to get green output.

Before release, also run `git diff --check` and inspect tracked/untracked changes.
Local validation does not prove hosted CI or public HTTPS behavior; publication,
licensing and hosting decisions follow [RELEASE.md](./docs/RELEASE.md).

## Tests

Bug fixes should include regression tests when practical.

Critical deterministic logic requires direct tests.

See `docs/TESTING.md`.

## Dependencies

Every new dependency should have a clear reason.

Avoid introducing multiple tools for the same responsibility.

## Documentation

Update documentation when changing:

- security boundaries;
- architecture;
- provider contracts;
- Rules Engine semantics;
- AI lifecycle;
- Bridge capabilities;
- development workflow.

Create or update an ADR for significant architectural decisions.

## Out-of-scope discoveries

If you discover an improvement outside the requested scope, report it rather than implementing it automatically.
