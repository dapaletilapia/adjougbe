import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatPhone, PAYMENT_METHODS } from '../lib/format'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/hooks'
import { Icon, initials, Logo, PayLogo } from './ui'

// Menu de l'en-tête « Adj Header » des maquettes.
type NavItem = { to: string; label: string; children?: { to: string; label: string; hint: string }[] }
const NAV: NavItem[] = [
  { to: '/', label: 'Accueil' },
  { to: '/boutique', label: 'Œuvres' },
  { to: '/formations', label: 'Formations' },
  { to: '/blog', label: 'Blog' },
  {
    to: '/a-propos', label: 'À propos', children: [
      { to: '/a-propos', label: 'Présentation', hint: "Son parcours et ce qui l'anime" },
      { to: '/a-propos#domaines', label: "Domaines d'intervention", hint: 'Les sujets sur lesquels il forme et intervient' },
    ],
  },
]

/** Entrée de menu à sous-menu : s'ouvre au survol, au clic et au clavier ; se ferme avec Échap ou en sortant. */
function NavDropdown({ item }: { item: NavItem }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const active = loc.pathname.startsWith(item.to)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { setOpen(false) }, [loc.pathname, loc.hash])
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [open])
  return (
    // Le libellé reste un lien vers la page ; la flèche ouvre le sous-menu (clic, clavier, toucher). Survol souris : ouverture aussi.
    <div ref={ref} className="relative flex items-center"
      onPointerEnter={(e) => e.pointerType === 'mouse' && setOpen(true)} onPointerLeave={(e) => e.pointerType === 'mouse' && setOpen(false)}
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(false) }}>
      <NavLink to={item.to} className={`nav-pill !pr-1 ${active ? 'is-active' : ''}`}>{item.label}</NavLink>
      <button type="button" aria-expanded={open} aria-controls="sous-menu-apropos" aria-label={`Sous-menu ${item.label}`} onClick={() => setOpen(!open)}
        className={`-ml-0.5 mr-1.5 grid h-7 w-6 place-items-center rounded-full ${active ? 'text-blue' : 'hover:text-blue'}`}>
        <Icon name="angle-small-down" className={`text-[15px] leading-none transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-1/2 z-50 -translate-x-1/2 pt-4">
          <ul id="sous-menu-apropos" className="w-[300px] rounded-2xl bg-[var(--card)] p-2 shadow-[0_24px_50px_-20px_rgba(4,28,92,.45)] ring-1 ring-ink/[.06]">
            {item.children!.map((c) => (
              <li key={c.to}>
                <Link to={c.to} className="block rounded-xl px-4 py-3 hover:bg-paper focus-visible:bg-paper">
                  <b className="block text-[14.5px] text-ink">{c.label}</b>
                  <span className="text-[13px] font-normal text-muted">{c.hint}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

export function useTheme() {
  const [theme, setTheme] = useState<string>(() => {
    try {
      return localStorage.getItem('adj-theme') || 'light'
    } catch {
      return 'light'
    }
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('adj-theme', theme)
    } catch {
      /* stockage indisponible */
    }
  }, [theme])
  return [theme, setTheme] as const
}

function Header() {
  const { user } = useAuth()
  const { items } = useCart()
  const [open, setOpen] = useState(false)
  const [theme, setTheme] = useTheme()
  const loc = useLocation()
  useEffect(() => { setOpen(false) }, [loc.pathname])
  // En-tête plus compact et ombré dès qu'on fait défiler la page.
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 24)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [])

  const { data: site } = useSettings<{ whatsapp_number: string }>()
  const phone = site?.whatsapp_number ? formatPhone(site.whatsapp_number) : ''
  return (
    <header className="sticky top-0 z-40 no-print">
      {/* Bandeau de réassurance (maquette « Adj Header ») */}
      <div className="hidden bg-ink text-[13.5px] text-[#D9DBE0] md:block">
        <div className="container-x flex items-center gap-8 py-2">
          {[['mobile-notch', 'Paiement Mobile Money'], ['lock', 'Lecture sécurisée'], ['clock', 'Accès immédiat']].map(([i, l], k) => (
            <span key={l} className={`items-center gap-2 whitespace-nowrap ${k === 2 ? 'hidden lg:flex' : 'flex'}`}><Icon name={i} className="text-peach" />{l}</span>
          ))}
          {phone && <a href={`https://wa.me/${site!.whatsapp_number}`} className="ml-auto whitespace-nowrap">WhatsApp : <b className="text-white">{phone}</b></a>}
        </div>
      </div>
      <div className={`border-b bg-[var(--card)]/90 backdrop-blur-xl transition-[box-shadow,border-color] duration-300 supports-[backdrop-filter]:bg-[var(--card)]/80 ${scrolled ? 'border-transparent shadow-[0_14px_34px_-24px_rgba(4,28,92,.5)]' : 'border-line'}`}>
        <div className={`container-x flex items-center gap-6 transition-[height] duration-300 ${scrolled ? 'h-[64px]' : 'h-[76px]'}`}>
          <Link to="/" aria-label="Accueil Adjougbe" className="shrink-0"><Logo /></Link>
          {/* Menu : un rail discret, l'entrée active est marquée d'un trait orange. */}
          <nav className="mx-auto hidden items-center gap-1 rounded-full bg-paper/80 p-1 text-[14px] leading-none font-medium text-ink-soft ring-1 ring-ink/[.04] lg:flex" aria-label="Navigation principale">
            {NAV.map((n) => n.children ? <NavDropdown key={n.to} item={n} /> : (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => `nav-pill ${isActive ? 'is-active' : ''}`}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2 lg:ml-0">
            <Link to="/recherche" className="icon-btn hidden sm:grid" aria-label="Rechercher" title="Rechercher"><Icon name="search" /></Link>
            <Link to="/panier" className="icon-btn relative" aria-label={`Panier, ${items.length} article(s)`} title="Panier">
              <Icon name="shopping-bag" />
              {items.length > 0 && <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-orange px-1 text-[10px] font-bold text-white ring-2 ring-[var(--card)]">{items.length}</span>}
            </Link>
            {user ? (
              <Link to={user.is_staff_role ? '/admin' : '/bibliotheque'} className="ml-1 hidden items-center gap-2.5 rounded-full border border-line bg-[var(--card)] py-1 pr-4 pl-1 text-sm font-semibold transition-colors hover:border-blue sm:flex">
                <span className="avatar h-8 w-8">{initials(user.full_name)}</span>
                <span className="leading-tight">{user.is_staff_role ? 'Studio' : user.full_name.split(' ')[0]}<span className="block text-[11.5px] font-medium text-muted">{user.is_staff_role ? 'Administration' : 'Mon espace'}</span></span>
              </Link>
            ) : (<>
              <Link to="/connexion" className="ml-1 hidden rounded-full px-4 py-2.5 text-sm font-semibold text-ink-soft transition-colors hover:bg-paper hover:text-blue sm:block">Se connecter</Link>
              <Link to="/boutique" className="btn btn-primary hidden !rounded-full !px-5 !py-2.5 text-sm shadow-[0_8px_18px_-8px_rgba(255,107,41,.8)] sm:inline-flex">Acheter un livre</Link>
            </>)}
            <button type="button" className="icon-btn lg:hidden"
              aria-expanded={open} aria-controls="menu-mobile" onClick={() => setOpen(!open)} aria-label="Menu">
              <Icon name={open ? 'cross-small' : 'menu-burger'} />
            </button>
          </div>
        </div>
        {/* Menu plein écran en mobile (maquette 16e) */}
        {open && createPortal(
          <div id="menu-mobile" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-50 flex flex-col overflow-y-auto text-white lg:hidden"
            style={{ background: 'radial-gradient(400px 400px at 80% 20%,#3FA2FF 0%,rgba(31,120,240,.55) 38%,transparent 72%),linear-gradient(160deg,#041C5C 0%,#0A3A9E 50%,#1560DC 100%)' }}>
            <div className="pointer-events-none absolute inset-0 opacity-[.04]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
            <div className="relative flex items-center justify-between px-5 py-4">
              <Logo light />
              <button onClick={() => setOpen(false)} className="grid h-11 w-11 place-items-center rounded-xl bg-white text-lg text-blue-dark" aria-label="Fermer le menu"><Icon name="cross-small" /></button>
            </div>
            <nav className="relative flex flex-col px-6 py-6 text-[26px] font-semibold" aria-label="Menu mobile">
              {NAV.map((n, i) => n.children ? (
                <div key={n.to} className={`py-3 ${i < NAV.length - 1 ? 'border-b border-white/12' : ''}`}>
                  <span className={loc.pathname.startsWith(n.to) ? 'text-peach' : ''}>{n.label}</span>
                  <div className="mt-2 grid gap-1 border-l-2 border-white/20 pl-4 text-[18px] font-medium">
                    {n.children.map((c) => <Link key={c.to} to={c.to} onClick={() => setOpen(false)} className="py-1.5 text-white/85 hover:text-white">{c.label}</Link>)}
                  </div>
                </div>
              ) : (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `py-3 ${i < NAV.length - 1 ? 'border-b border-white/12' : ''} ${isActive ? 'text-peach' : ''}`}>{n.label}</NavLink>
              ))}
            </nav>
            <div className="relative mt-auto flex flex-col gap-2.5 px-5 pb-7">
              <Link to={user ? (user.is_staff_role ? '/admin' : '/bibliotheque') : '/connexion'} className="rounded-xl bg-orange py-4 text-center font-semibold">{user ? (user.is_staff_role ? 'Studio' : 'Mon espace') : 'Se connecter'}</Link>
              <Link to="/panier" className="rounded-xl border border-white/25 bg-white/12 py-4 text-center font-semibold">Panier ({items.length})</Link>
              <button type="button" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="py-2 text-sm opacity-80">{theme === 'dark' ? 'Mode clair' : 'Mode sombre'}</button>
              {phone && <a href={`https://wa.me/${site!.whatsapp_number}`} className="text-center text-xs opacity-70">WhatsApp · {phone}</a>}
            </div>
          </div>
        , document.body)}
      </div>
    </header>
  )
}

function Footer() {
  const { data } = useSettings<{ contact_email: string; whatsapp_number: string }>()
  const phone = data?.whatsapp_number ? formatPhone(data.whatsapp_number) : ''
  const col = 'flex flex-col gap-3 text-[14.5px]'
  const link = 'w-fit text-white/70 transition-colors hover:text-white'
  return (
    <footer className="no-print relative overflow-hidden text-white" style={{ background: 'radial-gradient(700px 380px at 88% 0%,rgba(63,162,255,.28),transparent 70%),linear-gradient(160deg,#041C5C 0%,#06225f 55%,#0A3A9E 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.035]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -right-24 -bottom-24 hidden h-[420px] w-[420px] opacity-[.06] lg:block" />

      {/* Signature : la devise et les deux portes d'entrée du site. */}
      <div className="container-x relative grid gap-8 border-b border-white/10 py-12 md:py-14 lg:grid-cols-[1fr_auto] lg:items-end">
        <div>
          <p className="text-[13px] font-semibold tracking-[.2em] text-peach">POSSUMUS</p>
          <p className="mt-3 max-w-[620px] text-[28px] leading-[1.15] font-bold tracking-[-0.02em] md:text-[38px]">Nous pouvons. Lire, apprendre et grandir, ensemble.</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/boutique" className="btn btn-primary !rounded-full shadow-orange">Découvrir les œuvres</Link>
          <Link to="/formations" className="btn !rounded-full border border-white/25 bg-white/10 text-white hover:bg-white/20">Prochaines formations</Link>
        </div>
      </div>

      <div className="container-x relative grid gap-10 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <Logo light />
          <p className="mt-5 max-w-[300px] text-[14.5px] leading-7 text-white/70">Livres, formations et contenus pour développer le leadership, depuis Abidjan.</p>
          <div className="mt-5 flex gap-2.5">
            {data?.whatsapp_number && <a href={`https://wa.me/${data.whatsapp_number}`} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-[17px] transition-colors hover:bg-[#25D366]"><i className="fi fi-brands-whatsapp leading-none" aria-hidden="true" /></a>}
            {data?.contact_email && <a href={`mailto:${data.contact_email}`} aria-label="E-mail" className="grid h-10 w-10 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"><Icon name="envelope" className="leading-none" /></a>}
          </div>
        </div>
        <nav className={col} aria-label="Explorer">
          <b className="mb-1 text-[13px] tracking-[.08em] text-white/50">Explorer</b>
          <Link to="/boutique" className={link}>Œuvres</Link>
          <Link to="/formations" className={link}>Formations</Link>
          <Link to="/blog" className={link}>Blog</Link>
          <Link to="/a-propos" className={link}>À propos</Link>
          <Link to="/a-propos#domaines" className={link}>Domaines d'intervention</Link>
        </nav>
        <nav className={col} aria-label="Mon compte">
          <b className="mb-1 text-[13px] tracking-[.08em] text-white/50">Mon compte</b>
          <Link to="/bibliotheque" className={link}>Bibliothèque</Link>
          <Link to="/compte/commandes" className={link}>Commandes</Link>
          <Link to="/compte" className={link}>Profil</Link>
          <Link to="/cadeau" className={link}>J'ai un code cadeau</Link>
        </nav>
        <div className={col}>
          <b className="mb-1 text-[13px] tracking-[.08em] text-white/50">Nous joindre</b>
          {phone && <a href={`https://wa.me/${data!.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className={link}><span className="block text-[12.5px] text-white/50">WhatsApp</span><b className="font-semibold text-white">{phone}</b></a>}
          {data?.contact_email && <a href={`mailto:${data.contact_email}`} className={`${link} break-all`}><span className="block text-[12.5px] text-white/50">E-mail</span>{data.contact_email}</a>}
          <span className="text-white/70"><span className="block text-[12.5px] text-white/50">Basé à</span>Abidjan, Côte d'Ivoire</span>
        </div>
      </div>

      <div className="relative border-t border-white/10">
        <div className="container-x flex flex-col gap-4 py-6 text-[13.5px] text-white/60 md:flex-row md:items-center">
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <span>© {new Date().getFullYear()} Adjougbe</span>
            <Link to="/cgu" className="hover:text-white">CGU</Link>
            <Link to="/confidentialite" className="hover:text-white">Confidentialité</Link>
            <Link to="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:ml-auto">
            <span className="mr-1">Paiement sécurisé</span>
            {PAYMENT_METHODS.map((m) => <span key={m.value} className="rounded-md bg-white p-0.5"><PayLogo method={m.value} size={22} /></span>)}
          </div>
        </div>
      </div>
    </footer>
  )
}

function WhatsAppButton() {
  const { data } = useSettings<{ whatsapp_number: string }>()
  if (!data?.whatsapp_number) return null
  return (
    <a href={`https://wa.me/${data.whatsapp_number}`} target="_blank" rel="noopener noreferrer"
      className="fixed right-4 bottom-[164px] z-30 flex h-14 items-center gap-2 md:bottom-4 rounded-full bg-[#1f8a5b] px-5 font-semibold text-white shadow-lg no-print"
      aria-label="Écrire au support sur WhatsApp">
      <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4a.5.5 0 0 0 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .1-1.3c0-.1-.2-.2-.4-.3Z"/></svg>
      <span className="hidden sm:inline">Besoin d'aide ?</span>
    </a>
  )
}

/** Barre d'onglets mobile (maquette 16d). */
function MobileTabs() {
  const { user } = useAuth()
  const tabs = [
    { to: '/', label: 'Accueil', icon: 'home', end: true },
    { to: '/boutique', label: 'Œuvres', icon: 'book-alt' },
    { to: '/formations', label: 'Formations', icon: 'graduation-cap' },
    { to: user ? (user.is_staff_role ? '/admin' : '/bibliotheque') : '/connexion', label: 'Moi', icon: 'user' },
  ]
  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[18px] bg-[var(--card)] p-1.5 text-[12px] shadow-[0_10px_30px_-10px_rgba(4,28,92,.4)] md:hidden no-print" aria-label="Navigation mobile">
      {tabs.map((t) => (
        <NavLink key={t.label} to={t.to} end={t.end}
          className={({ isActive }) => `flex flex-col items-center gap-[3px] rounded-xl px-3.5 py-2.5 ${isActive ? 'bg-blue font-semibold text-white' : 'text-muted'}`}>
          <Icon name={t.icon} className="text-[17px]" />{t.label}
        </NavLink>
      ))}
    </nav>
  )
}

// Mesure d'audience interne (sans cookie, IP non conservée) : une page vue par changement de page.
// La provenance (document.referrer) n'a de sens que pour la première page chargée.
let firstHit = true
let lastCounted = ''
function useAudience() {
  const { pathname } = useLocation()
  const { user, loading } = useAuth()
  useEffect(() => {
    // On attend de savoir qui navigue : l'équipe du Studio n'est pas comptée.
    if (loading || user?.is_staff_role || navigator.doNotTrack === '1' || lastCounted === pathname) return
    lastCounted = pathname  // une connexion sur la même page ne la recompte pas
    const referrer = firstHit ? document.referrer : ''
    firstHit = false
    fetch('/api/analytics/hit/', {
      method: 'POST', credentials: 'omit', keepalive: true,
      headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: pathname, referrer }),
    }).catch(() => { /* la mesure ne doit jamais gêner la navigation */ })
  }, [pathname, loading, user?.is_staff_role])
}

export default function Layout() {
  const loc = useLocation()
  useAudience()
  // Accolades obligatoires : dans les Chrome récents, scrollTo() renvoie une promesse, que React prendrait pour un nettoyage.
  useEffect(() => { if (!loc.hash) window.scrollTo(0, 0) }, [loc.pathname, loc.hash])
  // Lien vers une ancre (/a-propos#domaines) : la section peut arriver après le chargement des données.
  useEffect(() => {
    if (!loc.hash) return
    let tries = 0
    let target = loc.hash.slice(1)
    try { target = decodeURIComponent(target) } catch { /* ancre mal encodée : utilisée telle quelle */ }
    const id = window.setInterval(() => {
      const el = document.getElementById(target)
      if (el || ++tries > 40) { window.clearInterval(id); el?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }) }
    }, 75)
    return () => { window.clearInterval(id) }
  }, [loc.pathname, loc.hash])
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#contenu" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-ink focus:px-3 focus:py-2 focus:text-white">
        Aller au contenu
      </a>
      <Header />
      <main id="contenu" className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>
      <Footer />
      <WhatsAppButton />
      <MobileTabs />
    </div>
  )
}
