# RaidVault Security Policy

## Purpose

RaidVault is designed to assist ARC Raiders players without interfering with the game, anti-cheat, or protected runtime state.

This document defines mandatory engineering boundaries.

## Security principle

**No feature is important enough to risk a player's account or game integrity.**

If safety is uncertain, RaidVault must fail closed and use a safer alternative.

## Prohibited interaction with ARC Raiders

RaidVault must not:

- read or write game process memory;
- request handles for memory inspection or mutation;
- inject DLLs, threads, modules, or code;
- hook game functions or rendering APIs;
- inspect protected modules;
- tamper with Easy Anti-Cheat or any other anti-cheat component;
- modify the game executable, assets, or protected runtime configuration;
- intercept, decrypt, alter, proxy, replay, or impersonate game network traffic;
- automate gameplay inputs;
- provide aim, recoil, movement, farming, or loot automation.

A future contributor or agent must not introduce these capabilities as fallbacks when an approved API is unavailable.

## Allowed interaction model

Permitted categories may include:

- documented external APIs;
- explicitly approved community APIs;
- static public game datasets;
- user-provided data;
- RaidVault-owned local files;
- browser-local storage;
- localhost communication between RaidVault components;
- normal OS process-existence detection limited to approved executable identity.

Process detection is only for determining whether the game is running. It must not inspect game memory, modules, state structures, or anti-cheat internals.

## Provider security

External player-data providers must be treated as trust boundaries.

Requirements:

- validate every response;
- normalize into RaidVault-owned domain types;
- use the minimum requested permission/scope;
- never log access tokens;
- never commit credentials;
- never expose provider secrets to unrelated components;
- handle provider outages without unsafe fallbacks.

Provider credentials should remain local where the provider architecture permits it.

## Bridge security

The Bridge is a narrow local component, not a privileged general-purpose daemon.

Requirements:

- bind only to localhost when networking is required;
- expose the smallest possible API;
- validate all input;
- restrict origins/clients where practical;
- do not expose arbitrary command execution;
- do not expose arbitrary process queries;
- do not expose arbitrary filesystem access;
- do not expose memory read/write primitives;
- do not accept arbitrary executable paths for process inspection;
- do not log secrets;
- remain useful without administrator rights whenever possible.

Any new Bridge capability requires review against this file and `docs/BRIDGE.md`.

## AI security

Local AI has no mutation authority.

AI tools must be read-only and narrowly typed.

The AI must not receive a generic shell tool, generic filesystem mutation tool, memory tool, game-input tool, or arbitrary network tool.

The Rules Engine remains authoritative for factual inventory calculations.

## Data minimization

Store only what RaidVault needs.

Prefer local storage for user-specific state.

Do not add telemetry, analytics, crash-upload services, or remote logs without explicit approval and a privacy review.

## Logging

Logs must not contain:

- access tokens;
- API keys;
- credentials;
- personal identifiers not necessary for debugging;
- full sensitive provider payloads by default.

Diagnostic logging should be structured, minimal, and user-controlled where practical.

## Dependency security

New dependencies require justification.

Before adding a dependency, consider:

- maintenance activity;
- security history;
- transitive dependency footprint;
- whether native functionality already solves the problem.

Lockfiles must be committed once package management is introduced.

## Vulnerability handling

If a security issue is found:

1. stop feature work affecting the vulnerable area;
2. document the impact;
3. patch the issue with the smallest safe change;
4. add regression tests where applicable;
5. review whether cached/local credentials or data could be affected.

Do not publish exploitable security details before a fix is available if doing so would create avoidable risk.

## Fail-safe behaviors

Examples:

- invalid external payload → reject, do not infer;
- unknown game-running state → disable heavy AI;
- incomplete item requirement data → REVIEW;
- provider unavailable → use last validated snapshot with clear staleness indication, or show unavailable;
- unsafe implementation required → feature unavailable.

## Security review trigger

Explicit security review is required before:

- connecting a real player account/provider;
- adding process detection;
- adding localhost APIs;
- adding credential storage;
- adding AI tool execution;
- expanding Bridge permissions;
- changing the anti-cheat safety boundary.
