'use client'

import { useState, type Dispatch, type SetStateAction } from 'react'
import {
  createArcAiController,
  createStaticGamingModeSource,
  type ArcAiController,
  type ArcAiSnapshot,
  type VerifiedAiContext,
} from '@raidvault/ai-engine'

export interface ArcAiChatViewProps {
  readonly snapshot: ArcAiSnapshot
  readonly draft: string
  readonly onDraftChange: Dispatch<SetStateAction<string>>
  onSubmit(): void
  onCancel(): void
}

/**
 * Presentational ARC AI chat. Renders controller snapshots verbatim:
 * message history, generating state, errors, and blocked or unavailable
 * states. Contains no gameplay controls and performs no game actions.
 */
export function ArcAiChatView({
  snapshot,
  draft,
  onDraftChange,
  onSubmit,
  onCancel,
}: ArcAiChatViewProps) {
  const generating = snapshot.status === 'GENERATING'
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <p className="mb-3 text-sm text-gray-600">
        Answers are based on your validated RaidVault snapshot.
      </p>
      {snapshot.messages.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">
          Ask about stash quantities, missing items, classifications, priorities, or target
          completion.
        </p>
      ) : (
        <ul aria-live="polite" className="mb-3 max-h-96 space-y-2 overflow-y-auto">
          {snapshot.messages.map((message) => (
            <li key={message.id} className="rounded bg-gray-50 p-2 text-sm">
              <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                {message.role === 'USER' ? 'You' : 'ARC AI'}
              </span>
              <span className="text-gray-900">{message.content}</span>
            </li>
          ))}
        </ul>
      )}
      {snapshot.status === 'BLOCKED' && (
        <p role="status" className="mb-3 text-sm font-medium text-gray-900">
          Local AI blocked while Gaming Mode is ACTIVE or UNKNOWN.
        </p>
      )}
      {snapshot.status === 'UNAVAILABLE' && (
        <p role="status" className="mb-3 text-sm font-medium text-gray-900">
          No production model is configured. Deterministic facts remain available through stash
          and planning views.
        </p>
      )}
      {snapshot.error !== undefined && (
        <p role="alert" className="mb-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {snapshot.error}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          onSubmit()
        }}
        aria-busy={generating}
        className="flex flex-wrap gap-2"
      >
        <label htmlFor="arc-ai-input" className="sr-only">
          Ask ARC AI
        </label>
        <input
          id="arc-ai-input"
          type="text"
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Ask about your stash…"
          className="min-w-0 flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={generating}
          className="shrink-0 rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
        {generating && (
          <button
            type="button"
            onClick={onCancel}
            className="shrink-0 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700"
          >
            Cancel
          </button>
        )}
      </form>
      <p role="status" className="mt-2 text-sm text-gray-600">{generating ? 'Generating…' : ''}</p>
    </div>
  )
}

/**
 * Production chat wiring for M9: static fail-safe UNKNOWN gaming status
 * (no secure Bridge transport exists yet) and no generation session (no
 * approved production model). Submit paths therefore resolve to blocked
 * or deterministic states only; no fake answers are ever rendered.
 */
export function ArcAiChat({ initialContext }: { readonly initialContext: VerifiedAiContext }) {
  const [controller] = useState<ArcAiController>(() =>
    createArcAiController({
      context: initialContext,
      gamingModeSource: createStaticGamingModeSource('UNKNOWN'),
      sessionFactory: undefined,
    })
  )
  const [snapshot, setSnapshot] = useState<ArcAiSnapshot>(() => controller.snapshot())
  const [draft, setDraft] = useState('')

  const submit = () => {
    if (draft.trim() === '' || controller.snapshot().status === 'GENERATING') return
    const question = draft
    setDraft('')
    const pending = controller.submit(question)
    setSnapshot(controller.snapshot())
    void pending.then((next) => setSnapshot(next))
  }
  const cancel = () => {
    void controller.cancel().then((next) => setSnapshot(next))
  }

  return (
    <ArcAiChatView
      snapshot={snapshot}
      draft={draft}
      onDraftChange={setDraft}
      onSubmit={submit}
      onCancel={cancel}
    />
  )
}
