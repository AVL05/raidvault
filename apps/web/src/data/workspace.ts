import { createBundledGameDataSource, loadGameKnowledge } from '@raidvault/game-data'
import { createMockPlayerProvider, createPlayerStateSnapshotCache } from '@raidvault/providers'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import { buildVerifiedAiContext } from '@raidvault/ai-engine'
import {
  buildStashRows,
  describeSnapshot,
  listCategories,
  summarizeStash,
} from '../stash/view-model'
import {
  MOCK_GAME_DATA_PAYLOAD,
  MOCK_GAME_DATA_SOURCE_ID,
  MOCK_PLAYER_PAYLOAD,
  MOCK_PROVIDER_ID,
} from '../stash/mock-data'

export type WorkspaceResult =
  | { readonly ok: false; readonly kind: 'snapshot' | 'knowledge' }
  | {
      readonly ok: true
      readonly snapshot: import('@raidvault/providers').PlayerStateSnapshot
      readonly knowledge: import('@raidvault/game-data').GameKnowledge
      readonly rows: ReturnType<typeof buildStashRows>
      readonly categories: string[]
      readonly summary: ReturnType<typeof summarizeStash>
      readonly status: ReturnType<typeof describeSnapshot>
      readonly planning: ReturnType<typeof buildPlanningSnapshot>
      readonly analysis: ReturnType<typeof analyzeStash>
      readonly aiContext: ReturnType<typeof buildVerifiedAiContext>
    }

/** Load the validated demo snapshot + bundled knowledge once per page. */
export async function loadDemoWorkspace(): Promise<WorkspaceResult> {
  const provider = createMockPlayerProvider(MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD)
  const cache = createPlayerStateSnapshotCache(provider)
  const snapshotResult = await cache.refresh()
  if (snapshotResult.success === false) {
    return { ok: false, kind: 'snapshot' }
  }
  const knowledgeResult = await loadGameKnowledge(
    createBundledGameDataSource(MOCK_GAME_DATA_SOURCE_ID, MOCK_GAME_DATA_PAYLOAD),
  )
  if (knowledgeResult.success === false) {
    return { ok: false, kind: 'knowledge' }
  }
  const snapshot = snapshotResult.value
  const knowledge = knowledgeResult.value
  const rows = buildStashRows(snapshot.state, knowledge)
  const planning = buildPlanningSnapshot(snapshot.state, knowledge)
  const analysis = analyzeStash(snapshot.state, knowledge)
  const aiContext = buildVerifiedAiContext({
    playerState: snapshot.state,
    gameKnowledge: knowledge,
    analysis,
    planning,
    providerId: snapshot.providerId,
    stale: snapshot.stale,
  })
  return {
    ok: true,
    snapshot,
    knowledge,
    rows,
    categories: listCategories(rows),
    summary: summarizeStash(snapshot.state),
    status: describeSnapshot(snapshot),
    planning,
    analysis,
    aiContext,
  }
}
