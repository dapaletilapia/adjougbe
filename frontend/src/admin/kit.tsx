import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ErrorNote, Spinner } from '../components/ui'
import { TopBar } from './AdminLayout'
import { ApiError } from '../lib/api'
import { useApi } from '../lib/hooks'

export function AdminPage({ title, actions, children, intro, crumb, search = false }: {
  title: ReactNode; actions?: ReactNode; children: ReactNode; intro?: ReactNode; crumb?: ReactNode; search?: boolean
}) {
  useEffect(() => { document.title = `${typeof title === 'string' ? title : 'Studio'} — Studio Adjougbe` }, [title])
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-end gap-4">
        <div className="min-w-0 flex-1">
          {crumb && <div className="text-[14px] text-muted">{crumb}</div>}
          <h1 className="mt-0.5 text-[24px] md:text-[28px]">{title}</h1>
          {intro && <div className="mt-1 text-sm text-muted">{intro}</div>}
        </div>
        {(actions || search) && <div className="flex flex-wrap items-center gap-2">{search && <TopBar />}{actions}</div>}
      </header>
      {children}
    </div>
  )
}

export function Stat({ label, value, sub, tone, subTone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'navy' | 'orange'; subTone?: 'ok' }) {
  const cls = tone === 'navy' ? 'card-navy' : tone === 'orange' ? 'card-orange' : 'card'
  return (
    <div className={`${cls} relative p-5 md:p-[22px]`}>
      {tone === 'navy' && <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -right-8 -bottom-8 h-[150px] w-[150px] opacity-10" />}
      <div className={`text-xs font-semibold tracking-[.08em] uppercase ${tone ? 'opacity-85' : 'text-faint'}`}>{label}</div>
      <div className={`mt-2 font-bold tabular-nums ${tone === 'navy' ? 'text-[28px] md:text-[34px]' : 'text-[26px] md:text-[30px]'}`}>{value}</div>
      {sub && <div className={`text-[14px] ${tone ? 'opacity-90' : subTone === 'ok' ? 'text-ok' : 'text-muted'}`}>{sub}</div>}
    </div>
  )
}

export function Tabs({ tabs, value, onChange }: { tabs: { value: string; label: ReactNode }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="seg max-w-full overflow-x-auto" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} onClick={() => onChange(t.value)} className="whitespace-nowrap">
          {t.label}
        </button>
      ))}
    </div>
  )
}

/** Filtres en pastilles (maquettes Journal, Commandes). */
export function Pills({ options, value, onChange }: { options: [string, ReactNode][]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2 text-[14px]">
      {options.map(([v, l]) => (
        <button key={v} onClick={() => onChange(v)} aria-pressed={value === v}
          className={`rounded-full px-3.5 py-2 ${value === v ? 'bg-ink font-semibold text-white' : 'bg-[var(--card)]'}`}>{l}</button>
      ))}
    </div>
  )
}

