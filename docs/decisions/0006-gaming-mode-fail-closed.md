# ADR 0006 — Gaming Mode fails closed

## Status

Accepted

## Context

Running local WebGPU inference while ARC Raiders is active may compete for GPU/VRAM and reduce game performance.

## Decision

When ARC Raiders is detected as running, RaidVault enters Gaming Mode and disables/unloads heavy AI resources.

If game-running state is UNKNOWN, RaidVault behaves conservatively and disables heavy AI work.

## Consequences

- Game performance takes priority over AI availability.
- Bridge/process detection must expose uncertainty explicitly.
- Users can continue using lightweight deterministic functionality while gaming.
- AI model files may remain installed locally while GPU resources are unloaded.
