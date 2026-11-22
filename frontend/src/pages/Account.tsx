import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ClientShell } from '../components/ClientShell'
import { Empty, ErrorNote, Field, Spinner, WorkCover } from '../components/ui'
import { del, download, patch, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime, downloadIcs, fcfa, shortDate } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { PaymentPicker } from './Cart'

const PREFS = [
  { value: 'leadership', label: 'Leadership' }, { value: 'resilience', label: 'Résilience' },
  { value: 'ecriture', label: 'Écriture' }, { value: 'entraide', label: 'Entraide' },
  { value: 'papos', label: 'Papos de Tiékar' }, { value: 'formations', label: 'Formations' }, { value: 'evenements', label: 'Dédicaces et événements' },
]

export default function Account() {
  useTitle('Mon compte')
  const loc = useLocation()
  const titles: Record<string, string> = { '/compte': 'Profil et préférences', '/compte/commandes': 'Mes commandes', '/compte/formations': 'Mes formations' }
  return (
    <ClientShell>
      <h1 className="mb-6 text-[28px] md:text-[30px]">{titles[loc.pathname.replace(/\/$/, '')] ?? 'Mon compte'}</h1>
      <Routes>
        <Route index element={<Profile />} />
        <Route path="commandes" element={<Orders />} />
        <Route path="formations" element={<MyTrainings />} />
        <Route path="securite" element={<Navigate to="/compte#appareils" replace />} />
      </Routes>
    </ClientShell>
  )
}

