## Summary

Describe the change and why it is needed.

## Scope

- [ ] This PR is limited to one coherent milestone/task.
- [ ] No unrelated refactors or speculative features were added.

## Safety

- [ ] I read `AGENTS.md`.
- [ ] I read `SECURITY.md` if this touches Bridge/providers/game-facing functionality.
- [ ] This change does not read/write game memory, inject code, hook rendering, automate inputs, intercept game traffic, or interfere with anti-cheat.
- [ ] New Bridge/provider/AI capabilities stay within documented boundaries.

## Architecture

- [ ] Layer boundaries in `ARCHITECTURE.md` are respected.
- [ ] External data is validated before domain use.
- [ ] Provider-specific types do not leak into business logic/UI.
- [ ] AI does not replace deterministic Rules Engine facts.

## Validation

List commands executed and results.

```text
# example
pnpm lint
pnpm typecheck
pnpm test
pnpm build
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

## Tests

Describe tests added/updated and important edge cases covered.

## Known limitations

List any limitations, follow-up work, or intentionally deferred items.

## Security impact

State whether this changes the security surface. If yes, explain the review performed.
