// Client HTTP : cookies de session + jeton CSRF de Django.
export class ApiError extends Error {
  status: number
  data: Record<string, unknown>
  constructor(status: number, data: Record<string, unknown>) {
    super(firstMessage(data) || `Erreur ${status}`)
    this.status = status
    this.data = data
  }
  field(name: string): string | undefined {
    const v = (this.data[name] ?? (this.data.fields as Record<string, unknown> | undefined)?.[name]) as unknown
    return Array.isArray(v) ? String(v[0]) : typeof v === 'string' ? v : undefined
  }
}

function firstMessage(data: Record<string, unknown>): string {
  if (!data) return ''
  if (typeof data.detail === 'string') return data.detail
  for (const v of Object.values(data)) {
    if (typeof v === 'string') return v
    if (Array.isArray(v) && v.length) return String(v[0])
    if (v && typeof v === 'object') {
      const inner = firstMessage(v as Record<string, unknown>)
      if (inner) return inner
    }
  }
  return ''
}

function csrfToken(): string {
  return document.cookie.split('; ').find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? ''
}

let csrfReady: Promise<unknown> | null = null
export function ensureCsrf() {
  if (!csrfReady) csrfReady = fetch('/api/auth/csrf/', { credentials: 'include' })
  return csrfReady
}

type Body = Record<string, unknown> | unknown[] | FormData | undefined

export async function api<T = any>(path: string, opts: { method?: string; body?: Body; raw?: boolean } = {}): Promise<T> {
  const method = opts.method ?? (opts.body ? 'POST' : 'GET')
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (method !== 'GET') {
    await ensureCsrf()
    headers['X-CSRFToken'] = csrfToken()
  }
  let body: BodyInit | undefined
  if (opts.body instanceof FormData) body = opts.body
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.body)
  }
  const res = await fetch(path.startsWith('/') ? path : `/api/${path}`, { method, headers, body, credentials: 'include' })
  if (opts.raw) {
    if (!res.ok) throw new ApiError(res.status, {})
    return res as unknown as T
  }
  if (res.status === 204) return undefined as T
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new ApiError(res.status, data)
  return data as T
}

export const get = <T = any>(p: string) => api<T>(p)
export const post = <T = any>(p: string, body: Body = {}) => api<T>(p, { method: 'POST', body })
export const patch = <T = any>(p: string, body: Body) => api<T>(p, { method: 'PATCH', body })
export const put = <T = any>(p: string, body: Body) => api<T>(p, { method: 'PUT', body })
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' })

/** Télécharge un export (CSV, Excel, PDF) en conservant la session. */
export async function download(path: string, filename: string) {
  const res = await api<Response>(path, { raw: true })
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