/** Profil, préférences, appareils, sécurité et données (maquette 13i). */
function Profile() {
  const { user, setUser, logout } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ ...user! })
  const [error, setError] = useState<unknown>(null)
  const devices = useApi<any[]>('/api/auth/devices/')
  const loc = useLocation()
  useEffect(() => { if (loc.hash && devices.data) document.querySelector(loc.hash)?.scrollIntoView({ behavior: 'smooth' }) }, [loc.hash, devices.data])
  const [pwOpen, setPwOpen] = useState(false)
  const [pw, setPw] = useState({ current_password: '', new_password: '' })
  const [pwErr, setPwErr] = useState<unknown>(null)
  const [delOpen, setDelOpen] = useState(false)
  const [delPw, setDelPw] = useState('')
  const [delReason, setDelReason] = useState('')
  const [delErr, setDelErr] = useState<unknown>(null)
  if (!user) return null
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }))
  const save = async (body: Record<string, unknown>, msg = 'Profil enregistré.') => {
    try { const r = await patch('/api/auth/profile/', body); setUser(r.user); toast(msg) } catch (err) { setError(err) }
  }
  const submitInfo = (e: FormEvent) => {
    e.preventDefault()
    save({ full_name: f.full_name, phone: f.phone, country: f.country, city: f.city, birth_date: f.birth_date || null })
  }
  const togglePref = (v: string) => {
    const next = f.preferences.includes(v) ? f.preferences.filter((x) => x !== v) : [...f.preferences, v]
    set('preferences', next)
    save({ preferences: next }, 'Centres d’intérêt mis à jour.')
  }
  const os = (label: string) => (/iPhone|iPad/.test(label) ? 'iOS' : /Android/.test(label) ? 'And' : /Mac/.test(label) ? 'Mac' : 'PC')

  return (
    <div className="grid gap-5">
      {params.get('bienvenue') && <p className="rounded-xl bg-[#DCFCE7] px-5 py-4 text-ok-dark">Bienvenue ! Votre compte est créé.</p>}
      <div className="grid gap-5 xl:grid-cols-2">
        <form onSubmit={submitInfo} className="card grid content-start gap-3 p-6">
          <b className="text-[17px]">Informations personnelles</b>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Nom complet"><input className="input" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} /></Field>
            <Field label="Ville"><input className="input" value={f.city} onChange={(e) => set('city', e.target.value)} /></Field>
          </div>
          <div className="flex items-center justify-between rounded-[10px] bg-paper px-3.5 py-3 text-sm">
            <span className="truncate">{user.email}</span>
            {user.email_verified ? <span className="font-semibold text-ok">✓ vérifié</span>
              : <button type="button" className="font-semibold text-orange" onClick={async () => { await post('/api/auth/resend-verification/'); toast('Lien renvoyé.') }}>Vérifier</button>}
          </div>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label="Téléphone"><input className="input" type="tel" value={f.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+225 07 00 00 00 00" /></Field>
            <Field label="Date de naissance" hint="Pour une surprise le jour J."><input className="input" type="date" value={f.birth_date ?? ''} onChange={(e) => set('birth_date', e.target.value)} /></Field>
          </div>
          <ErrorNote error={error} />
          <button className="btn btn-blue btn-sm justify-self-start">Enregistrer</button>
        </form>

        <div className="card flex flex-col gap-3.5 p-6">
          <b className="text-[17px]">Mes centres d'intérêt</b>
          <div className="flex flex-wrap gap-2 text-[14px]">
            {PREFS.map((p) => {
              const on = f.preferences.includes(p.value)
              return <button key={p.value} type="button" aria-pressed={on} onClick={() => togglePref(p.value)} className={`rounded-full px-3.5 py-2 ${on ? 'bg-blue text-white' : 'bg-[#F2F3F5]'}`}>{on && '✓ '}{p.label}</button>
            })}
          </div>
          {/* Newsletter retirée du site : seuls les abonnés existants gardent de quoi se désinscrire. */}
          {user.newsletter_consent && (
            <div className="mt-auto flex items-center justify-between gap-3 rounded-xl bg-paper p-3.5">
              <span><b className="block text-sm">Punchline du jour par e-mail</b><span className="text-xs text-muted">Abonnement actif · désinscription en un clic</span></span>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => save({ newsletter_consent: false }, 'Désinscription enregistrée.')}>Se désinscrire</button>
            </div>
          )}
        </div>

        <section id="appareils" className="hero-grad flex flex-col gap-3 rounded-2xl p-6 text-white shadow-[0_30px_60px_-30px_rgba(4,28,92,.7)]">
          <div className="flex justify-between"><b className="text-[17px]">Appareils connectés</b><span className="text-xs font-semibold text-[#FF8A5B]">{devices.data?.length ?? 0} / 2 MAX</span></div>
          {devices.loading ? <Spinner /> : devices.data?.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3.5">
              <span className="grid h-9 w-9 place-items-center rounded-[10px] bg-white text-xs font-bold text-blue-dark">{os(d.label)}</span>
              <div className="min-w-0 flex-1"><b className="block text-sm">{d.label}</b><span className="text-xs opacity-70">{d.current ? 'Cet appareil' : `Vu le ${dateTime(d.last_seen_at)}`}</span></div>
              {d.current ? <span className="h-2 w-2 rounded-full bg-[#4ADE80]" aria-label="Actif" />
                : <button className="text-[14px] font-semibold text-[#FF8A5B]" onClick={async () => { await del(`/api/auth/devices/${d.id}/`); devices.reload() }}>Déconnecter</button>}
            </div>
          ))}
          <p className="text-xs opacity-75">Un 3ᵉ appareil ferme automatiquement la session la plus ancienne.</p>
        </section>

        <section className="card flex flex-col gap-3 p-6">
          <b className="text-[17px]">Sécurité et données</b>
          <button className="rounded-[10px] bg-paper px-3.5 py-3 text-left font-medium" onClick={() => setPwOpen(!pwOpen)} aria-expanded={pwOpen}>Modifier mon mot de passe</button>
          {pwOpen && (
            <form className="grid gap-2.5 rounded-xl border border-line p-4" onSubmit={async (e) => {
              e.preventDefault()
              try { await post('/api/auth/password/', pw); toast('Mot de passe modifié.'); setPw({ current_password: '', new_password: '' }); setPwOpen(false) } catch (err) { setPwErr(err) }
            }}>
              <Field label="Mot de passe actuel"><input className="input" type="password" autoComplete="current-password" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} /></Field>
              <Field label="Nouveau mot de passe"><input className="input" type="password" autoComplete="new-password" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} /></Field>
              <ErrorNote error={pwErr} />
              <button className="btn btn-blue btn-sm justify-self-start">Enregistrer</button>
            </form>
          )}
          <button className="rounded-[10px] bg-paper px-3.5 py-3 text-left font-medium" onClick={() => download('/api/auth/export/', 'mes-donnees-adjougbe.json')}>Exporter mes données</button>
          {/* Suppression : le lecteur envoie une demande, le super administrateur la traite. */}
          {user.deletion_requested_at ? (
            <div className="grid gap-2.5 rounded-xl border-[1.5px] border-[#FDBA9B] bg-orange-tint/40 p-4 text-sm">
              <p><b>Demande de suppression envoyée</b> le {shortDate(user.deletion_requested_at)}. L'équipe la traite sous 30 jours ; vous gardez l'accès à votre compte d'ici là.</p>
              <button className="btn btn-ghost btn-sm justify-self-start" onClick={async () => {
                try { await del('/api/auth/deletion-request/'); setUser({ ...user, deletion_requested_at: null }); toast('Demande annulée.') } catch (err) { setDelErr(err) }
              }}>Annuler la demande</button>
            </div>
          ) : !delOpen ? (
            <button className="rounded-[10px] border-[1.5px] border-[#FDBA9B] px-3.5 py-3 text-left font-semibold text-[#C2410C]" onClick={() => setDelOpen(true)}>Demander la suppression de mon compte</button>
          ) : (
            <form className="grid gap-2.5 rounded-xl border-[1.5px] border-[#FDBA9B] p-4" onSubmit={async (e) => {
              e.preventDefault()
              try {
                const r = await post('/api/auth/deletion-request/', { password: delPw, reason: delReason })
                setUser({ ...user, deletion_requested_at: r.deletion_requested_at }); setDelOpen(false); setDelPw(''); toast('Demande de suppression envoyée.')
              } catch (err) { setDelErr(err) }
            }}>
              <p className="text-sm">Votre demande est transmise à l'administrateur, qui supprime le compte. Vous perdrez alors l'accès à vos livres ; les factures sont conservées de façon anonyme pour la comptabilité.</p>
              <Field label="Motif (facultatif)"><textarea className="input" rows={2} maxLength={500} value={delReason} onChange={(e) => setDelReason(e.target.value)} /></Field>
              <Field label="Confirmez avec votre mot de passe"><input className="input" type="password" autoComplete="current-password" value={delPw} onChange={(e) => setDelPw(e.target.value)} /></Field>
              <ErrorNote error={delErr} />
              <div className="flex flex-wrap gap-2">
                <button className="btn btn-danger btn-sm">Envoyer la demande</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setDelOpen(false)}>Annuler</button>
              </div>
            </form>
          )}
          <button className="mt-auto text-left text-sm text-muted underline" onClick={async () => { await logout(); nav('/') }}>Se déconnecter</button>
        </section>
      </div>
    </div>
  )
}

