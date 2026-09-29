# ADR 0003 — Provider abstraction

## Status

Accepted

## Context

Community or future official sources may change or disappear. Coupling the application directly to one provider would make the Rules Engine and UI fragile.

## Decision

Player-data integrations use provider adapters that validate and normalize external payloads into RaidVault-owned domain models.

Provider-specific types must not leak into core business logic.

## Consequences

- A mock provider can drive development.
- Providers can be replaced with limited impact.
- Validation/normalization code is mandatory at the boundary.
- Integration work is slightly more explicit but substantially easier to audit.
