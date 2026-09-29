# RaidVault AI Architecture

## Principle

AI is optional enhancement, not core authority.

RaidVault must remain useful when no AI model is installed.

## Responsibilities

The AI may:

- explain deterministic recommendations;
- summarize player priorities;
- compare options;
- answer questions over validated RaidVault context;
- generate raid/planning suggestions from structured facts.

The AI must not:

- invent factual player state;
- override deterministic Rules Engine facts;
- mutate game state;
- automate gameplay;
- execute arbitrary shell commands;
- receive generic memory/process-control tools.

## Local execution

Target architecture is local WebGPU inference in the browser where supported.

Model artifacts should be explicitly installable and removable.

Cloud AI is not part of the default architecture.

## Model lifecycle

Expected states:

```text
NOT_INSTALLED
INSTALLING
INSTALLED
LOADING
READY
UNLOADING
ERROR
```

Transitions must be explicit and testable.

## Gaming Mode

When ARC Raiders is running or state is uncertain:

- stop inference;
- cancel/finish work safely;
- unload model resources;
- release WebGPU buffers/resources;
- minimize background AI work.

Installed model files may remain cached locally; they do not need to be redownloaded after each session.

## Context contract

Preferred flow:

```text
Validated PlayerState
+ Validated GameKnowledge
+ Rules Engine Analysis
        ↓
AI Context Builder
        ↓
Local AI
```

Raw provider payloads should not be sent directly to the model.

## Tools

AI tools must be read-only and narrowly typed.

Examples:

- getPlayerState;
- getItemAnalysis;
- getWorkshopNeeds;
- getQuestNeeds;
- getProjectNeeds;
- getRaidPriorities;
- searchGameKnowledge.

Do not expose mutation or generic system tools.

## Explainability

AI explanations should reference structured reasons from the Rules Engine rather than fabricate their own factual basis.

If structured context is incomplete, the AI must communicate uncertainty rather than claim certainty.
