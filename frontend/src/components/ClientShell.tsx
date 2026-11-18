import type { ReactNode } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { Icon, initials, Logo } from './ui'

const LINKS = [
  { to: '/bibliotheque', label: 'Ma bibliothèque', icon: 'books' },
  { to: '/compte/commandes', label: 'Mes commandes', icon: 'receipt' },
  { to: '/compte/formations', label: 'Mes formations', icon: 'graduation-cap' },
  { to: '/compte', label: 'Profil et préférences', icon: 'user', end: true },
]

/** Espace client (maquette 12e) : barre latérale en dégradé, contenu sur fond clair. */
export function ClientShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  return (
    <div className="bg-paper lg:grid lg:min-h-[calc(100vh-120px)] lg:grid-cols-[272px_1fr]">
      <aside className="relative hidden flex-col gap-1 overflow-hidden px-[18px] py-7 text-sm text-white lg:flex" style={{ background: 'linear-gradient(180deg,#041C5C,#0A3A9E 60%,#1560DC)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[.04]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
        <div className="relative px-2.5 pb-7"><Logo light /></div>
        {LINKS.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end}
            className={({ isActive }) => `relative flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 ${isActive ? 'bg-white font-semibold text-blue-dark shadow-[0_10px_20px_-10px_rgba(0,0,0,.4)]' : 'opacity-85 hover:bg-white/10'}`}>
            <Icon name={l.icon} />{l.label}
          </NavLink>
        ))}
        <Link to="/compte#appareils" className="relative flex items-center gap-2.5 rounded-[10px] px-3.5 py-3 opacity-85 hover:bg-white/10"><Icon name="devices" />Appareils</Link>
        {user && (
          <div className="relative mt-auto flex items-center gap-2.5 rounded-xl border border-white/15 bg-white/10 p-3.5">
            <span className="avatar h-[38px] w-[38px] !bg-orange text-[13px]">{initials(user.full_name)}</span>
            <div className="min-w-0 flex-1"><b className="block truncate">{user.full_name}</b><span className="block truncate text-xs opacity-70">{user.email}</span></div>
            <button onClick={async () => { await logout(); nav('/') }} aria-label="Se déconnecter" title="Se déconnecter" className="opacity-70 hover:opacity-100"><Icon name="sign-out-alt" /></button>
          </div>
        )}
      </aside>
      <div className="min-w-0">
        <nav className="flex gap-2 overflow-x-auto px-4 pt-5 lg:hidden" aria-label="Espace client">
          {LINKS.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.end}
              className={({ isActive }) => `whitespace-nowrap rounded-full px-4 py-2 text-sm ${isActive ? 'bg-blue font-semibold text-white' : 'bg-[var(--card)]'}`}>{l.label}</NavLink>
          ))}
        </nav>
        <div className="px-4 py-8 md:px-12 md:py-10">{children}</div>
      </div>
    </div>
  )
}

export function greeting() {
  const h = new Date().getHours()
  return h < 5 || h >= 18 ? 'Bonsoir' : 'Bonjour'
}
