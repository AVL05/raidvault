# RaidVault Architecture

## Goals

RaidVault should be:

- safe for players;
- local-first;
- provider-independent;
- deterministic for factual calculations;
- usable without AI;
- resilient to provider outages;
- lightweight while ARC Raiders is running;
- easy for coding agents to modify without crossing architectural boundaries.

## Target repository structure

```text
apps/
  web/
  bridge/

packages/
  domain/
  providers/
  game-data/
  rules-engine/
  ai-engine/
  shared/

docs/
  decisions/
```

This structure is introduced incrementally. Do not create unused packages only to satisfy the diagram.

## Layer responsibilities

### domain

Owns provider-agnostic RaidVault types and invariants.

Examples:

- PlayerState
- PlayerStash
- StashItem
- QuestProgress
- ProjectProgress
- HideoutProgress
- PlayerLoadout
- ItemRecommendation

Must not import provider implementations, UI, storage, or AI.

### providers

Owns adapters for external player-data sources.

Responsibilities:

- authentication integration;
- fetching;
- runtime validation;
- normalization into domain types;
- provider-specific error mapping.

Provider response types stay here.

### game-data

Owns normalized static/semi-static ARC Raiders knowledge used by the application.

Examples:

- item metadata;
- crafting requirements;
- workshop requirements;
- quest requirements;
- project requirements.

External datasets are validated before use.

### rules-engine

Owns deterministic calculations and recommendation facts.

Inputs:

- validated domain player state;
- validated game knowledge;
- explicit user goals/preferences.

Outputs include:

- owned/required/reserved/missing/surplus quantities;
- KEEP / RESERVE / SELL / RECYCLE / REVIEW;
- structured reasons;
- confidence/quality metadata where useful.

Must not call LLMs.

### ai-engine

Owns optional local model lifecycle and AI orchestration.

Responsibilities may include:

- model installation/removal;
- WebGPU capability checks;
- loading/unloading;
- read-only tool orchestration;
- explanation/planning over verified structured context.

AI output never replaces Rules Engine facts.

### shared

Contains genuinely cross-cutting utilities/configuration that do not belong to a more specific package.

Avoid turning this into a dumping ground.

### apps/web

Owns user-facing application composition and UI.

It consumes domain/application APIs, not raw provider payloads.

### apps/bridge

Owns the minimal local Bridge.

Initial scope is intentionally narrow. See `docs/BRIDGE.md`.

## Core data flow

```text
External provider ──┐
                    ├─> validation -> normalization -> PlayerState
Game data source ───┘                                │
                                                     ↓
                                                Rules Engine
                                                     │
                                                     ├─> UI
                                                     └─> verified AI context -> optional local AI
```

## Provider abstraction

Player-data providers must implement a stable internal contract.

Illustrative contract:

```ts
interface PlayerDataProvider {
  getProfile(): Promise<PlayerProfile>;
  getStash(): Promise<PlayerStash>;
  getLoadout(): Promise<PlayerLoadout | null>;
  getQuests(): Promise<readonly QuestProgress[]>;
  getHideout(): Promise<HideoutProgress>;
  getProjects(): Promise<readonly ProjectProgress[]>;
}
```

The exact interface may evolve through an ADR. Business logic must not depend on one provider.

## Validation boundary

External data is untrusted until validated.

A provider's raw response must never become a domain object through unchecked type assertion.

Validation failure must be explicit and observable.

## Storage

Initial direction:

- IndexedDB for structured user state/snapshots;
- Cache Storage where appropriate for installable/static assets and AI model artifacts;
- explicit schema versions;
- explicit migrations.

Do not store large/sensitive state in localStorage by default.

## Failure and degradation

The application must degrade gracefully:

- provider unavailable → last validated snapshot or explicit unavailable state;
- stale snapshot → display timestamp/staleness;
- AI unavailable → core application still works;
- WebGPU unavailable → core application still works;
- Bridge unavailable → manual/non-Bridge fallback where safe;
- incomplete requirements → REVIEW instead of unsafe recommendation.

## Gaming Mode

Gaming Mode is a performance state, not a game-integration system.

When the game is running or status is uncertain:

- AI inference stops;
- WebGPU model resources are unloaded;
- expensive work is reduced;
- lightweight UI/data functions may remain available.

## Architecture changes

Cross-layer changes require checking accepted ADRs.

Significant architectural decisions should be documented in `docs/decisions/` before implementation.