export function Panel({ title, action, children, className = '' }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card p-5 md:p-[22px] ${className}`}>
      {(title || action) && <div className="mb-3 flex items-center justify-between gap-3"><h2 className="text-[15px] font-semibold">{title}</h2>{action}</div>}
      {children}
    </section>
  )
}

export function Drawer({ open, onClose, title, children, wide = false }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-ink/40" onClick={onClose} aria-label="Fermer" />
      <div className={`relative flex h-full w-full flex-col bg-[var(--bg)] shadow-2xl ${wide ? 'max-w-3xl' : 'max-w-xl'}`}>
        <div className="flex items-center gap-3 border-b border-line px-6 py-4">
          <h2 className="flex-1 text-lg">{title}</h2>
          <button onClick={onClose} className="rounded-full px-3 py-1 text-xl hover:bg-mist" aria-label="Fermer">×</button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  )
}

export function Confirm({ text, onConfirm, children, danger = false }: { text: string; onConfirm: () => void; children: ReactNode; danger?: boolean }) {
  const [ask, setAsk] = useState(false)
  if (!ask) return <span onClick={() => setAsk(true)}>{children}</span>
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-mist px-3 py-1 text-sm">
      {text}
      <button className={`font-semibold ${danger ? 'text-danger' : 'text-blue'}`} onClick={() => { setAsk(false); onConfirm() }}>Oui</button>
      <button className="text-muted" onClick={() => setAsk(false)}>Non</button>
    </span>
  )
}

/** Liste paginée avec recherche et filtres synchronisés dans l'URL. */
export function useList(base: string, extra: Record<string, string> = {}) {
  const [params, setParams] = useSearchParams()
  const q = new URLSearchParams(params)
  Object.entries(extra).forEach(([k, v]) => v && q.set(k, v))
  const search = q.get('q') ?? ''
  if (search) q.set('search', search)
  q.delete('q')
  const url = `${base}${base.includes('?') ? '&' : '?'}${q.toString()}`
  const res = useApi(url)
  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(params)
    if (v) p.set(k, v); else p.delete(k)
    if (k !== 'page') p.delete('page')
    setParams(p, { replace: true })
  }
  return { ...res, params, setParam, search }
}

export function ListToolbar({ list, placeholder = 'Rechercher…', children }: { list: ReturnType<typeof useList>; placeholder?: string; children?: ReactNode }) {
  const [v, setV] = useState(list.search)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <form onSubmit={(e) => { e.preventDefault(); list.setParam('q', v) }} className="min-w-[220px] flex-1">
        <label className="sr-only" htmlFor="list-q">Rechercher</label>
        <input id="list-q" className="input" placeholder={placeholder} value={v} onChange={(e) => setV(e.target.value)} />
      </form>
      {children}
    </div>
  )
}

export function FilterSelect({ list, name, options, label }: { list: ReturnType<typeof useList>; name: string; options: [string, string][]; label: string }) {
  return (
    <select className="input !w-auto" aria-label={label} value={list.params.get(name) ?? ''} onChange={(e) => list.setParam(name, e.target.value)}>
      <option value="">{label}</option>
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

export function Pager({ list }: { list: ReturnType<typeof useList> }) {
  const d = list.data
  if (!d || (!d.next && !d.previous)) return null
  const page = Number(list.params.get('page') || 1)
  return (
    <div className="flex items-center gap-3 text-sm">
      <button className="btn btn-ghost btn-sm" disabled={!d.previous} onClick={() => list.setParam('page', String(page - 1))}>Précédent</button>
      <span className="text-muted">Page {page} · {d.count} résultat(s)</span>
      <button className="btn btn-ghost btn-sm" disabled={!d.next} onClick={() => list.setParam('page', String(page + 1))}>Suivant</button>
    </div>
  )
}

export function TableWrap({ loading, error, empty, children }: { loading: boolean; error?: unknown; empty?: boolean; children: ReactNode }) {
  if (loading) return <Spinner />
  if (error) return <ErrorNote error={error} />
  if (empty) return <p className="card p-8 text-muted">Aucun élément pour le moment.</p>
  return <div className="card overflow-x-auto px-2 py-1 md:px-3">{children}</div>
}

/** État de formulaire d'édition avec erreurs par champ venant de DRF.
 * L'état initial n'est lu qu'une fois : remonter le composant (prop `key`) pour le réinitialiser. */
export function useEditor<T extends Record<string, any>>(initial: T) {
  const [v, setV] = useState<T>(initial)
  const [err, setErr] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof T, val: unknown) => setV((s) => ({ ...s, [k]: val }))
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true); setErr(null)
    try { return await fn() } catch (e) { setErr(e as ApiError); throw e } finally { setBusy(false) }
  }
  const fe = (k: string) => err?.field?.(k)
  return { v, set, setV, err, fe, busy, run }
}

/** Convertit un objet en FormData (envoi de fichiers). */
export function toFormData(obj: Record<string, any>) {
  const fd = new FormData()
  Object.entries(obj).forEach(([k, val]) => {
    if (val === undefined) return
    if (val instanceof File) fd.append(k, val)
    else if (val === null) fd.append(k, '')
    else if (Array.isArray(val)) val.forEach((x) => fd.append(k, String(x)))
    else if (typeof val === 'object') fd.append(k, JSON.stringify(val))
    else fd.append(k, String(val))
  })
  return fd
}

export function StatusChip({ status, label }: { status: string; label: string }) {
  const tone: Record<string, string> = {
    paid: 'chip-ok', approved: 'chip-ok', confirmed: 'chip-ok', published: 'chip-ok', open: 'chip-ok',
    pending: 'chip-warn', pending_payment: 'chip-warn', draft: '', preorder: 'chip-blue', waitlist: 'chip-blue', upcoming: 'chip-blue',
    failed: 'chip-danger', rejected: 'chip-danger', cancelled: 'chip-danger', refunded: 'chip-blue', full: 'chip-warn', done: '',
    archived: '',
  }
  return <span className={`chip ${tone[status] ?? ''}`}>{label}</span>
}

/** Courbe en aire (maquette 15a) avec le point le plus haut mis en avant. */
export function AreaChart({ data, format, peakLabel }: { data: { label: string; value: number }[]; format: (n: number) => string; peakLabel?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  const n = Math.max(1, data.length - 1)
  const pts = data.map((d, i) => [(i / n) * 600, 185 - (d.value / max) * 160] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0)
  return (
    <figure>
      <svg viewBox="0 0 600 200" preserveAspectRatio="none" className="mt-3.5 h-[210px] w-full" role="img" aria-label={`Ventes, maximum ${format(data[peak]?.value ?? 0)}`}>
        <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#1560DC" stopOpacity=".35" /><stop offset="1" stopColor="#1560DC" stopOpacity="0" /></linearGradient></defs>
        <path d={`${line} L600 200 L0 200 Z`} fill="url(#ga)" />
        <path d={line} fill="none" stroke="#1560DC" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        {data[peak]?.value > 0 && <circle cx={pts[peak][0]} cy={pts[peak][1]} r="6" fill="#FF6B29" stroke="#fff" strokeWidth="3" />}
        {data.map((d, i) => <rect key={i} x={pts[i][0] - 300 / n} y="0" width={600 / n} height="200" fill="transparent"><title>{`${d.label} : ${format(d.value)}`}</title></rect>)}
      </svg>
      <figcaption className="flex justify-between text-[12px] text-faint">
        <span>{data[0]?.label}</span>
        {data[peak]?.value > 0 && <span className="font-semibold text-orange">Pic : {data[peak].label} · {format(data[peak].value)}{peakLabel ? ` · ${peakLabel}` : ''}</span>}
        <span>{data[data.length - 1]?.label}</span>
      </figcaption>
    </figure>
  )
}
