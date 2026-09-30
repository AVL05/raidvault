import { createBundledGameDataSource, loadGameKnowledge } from '@raidvault/game-data'
import {
  createMockPlayerProvider,
  createPlayerStateSnapshotCache,
} from '@raidvault/providers'
import { buildPlanningSnapshot } from '@raidvault/rules-engine'
import { AiEnginePanel } from '../ai/ai-panel'
import { StashBrowser } from '../stash/stash-browser'
import { PlanningSection } from '../stash/planning-section'
import { UnavailablePanel } from '../stash/unavailable-panel'
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
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
          <UnavailablePanel title="Stash unavailable" detail={snapshotResult.error.message} />
        </div>
      </main>
    )
  }

  const knowledgeResult = await loadGameKnowledge(
    createBundledGameDataSource(MOCK_GAME_DATA_SOURCE_ID, MOCK_GAME_DATA_PAYLOAD)
  )
  if (knowledgeResult.success === false) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
          <UnavailablePanel title="Game data unavailable" detail={knowledgeResult.error.message} />
        </div>
      </main>
    )
  }

  const snapshot = snapshotResult.value
  const knowledge = knowledgeResult.value
  const rows = buildStashRows(snapshot.state, knowledge)
  const planning = buildPlanningSnapshot(snapshot.state, knowledge)

  return (
    <main className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-6 text-3xl font-bold text-gray-900">RaidVault Stash</h1>
        <StashBrowser
          rows={rows}
          categories={listCategories(rows)}
          summary={summarizeStash(snapshot.state)}
          status={describeSnapshot(snapshot)}
        />
        <PlanningSection planning={planning} />
        <section aria-labelledby="ai-heading" className="mt-8">
          <h2 id="ai-heading" className="mb-1 text-xl font-bold text-gray-900">
            Local AI
          </h2>
          <p className="mb-4 text-sm text-gray-600">
            Optional on-device engine. No model is configured in this build.
          </p>
          <AiEnginePanel />
        </section>
      </div>
    </main>
  )
}
