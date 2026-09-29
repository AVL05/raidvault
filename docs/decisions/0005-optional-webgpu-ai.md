# ADR 0005 — Optional local WebGPU AI

## Status

Accepted

## Context

AI can improve explanations and planning, but server-side AI adds recurring cost and privacy concerns. AI should not be required for basic stash functionality.

## Decision

The target AI architecture is an optional, locally installed browser model using WebGPU where supported.

Users can install/remove the model independently of RaidVault data.

Core RaidVault functionality must work without AI.

## Consequences

- Hardware/browser capability detection is required.
- Model lifecycle and storage management must be explicit.
- Non-WebGPU users retain deterministic functionality.
- Model size/performance must be treated as a product constraint.
