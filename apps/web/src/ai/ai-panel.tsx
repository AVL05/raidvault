'use client'

import { useEffect, useState } from 'react'
import {
  GAMING_MODE_BLOCKED_MESSAGE,
  describeAiControls,
  detectAiCapabilities,
  type AiCapabilities,
  type AiControls,
  type GamingModeStatus,
  type ModelManagerSnapshot,
  type StorageReport,
} from '@raidvault/ai-engine'
import { readBrowserCapabilityEnvironment } from './capability-env'

export interface AiStatusViewProps {
  readonly capabilities: AiCapabilities | undefined
  readonly gamingMode: GamingModeStatus
  readonly snapshot: ModelManagerSnapshot
  readonly storage: StorageReport
  readonly controls: AiControls
  readonly onRefresh: () => void
}

function formatBytes(value: number | undefined): string {
  if (value === undefined) {
    return 'Unknown'
  }
  return `${value} bytes`
}

function ControlButton({
  label,
  disabled,
  reason,
  onClick,
}: {
  readonly label: string
  readonly disabled: boolean
  readonly reason: string | undefined
  readonly onClick?: () => void
}) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
    <button
      type="button"
      disabled={disabled}
      title={reason ?? undefined}
      onClick={onClick}
      className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
    {disabled && reason !== undefined && <span className="text-xs text-gray-700">{reason}</span>}
    </span>
  )
}

/**
 * Presentational AI engine status. All values arrive as props; this
 * component performs no detection, downloads, or lifecycle transitions
 * beyond invoking the provided refresh callback.
 */
export function AiStatusView({
  capabilities,
  gamingMode,
  snapshot,
  storage,
  controls,
  onRefresh,
}: AiStatusViewProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <dl className="space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">WebGPU</dt>
          <dd role="status" className="text-right text-gray-900">
            {capabilities === undefined
              ? 'Checking WebGPU support…'
              : capabilities.supported
                ? 'Supported'
                : `Unsupported — ${capabilities.reason ?? 'unknown reason'}`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Model state</dt>
          <dd className="text-right text-gray-900">{snapshot.state}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Model</dt>
          <dd className="text-right text-gray-900">
            {snapshot.modelId ?? 'No model is configured'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Installed</dt>
          <dd className="text-right text-gray-900">
            {snapshot.installed ? 'Installed' : 'Not installed'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Gaming Mode</dt>
          <dd className="text-right font-semibold text-gray-900">{gamingMode}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Model size</dt>
          <dd className="text-right text-gray-900">
            {storage.installed ? formatBytes(storage.modelBytes) : 'Not installed'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Storage usage</dt>
          <dd className="text-right text-gray-900">{formatBytes(storage.usageBytes)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="font-medium text-gray-500">Storage quota</dt>
          <dd className="text-right text-gray-900">{formatBytes(storage.quotaBytes)}</dd>
        </div>
      </dl>
      {snapshot.error !== undefined && (
        <p role="alert" className="mt-3 rounded bg-red-50 p-2 text-sm text-red-800">
          {snapshot.error}
        </p>
      )}
      {gamingMode !== 'INACTIVE' && (
        <p className="mt-3 text-sm font-medium text-gray-900">{GAMING_MODE_BLOCKED_MESSAGE}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <ControlButton
          label="Install"
          disabled={controls.install.disabled}
          reason={controls.install.reason}
        />
        <ControlButton
          label="Load"
          disabled={controls.load.disabled}
          reason={controls.load.reason}
        />
        <ControlButton
          label="Unload"
          disabled={controls.unload.disabled}
          reason={controls.unload.reason}
        />
        <ControlButton
          label="Remove"
          disabled={controls.remove.disabled}
          reason={controls.remove.reason}
        />
        <ControlButton
          label="Refresh"
          disabled={controls.refresh.disabled}
          reason={controls.refresh.reason}
          onClick={onRefresh}
        />
      </div>
    </div>
  )
}

const DETECTING_CAPABILITIES: AiCapabilities = {
  webgpuAvailable: false,
  adapterAvailable: false,
  deviceAvailable: false,
  supported: false,
  reason: 'Checking WebGPU support…',
}

/**
 * Production panel wiring for M8: real capability detection plus static
 * fail-safe status. No model is configured, so lifecycle actions stay
 * disabled; Gaming Mode stays UNKNOWN until a secure Bridge integration
 * path exists. Refresh re-probes capabilities only.
 */
export function AiEnginePanel() {
  const [capabilities, setCapabilities] = useState<AiCapabilities | undefined>(undefined)

  const probeCapabilities = () => {
    setCapabilities(undefined)
    detectAiCapabilities(readBrowserCapabilityEnvironment()).then((result) => {
      setCapabilities(result)
    })
  }

  useEffect(() => {
    let live = true
    detectAiCapabilities(readBrowserCapabilityEnvironment()).then((result) => {
      if (live) {
        setCapabilities(result)
      }
    })
    return () => {
      live = false
    }
  }, [])

  const snapshot: ModelManagerSnapshot = {
    state: 'NOT_INSTALLED',
    modelId: undefined,
    installed: false,
    progress: undefined,
    error: undefined,
    gamingMode: 'UNKNOWN',
  }
  const storage: StorageReport = { installed: false }
  const controls = describeAiControls(snapshot, capabilities ?? DETECTING_CAPABILITIES)

  return (
    <AiStatusView
      capabilities={capabilities}
      gamingMode={snapshot.gamingMode}
      snapshot={snapshot}
      storage={storage}
      controls={controls}
      onRefresh={probeCapabilities}
    />
  )
}
