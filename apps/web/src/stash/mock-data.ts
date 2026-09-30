/**
 * RaidVault web demo inputs (M4).
 *
 * Tiny synthetic payloads for the stash screen only. Shapes are validated
 * at runtime by the real provider and game-data pipelines; this module
 * holds input literals, never validation logic. No real player data.
 *
 * demo-relic is intentionally absent from the game-data payload so the UI
 * demonstrates safe unknown-metadata fallback.
 */

export const MOCK_PROVIDER_ID = 'mock-provider'

export const MOCK_GAME_DATA_SOURCE_ID = 'web-demo-data'

/** Fixed demo snapshot timestamp (unix ms epoch). Displayed, never generated. */
export const DEMO_CAPTURED_AT = 1704067200000

export const MOCK_PLAYER_PAYLOAD = {
  profile: { pid: 'demo-raider' },
  stash: {
    owner: 'demo-stash',
    goods: [
      { sku: 'demo-bandage', amount: 3 },
      { sku: 'demo-wire', amount: 12 },
      { sku: 'demo-relic', amount: 1 },
    ],
    slotsTotal: 10,
    slotsUsed: 3,
  },
  quests: [{ uid: 'demo-quest', title: 'Demo Quest', needs: [2] }],
  takenAt: DEMO_CAPTURED_AT,
  source: 'web-demo',
}

export const MOCK_GAME_DATA_PAYLOAD = {
  items: [
    { uid: 'demo-bandage', label: 'Field Bandage', klass: 'medical' },
    { uid: 'demo-wire', label: 'Copper Wire', klass: 'parts' },
  ],
  quests: [
    {
      uid: 'demo-quest',
      label: 'Demo Quest',
      needs: [{ ref: 'demo-wire', qty: 2 }],
    },
  ],
  workshops: [],
  projects: [],
  metadata: {
    origin: MOCK_GAME_DATA_SOURCE_ID,
    revision: 'm4-demo-1',
    generatedAt: DEMO_CAPTURED_AT,
  },
}
