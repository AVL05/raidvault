# ADR 0001 — Local-first architecture

## Status

Accepted

## Context

RaidVault handles user-specific player state and may run an optional AI model. A hosted backend would add privacy, cost, operational complexity, and an additional trust boundary.

## Decision

RaidVault is local-first.

User-specific cache/state should remain on-device wherever practical. Core application behavior must not require a RaidVault-owned database or account system.

## Consequences

- IndexedDB/Cache Storage are preferred for browser-local state.
- Cloud services require explicit future approval.
- Offline/stale-snapshot behavior becomes an important design concern.
- Provider APIs may still be contacted directly when required for approved data access.
