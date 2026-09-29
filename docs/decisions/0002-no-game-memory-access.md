# ADR 0002 — No game memory access

## Status

Accepted

## Context

Reading/writing game memory, injection, hooks, traffic interception, or anti-cheat interaction creates unacceptable player/account risk for RaidVault's goals.

## Decision

RaidVault will not read or write ARC Raiders memory, inject code, hook rendering/game functions, interfere with anti-cheat, intercept game traffic, or automate game input.

This is a product constraint, not merely an implementation preference.

## Consequences

- Some desired features may be unavailable.
- Approved external providers, static data, manual input, and safe OS-level process existence detection are preferred.
- Loss of a provider does not justify an invasive fallback.
