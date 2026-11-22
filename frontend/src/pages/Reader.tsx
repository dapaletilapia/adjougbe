import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import markColor from '../assets/mark-color.svg'
import markWhite from '../assets/mark-white.svg'
import { ErrorNote, Icon, Spinner } from '../components/ui'
import { ApiError, del, get, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { fcfa } from '../lib/format'
import { useTitle } from '../lib/hooks'

type Manifest = { section: { id: number; number: number; title: string }; pages: string[]; ttl: number; prev: number | null; next: number | null }

const SIZES = ['s', 'm', 'l', 'xl']
const SIZE_PCT: Record<string, number> = { s: 90, m: 100, l: 120, xl: 140 }
const THEME_LABELS: Record<string, string> = { light: 'Clair', sepia: 'Sépia', dark: 'Sombre' }

function pref(key: string, fallback: string) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function savePref(key: string, v: string) {
  try { localStorage.setItem(key, v) } catch { /* stockage indisponible */ }
}

/**
 * Lecteur protégé (maquettes 14a–14f). Les pages arrivent en images filigranées, via des adresses signées de courte durée.
 * Sélection, clic droit, glisser-déposer, impression et raccourcis de copie sont bloqués ; le contenu est masqué
 * quand l'onglet perd le focus. C'est dissuasif : une photo d'écran reste possible, mais le filigrane nominatif
 * permet de remonter jusqu'au compte d'origine.
 */
export default function Reader() {
  const { slug } = useParams()
  const [params, setParams] = useSearchParams()
  const { user } = useAuth()
  const [toc, setToc] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  const [sectionId, setSectionId] = useState<number | null>(null)
  const [manifest, setManifest] = useState<Manifest | null>(null)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(() => pref('adj-reader-size', 'm'))
  const [theme, setTheme] = useState(() => pref('adj-reader-theme', 'light'))
  const [hidden, setHidden] = useState(false)
  const [panel, setPanel] = useState<'toc' | 'display' | null>(() => (window.innerWidth >= 1100 ? 'toc' : null))
  const [locked, setLocked] = useState<string | null>(null)
  const [imgLoading, setImgLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)
  const [search, setSearch] = useState('')
  const touchX = useRef<number | null>(null)
  useTitle(toc?.work.title ?? 'Lecture')

  const loadToc = useCallback(() => get(`/api/reader/works/${slug}/toc/`).then(setToc).catch(setError), [slug])
  useEffect(() => { loadToc() }, [loadToc])

  // Section de départ : paramètre d'URL, sinon reprise de lecture, sinon la première lisible.
  useEffect(() => {
    if (!toc || sectionId) return
    const wanted = Number(params.get('section'))
    const start = wanted || toc.progress?.section || toc.sections.find((s: any) => s.readable)?.id || toc.sections[0]?.id
    if (start) {
      setSectionId(start)
      if (!wanted && toc.progress?.section === start) setPage(toc.progress.page)
    }
  }, [toc, params, sectionId])

  const loadManifest = useCallback(async (id: number) => {
    try {
      const m = await get<Manifest>(`/api/reader/sections/${id}/manifest/?size=${size}&theme=${theme}`)
      setManifest(m)
      setFetchedAt(Date.now())
      setLocked(null)
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setManifest(null)
        setLocked(String(e.data.detail || 'purchase_required'))
      } else setError(e)
    }
  }, [size, theme])

  useEffect(() => { if (sectionId) loadManifest(sectionId) }, [sectionId, loadManifest])

  // Les adresses expirent : on rafraîchit le manifeste avant l'échéance.
  useEffect(() => {
    if (!manifest || !sectionId) return
    const t = setTimeout(() => loadManifest(sectionId), Math.max(10, manifest.ttl - 20) * 1000)
    return () => clearTimeout(t)
  }, [manifest, sectionId, loadManifest, fetchedAt])

  // Sauvegarde de la progression.
  useEffect(() => {
    if (!user || !manifest || !sectionId) return
    const last = page >= manifest.pages.length - 1
    const t = setTimeout(() => {
      post('/api/reader/progress/', { section: sectionId, page, completed: last })
        .then((r) => last && setToc((tc: any) => (tc ? { ...tc, progress: { ...(tc.progress ?? {}), sections_read: r.sections_read } } : tc)))
        .catch(() => {})
    }, 800)
    return () => clearTimeout(t)
  }, [user, manifest, sectionId, page])

  const goSection = (id: number | null, toEnd = false) => {
    if (!id) return
    setSectionId(id)
    setPage(toEnd ? 9999 : 0)
    setParams({ section: String(id) }, { replace: true })
    if (window.innerWidth < 1100) setPanel(null)
  }
  useEffect(() => { if (manifest && page >= manifest.pages.length) setPage(manifest.pages.length - 1) }, [manifest, page])

  const next = useCallback(() => {
    if (!manifest) return
    if (page < manifest.pages.length - 1) setPage(page + 1)
    else goSection(manifest.next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, page])
  const prev = useCallback(() => {
    if (!manifest) return
    if (page > 0) setPage(page - 1)
    else goSection(manifest.prev, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manifest, page])

  // Protections : raccourcis, clic droit, perte de focus.
  useEffect(() => {
    let tm: ReturnType<typeof setTimeout>
    const warn = () => { setBlocked(true); clearTimeout(tm); tm = setTimeout(() => setBlocked(false), 3500) }
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && ['s', 'p', 'c', 'a', 'u'].includes(k)) { e.preventDefault(); warn(); return }
      if (k === 'printscreen' || (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(k))) { setHidden(true); return }
      if (k === 'arrowright') next()
      if (k === 'arrowleft') prev()
    }
    const block = (e: Event) => { e.preventDefault(); warn() }
    const onVis = () => { if (document.hidden) setHidden(true) }
    const onBlur = () => setHidden(true)
    window.addEventListener('keydown', onKey)
    document.addEventListener('contextmenu', block)
    document.addEventListener('copy', block)
    document.addEventListener('dragstart', block)
    document.addEventListener('visibilitychange', onVis)
    window.addEventListener('blur', onBlur)
    return () => {
      clearTimeout(tm)
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('contextmenu', block)
      document.removeEventListener('copy', block)
      document.removeEventListener('dragstart', block)
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('blur', onBlur)
    }
  }, [next, prev])

  const addBookmark = async () => {
    if (!user) return
    const b = await post('/api/reader/bookmarks/', { section: sectionId, page })
    setToc((t: any) => ({ ...t, bookmarks: [{ ...b, created_at: new Date().toISOString() }, ...t.bookmarks] }))
  }
  const removeBookmark = async (id: number) => {
    await del(`/api/reader/bookmarks/${id}/`)
    setToc((t: any) => ({ ...t, bookmarks: t.bookmarks.filter((b: any) => b.id !== id) }))
  }
  const changeSize = (d: number) => {
    const i = Math.min(SIZES.length - 1, Math.max(0, SIZES.indexOf(size) + d))
    setSize(SIZES[i]); savePref('adj-reader-size', SIZES[i])
  }
  const changeTheme = (t: string) => { setTheme(t); savePref('adj-reader-theme', t) }

  if (error) return <div className="container-x py-10"><ErrorNote error={error} /></div>
  if (!toc) return <div className="grid min-h-screen place-items-center"><Spinner /></div>

  const dark = theme === 'dark'
  const unit = toc.work.unit_label === 'série' ? 'Série' : 'Histoire'
  const current = toc.sections.find((s: any) => s.id === sectionId)
  const idx = toc.sections.findIndex((s: any) => s.id === sectionId)
  const read: number[] = toc.progress?.sections_read ?? []
  const pct = Math.round((read.length / Math.max(1, toc.sections.length)) * 100)
  const pageUrl = manifest?.pages[Math.min(page, manifest.pages.length - 1)]
  const bar = dark ? 'bg-[#0b1b4a] text-white shadow-[0_1px_0_rgba(255,255,255,.08)]' : 'bg-white shadow-[0_1px_0_#EFF0F2]'
  const chip = dark ? 'bg-white/10' : 'bg-paper'
  const stage = dark ? { background: 'radial-gradient(800px 500px at 50% 40%,#0B2E78 0%,#041C5C 50%,#020E30 100%)' } : theme === 'sepia' ? { background: '#EFE6D2' } : { background: '#F5F7FA' }
  const filtered = toc.sections.filter((s: any) => !search || `${s.number} ${s.title}`.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="reader-root no-copy fixed inset-0 z-50 flex flex-col" style={{ color: dark ? '#E6ECF5' : '#0E0F13' }}>
      {/* Barre du haut (14a) */}
      <div className={`flex shrink-0 items-center gap-3 px-3 py-3 md:gap-4 md:px-7 ${bar}`}>
        <Link to={user ? '/bibliotheque' : `/livres/${slug}`} className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[10px] ${chip}`} aria-label="Quitter le lecteur"><Icon name="arrow-small-left" /></Link>
        <img src={dark ? markWhite : markColor} alt="" className="hidden h-8 w-8 sm:block" />
        <div className="min-w-0 flex-1">
          <div className={`truncate text-xs ${dark ? 'text-white/60' : 'text-muted'}`}>{toc.work.title}</div>
          <b className="block truncate text-[15px] md:text-base">{current ? `${unit} ${current.number}${current.title ? ` — ${current.title}` : ''}` : ''}</b>
        </div>
        <div className={`hidden items-center gap-1 rounded-[10px] p-1 md:flex ${chip}`}>
          <button onClick={() => changeSize(-1)} className="h-[34px] w-9 text-[14px] font-semibold" aria-label="Réduire le texte">A−</button>
          <span className={`w-10 text-center text-xs ${dark ? 'text-white/60' : 'text-muted'}`}>{SIZE_PCT[size]} %</span>
          <button onClick={() => changeSize(1)} className="h-[34px] w-9 text-base font-semibold" aria-label="Agrandir le texte">A+</button>
        </div>
        <div className={`hidden gap-1 rounded-[10px] p-1 text-[14px] lg:flex ${chip}`} role="radiogroup" aria-label="Fond">
          {Object.entries(THEME_LABELS).map(([k, l]) => (
            <button key={k} role="radio" aria-checked={theme === k} onClick={() => changeTheme(k)}
              className={`rounded-lg px-3.5 py-2 ${theme === k ? (dark ? 'bg-white/15 font-semibold' : 'bg-white font-semibold shadow-[0_2px_6px_rgba(4,28,92,.1)]') : ''}`}>{l}</button>
          ))}
        </div>
        <button onClick={() => setPanel(panel === 'display' ? null : 'display')} className={`grid h-[42px] w-[42px] place-items-center rounded-[10px] text-[14px] font-semibold lg:hidden ${chip}`} aria-label="Affichage">Aa</button>
        {manifest && user && <button onClick={addBookmark} className={`hidden h-[42px] w-[42px] place-items-center rounded-[10px] sm:grid ${chip}`} aria-label="Ajouter un signet" title="Ajouter un signet"><Icon name="bookmark" /></button>}
        <button onClick={() => setPanel(panel === 'toc' ? null : 'toc')} aria-expanded={panel === 'toc'}
          className="flex h-[42px] items-center gap-1.5 rounded-[10px] bg-blue px-3 text-sm font-semibold text-white md:px-4">
          <Icon name="list" /><span className="hidden md:inline">Sommaire</span>
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1">
        {/* Zone de lecture */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-3 md:p-9" style={stage}
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return
            const dx = e.changedTouches[0].clientX - touchX.current
            if (Math.abs(dx) > 50) (dx < 0 ? next : prev)()
            touchX.current = null
          }}>
          {locked ? <LockedSection reason={locked} work={toc.work} /> : !pageUrl ? <Spinner /> : (
            <>
              <button onClick={prev} disabled={page === 0 && !manifest?.prev} aria-label="Page précédente"
                className="absolute top-1/2 left-3 z-10 hidden h-[52px] w-[52px] -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_10px_20px_-10px_rgba(4,28,92,.4)] disabled:opacity-30 md:left-7 md:grid"><Icon name="angle-small-left" /></button>
              <img key={pageUrl} src={pageUrl} alt={`${unit} ${current?.number}, page ${page + 1}`} draggable={false}
                onLoad={() => setImgLoading(false)} onLoadStart={() => setImgLoading(true)} onError={() => sectionId && loadManifest(sectionId)}
                className={`pointer-events-none max-h-full max-w-full rounded-[14px] object-contain shadow-[0_40px_80px_-40px_rgba(4,28,92,.45)] transition-[filter,opacity] ${hidden ? 'blur-2xl' : ''} ${imgLoading ? 'opacity-60' : ''}`} />
              <button onClick={next} disabled={page >= (manifest?.pages.length ?? 1) - 1 && !manifest?.next} aria-label="Page suivante"
                className="absolute top-1/2 right-3 z-10 hidden h-[52px] w-[52px] -translate-y-1/2 place-items-center rounded-full bg-blue text-white shadow-[0_10px_20px_-8px_rgba(47,104,183,.7)] disabled:opacity-30 md:right-7 md:grid"><Icon name="angle-small-right" /></button>
              {/* Zones tactiles en mobile */}
              <button className="absolute inset-y-0 left-0 w-1/4 md:hidden" onClick={prev} aria-hidden="true" tabIndex={-1} />
              <button className="absolute inset-y-0 right-0 w-1/4 md:hidden" onClick={next} aria-hidden="true" tabIndex={-1} />
            </>
          )}

          {/* Hors focus : contenu masqué (14c) */}
          {hidden && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-10 text-center text-white" style={{ background: 'linear-gradient(125deg,rgba(4,28,92,.94),rgba(21,96,220,.9))' }}>
              <span className="grid h-20 w-20 place-items-center rounded-full bg-white/10 text-4xl"><Icon name="eye-crossed" /></span>
              <h2 className="mt-5 text-[28px]">Lecture en pause</h2>
              <p className="mt-2.5 max-w-[380px] leading-relaxed opacity-85">Le texte est masqué quand vous quittez l'onglet. Il réapparaît dès votre retour.</p>
              <button onClick={() => setHidden(false)} className="btn btn-primary mt-6 shadow-orange">Reprendre la lecture</button>
            </div>
          )}

          {/* Copie bloquée (14b) */}
          {blocked && (
            <div role="status" className="absolute right-4 bottom-4 z-30 flex items-center gap-3 rounded-[14px] bg-white px-4 py-3.5 text-[14px] text-ink shadow-[0_20px_40px_-14px_rgba(0,0,0,.6)] md:right-7 md:bottom-7">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-orange-tint text-orange"><Icon name="ban" /></span>
              <div><b>Copie désactivée</b><div className="text-muted">Ctrl+C, Ctrl+S et Ctrl+P sont bloqués pour protéger l'œuvre.</div></div>
            </div>
          )}

          {/* Réglages d'affichage en mobile (14f) */}
          {panel === 'display' && (
            <div className="absolute inset-x-3.5 bottom-3.5 z-30 flex flex-col gap-3.5 rounded-[20px] p-5 text-white shadow-[0_20px_40px_-14px_rgba(4,28,92,.6)] lg:hidden" style={{ background: 'linear-gradient(125deg,#041C5C,#1560DC)' }}>
              <div className="flex justify-between"><b>Affichage</b><button onClick={() => setPanel(null)} aria-label="Fermer"><Icon name="cross-small" /></button></div>
              <div className="flex items-center gap-3">
                <span className="text-[14px]">A</span>
                <input type="range" min={0} max={3} value={SIZES.indexOf(size)} onChange={(e) => { const v = SIZES[Number(e.target.value)]; setSize(v); savePref('adj-reader-size', v) }} className="flex-1 accent-orange" aria-label="Taille du texte" />
                <span className="text-xl">A</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center text-[14px]">
                <button onClick={() => changeTheme('light')} className={`rounded-[10px] bg-white p-2.5 text-ink ${theme === 'light' ? 'font-semibold ring-2 ring-orange' : ''}`}>Clair</button>
                <button onClick={() => changeTheme('sepia')} className={`rounded-[10px] bg-[#F3E9D4] p-2.5 text-ink ${theme === 'sepia' ? 'font-semibold ring-2 ring-orange' : ''}`}>Sépia</button>
                <button onClick={() => changeTheme('dark')} className={`rounded-[10px] border border-white/20 bg-[#020E30] p-2.5 ${theme === 'dark' ? 'font-semibold ring-2 ring-orange' : ''}`}>Sombre</button>
              </div>
            </div>
          )}
        </div>

        {/* Sommaire (14a) */}
        {panel === 'toc' && (
          <aside className="absolute inset-y-0 right-0 z-40 flex w-[min(92vw,360px)] flex-col gap-1 overflow-hidden px-5 py-6 text-white lg:static" style={{ background: 'linear-gradient(180deg,#041C5C,#0A3A9E 70%,#1560DC)' }}>
            <div className="mb-3.5 flex items-center justify-between"><b className="text-lg">Sommaire</b><button onClick={() => setPanel(null)} className="opacity-60 hover:opacity-100" aria-label="Fermer le sommaire"><Icon name="cross-small" /></button></div>
            <input className="mb-2.5 w-full rounded-[10px] bg-white/10 px-3.5 py-2.5 text-[14px] text-white outline-none placeholder:text-white/70" placeholder={`Chercher une ${unit.toLowerCase()}…`} value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Chercher dans le sommaire" />
            {toc.bookmarks.length > 0 && (
              <div className="mb-2 rounded-xl bg-white/8 p-2 text-[14px]">
                <div className="px-2 pb-1 text-xs opacity-70">Mes signets</div>
                {toc.bookmarks.map((b: any) => {
                  const s = toc.sections.find((x: any) => x.id === b.section)
                  return (
                    <div key={b.id} className="flex items-center gap-2 px-2 py-1">
                      <button className="flex-1 text-left hover:underline" onClick={() => { goSection(b.section); setPage(b.page) }}>{unit} {s?.number}, page {b.page + 1}</button>
                      <button onClick={() => removeBookmark(b.id)} aria-label="Supprimer le signet" className="opacity-60">×</button>
                    </div>
                  )
                })}
              </div>
            )}
            <ol className="-mx-1 flex-1 overflow-y-auto px-1">
              {filtered.map((s: any) => {
                const isCur = s.id === sectionId
                const isRead = read.includes(s.id)
                return (
                  <li key={s.id}>
                    <button onClick={() => goSection(s.id)} aria-current={isCur ? 'true' : undefined}
                      className={`flex w-full items-center gap-3 rounded-[10px] px-3.5 py-[11px] text-left text-sm ${isCur ? 'bg-white font-semibold text-blue-dark' : isRead ? 'opacity-55 hover:bg-white/10' : 'hover:bg-white/10'}`}>
                      <b className={`w-6 tabular-nums ${isCur ? '' : 'opacity-60'}`}>{s.number}</b>
                      <span className="flex-1 truncate">{s.title || `${unit} ${s.number}`}</span>
                      {isCur && manifest ? <span className="text-xs text-orange">{Math.min(page, manifest.pages.length - 1) + 1}/{manifest.pages.length}</span>
                        : !s.readable ? <Icon name="lock" className="opacity-60" />
                        : isRead ? <Icon name="check" /> : s.free && !toc.full_access ? <span className="text-[12px] opacity-70">extrait</span> : null}
                    </button>
                  </li>
                )
              })}
            </ol>
            {user && toc.full_access && (
              <div className="mt-2 rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="flex justify-between text-[14px]"><span>Progression</span><b>{pct} %</b></div>
                <div className="mt-2.5 h-1.5 rounded-full bg-white/15"><div className="h-full rounded-full bg-orange shadow-[0_0_10px_rgba(255,107,41,.8)]" style={{ width: `${pct}%` }} /></div>
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Barre du bas */}
      {manifest && (
        <div className={`flex shrink-0 items-center gap-3 px-4 py-3.5 text-xs md:gap-4 md:px-7 ${bar} ${dark ? 'text-white/70' : 'text-muted'}`}>
          <button onClick={prev} className={`grid h-11 w-11 place-items-center rounded-full md:hidden ${chip}`} aria-label="Page précédente"><Icon name="angle-small-left" /></button>
          <span className="hidden tabular-nums md:inline">{idx + 1} / {toc.sections.length}</span>
          <div className="relative hidden h-[5px] flex-1 rounded-full bg-[#EFF0F2]/80 md:block">
            <div className="h-full rounded-full" style={{ width: `${((idx + (page + 1) / manifest.pages.length) / toc.sections.length) * 100}%`, background: 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} />
            <span className="absolute -top-1.5 h-4 w-4 -translate-x-1/2 rounded-full border-[3px] border-bright bg-white" style={{ left: `${((idx + (page + 1) / manifest.pages.length) / toc.sections.length) * 100}%` }} />
          </div>
          <span className="flex-1 text-center md:hidden">{Math.min(page, manifest.pages.length - 1) + 1} / {manifest.pages.length} · {pct} %</span>
          <span className="hidden lg:inline">Lecture protégée · position synchronisée</span>
          <button onClick={next} className="grid h-11 w-11 place-items-center rounded-full bg-blue text-white md:hidden" aria-label="Page suivante"><Icon name="angle-small-right" /></button>
        </div>
      )}
    </div>
  )
}

/** Œuvre verrouillée ou session expirée (maquette 14e). */
function LockedSection({ reason, work }: { reason: string; work: any }) {
  const cart = useCart()
  const content: Record<string, { title: string; text: React.ReactNode; primary?: React.ReactNode; secondary?: React.ReactNode }> = {
    login_required: {
      title: 'Connectez-vous pour continuer',
      text: <>La suite de <b className="text-ink">{work.title}</b> est réservée aux lecteurs inscrits.</>,
      primary: <Link to={`/connexion?suivant=/lire/${work.slug}`} className="btn btn-primary">Se connecter</Link>,
      secondary: <Link to={`/inscription?suivant=/lire/${work.slug}`} className="btn btn-ghost">Créer un compte</Link>,
    },
    purchase_required: {
      title: 'Cette œuvre est verrouillée',
      text: <>Vous avez lu l'extrait gratuit. Achetez <b className="text-ink">{work.title}</b> pour lire toutes les {work.unit_label}s.</>,
      primary: <Link to="/paiement" onClick={() => cart.add({ type: 'work', id: work.id, label: work.title, price: work.price_xof })} className="btn btn-primary">Acheter · {fcfa(work.price_xof)}</Link>,
      secondary: <Link to={`/connexion?suivant=/lire/${work.slug}`} className="btn btn-ghost">Se reconnecter</Link>,
    },
    form_required: {
      title: 'Ce livre est offert',
      text: 'Répondez à quelques questions et la lecture s’ouvre immédiatement.',
      primary: <Link to={`/acces/${work.slug}`} className="btn btn-primary">Recevoir le livre</Link>,
    },
    claim: { title: 'Ce livre est offert', text: 'Ajoutez-le à votre bibliothèque pour le lire.', primary: <Link to={`/livres/${work.slug}`} className="btn btn-primary">Ajouter à ma bibliothèque</Link> },
    preorder: { title: 'Bientôt disponible', text: 'Votre précommande est enregistrée. La lecture s’ouvrira le jour de la sortie.', primary: <Link to="/bibliotheque" className="btn btn-primary">Ma bibliothèque</Link> },
  }
  const c = content[reason] ?? { title: 'Section indisponible', text: '' }
  return (
    <div className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-[20px] bg-white p-9 text-center text-ink shadow-[0_40px_80px_-30px_rgba(4,28,92,.45)]">
      <span className="mx-auto grid h-20 w-20 place-items-center rounded-[22px] text-3xl text-white shadow-[0_16px_30px_-12px_rgba(4,28,92,.7)]" style={{ background: 'linear-gradient(135deg,#3386C9,#041C5C)' }}><Icon name="lock" /></span>
      <h2 className="mt-2 text-2xl">{c.title}</h2>
      <p className="text-sm leading-relaxed text-muted">{c.text}</p>
      {c.primary}
      {c.secondary}
    </div>
  )
}
