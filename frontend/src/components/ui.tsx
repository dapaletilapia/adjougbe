import { useState, type ReactNode } from 'react'
import { Link, Navigate, useLocation } from 'react-router-dom'
import markColor from '../assets/mark-color.svg'
import markMono from '../assets/mark-mono.svg'
import markWhite from '../assets/mark-white.svg'
import { useAuth } from '../lib/auth'

export function Logo({ light = false, compact = false }: { light?: boolean; compact?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3">
      <img src={light ? markWhite : markColor} alt="" className="h-11 w-11 object-contain" />
      {!compact && (
        <span className="flex flex-col gap-0.5">
          <span className={`text-[21px] leading-none font-bold tracking-[-0.02em] ${light ? 'text-white' : 'text-blue'}`}>Adjougbe</span>
          <span className={`mt-0.5 text-[9px] font-semibold tracking-[.28em] ${light ? 'text-peach' : 'text-orange'}`}>POSSUMUS</span>
        </span>
      )}
    </span>
  )
}

export function Spinner({ label = 'Chargement…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-10 text-muted" role="status">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-orange" />
      {label}
    </div>
  )
}

export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="card flex flex-col items-start gap-3 p-8">
      <h3 className="text-lg">{title}</h3>
      {children && <div className="text-muted">{children}</div>}
      {action}
    </div>
  )
}

export function ErrorNote({ error }: { error: unknown }) {
  if (!error) return null
  return <p className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">{(error as Error).message}</p>
}

export function Field({ label, error, hint, children }: { label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
      {hint && !error && <small>{hint}</small>}
      {error && <span className="err">{error}</span>}
    </label>
  )
}

type CoverWork = { title: string; subtitle?: string; cover?: string | null; cover_color?: string; access_mode?: string; kind?: string; sections_count?: number; unit_label?: string }

/** Taille du titre (en cqw) pour que le mot le plus long tienne sur une ligne, sans césure. */
function titleSize(t: string) {
  const longest = Math.max(...t.split(/\s+/).map((w) => w.length))
  return Math.min(17, 80 / (longest * 0.66))
}

/**
 * Couverture d'œuvre (maquette « Adj Cover ») : variante bleue, orange ou « offerte » sur fond nuit.
 * Les tailles sont en unités de conteneur (cqw) posées en style : la couverture garde ses proportions à toute taille.
 */
export function WorkCover({ work, className = '' }: { work: CoverWork; className?: string; size?: string }) {
  const shell = `relative block aspect-[2/3] w-full overflow-hidden rounded-[3px_8px_8px_3px] shadow-[inset_6px_0_10px_-4px_rgba(0,0,0,.35),0_30px_60px_-20px_rgba(0,0,0,.45)] ${className}`
  if (work.cover)
    return (
      <span className={shell}>
        <img src={work.cover} alt={`Couverture : ${work.title}`} loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
        {/* Dos du livre : pli et reflet sur le bord gauche. */}
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[7%] bg-[linear-gradient(90deg,rgba(0,0,0,.38),rgba(255,255,255,.16)_45%,transparent)]" />
      </span>
    )
  const [main, ...rest] = work.title.split(/ — | – /)
  const tome = rest.join(' ')
  const num = tome.match(/\d+/)?.[0]
  const offered = work.access_mode && work.access_mode !== 'paid'
  const bg = work.cover_color || '#2F68B7'
  const onOrange = bg.toLowerCase() === '#ff6b29'
  const count = work.sections_count ? `${work.sections_count} ${work.kind === 'punchlines' ? 'SÉRIES' : 'HISTOIRES'}` : ''
  const spine = <span className="absolute inset-y-0 left-0" style={{ width: '2.5cqw', background: 'linear-gradient(90deg,rgba(0,0,0,.35),rgba(255,255,255,.12),transparent)' }} />
  if (offered)
    return (
      <div role="img" aria-label={`Couverture : ${work.title}`} className={shell} style={{ containerType: 'inline-size', background: '#0E0F13', color: '#F5F7FA' }}>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(80cqw 60cqw at 50% 38%,rgba(51,134,201,.35),transparent 70%)' }} />
        <div className="absolute inset-0 flex flex-col items-center text-center" style={{ padding: '9cqw 9cqw 8cqw' }}>
          <span style={{ font: "600 4.2cqw 'Poppins'", letterSpacing: '.08em', color: '#3386C9' }}>ADJOUGBE</span>
          <img src={markWhite} alt="" style={{ width: '42cqw', height: '42cqw', margin: '12cqw 0 7cqw' }} />
          <span style={{ font: `600 ${Math.min(12, titleSize(main))}cqw/1.15 'Poppins'`, letterSpacing: '-.02em' }}>{main}</span>
          {tome && <span style={{ marginTop: '3cqw', font: "500 4.4cqw/1.3 'Poppins'", opacity: 0.75 }}>{tome}</span>}
          <span style={{ marginTop: 'auto', font: "600 3.6cqw 'Poppins'", letterSpacing: '.08em', color: '#FF6B29' }}>ŒUVRE OFFERTE</span>
        </div>
        {spine}
      </div>
    )
  return (
    <div role="img" aria-label={`Couverture : ${work.title}`} className={shell} style={{ containerType: 'inline-size', background: bg, color: onOrange ? '#0E0F13' : '#fff' }}>
      <img src={markMono} alt="" className="absolute" style={onOrange
        ? { left: '-30cqw', top: '-20cqw', width: '100cqw', height: '100cqw', opacity: 0.18, filter: 'brightness(0) invert(1)' }
        : { right: '-28cqw', bottom: '-16cqw', width: '100cqw', height: '100cqw', opacity: 0.09 }} />
      <div className="absolute inset-0 flex flex-col" style={{ padding: '8cqw 9cqw 7cqw' }}>
        <div className="flex justify-between" style={{ font: "600 4.2cqw 'Poppins'", letterSpacing: '.08em' }}>
          ADJOUGBE{num && <span style={{ color: onOrange ? '#fff' : '#FF6B29' }}>{num.padStart(2, '0')}</span>}
        </div>
        <div className="mt-auto uppercase" style={{ fontWeight: 700, fontSize: `${titleSize(main)}cqw`, lineHeight: 1, letterSpacing: '-.02em' }}>{main}</div>
        <div className="flex items-end justify-between" style={{ marginTop: '6cqw' }}>
          <span style={{ font: "600 7.4cqw/1.15 'Poppins'", color: onOrange ? '#fff' : '#FF6B29' }}>{tome}</span>
          {count && <span style={{ font: "500 3.6cqw 'Poppins'", letterSpacing: '.08em', opacity: 0.8 }}>{count}</span>}
        </div>
      </div>
      {spine}
    </div>
  )
}

