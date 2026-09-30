# RaidVault Bridge

## Purpose

The Bridge exists only for local capabilities that a browser/PWA cannot safely provide.

It is not a game-modification component.

## Initial scope

The first Bridge version should be extremely small.

Allowed initial capabilities:

- `health`;
- Bridge version;
- approved game-process existence status;
- Gaming Mode state derived from process existence;
- RaidVault-specific diagnostics.

No process detection should be implemented until its milestone and security review.

## Prohibited capabilities

The Bridge must never provide:

- process memory read/write;
- DLL/code injection;
- rendering hooks;
- anti-cheat inspection or control;
- network interception;
- game packet manipulation;
- game-input automation;
- generic process enumeration API;
- generic shell execution;
- arbitrary filesystem RPC;
- arbitrary registry mutation.

## Local API

If HTTP/WebSocket is used:

- bind to loopback only;
- minimize endpoints;
- validate every request;
- use explicit origin policy where practical;
- do not expose secrets in URLs;
- avoid permissive CORS;
- avoid generic RPC endpoints.

A conceptual API might eventually look like:

```text
GET /health
GET /version
GET /gaming-mode
```

This is illustrative, not authorization to implement ahead of the roadmap.

## Permissions

The Bridge should run with ordinary user permissions whenever possible.

Do not request administrator privileges as a convenience.

## Game detection

Approved process detection is limited to answering:

> Is the specifically approved ARC Raiders executable currently running?

It must not inspect:

- process memory;
- loaded data structures;
- modules for game-state extraction;
- anti-cheat internals;
- in-match/menu state.

If status cannot be established safely, report UNKNOWN.

## Failure behavior

Bridge unavailable or uncertain status must not trigger aggressive fallback techniques.

The web application should degrade safely and disable heavy AI if needed.

## Expansion rule

Every new Bridge capability requires:

1. explicit product need;
2. security review against `SECURITY.md`;
3. architecture review;
4. tests;
5. documentation update;
6. explicit approval before implementation.

## M7 implementation status

Implemented: `GET /health`, `GET /version`, and `GET /gaming-mode` on
`127.0.0.1` using only the Rust standard library (no HTTP framework).

No approved ARC Raiders executable identity exists in project
documentation yet, so the production detector reports UNKNOWN
(fail-safe) and no executable names are hard-coded. Fake detectors
cover every detection state in tests. No CORS is configured because no
browser integration consumes the Bridge yet.
