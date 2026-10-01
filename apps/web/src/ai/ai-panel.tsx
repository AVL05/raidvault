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
import { SectionLabel } from '../ui/vault'

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
      className="rounded-sm border border-vault-line bg-vault-raised px-3 py-2 text-sm font-semibold text-vault-text disabled:cursor-not-allowed disabled:opacity-50"
    >
      {label}
    </button>
    {disabled && reason !== undefined && <span className="max-w-44 text-[11px] text-vault-muted">{reason}</span>}
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
    <div className="rounded-sm border border-vault-line bg-vault-surface p-4">
      <SectionLabel>Engine status</SectionLabel>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">WebGPU</dt>
          <dd role="status" className="text-right text-vault-text">
            {capabilities === undefined
              ? 'Checking WebGPU support…'
              : capabilities.supported
                ? 'Supported'
                : `Unsupported — ${capabilities.reason ?? 'unknown reason'}`}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Model state</dt>
          <dd className="text-right font-mono text-vault-text">{snapshot.state}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Model</dt>
          <dd className="text-right text-vault-text">
            {snapshot.modelId ?? 'No model is configured'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Installed</dt>
          <dd className="text-right text-vault-text">
            {snapshot.installed ? 'Installed' : 'Not installed'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Gaming Mode</dt>
          <dd className="text-right font-bold text-vault-amber">{gamingMode}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Model size</dt>
          <dd className="text-right font-mono text-vault-text">
            {storage.installed ? formatBytes(storage.modelBytes) : 'Not installed'}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Storage usage</dt>
          <dd className="text-right font-mono text-vault-text">{formatBytes(storage.usageBytes)}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-vault-muted">Storage quota</dt>
          <dd className="text-right font-mono text-vault-text">{formatBytes(storage.quotaBytes)}</dd>
        </div>
      </dl>
      {snapshot.error !== undefined && (
        <p role="alert" className="mt-3 rounded-sm border border-vault-danger/60 bg-vault-void p-2 text-sm text-vault-danger">
          {snapshot.error}
        </p>
      )}
      {gamingMode !== 'INACTIVE' && (
        <p className="mt-3 text-sm font-semibold text-vault-amber">{GAMING_MODE_BLOCKED_MESSAGE}</p>
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