export function RequireAuth({ children, staff = false }: { children: ReactNode; staff?: boolean }) {
  const { user, loading } = useAuth()
  const loc = useLocation()
  if (loading) return <div className="container-x"><Spinner /></div>
  if (!user) return <Navigate to={`/connexion?suivant=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  if (staff && !user.is_staff_role) return <Navigate to="/" replace />
  return <>{children}</>
}

export function PageHeader({ title, intro, children }: { title: string; intro?: ReactNode; children?: ReactNode }) {
  return (
    <header className="container-x pt-10 pb-8 md:pt-16">
      <h1 className="text-3xl md:text-5xl">{title}</h1>
      {intro && <p className="mt-3 max-w-2xl text-lg text-muted">{intro}</p>}
      {children}
    </header>
  )
}

export function Stars({ value }: { value: number }) {
  return (
    <span aria-label={`${value} sur 5`} className="text-orange">
      {'★★★★★'.slice(0, Math.round(value))}
      <span className="text-line">{'★★★★★'.slice(Math.round(value))}</span>
    </span>
  )
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link to={to} className="text-sm text-muted hover:text-current">← {children}</Link>
}

/** Icône Flaticon « uicons regular rounded » (même jeu que les maquettes). */
export function Icon({ name, className = '' }: { name: string; className?: string }) {
  return <i className={`fi fi-rr-${name} ${className}`} aria-hidden="true" />
}

const PAY_FALLBACK: Record<string, [string, string, string]> = {
  orange_money: ['OM', '#FF7900', '#fff'],
  mtn_momo: ['MTN', '#FFCB05', '#0E0F13'],
  moov_money: ['moov', '#0067B1', '#fff'],
  wave: ['wave', '#1DC8F2', '#fff'],
  card: ['VISA', '#1A1F71', '#fff'],
}

/** Logo d'un moyen de paiement. Déposer les fichiers dans public/pay/<id>.png ; sinon pastille de couleur. */
export function PayLogo({ method, size = 34 }: { method: string; size?: number }) {
  const [failed, setFailed] = useState(false)
  const [label, bg, fg] = PAY_FALLBACK[method] ?? ['?', '#E6E7EA', '#0E0F13']
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-[9px] bg-white font-bold shadow-[0_0_0_1px_rgba(14,15,19,.06)] ${size < 30 ? "text-[7px]" : "text-[12px]"}`}
      style={{ width: size, height: size, ...(failed ? { background: bg, color: fg } : {}) }}>
      {failed ? label : <img src={`/pay/${method}.png`} alt="" className="h-full w-full object-contain p-[2px]" onError={() => setFailed(true)} />}
    </span>
  )
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('')
}
