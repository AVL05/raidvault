# RaidVault

RaidVault is an unofficial, local-first intelligent companion for ARC Raiders.

The project is designed around three principles:

1. **Player safety first.**
2. **Deterministic game logic before AI.**
3. **Local-first privacy and performance.**

RaidVault aims to help players understand their stash, determine what to keep/reserve/sell/recycle, plan workshop and quest requirements, prioritize loot, and optionally use a local WebGPU AI assistant.

> RaidVault is an unofficial community project and is not affiliated with, endorsed by, or sponsored by Embark Studios.

## Status

**Pre-alpha / foundation stage.**

The project is currently defining architecture, safety boundaries, data contracts, and agent workflows before implementing game-facing integrations.

## Planned architecture

```text
External data sources
        ↓
Provider adapters
        ↓
Validation + normalization
        ↓
RaidVault domain
        ↓
Rules Engine
        ↓
Application services
        ↓
UI / optional local AI
```

A minimal local Bridge may later provide safe RaidVault-owned functionality such as health status and game-process existence detection. It must never inspect game memory or interfere with anti-cheat.

## Repository structure

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

The code structure will be introduced incrementally through milestones.

## Documentation

Start here:

- [AGENTS.md](./AGENTS.md) — rules for Codex, OpenCode, and other coding agents
- [SECURITY.md](./SECURITY.md) — non-negotiable player-safety boundary
- [ARCHITECTURE.md](./ARCHITECTURE.md) — architectural contracts
- [CONTRIBUTING.md](./CONTRIBUTING.md) — development workflow
- [docs/ROADMAP.md](./docs/ROADMAP.md) — staged delivery plan
- [docs/TESTING.md](./docs/TESTING.md) — validation strategy
- [docs/DATA_SOURCES.md](./docs/DATA_SOURCES.md) — external-data policy
- [docs/AI.md](./docs/AI.md) — optional WebGPU AI architecture
- [docs/BRIDGE.md](./docs/BRIDGE.md) — Bridge constraints

## Safety

RaidVault must not read or write ARC Raiders memory, inject code, hook rendering APIs, intercept game traffic, automate inputs, modify game files, or interfere with anti-cheat.

If a feature cannot be implemented safely within the documented boundary, it is not implemented.

## Development model

RaidVault is intentionally developed in small, reviewable milestones.

Coding agents must:

1. read `AGENTS.md`;
2. read the relevant specialized documentation;
3. implement only the requested scope;
4. run applicable checks;
5. review their own diff;
6. report limitations and risks.

See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

No open-source license has been selected yet. Until a license is explicitly added, normal copyright rules apply.
