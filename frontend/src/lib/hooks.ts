import { useCallback, useEffect, useState } from 'react'
import { get } from './api'

/** Charge une ressource API ; `reload` relance la requête. */
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(!!path)
  const load = useCallback(async () => {
    if (!path) return
    setLoading(true)
    try {
      setData(await get<T>(path))
      setError(null)
    } catch (e) {
      setError(e as Error)
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])
  useEffect(() => {
    load()
  }, [load])
  return { data, error, loading, reload: load, setData }
}

export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} — Adjougbe` : 'Adjougbe'
  }, [title])
}

// Paramètres publics du site : une seule requête partagée par toute l'application.
let settingsPromise: Promise<any> | null = null
export function useSettings<T = any>() {
  const [data, setData] = useState<T | null>(null)
  useEffect(() => {
    if (!settingsPromise) settingsPromise = get('/api/settings/').catch((e) => { settingsPromise = null; throw e })
    settingsPromise.then(setData).catch(() => {})
  }, [])
  return { data }
}
