'use client'

import { useEffect, useState } from 'react'
import { registerWorker, type WorkerStatus } from './register'

export function PwaStatus() {
  const [online, setOnline] = useState<boolean | undefined>()
  const [worker, setWorker] = useState<WorkerStatus>()
  useEffect(() => {
    let live = true
    let cleanup = () => undefined as void
    const connectivity = () => setOnline(navigator.onLine)
    connectivity()
    window.addEventListener('online', connectivity)
    window.addEventListener('offline', connectivity)
    void registerWorker(process.env.NODE_ENV === 'production', navigator.serviceWorker,
      (status) => { if (live) setWorker(status) }).then((dispose) => {
        if (live) cleanup = dispose
        else dispose()
      })
    return () => {
      live = false
      cleanup()
      window.removeEventListener('online', connectivity)
      window.removeEventListener('offline', connectivity)
    }
  }, [])
  return (
    <div className="border-t border-vault-line bg-vault-void px-4 py-1.5 text-[11px] text-vault-muted">
      <p role="status" className="mx-auto max-w-6xl">
        Browser network: {online === undefined ? 'Unknown' : online ? 'Online' : 'Offline'}.
        {' '}This does not verify provider or Bridge availability. Connectivity alone
        never marks snapshots fresh.
        {worker === 'pending' && ' Finish your work, then close all RaidVault tabs and reopen to update.'}
        {worker === 'error' && ' Offline shell registration failed — the app remains usable.'}
        {worker === 'unsupported' && ' Offline shell unsupported in this browser.'}
      </p>
    </div>
  )
}
