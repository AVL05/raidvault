# RaidVault v0.1.0 — Design Implementation Handoff

This document is the implementation handoff for the approved final product design.

## Source of truth

Final Figma:

https://www.figma.com/design/SYc7RxdCm0XD9I9VpKVrhA

Treat the Figma as locked for this phase. Implement it; do not redesign it.

GitHub issue:

https://github.com/AVL05/raidvault/issues/28

Working branch:

`feat/ui-v0.1.0`

## Figma pages and primary node IDs

If the coding environment has Figma MCP/tool access, inspect these nodes directly.

### Foundations

- Page: `00 · Foundations`
- Main frame: `3:2` — `Visual Direction & Design System`

### Desktop

Page: `01 · Desktop Screens`

- `3:55` — `Overview · Desktop`
- `3:156` — `Stash · Desktop`
- `3:254` — `Planning · Desktop`
- `3:331` — `ARC AI · Desktop`
- `3:399` — `Settings · Desktop`

All desktop reference frames are `1440 × 1024`.

### Mobile and explicit states

Page: `02 · Mobile & States`

- `3:467` — `Overview · Mobile`
- `3:505` — `Stash · Mobile`
- `3:547` — `Offline stale state · Mobile`

Mobile references are `390 × 844`.

## Visual direction

RaidVault should feel like a focused tactical utility related to ARC Raiders without copying the game UI or proprietary assets.

Design statement from the approved Figma:

> Tactical utility, not military cosplay.

The intended visual language is:

- deep navy / graphite surfaces;
- warm amber focus/accent;
- cream primary typography;
- thin technical borders;
- capsule navigation/status controls;
- squared data panels;
- dense inventory information;
- strong uppercase micro-labels with tracking;
- restrained use of semantic status colors;
- compact, high-information presentation;
- no generic SaaS-dashboard feel.

Do not use ARC Raiders logos, extracted art, proprietary fonts, screenshots, or copyrighted UI assets.

## Exact foundation colors

Use semantic tokens rather than repeating these values throughout component markup.

| Token | Hex | Intent |
| --- | --- | --- |
| `void` | `#090D12` | page/app background |
| `surface` | `#121820` | primary panels/navigation |
| `raised` | `#1B2531` | raised/selected surfaces |
| `text` | `#F2EEE5` | primary text |
| `amber` | `#E6A63A` | primary focus/action/accent |
| `signal` | `#54A8C8` | informational/reserve signal |
| `safe` | `#68B982` | success/known-safe state |
| `danger` | `#D76A63` | destructive/error state |

Muted text/border values may be derived from the above only where needed for contrast/hierarchy. Avoid arbitrary one-off colors.

## Typography

Implementation font: **Inter**.

Direction:

- display: ~32px for primary page/status headings;
- section labels: ~11px uppercase with generous tracking;
- body: ~14px, factual and compact;
- numerics should carry strong hierarchy;
- interface copy remains neutral and precise.

Avoid decorative typefaces.

## Component language

### Navigation

Desktop:
- top application header;
- left navigation rail;
- active state uses a filled/raised surface and/or amber focus treatment;
- persistent status chips remain compact.

Mobile:
- compact top bar;
- fixed/anchored bottom navigation matching the approved 390px references.

### Panels

- mostly squared-off data surfaces;
- restrained corner radius;
- thin borders rather than large shadows;
- dense but readable information hierarchy.

### Status/classification

Existing deterministic labels remain authoritative:

- `KEEP`
- `RESERVE`
- `SELL`
- `RECYCLE`
- `REVIEW`

Status meaning must never rely on color alone. Always display the text label.

### Actions

Primary action uses amber emphasis.

Secondary actions use neutral/surface treatment.

Destructive actions must remain explicitly destructive and retain confirmation/focus behavior where already required.

## Screen contracts

### Overview

Reference: Figma node `3:55`.

Compose from existing application outputs only.

Expected presentation includes:
- stash occupancy metric;
- reserved requirements metric;
- missing requirements metric;
- snapshot freshness/state metric;
- current raid-priority summary;
- reserve item summary;
- system status panel;
- browser/offline state;
- Gaming Mode state;
- Local AI state;
- recent stash item cards.

Do not implement new calculations solely for this screen when an existing authoritative result already exists.

### Stash

Reference: Figma node `3:156`.

Core structure:
- page heading/description;
- compact search/filter row;
- inventory/grid region;
- item inspector on desktop;
- item cards with quantity and deterministic classification;
- inspector shows requirement facts, reserve/surplus facts and deterministic source/reason;
- empty slots are presentation only and must not corrupt domain capacity semantics.

Mobile reference: node `3:505`.

Mobile intentionally changes layout; do not simply scale down the desktop frame.

### Planning

Reference: Figma node `3:254`.

