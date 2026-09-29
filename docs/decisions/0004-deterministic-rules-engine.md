# ADR 0004 — Deterministic Rules Engine

## Status

Accepted

## Context

KEEP/SELL/RECYCLE decisions depend on quantities, requirements, reserves, and player goals. These facts are better handled by deterministic, testable logic than probabilistic LLM output.

## Decision

The Rules Engine is authoritative for factual inventory calculations and classifications.

AI may explain or plan using Rules Engine output but cannot override it.

When information is insufficient for a safe recommendation, use REVIEW.

## Consequences

- Critical logic is directly unit-testable.
- AI hallucinations cannot silently redefine inventory facts.
- Structured reasons become part of recommendation output.
- Data completeness must be modeled explicitly.
