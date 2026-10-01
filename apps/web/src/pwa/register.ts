export type WorkerStatus = 'unsupported' | 'disabled' | 'ready' | 'pending' | 'error'

export async function registerWorker(
  production: boolean,
  container: ServiceWorkerContainer | undefined,
  onStatus: (status: WorkerStatus) => void
): Promise<() => void> {
  if (!production) { onStatus('disabled'); return () => undefined }
  if (container === undefined) { onStatus('unsupported'); return () => undefined }
  try {
    const registration = await container.register('/sw.js', { scope: '/', updateViaCache: 'none' })
    const refresh = () => onStatus(registration.waiting === null ? 'ready' : 'pending')
    let installing: ServiceWorker | null = null
    const installed = () => {
      if (installing?.state === 'installed') refresh()
      if (installing?.state === 'redundant') onStatus('error')
    }
    const update = () => {
      installing?.removeEventListener('statechange', installed)
      installing = registration.installing
      installing?.addEventListener('statechange', installed)
    }
    refresh()
    registration.addEventListener('updatefound', update)
    update()
    return () => {
      registration.removeEventListener('updatefound', update)
      installing?.removeEventListener('statechange', installed)
    }
  } catch { onStatus('error'); return () => undefined }
}
