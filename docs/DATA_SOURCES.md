# Data Sources Policy

## Purpose

RaidVault separates two categories of information:

### Game Knowledge

Static or semi-static information such as:

- items;
- crafting data;
- workshop requirements;
- quests;
- projects;
- maps/locations where approved.

### Player State

User-specific information such as:

- stash;
- quest progress;
- hideout/workshop progress;
- projects;
- loadout/profile state where safely available.

These categories must remain distinct.

## Approval requirement

No external source should be integrated merely because it exists.

Before integration, document:

- source owner;
- API/repository documentation;
- data categories;
- authentication/scopes;
- license/terms where relevant;
- update frequency;
- reliability expectations;
- rate limits;
- privacy implications;
- fallback behavior;
- whether use could create anti-cheat/account risk.

## Trust boundary

External data is untrusted.

Required flow:

```text
raw source
  ↓
provider/source-specific schema validation
  ↓
normalization
  ↓
RaidVault-owned domain/game-data types
```

Do not use unchecked type assertions as validation.

## Player-data credentials

If a player provider requires a token:

- request minimum read-only scope;
- store locally where architecture permits;
- never commit it;
- never log it;
- provide a clear disconnect/delete path;
- do not send it to unrelated services.

## Provider independence

RaidVault must be able to replace a community provider with another approved provider or future official provider without rewriting Rules Engine/UI/domain code.

## Caching

Validated snapshots should include:

- schema version;
- source/provider identifier;
- fetched timestamp;
- source version where available;
- validation status.

The UI must communicate when player state is stale.

## Unsafe fallback prohibition

If an approved provider stops working, do not replace it with process-memory reading, packet interception, anti-cheat-adjacent techniques, or undocumented invasive game access.

Use mock/manual/last-valid data until a safe provider is available.