Expected presentation:
- target/quest card;
- progress indicator;
- requirement rows;
- owned/required/missing quantities;
- raid-readiness summary;
- next-raid priority board;
- unsupported workshop state remains explicit.

Do not invent workshop planning or progression facts.

### ARC AI

Reference: Figma node `3:331`.

Expected presentation:
- conversation-style layout;
- clear `YOU` / `ARC AI` distinction;
- verified-facts/source indicator;
- model/engine status panel;
- Gaming Mode state;
- model lifecycle state;
- locked/unavailable state;
- input/send control.

Existing AI rules remain unchanged:
- deterministic facts are authoritative;
- AI is optional;
- AI cannot invent game state;
- AI remains blocked while Gaming Mode is `ACTIVE` or `UNKNOWN`.

### Settings

Reference: Figma node `3:399`.

Expected sections:
- Local Snapshots;
- Offline App Shell;
- Local AI Model;
- Gaming Mode;
- version/build/privacy information where appropriate.

Preserve independent actions:
- clearing snapshots must not clear shell/model data;
- clearing shell must not clear snapshots/model data;
- model removal remains independent.

### Offline / stale state

Reference: Figma node `3:547`.

The UI must explicitly communicate:
- local restored snapshot;
- stale status;
- no provider refresh occurred;
- browser connectivity alone cannot make restored data fresh;
- Gaming Mode `UNKNOWN` remains fail-safe;
- AI remains locked where required.

Never visually imply fresh/live provider data when it is stale/local.

## Responsive behavior

Intentional targets:

- 1440 desktop reference;
- 1280 laptop;
- 1024 compact desktop/tablet landscape;
- 768 tablet;
- approximately 390 mobile reference.

At mobile width:
- desktop sidebar disappears;
- bottom navigation becomes primary navigation;
- inspector/detail content must stack or move to an appropriate mobile interaction;
- no horizontal clipping of core data;
- touch targets remain practical;
- fixed navigation must not cover interactive content.

## Architecture constraints

This phase should remain overwhelmingly inside the web presentation layer.

Do not change without a documented blocking reason:
- `packages/domain` semantics;
- `packages/providers` contracts;
- `packages/game-data` semantics;
- `packages/rules-engine` logic;
- `packages/ai-engine` factual authority;
- Bridge behavior;
- IndexedDB schema/normalized snapshot contract;
- service-worker allowlist/security policy.

Prefer adapting/deriving UI view models in the web layer from existing authoritative outputs rather than modifying business logic.

## Dependency policy

Use the existing stack and Tailwind.

Do not add a component library, icon library, animation library, state library or other dependency merely to reproduce the design.

If a dependency appears truly necessary, stop and report why before adding it.

Simple original SVG/CSS icons are acceptable when needed; do not import proprietary game assets.

## Accessibility contract

Do not trade accessibility for visual fidelity.

Required:
- existing skip link preserved;
- logical heading hierarchy;
- visible keyboard focus;
- keyboard-accessible navigation;
- labelled form fields;
- adequate text/background contrast;
- status text in addition to color;
- accessible destructive confirmations;
- no content hidden from keyboard/screen-reader users solely to match visuals.

## Performance / PWA contract

The redesign must not regress the verified v0.1.0 PWA behavior.

Preserve:
- `/sw.js` generation after Next build;
- exact app-shell allowlist strategy;
- no provider/API/Bridge/model runtime caching;
- existing offline restore semantics;
- existing IndexedDB validation/recompute behavior;
- no telemetry or third-party runtime dependencies.

Watch bundle size. A visual redesign is not justification for substantial dependency/bundle growth.

## Implementation sequence

Use coherent commits in this order:

1. `ui: add RaidVault design foundations and app shell`
2. `ui: implement overview design`
3. `ui: implement stash design`
4. `ui: implement planning design`
5. `ui: implement ARC AI design`
6. `ui: implement settings design`
7. `ui: implement responsive and explicit states`
8. `test: harden redesigned UI behavior`
9. `docs: record design implementation notes` if needed

Exact commit count can vary, but keep work reviewable.

## Required checks

Before reporting completion:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If repository CI runs Rust/Bridge validation, keep it green as well.

Do not change test expectations simply because the new UI is inconvenient to test. Update tests only where the rendered structure legitimately changed while preserving behavioral assertions.

## Agent reporting template

When done, report:

1. branch and final commit SHA;
2. phases completed;
3. files added/changed;
4. tests added/updated;
5. exact commands run and results;
6. dependency changes (expected: none);
7. functional/architectural changes (expected: none outside UI composition);
8. PWA/storage impact;
9. accessibility notes;
10. any deviations from Figma and why;
11. anything still incomplete.

Do not create the `v0.1.0` tag or GitHub Release from this task.
