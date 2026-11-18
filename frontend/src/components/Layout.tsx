import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { useSettings } from '../lib/hooks'
import { Icon, initials, Logo } from './ui'

// Menu de l'en-tête « Adj Header » des maquettes.
const NAV = [
  { to: '/', label: 'Accueil' },
  { to: '/boutique', label: 'Œuvres' },
  { to: '/formations', label: 'Formations' },
  { to: '/blog', label: 'Blog' },
  { to: '/a-propos', label: 'À propos' },
  { to: '/contact', label: 'Contact' },
]

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

  const { data: site } = useSettings<{ whatsapp_number: string }>()
  const phone = site?.whatsapp_number ? `+${site.whatsapp_number.replace(/^(\d{3})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1 $2 $3 $4 $5 $6')}` : ''
  return (
    <header className="sticky top-0 z-40 no-print">
      {/* Bandeau de réassurance (maquette « Adj Header ») */}
      <div className="hidden bg-ink text-[12.5px] text-[#D9DBE0] md:block">
        <div className="container-x flex items-center gap-8 py-2.5">
          {[['mobile-notch', 'Paiement Mobile Money'], ['lock', 'Lecture sécurisée'], ['clock', 'Accès immédiat']].map(([i, l]) => (
            <span key={l} className="flex items-center gap-2"><Icon name={i} className="text-orange" />{l}</span>
          ))}
          {phone && <a href={`https://wa.me/${site!.whatsapp_number}`} className="ml-auto">WhatsApp : <b className="text-white">{phone}</b></a>}
        </div>
      </div>
      <div className="border-b border-[#EFF0F2] bg-[var(--card)]">
        <div className="container-x flex h-[76px] items-center gap-6">
          <Link to="/" aria-label="Accueil Adjougbe"><Logo /></Link>
          <nav className="ml-auto hidden gap-[30px] text-sm font-medium text-ink-soft lg:flex" aria-label="Navigation principale">
            {NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.to === '/'}
                className={({ isActive }) => (isActive ? 'font-semibold text-blue' : 'hover:text-blue')}>
                {n.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-[18px] lg:ml-6">
            <Link to="/recherche" className="hidden text-ink-soft sm:block" aria-label="Rechercher"><Icon name="search" className="text-lg" /></Link>
            <Link to="/panier" className="relative text-ink-soft" aria-label={`Panier, ${items.length} article(s)`}>
              <Icon name="shopping-bag" className="text-lg" />
              {items.length > 0 && <span className="absolute -top-1.5 -right-2 grid h-4 w-4 place-items-center rounded-full bg-orange text-[9px] font-bold text-white">{items.length}</span>}
            </Link>
            {user ? (
              <Link to={user.is_staff_role ? '/admin' : '/bibliotheque'} className="hidden items-center gap-2.5 rounded-full bg-[#F2F3F5] py-1.5 pr-3.5 pl-1.5 text-sm font-semibold sm:flex">
                <span className="avatar h-8 w-8">{initials(user.full_name)}</span>{user.is_staff_role ? 'Studio' : user.full_name.split(' ')[0]}
              </Link>
            ) : (
              <Link to="/boutique" className="btn btn-primary hidden !rounded-lg !px-5 text-sm shadow-[0_8px_18px_-8px_rgba(255,107,41,.8)] sm:inline-flex">Acheter un livre</Link>
            )}
            <button type="button" className="grid h-10 w-10 place-items-center rounded-full border border-ink/15 lg:hidden"
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
              {NAV.map((n, i) => (
                <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `py-3 ${i < NAV.length - 1 ? 'border-b border-white/12' : ''} ${isActive ? 'text-orange' : ''}`}>{n.label}</NavLink>
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

function NewsletterForm() {
  const [email, setEmail] = useState('')
  const [consent, setConsent] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr('')
    try {
      const r = await post('/api/newsletter/subscribe/', { email, consent, source: 'pied-de-page' })
      setMsg(r.message)
    } catch (ex) {
      setErr((ex as Error).message)
    }
  }
  if (msg) return <p className="font-medium text-white">{msg}</p>
  return (
    <form onSubmit={submit} className="grid gap-3">
      <div className="flex overflow-hidden rounded-[10px] shadow-[0_20px_40px_-20px_rgba(0,0,0,.6)]">
        <label className="sr-only" htmlFor="nl-email">Adresse e-mail</label>
        <input id="nl-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="Votre adresse e-mail" className="min-w-0 flex-1 bg-white px-4 py-4 text-sm text-ink outline-none" />
        <button className="bg-orange px-6 text-sm font-semibold text-white hover:bg-orange-dark">S'inscrire</button>
      </div>
      <label className="flex items-start gap-2 text-xs text-white/70">
        <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 accent-orange" required />
        J'accepte de recevoir les e-mails d'Adjougbe. Désinscription en un clic.
      </label>
      {err && <span className="text-sm text-orange">{err}</span>}
    </form>
  )
}

function Footer() {
  const { data } = useSettings<{ contact_email: string; whatsapp_number: string }>()
  return (
    <footer className="no-print">
      <div className="relative overflow-hidden text-white" style={{ background: 'radial-gradient(500px 300px at 85% 30%,#3FA2FF,transparent 70%),linear-gradient(125deg,#041C5C,#0A3A9E 45%,#1560DC)' }}>
        <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -top-16 -right-10 h-80 w-80 opacity-[.07]" />
        <div className="container-x relative flex flex-col gap-6 py-12 md:flex-row md:items-center md:gap-12 md:py-14">
          <div className="flex-1">
            <div className="text-[11px] font-semibold tracking-[.14em] opacity-75">RESTONS EN CONTACT</div>
            <p className="mt-2.5 text-2xl font-bold md:text-[30px]">Recevez la punchline du jour</p>
          </div>
          <div className="w-full md:w-[460px]"><NewsletterForm /></div>
        </div>
      </div>
      <div className="bg-ink text-[#D9DBE0]">
        <div className="container-x grid gap-10 pt-14 pb-7 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 max-w-xs text-[13.5px] leading-7 text-faint">Livres, formations et contenus pour développer le leadership. Abidjan, Côte d'Ivoire.</p>
          </div>
          <nav className="flex flex-col gap-2.5 text-[13.5px]" aria-label="Explorer">
            <b className="mb-1 text-white">Explorer</b>
            <Link to="/boutique" className="hover:text-white">Œuvres</Link>
            <Link to="/formations" className="hover:text-white">Formations</Link>
            <Link to="/blog" className="hover:text-white">Blog</Link>
            <Link to="/a-propos" className="hover:text-white">À propos</Link>
          </nav>
          <nav className="flex flex-col gap-2.5 text-[13.5px]" aria-label="Mon compte">
            <b className="mb-1 text-white">Mon compte</b>
            <Link to="/bibliotheque" className="hover:text-white">Bibliothèque</Link>
            <Link to="/compte/commandes" className="hover:text-white">Commandes</Link>
            <Link to="/compte" className="hover:text-white">Profil</Link>
            <Link to="/cadeau" className="hover:text-white">J'ai un code cadeau</Link>
          </nav>
          <div className="flex flex-col gap-2.5 text-[13.5px]">
            <b className="mb-1 text-white">Contact</b>
            {data?.contact_email && <a href={`mailto:${data.contact_email}`} className="hover:text-white">{data.contact_email}</a>}
            {data?.whatsapp_number && <a href={`https://wa.me/${data.whatsapp_number}`} className="hover:text-white">WhatsApp</a>}
            <Link to="/contact" className="hover:text-white">Contact et dédicaces</Link>
          </div>
        </div>
        <div className="container-x flex flex-wrap gap-x-6 gap-y-2 border-t border-white/10 py-5 text-[12.5px] text-faint">
          <span>© {new Date().getFullYear()} Adjougbe</span>
          <Link to="/cgu" className="hover:text-white">CGU</Link>
          <Link to="/confidentialite" className="hover:text-white">Confidentialité</Link>
          <Link to="/mentions-legales" className="hover:text-white">Mentions légales</Link>
          <span className="sm:ml-auto">Paiements sécurisés · FCFA</span>
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
    <nav className="fixed inset-x-3 bottom-3 z-40 flex justify-around rounded-[18px] bg-[var(--card)] p-1.5 text-[11px] shadow-[0_10px_30px_-10px_rgba(4,28,92,.4)] md:hidden no-print" aria-label="Navigation mobile">
      {tabs.map((t) => (
        <NavLink key={t.label} to={t.to} end={t.end}
          className={({ isActive }) => `flex flex-col items-center gap-[3px] rounded-xl px-3.5 py-2.5 ${isActive ? 'bg-blue font-semibold text-white' : 'text-muted'}`}>
          <Icon name={t.icon} className="text-[17px]" />{t.label}
        </NavLink>
      ))}
    </nav>
  )
}

export default function Layout() {
  const loc = useLocation()
  // Accolades obligatoires : dans les Chrome récents, scrollTo() renvoie une promesse, que React prendrait pour un nettoyage.
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
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
