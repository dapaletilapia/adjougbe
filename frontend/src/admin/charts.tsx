// Graphes du tableau de bord : SVG fait main, interactifs (survol, clavier), lisibles sans couleur.
// Règles : traits fins, une seule échelle par graphe, grille discrète, valeurs aussi disponibles en tableau.
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { compact, nf } from '../lib/format'


function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [w, setW] = useState(600)
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(([e]) => setW(Math.max(260, Math.round(e.contentRect.width))))
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Graduations « rondes » : 0, 250, 500… */
function ticks(max: number, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw
  const out = []
  for (let v = 0; v <= max + step * 0.001; v += step) out.push(v)
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step)
  return out
}

export type Serie = { key: string; name: string; color: string; values: number[]; muted?: boolean }

/** Infobulle : la valeur en premier, le nom ensuite, une petite ligne de la couleur de la série. */
function Tip({ x, width, title, rows }: { x: number; width: number; title: string; rows: { name: string; color: string; value: string }[] }) {
  const left = Math.min(Math.max(x - 90, 0), width - 180)
  return (
    <div className="pointer-events-none absolute top-0 z-10 w-[180px] rounded-xl bg-[var(--card)] p-3 text-[13px] shadow-[0_16px_40px_-12px_rgba(4,28,92,.45)] ring-1 ring-ink/10" style={{ left }} role="status">
      <div className="mb-1.5 text-[12px] text-muted">{title}</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2 py-0.5">
          <span className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
          <b className="tabular-nums">{r.value}</b><span className="truncate text-muted">{r.name}</span>
        </div>
      ))}
    </div>
  )
}

const PAD = { l: 44, r: 14, t: 16, b: 28 }
/** Un libellé d'axe sur `every`, plus le dernier — sans qu'il touche l'avant-dernier affiché. */
const showTick = (i: number, n: number, every: number) => i === n - 1 || (i % every === 0 && n - 1 - i >= every * 0.75)

/** Courbes sur une même échelle (ex. période en cours et précédente), curseur vertical et infobulle. */
export function LineChart({ labels, fullLabels, series, format = compact, height = 300, label }: {
  labels: string[]; fullLabels?: string[]; series: Serie[]; format?: (n: number) => string; height?: number; label: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const gid = useId().replace(/:/g, '')
  const n = labels.length
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const yt = ticks(max)
  const top = yt[yt.length - 1]
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b
  const x = (i: number) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw)
  const y = (v: number) => PAD.t + ih - (v / top) * ih
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ')
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))))
  const main = series.find((s) => !s.muted) ?? series[0]

  const pick = (clientX: number, el: SVGSVGElement) => {
    const r = el.getBoundingClientRect()
    const i = Math.round(((clientX - r.left - PAD.l) / iw) * (n - 1))
    setHover(Math.min(n - 1, Math.max(0, i)))
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? -1) + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)) }
    if (e.key === 'Escape') setHover(null)
  }
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={height} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)}
        onPointerMove={(e) => pick(e.clientX, e.currentTarget)} onPointerLeave={() => setHover(null)}
        className="block touch-pan-y rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue">
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={main.color} stopOpacity=".14" /><stop offset="1" stopColor={main.color} stopOpacity="0" /></linearGradient></defs>
        {yt.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--color-faint)] text-[11px] tabular-nums">{compact(t)}</text>
          </g>
        ))}
        {labels.map((l, i) => showTick(i, n, every) ? (
          <text key={i} x={x(i)} y={height - 8} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-[var(--color-faint)] text-[11px]">{l}</text>
        ) : null)}
        <path d={`${path(main.values)} L${x(n - 1)} ${y(0)} L${x(0)} ${y(0)} Z`} fill={`url(#${gid})`} />
        {series.map((s) => (
          <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={s.muted ? 1.5 : 2} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--color-faint)" strokeWidth="1" />}
        {series.filter((s) => !s.muted).map((s) => {
          const i = hover ?? n - 1
          return <circle key={s.key} cx={x(i)} cy={y(s.values[i] ?? 0)} r="4.5" fill={s.color} stroke="var(--card)" strokeWidth="2" />
        })}
      </svg>
      {hover !== null && (
        <Tip x={x(hover)} width={w} title={fullLabels?.[hover] ?? labels[hover]}
          rows={[...series].sort((a, b) => Number(!!a.muted) - Number(!!b.muted)).map((s) => ({ name: s.name, color: s.color, value: format(s.values[hover] ?? 0) }))} />
      )}
    </div>
  )
}

