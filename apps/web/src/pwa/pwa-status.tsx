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
    <aside aria-label="Connection and application update" className="border-b border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
      <p role="status">Browser network: {online === undefined ? 'Unknown' : online ? 'Online' : 'Offline'}.
        {' '}This does not verify provider or Bridge availability.</p>
      {worker === 'pending' && <p role="status">An update is pending. Finish your work, then close all RaidVault tabs and reopen to update.</p>}
      {worker === 'error' && <p role="status">Offline shell registration failed. The current application remains usable.</p>}
      {worker === 'unsupported' && <p>Offline shell is unsupported in this browser.</p>}
      <a href="/offline" className="mt-1 inline-block underline">Open saved local workspace</a>
    </aside>
  )
}
