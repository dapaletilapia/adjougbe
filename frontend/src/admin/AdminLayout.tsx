import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, NavLink, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import markColor from '../assets/mark-color.svg'
import markWhite from '../assets/mark-white.svg'
import { ErrorNote, Icon, Spinner } from '../components/ui'
import { get, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/hooks'

type Item = { to: string; label: string; icon: string; roles?: string[]; badge?: 'orders' | 'moderation' | 'alerts' }

// Ordre et icônes de la maquette « Adj Admin Side ».
const ITEMS: Item[] = [
  { to: '/admin', label: 'Tableau de bord', icon: 'apps' },
  { to: '/admin/oeuvres', label: 'Œuvres', icon: 'book-alt', roles: ['admin'] },
  { to: '/admin/commandes', label: 'Commandes', icon: 'shopping-cart', roles: ['admin', 'accountant'], badge: 'orders' },
  { to: '/admin/utilisateurs', label: 'Utilisateurs', icon: 'users', roles: ['admin', 'assistant'], badge: 'alerts' },
  { to: '/admin/blog', label: 'Blog', icon: 'blog-pencil', roles: ['admin', 'editor'], badge: 'moderation' },
  { to: '/admin/formations', label: 'Formations', icon: 'graduation-cap', roles: ['admin', 'assistant'] },
  { to: '/admin/formulaires', label: 'Formulaires', icon: 'form', roles: ['admin', 'assistant'] },
  { to: '/admin/newsletter', label: 'Newsletter', icon: 'envelope', roles: ['admin', 'editor'] },
  { to: '/admin/parametres', label: 'Paramètres', icon: 'settings', roles: ['admin'] },
  { to: '/admin/journal', label: 'Journal', icon: 'time-past', roles: ['admin'] },
]

function Brand({ sub = 'STUDIO', light = true }: { sub?: string; light?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <img src={light ? markWhite : markColor} alt="" className="h-[34px] w-[34px]" />
      <span>
        <span className={`block text-[17px] leading-none font-bold ${light ? 'text-white' : 'text-blue'}`}>Adjougbe</span>
        <span className="mt-1 block text-[8px] font-semibold tracking-[.28em] text-orange">{sub}</span>
      </span>
    </span>
  )
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [results, setResults] = useState<any[]>([])
  const nav = useNavigate()
  useEffect(() => {
    if (q.length < 2) return setResults([])
    const t = setTimeout(() => get(`/api/backoffice/search/?q=${encodeURIComponent(q)}`).then((r) => setResults(r.results)), 250)
    return () => clearTimeout(t)
  }, [q])
  return (
    <div className="relative w-[260px] max-w-full">
      <label htmlFor="bo-search" className="sr-only">Recherche globale</label>
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
      <input id="bo-search" className="input !min-h-[42px] !bg-[var(--card)] !pl-10 shadow-[0_6px_16px_-12px_rgba(4,28,92,.4)]" placeholder="Rechercher…"
        value={q} onChange={(e) => setQ(e.target.value)} />
      {results.length > 0 && (
        <ul className="card absolute top-12 right-0 z-50 max-h-80 w-[360px] overflow-y-auto p-1">
          {results.map((r, i) => (
            <li key={i}>
              <button className="flex w-full gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-mist" onClick={() => { nav(r.path); setQ('') }}>
                <span className="w-24 shrink-0 text-faint">{r.type}</span><span className="truncate">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** En-tête de page commun : sur-titre, titre, recherche et actions (maquette 15a). */
export function TopBar() {
  return <GlobalSearch />
}

export default function AdminLayout() {
  const { user, loading, logout } = useAuth()
  const loc = useLocation()
  const nav = useNavigate()
  const badges = useApi<Record<string, number>>(user?.otp_verified ? '/api/backoffice/badges/' : null, [loc.pathname])
  const [more, setMore] = useState(false)
  useEffect(() => { setMore(false) }, [loc.pathname])
  if (loading) return <Spinner />
  if (!user) return <Navigate to={`/connexion?suivant=${encodeURIComponent(loc.pathname)}`} replace />
  if (!user.is_staff_role) return <Navigate to="/" replace />
  if (!user.otp_verified) return <Navigate to={`/admin/verification?suivant=${encodeURIComponent(loc.pathname)}`} replace />
  const role = user.role === 'reader' ? 'admin' : user.role
  const items = ITEMS.filter((s) => !s.roles || s.roles.includes(role) || role === 'admin')
  const badge = (b?: Item['badge']) => (b && badges.data?.[b] ? badges.data[b] : null)

  const sidebar = (
    <div className="relative flex h-full flex-col gap-0.5 overflow-hidden px-3.5 py-6 text-sm text-white" style={{ background: 'var(--grad-side)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.035]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
      <Link to="/admin" className="relative px-2.5 pb-6"><Brand /></Link>
      <nav className="relative flex flex-col gap-0.5" aria-label="Modules du back-office">
        {items.map((s) => (
          <NavLink key={s.to} to={s.to} end={s.to === '/admin'}
            className={({ isActive }) => `flex items-center gap-2.5 rounded-[10px] px-3 py-[11px] ${isActive ? 'bg-white font-semibold text-blue-dark' : 'text-white/85 hover:bg-white/10'}`}>
            <Icon name={s.icon} className="w-[18px] justify-center text-base" />
            {s.label}
            {badge(s.badge) && <span className="ml-auto text-[11px] font-bold text-orange">{badge(s.badge)}</span>}
          </NavLink>
        ))}
      </nav>
      <div className="relative mt-auto rounded-xl border border-white/15 bg-white/8 p-3.5 text-xs">
        <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4ADE80]" />2FA active</div>
        <div className="mt-1 truncate opacity-60">{user.full_name}</div>
        <div className="mt-2 flex gap-3 opacity-80">
          <Link to="/" className="underline">Voir le site</Link>
          <button className="underline" onClick={async () => { await logout(); nav('/') }}>Déconnexion</button>
        </div>
      </div>
    </div>
  )

  // Barre du bas en mobile (maquette 15o) : Accueil, Ventes, Contenu, Plus.
  const tabs = [
    { to: '/admin', label: 'Accueil', icon: 'home', end: true },
    { to: '/admin/commandes', label: 'Ventes', icon: 'chart-line-up' },
    { to: '/admin/blog', label: 'Contenu', icon: 'document' },
  ]
  return (
    <div className="min-h-screen bg-paper md:grid md:grid-cols-[240px_1fr]">
      <aside className="sticky top-0 hidden h-screen md:block">{sidebar}</aside>
      <div className="min-w-0 pb-24 md:pb-0">
        <main className="px-4 py-5 md:px-9 md:py-8"><Outlet /></main>
      </div>
      <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-2xl bg-[var(--card)] p-1.5 text-[11px] shadow-[0_10px_20px_-14px_rgba(4,28,92,.5)] md:hidden" aria-label="Navigation mobile">
        {tabs.map((t) => (
          <NavLink key={t.to} to={t.to} end={t.end}
            className={({ isActive }) => `flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 ${isActive ? 'bg-blue font-semibold text-white' : 'text-muted'}`}>
            <Icon name={t.icon} className="text-[17px]" />{t.label}
          </NavLink>
        ))}
        <button onClick={() => setMore(true)} className="flex flex-col items-center gap-1 rounded-xl px-3.5 py-2.5 text-muted" aria-expanded={more}>
          <Icon name="menu-dots" className="text-[17px]" />Plus
        </button>
      </nav>
      {more && (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button className="absolute inset-0 bg-ink/50" onClick={() => setMore(false)} aria-label="Fermer" />
          <div className="absolute inset-y-0 left-0 w-[260px]">{sidebar}</div>
        </div>
      )}
    </div>
  )
}

/** Double authentification obligatoire avant tout accès au back-office (maquette 15n). */
export function OtpGate() {
  const { user, loading, setUser } = useAuth()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [setup, setSetup] = useState<{ qr: string; secret: string } | null>(null)
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [backup, setBackup] = useState(false)
  const [backupCode, setBackupCode] = useState('')
  const [codes, setCodes] = useState<string[] | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const next = params.get('suivant') || '/admin'

  useEffect(() => {
    if (user && user.is_staff_role && !user.otp_enabled && !setup) post('/api/auth/otp/setup/').then(setSetup).catch(setError)
  }, [user, setup])

  if (loading) return <Spinner />
  if (!user) return <Navigate to="/connexion?suivant=/admin" replace />
  if (user.otp_verified && !codes) return <Navigate to={next} replace />

  const code = backup ? backupCode : digits.join('')
  const submit = async (e?: FormEvent) => {
    e?.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await post('/api/auth/otp/verify/', { code })
      if (r.backup_codes) { setCodes(r.backup_codes); setUser(r.user) }
      else { setUser(r.user); nav(next, { replace: true }) }
    } catch (err) {
      setError(err)
      setDigits(Array(6).fill(''))
      refs.current[0]?.focus()
    } finally { setBusy(false) }
  }
  const setDigit = (i: number, v: string) => {
    const clean = v.replace(/\D/g, '')
    if (clean.length > 1) { // collage d'un code complet
      const arr = clean.slice(0, 6).split('')
      setDigits([...arr, ...Array(6 - arr.length).fill('')])
      refs.current[Math.min(arr.length, 5)]?.focus()
      return
    }
    const d = [...digits]; d[i] = clean; setDigits(d)
    if (clean && i < 5) refs.current[i + 1]?.focus()
  }

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden px-4 py-10"
      style={{ background: 'radial-gradient(500px 400px at 50% 30%,#3FA2FF 0%,rgba(31,120,240,.55) 38%,transparent 72%),linear-gradient(125deg,#041C5C 0%,#0A3A9E 45%,#1560DC 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      <div className="relative flex w-full max-w-[440px] flex-col gap-3.5 rounded-[20px] bg-white p-8 text-ink shadow-[0_50px_90px_-30px_rgba(4,28,92,.8)] sm:p-10">
        <Brand light={false} />
        {codes ? (
          <>
            <h1 className="mt-4 text-[26px]">Codes de secours</h1>
            <p className="text-sm text-muted">Notez ces 8 codes et gardez-les en lieu sûr. Chacun permet une connexion si vous perdez votre téléphone. Ils ne seront plus affichés.</p>
            <ul className="grid grid-cols-2 gap-2 rounded-xl bg-paper p-4 font-mono text-[15px] font-semibold tracking-wider">
              {codes.map((c) => <li key={c}>{c}</li>)}
            </ul>
            <button className="btn btn-primary mt-2" onClick={() => nav(next, { replace: true })}>J'ai noté mes codes</button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-[26px]">Code de vérification</h1>
            {!user.otp_enabled && setup ? (
              <div className="grid gap-3 text-sm text-muted">
                <p>Première connexion au Studio : scannez ce QR code avec Google Authenticator, Microsoft Authenticator ou une application équivalente.</p>
                <img src={setup.qr} alt="QR code de configuration de la double authentification" className="h-44 w-44 justify-self-center rounded-xl bg-white p-2 ring-1 ring-line" />
                <p>Ou saisissez la clé : <code className="break-all text-ink">{setup.secret}</code></p>
              </div>
            ) : (
              <p className="text-sm text-muted">{backup ? 'Saisissez un de vos codes de secours.' : "Saisissez le code à 6 chiffres de votre application d'authentification."}</p>
            )}
            <form onSubmit={submit} className="grid gap-3.5">
              {backup ? (
                <input className="input text-center text-xl font-semibold tracking-[.2em] uppercase" placeholder="XXXX-XXXX" value={backupCode}
                  onChange={(e) => setBackupCode(e.target.value)} aria-label="Code de secours" autoFocus />
              ) : (
                <div className="mt-1.5 flex gap-2" role="group" aria-label="Code à 6 chiffres">
                  {digits.map((d, i) => (
                    <input key={i} ref={(el) => { refs.current[i] = el }} value={d} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      maxLength={6} aria-label={`Chiffre ${i + 1}`} autoFocus={i === 0}
                      onChange={(e) => setDigit(i, e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Backspace' && !d && i > 0) refs.current[i - 1]?.focus() }}
                      className="h-[58px] w-full min-w-0 flex-1 rounded-xl border-2 border-transparent bg-paper text-center text-2xl font-bold outline-none focus:border-blue focus:shadow-[0_0_0_4px_rgba(47,104,183,.12)]" />
                  ))}
                </div>
              )}
              <ErrorNote error={error} />
              <button className="btn btn-primary mt-2 !py-3.5" disabled={busy || (backup ? code.replace(/\W/g, '').length < 8 : code.length !== 6)}>Vérifier</button>
            </form>
            {user.otp_enabled && (
              <p className="text-center text-[13px] text-muted">
                {backup ? <button className="font-semibold text-blue" onClick={() => setBackup(false)}>Utiliser l'application</button>
                  : <>Code perdu ? <button className="font-semibold text-blue" onClick={() => setBackup(true)}>Utiliser un code de secours</button></>}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