/** Colonnes (une série) : chaque colonne est sa propre zone de survol ; flèches du clavier pour parcourir. */
export function ColumnChart({ labels, fullLabels, values, name, color = 'var(--chart-1)', format = compact, height = 220, label }: {
  labels: string[]; fullLabels?: string[]; values: number[]; name: string; color?: string; format?: (n: number) => string; height?: number; label: string
}) {
  const [ref, w] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  const yt = ticks(Math.max(1, ...values))
  const top = yt[yt.length - 1]
  const iw = w - PAD.l - PAD.r, ih = height - PAD.t - PAD.b
  const band = iw / Math.max(1, n)
  const bw = Math.max(2, Math.min(24, band - 2))
  const y = (v: number) => PAD.t + ih - (v / top) * ih
  const every = Math.max(1, Math.ceil(n / Math.max(2, Math.floor(iw / 64))))
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setHover((h) => Math.min(n - 1, (h ?? -1) + 1)) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setHover((h) => Math.max(0, (h ?? n) - 1)) }
  }
  return (
    <div ref={ref} className="relative">
      <svg width={w} height={height} role="img" aria-label={label} tabIndex={0} onKeyDown={onKey} onBlur={() => setHover(null)} onPointerLeave={() => setHover(null)}
        className="block touch-pan-y rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue">
        {yt.map((t) => (
          <g key={t}>
            <line x1={PAD.l} x2={w - PAD.r} y1={y(t)} y2={y(t)} stroke="var(--chart-grid)" />
            <text x={PAD.l - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-[var(--color-faint)] text-[11px] tabular-nums">{compact(t)}</text>
          </g>
        ))}
        {values.map((v, i) => {
          const cx = PAD.l + band * i + band / 2
          const h = Math.max(0, y(0) - y(v))
          const r = Math.min(4, bw / 2, h)
          const x0 = cx - bw / 2, y0 = y(v)
          return (
            <g key={i} onPointerEnter={() => setHover(i)}>
              <rect x={PAD.l + band * i} y={PAD.t} width={band} height={ih} fill="transparent" />
              {h > 0 && (
                <path d={`M${x0} ${y(0)} V${y0 + r} Q${x0} ${y0} ${x0 + r} ${y0} H${x0 + bw - r} Q${x0 + bw} ${y0} ${x0 + bw} ${y0 + r} V${y(0)} Z`}
                  fill={color} opacity={hover === null || hover === i ? 1 : 0.45} />
              )}
              {showTick(i, n, every) && <text x={cx} y={height - 8} textAnchor="middle" className="fill-[var(--color-faint)] text-[11px]">{labels[i]}</text>}
            </g>
          )
        })}
      </svg>
      {hover !== null && <Tip x={PAD.l + band * hover + band / 2} width={w} title={fullLabels?.[hover] ?? labels[hover]} rows={[{ name, color, value: format(values[hover]) }]} />}
    </div>
  )
}

/** Classement en barres horizontales : libellé, valeur écrite, barre proportionnelle (une seule teinte). */
export function BarList({ rows, format = compact, color = 'var(--chart-1)', empty = 'Pas encore de données sur la période.' }: {
  rows: { label: ReactNode; value: number; hint?: ReactNode; key: string }[]; format?: (n: number) => string; color?: string; empty?: string
}) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  if (!rows.length || rows.every((r) => !r.value)) return <p className="py-6 text-sm text-muted">{empty}</p>
  return (
    <ul className="grid gap-3">
      {rows.map((r) => (
        <li key={r.key} className="grid gap-1.5">
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate">{r.label}{r.hint && <span className="ml-2 text-[12.5px] text-muted">{r.hint}</span>}</span>
            <b className="shrink-0 tabular-nums">{format(r.value)}</b>
          </div>
          <div className="h-2 rounded-full bg-[var(--chart-grid)]">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color, minWidth: r.value ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Un tout découpé en parts (barre fine) + légende avec part et valeur. */
export function SegmentBar({ parts, label }: { parts: { key: string; label: string; value: number; color: string }[]; label: string }) {
  const total = parts.reduce((a, p) => a + p.value, 0)
  if (!total) return <p className="py-4 text-sm text-muted">Pas encore de données sur la période.</p>
  const pct = (v: number) => Math.round((v / total) * 100)
  return (
    <div>
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" role="img" aria-label={`${label} : ${parts.map((p) => `${p.label} ${pct(p.value)} %`).join(', ')}`}>
        {parts.filter((p) => p.value).map((p) => <span key={p.key} className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(p.value / total) * 100}%`, background: p.color }} title={`${p.label} : ${pct(p.value)} %`} />)}
      </div>
      <ul className="mt-4 grid gap-2.5 text-[14px]">
        {parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: p.color }} />{p.label}
            <span className="ml-auto text-muted tabular-nums">{nf.format(p.value)}</span><b className="w-11 text-right tabular-nums">{pct(p.value)} %</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Petite tendance pour les tuiles (la période en cours, sans axe). */
export function Sparkline({ values, color = 'var(--chart-1)' }: { values: number[]; color?: string }) {
  const max = Math.max(1, ...values)
  const n = values.length
  if (n < 2) return null
  const pts = values.map((v, i) => `${((i / (n - 1)) * 100).toFixed(2)},${(28 - (v / max) * 24).toFixed(2)}`).join(' ')
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-full" aria-hidden="true">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

/** Vue tableau d'un graphe (les valeurs restent lisibles sans survol). */
export function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-[13.5px]">
      <summary className="cursor-pointer font-semibold text-blue">Voir les données</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-lg ring-1 ring-line">
        <table className="table">
          <caption className="sr-only">{caption}</caption>
          <thead><tr>{head.map((h) => <th key={h}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={j ? 'text-right tabular-nums' : ''}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  )
}
