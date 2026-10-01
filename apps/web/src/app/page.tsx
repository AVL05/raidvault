import { createBundledGameDataSource, loadGameKnowledge } from '@raidvault/game-data'
import {
  createMockPlayerProvider,
  createPlayerStateSnapshotCache,
} from '@raidvault/providers'
import { analyzeStash, buildPlanningSnapshot } from '@raidvault/rules-engine'
import { buildVerifiedAiContext } from '@raidvault/ai-engine'
import { AiEnginePanel } from '../ai/ai-panel'
import { StashBrowser } from '../stash/stash-browser'
import { ArcAiChat } from '../arc-ai/arc-ai-chat'
import { PlanningSection } from '../stash/planning-section'
import { UnavailablePanel } from '../stash/unavailable-panel'
import { PrivacyStorage } from '../storage/privacy-storage'
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

/**
 * M4 stash screen. Loads the deterministic mock provider through the
 * last-valid snapshot cache plus bundled game knowledge, then renders
 * validated data only. Every failure branch is explicit.
 */
export default async function Home() {
  const provider = createMockPlayerProvider(MOCK_PROVIDER_ID, MOCK_PLAYER_PAYLOAD)
  const cache = createPlayerStateSnapshotCache(provider)
  const snapshotResult = await cache.refresh()
  if (snapshotResult.success === false) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
          <UnavailablePanel title="Stash unavailable" detail="A validated player snapshot could not be obtained. Open the saved local workspace for previously validated data." />
          <PrivacyStorage />
        </div>
      </main>
    )
  }

  const knowledgeResult = await loadGameKnowledge(
    createBundledGameDataSource(MOCK_GAME_DATA_SOURCE_ID, MOCK_GAME_DATA_PAYLOAD)
  )
  if (knowledgeResult.success === false) {
    return (
      <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
          <UnavailablePanel title="Game data unavailable" detail="Validated game knowledge could not be loaded. No recommendations have been inferred." />
          <PrivacyStorage />
        </div>
      </main>
    )
  }

  const snapshot = snapshotResult.value
  const knowledge = knowledgeResult.value
  const rows = buildStashRows(snapshot.state, knowledge)
  const planning = buildPlanningSnapshot(snapshot.state, knowledge)
  const aiContext = buildVerifiedAiContext({
    playerState: snapshot.state,
    gameKnowledge: knowledge,
    analysis: analyzeStash(snapshot.state, knowledge),
    planning,
    providerId: snapshot.providerId,
    stale: snapshot.stale,
  })

  return (
    <main id="main-content" tabIndex={-1} className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
        <p className="mb-4 text-sm text-gray-700">Synthetic demo snapshot · no live account integration. Capture timestamps are preserved.</p>
        <StashBrowser
          rows={rows}
          categories={listCategories(rows)}
          summary={summarizeStash(snapshot.state)}
          status={describeSnapshot(snapshot)}
        />
        <PlanningSection planning={planning} />
        <section aria-labelledby="arc-ai-heading" className="mt-8">
          <h2 id="arc-ai-heading" className="mb-1 text-xl font-bold text-gray-900">
            ARC AI
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Local assistant over verified facts. No production model is configured in this build.
          </p>
          <ArcAiChat initialContext={aiContext} />
        </section>
        <section aria-labelledby="ai-heading" className="mt-8">
          <h2 id="ai-heading" className="mb-1 text-xl font-bold text-gray-900">
            Local AI
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Optional on-device engine. No model is configured in this build.
          </p>
          <AiEnginePanel />
        </section>
        <PrivacyStorage initialSnapshot={snapshot} />
      </div>
    </main>
  )
}