/** Commandes et reçu (maquette 13g). */
function Orders() {
  const { user } = useAuth()
  const { data, loading } = useApi<any[]>('/api/shop/orders/')
  const works = useApi<any[]>('/api/catalog/works/')
  const bundles = useApi<any[]>('/api/catalog/bundles/')
  const [sel, setSel] = useState<string | null>(null)
  const [retry, setRetry] = useState(false)
  const [method, setMethod] = useState('orange_money')
  if (loading) return <Spinner />
  if (!data?.length) return <Empty title="Aucune commande" action={<Link to="/boutique" className="btn btn-primary">Voir les œuvres</Link>} />
  const o = data.find((x) => x.reference === sel) ?? data[0]
  const coversOf = (order: any) => order.items.flatMap((i: any) => i.work_slug ? (works.data ?? []).filter((w) => w.slug === i.work_slug)
    : ((bundles.data ?? []).find((b) => b.title === i.label)?.works ?? []))
  const tone: Record<string, string> = { paid: 'text-ok', pending: 'text-warn', failed: 'text-danger', refunded: 'text-blue', cancelled: 'text-muted' }
  const readable = o.items.find((i: any) => i.work_slug)
  return (
    <div className="grid gap-7 xl:grid-cols-[1.3fr_1fr]">
      <ul className="grid content-start gap-3">
        {data.map((x) => {
          const covers = coversOf(x)
          return (
            <li key={x.reference}>
              <button onClick={() => { setSel(x.reference); setRetry(false) }} aria-pressed={x.reference === o.reference}
                className={`card flex w-full items-center gap-4 px-5 py-4 text-left ${x.reference === o.reference ? 'ring-2 ring-blue' : ''}`}>
                <div className="flex shrink-0">
                  {covers.length ? covers.slice(0, 2).map((w: any, k: number) => <div key={w.id} className="w-9" style={{ marginLeft: k ? -12 : 0 }}><WorkCover work={w} /></div>)
                    : <span className="grid h-[54px] w-9 place-items-center rounded-md bg-orange-tint font-bold text-orange">F</span>}
                </div>
                <div className="min-w-0 flex-1"><b className="block truncate">{x.items.map((i: any) => i.label).join(', ')}</b><span className="text-xs text-muted">{x.reference} · {shortDate(x.created_at)}</span></div>
                <div className="text-right"><b>{x.total.toLocaleString('fr-FR')} F</b><div className={`text-xs font-semibold ${tone[x.status]}`}>{x.total === 0 && x.status === 'paid' ? 'Offerte' : x.status_label}</div></div>
              </button>
            </li>
          )
        })}
      </ul>
      <aside className="card h-max p-7 text-sm xl:sticky xl:top-32">
        <div className="flex items-center justify-between"><b className="text-sm">Adjougbe</b><span className="text-[12px] font-semibold tracking-[.2em] text-faint">{o.status === 'paid' ? 'REÇU' : 'COMMANDE'}</span></div>
        <div className="mt-5 text-[30px] font-bold">{fcfa(o.total)}</div>
        <div className="text-muted">{o.status === 'paid' ? `Payé le ${dateTime(o.paid_at)} · ${o.payment_method_label}` : o.status_label}</div>
        <div className="my-5 border-t-2 border-dashed border-[#EFF0F2]" />
        <dl className="grid gap-2">
          <div className="flex justify-between"><dt className="text-muted">Commande</dt><dd className="font-bold">{o.reference}</dd></div>
          {o.items.map((i: any, k: number) => <div key={k} className="flex justify-between gap-4"><dt className="text-muted">Article</dt><dd className="text-right">{i.label}</dd></div>)}
          {o.discount > 0 && <div className="flex justify-between"><dt className="text-muted">Remise</dt><dd className="text-ok">− {fcfa(o.discount)}</dd></div>}
          <div className="flex justify-between"><dt className="text-muted">Client</dt><dd>{user?.full_name}</dd></div>
          {o.is_gift && <div className="flex justify-between"><dt className="text-muted">Cadeau pour</dt><dd>{o.gift_recipient_email}</dd></div>}
        </dl>
        <div className="my-5 border-t-2 border-dashed border-[#EFF0F2]" />
        {o.status === 'paid' || o.status === 'refunded' ? (
          <div className="flex flex-wrap gap-2.5 [&>*]:min-w-[150px]">
            <button className="btn btn-blue btn-sm flex-1" onClick={() => download(`/api/shop/orders/${o.reference}/receipt/`, `recu-${o.reference}.pdf`)}>Télécharger le reçu</button>
            {readable ? <Link to={`/lire/${readable.work_slug}`} className="btn btn-ghost btn-sm flex-1">Lire l'œuvre</Link>
              : <Link to="/bibliotheque" className="btn btn-ghost btn-sm flex-1">Ma bibliothèque</Link>}
          </div>
        ) : ['pending', 'failed'].includes(o.status) && (
          retry ? (
            <div className="grid gap-3">
              <PaymentPicker value={method} onChange={setMethod} />
              <button className="btn btn-primary" onClick={async () => { const r = await post(`/api/shop/orders/${o.reference}/retry/`, { payment_method: method }); window.location.href = r.redirect_url }}>Payer {fcfa(o.total)}</button>
            </div>
          ) : <button className="btn btn-primary w-full shadow-orange" onClick={() => setRetry(true)}>Finaliser le paiement</button>
        )}
      </aside>
    </div>
  )
}

