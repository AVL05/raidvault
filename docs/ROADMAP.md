# RaidVault Roadmap

This roadmap defines implementation order, not release dates.

Do not skip milestones casually. Each stage should leave the repository in a valid, reviewable state.

## M0 — Foundation

- workspace/toolchain;
- minimal web app;
- minimal Rust Bridge executable with no game integration;
- lint/typecheck/test/build scripts;
- CI when tooling exists;
- documentation and ADR baseline.

## M1 — Domain

- provider-independent domain types;
- domain invariants;
- runtime/domain boundaries;
- mock player state fixtures.

## M2 — Game Data

- approved static/semi-static data-source adapter;
- validation;
- normalized item/quest/workshop/project knowledge;
- version/staleness metadata.

## M3 — Provider Architecture

- PlayerDataProvider contract;
- mock provider;
- provider error model;
- local cache/snapshot behavior;
- no real account integration until security review.

## M4 — Stash UI

- stash browsing;
- search/filtering;
- item detail;
- snapshot/staleness presentation;
- no AI dependency.

## M5 — Rules Engine

- KEEP;
- RESERVE;
- SELL;
- RECYCLE;
- REVIEW;
- required/reserved/missing/surplus calculations;
- structured explanations;
- strong test coverage.

## M6 — Planning

- workshop needs;
- quest needs;
- project needs;
- manual goals;
- raid-loot priorities;
- deterministic core.

## M7 — Bridge

- localhost health/version;
- narrowly approved process-existence detection;
- fail-safe Gaming Mode status;
- security review.

## M8 — WebGPU Engine

- capability detection;
- model manager;
- install/remove;
- load/unload/dispose;
- storage reporting;
- no gameplay automation.

## M9 — ARC AI

- local chat;
- read-only structured tools;
- explanations/planning;
- verified context only;
- Gaming Mode integration.

## M10 — PWA / Performance / Polish

- installability;
- offline behavior;
- cache/version handling;
- privacy/storage center;
- performance budgets;
- accessibility;
- release hardening.

## Release principle

A milestone is complete only when its relevant validation gates pass and known safety issues are resolved.
