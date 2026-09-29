# Testing Strategy

## Goals

Testing exists to protect:

- player safety;
- deterministic correctness;
- provider trust boundaries;
- graceful degradation;
- Gaming Mode behavior.

## Test pyramid

Prefer many fast unit tests, focused integration tests, and a small number of end-to-end flows.

## Mandatory critical coverage

### Rules Engine

Protect at least these invariants:

- missing/incomplete requirement data cannot produce unsafe SELL/RECYCLE recommendations;
- `surplus <= 0` cannot produce positive sell/recycle quantity;
- reserved quantities are respected;
- active objective requirements are respected;
- REVIEW is used when certainty is insufficient;
- calculations are deterministic for identical inputs.

### Providers

Test:

- valid payload normalization;
- invalid type rejection;
- negative/impossible quantity rejection;
- missing required field behavior;
- provider outage/timeouts;
- stale snapshot fallback;
- no provider-specific data leakage into domain objects.

### Storage

Test:

- schema versioning;
- migration behavior;
- corrupted cache handling;
- stale metadata;
- clearing user/model data independently.

### Gaming Mode

Test state transitions such as:

```text
NOT_RUNNING -> RUNNING
RUNNING -> NOT_RUNNING
UNKNOWN -> safe/heavy-AI-disabled
bridge unavailable -> safe fallback
```

### AI lifecycle

Test:

- not installed;
- installing;
- installed;
- loading;
- ready;
- unloading;
- error;
- unload on Gaming Mode;
- core application remains functional without AI.

## Regression tests

When fixing a bug in deterministic logic, reproduce it with a failing test before or alongside the fix whenever practical.

## Agent requirement

An agent changing critical business logic must report:

- tests added/changed;
- exact commands run;
- pass/fail status;
- untested edge cases.

## No fake green builds

Do not:

- remove tests to make CI pass;
- weaken assertions without justification;
- silence type errors with broad ignores;
- disable lints because generated code fails them.