/** Mes formations (maquette 13h). */
function MyTrainings() {
  const { data, loading, reload } = useApi<any[]>('/api/trainings/mine/')
  const [tab, setTab] = useState<'next' | 'past'>('next')
  if (loading) return <Spinner />
  if (!data?.length) return <Empty title="Aucune formation" action={<Link to="/formations" className="btn btn-primary">Voir les formations</Link>} />
  const now = Date.now()
  const active = data.filter((e) => e.status !== 'cancelled')
  const next = active.filter((e) => new Date(e.session.ends_at ?? e.session.starts_at).getTime() >= now)
  const past = active.filter((e) => !next.includes(e))
  const list = tab === 'next' ? next : past
  const chip = (e: any) => {
    const days = Math.ceil((new Date(e.session.starts_at).getTime() - now) / 864e5)
    if (tab === 'past') return ['', e.attended ? 'Présent' : 'Terminée']
    if (e.status === 'confirmed') return ['chip-ok', `Confirmée · J-${Math.max(0, days)}`]
    if (e.status === 'waitlist') return ['chip-blue', "Liste d'attente"]
    return ['chip-warn', 'Paiement en attente']
  }
  return (
    <>
      <div className="mb-5 flex gap-2">
        {([['next', `À venir · ${next.length}`], ['past', `Passées · ${past.length}`]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-full px-4 py-2 text-[14px] ${tab === k ? 'bg-ink font-semibold text-white' : 'bg-[var(--card)]'}`}>{l}</button>
        ))}
      </div>
      {!list.length && <p className="card p-6 text-muted">{tab === 'next' ? 'Aucune formation à venir.' : 'Aucune formation passée.'}</p>}
      <ul className="grid gap-4">
        {list.map((e, k) => {
          const d = new Date(e.session.starts_at)
          const [tone, label] = chip(e)
          const online = !e.session.location
          return (
            <li key={e.id} className="card grid items-center gap-5 p-5 sm:grid-cols-[110px_1fr_auto]">
              <Link to={`/compte/formations/${e.id}`} className="flex h-[110px] flex-col items-center justify-center rounded-[14px] text-white" style={{ background: k % 2 ? 'linear-gradient(135deg,#FF8A3D,#FF6B29)' : 'linear-gradient(135deg,#1560DC,#041C5C)' }}>
                <b className="text-[38px] leading-none">{String(d.getDate()).padStart(2, '0')}</b>
                <span className={`text-xs font-semibold uppercase ${k % 2 ? '' : 'text-[#FF8A5B]'}`}>{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
              </Link>
              <div className="min-w-0">
                <span className={`chip ${tone}`}>{label}</span>
                <Link to={`/formations/${e.session.training.slug}`} className="mt-2.5 block text-lg font-semibold md:text-xl">{e.session.training.title}</Link>
                <p className="mt-1 text-sm text-muted">{d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} · {e.session.location || 'En ligne'} · {e.number}</p>
              </div>
              <div className="flex flex-col gap-2">
                {tab === 'past' ? (e.attended && <button className="btn btn-blue btn-sm" onClick={() => download(`/api/trainings/enrollments/${e.id}/certificate/`, 'attestation.pdf')}>Attestation</button>) : (
                  <>
                    {e.status === 'pending_payment' && <Link to="/compte/commandes" className="btn btn-primary btn-sm">Payer</Link>}
                    {e.status === 'confirmed' && (online
                      ? (e.meeting_link ? <a href={e.meeting_link} target="_blank" rel="noopener noreferrer" className="btn btn-blue btn-sm">Rejoindre</a> : <span className="btn btn-sm bg-[#F2F3F5] text-faint">Lien bientôt dispo</span>)
                      : <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(e.session.location)}`} target="_blank" rel="noopener noreferrer" className="btn btn-blue btn-sm">Itinéraire</a>)}
                    {e.status === 'confirmed' && <button className="btn btn-ghost btn-sm" onClick={() => downloadIcs({ title: e.session.training.title, start: e.session.starts_at, end: e.session.ends_at ?? e.session.starts_at, location: e.session.location || e.meeting_link, description: e.number })}>Calendrier</button>}
                    {(e.status === 'waitlist' || e.status === 'pending_payment' || (e.status === 'confirmed' && !e.session.effective_price)) && (
                      <button className="text-xs text-muted underline" onClick={async () => { await post(`/api/trainings/enrollments/${e.id}/cancel/`); reload() }}>Annuler</button>
                    )}
                  </>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </>
  )
}
