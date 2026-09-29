# RaidVault — Agent Instructions

These instructions apply to Codex, OpenCode, and any other coding agent working in this repository.

## 1. Mission

RaidVault is an unofficial, local-first companion for ARC Raiders.

Primary capabilities may include:

- stash analysis;
- KEEP / RESERVE / SELL / RECYCLE / REVIEW recommendations;
- workshop, quest, and project planning;
- raid-loot priorities;
- loadout context;
- optional local WebGPU AI.

RaidVault must never put a player's account, installation, or system at unnecessary risk.

## 2. Priority order

Use this order when making decisions:

1. player/account safety;
2. data correctness;
3. security/privacy;
4. reliability;
5. game performance;
6. maintainability;
7. features;
8. development speed.

A lower-priority goal never overrides a higher-priority one.

## 3. Required reading

Always read this file before modifying the repository.

Also read:

- `SECURITY.md` before Bridge, provider, process-detection, localhost, game-facing, or anti-cheat-related work;
- `ARCHITECTURE.md` before changing package boundaries, domain models, providers, Rules Engine, storage, Bridge, or AI architecture;
- relevant files in `docs/decisions/` before contradicting an accepted architectural decision;
- `docs/TESTING.md` before adding or changing critical business logic.

## 4. Non-negotiable game-safety boundary

RaidVault must never:

- read or write ARC Raiders process memory;
- inject DLLs or code;
- hook game functions, DirectX, Vulkan, or rendering pipelines;
- modify game executables, assets, or protected files;
- inspect, disable, weaken, bypass, or interfere with anti-cheat;
- intercept, decrypt, proxy, modify, or impersonate game network traffic;
- automate keyboard, mouse, or controller input into the game;
- implement macros, recoil compensation, aiming assistance, movement automation, loot automation, or gameplay automation.

If a requested feature appears to require any of the above: **stop, do not implement it, explain the conflict, and propose a safer alternative.**

## 5. Local-first

Prefer:

- browser-local storage;
- IndexedDB;
- Cache Storage;
- localhost-only communication;
- local WebGPU inference.

Do not add, without explicit approval:

- hosted databases;
- user accounts;
- cloud AI;
- analytics;
- telemetry;
- trackers;
- remote player-data storage;
- remote logging of sensitive data.

## 6. Architecture contracts

Required data flow:

```text
External source
    ↓
Provider adapter
    ↓
Runtime validation
    ↓
Normalization
    ↓
RaidVault domain model
    ↓
Rules Engine / application services
    ↓
UI / optional AI
```

Do not pass provider response objects directly into business logic or UI components.

Business logic must not depend on provider-specific field names or authentication formats.

## 7. External data is untrusted

Every external payload must be validated before entering domain logic.

Never invent missing values.

If required information is incomplete, preserve uncertainty explicitly.

## 8. Rules Engine before AI

The Rules Engine is deterministic and authoritative for factual calculations.

Core recommendation classes:

- `KEEP`
- `RESERVE`
- `SELL`
- `RECYCLE`
- `REVIEW`

Use `REVIEW` when available data is insufficient for a safe recommendation.

Every recommendation must be explainable from structured reasons.

## 9. AI boundary

AI is optional and non-authoritative.

It may explain, summarize, compare, prioritize, and plan from validated RaidVault data.

It must not:

- invent game state;
- override deterministic safety rules;
- mutate game state;
- perform game actions;
- execute arbitrary local commands.

AI tools must remain read-only.

RaidVault core functionality must work without an installed AI model.

## 10. Gaming Mode

When ARC Raiders is known or reasonably suspected to be running:

- stop AI inference;
- unload model GPU resources;
- minimize background work;
- avoid expensive polling;
- preserve game performance.

If game-running status is uncertain, fail safely and treat the game as potentially running.

## 11. Bridge scope

The Bridge must remain intentionally small.

Initially allowed responsibilities:

- health status;
- Bridge version;
- specifically approved process-existence detection;
- Gaming Mode status;
- RaidVault-owned diagnostics.

It must not become a generic process inspector, shell runner, filesystem RPC service, memory-access layer, or game-integration framework.

## 12. Code quality

Use strict TypeScript. Avoid `any`, `@ts-ignore`, and `@ts-nocheck` unless explicitly justified.

Prefer safe Rust. Do not introduce `unsafe` without explicit architectural approval.

Do not add dependencies casually. Prefer platform capabilities and existing dependencies when appropriate.

## 13. Scope discipline

Implement only the requested milestone.

Do not opportunistically add authentication, databases, analytics, cloud services, overlays, automation, speculative features, or unrelated refactors.

If an improvement is useful but out of scope, report it instead of implementing it.

## 14. Mock-first development

Core behavior should be developed and tested with mock player data before real-player integration.

Real ARC Raiders integration must not be required to build the domain, Rules Engine, stash UI, planners, storage, or AI context.

## 15. Testing expectations

Critical business logic requires automated tests.

At minimum protect invariants such as:

- required items cannot become SELL/RECYCLE because data is missing;
- non-positive surplus cannot produce a positive sell quantity;
- invalid provider payloads cannot reach domain logic;
- uncertain requirements produce REVIEW where safety requires it;
- Gaming Mode behaves fail-safe.

## 16. Git safety

Before editing:

1. inspect repository state;
2. understand the current milestone;
3. read relevant docs and source;
4. preserve unrelated user work.

Never force-push, rewrite history, or discard unrelated uncommitted work without explicit permission.

## 17. Agent workflow

For each task:

1. **Read** relevant instructions and ADRs.
2. **Inspect** existing implementation.
3. **Plan** the smallest coherent change.
4. **Implement** only requested scope.
5. **Validate** with applicable tests/lint/typecheck/build/Rust checks.
6. **Review** the diff for security, architecture, and unnecessary complexity.
7. **Report** changes, files, commands, results, limitations, and security implications.

Do not claim success while relevant checks are failing.

## 18. Definition of done

A task is done only when:

- requested behavior is implemented;
- architecture and security boundaries are respected;
- applicable tests exist and pass;
- applicable type/lint/build checks pass;
- error states are handled;
- documentation is updated when needed;
- no unnecessary dependencies were introduced.

## 19. Final rule

When choosing between more functionality and lower player risk, choose lower player risk.

When choosing between guessing and `REVIEW`, choose `REVIEW`.

When choosing between a clever implementation and a simple auditable implementation, prefer the simple auditable implementation.
