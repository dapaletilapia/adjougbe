import { useState } from 'react'
import { FilterBar } from '../components/FilterBar'
import { PageHero } from '../components/PageHero'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { DynamicForm } from '../components/DynamicForm'
import { Empty, ErrorNote, Icon, Spinner } from '../components/ui'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateFr, downloadIcs, fcfa } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'
import { PaymentPicker } from './Cart'
import { hostLabel, isExternal, TrainingPoster } from '../components/TrainingPoster'


const STATUS_TXT: Record<string, [string, string]> = {
  open: ['Ouvertes', 'chip-ok'], full: ['Complet', 'chip-orange'], upcoming: ['Bientôt', 'chip-blue'], done: ['Terminée', ''], cancelled: ['Annulée', 'chip-danger'],
}

function DateBadge({ iso, big = false }: { iso: string; big?: boolean }) {
  const d = new Date(iso)
  return (
    <span className={`grid place-content-center rounded-xl bg-white text-center text-ink shadow-[0_10px_20px_-10px_rgba(4,28,92,.5)] ${big ? 'h-16 w-16' : 'h-14 w-14'}`}>
      <b className="text-xl leading-none">{d.getDate()}</b>
      <span className="text-[12px] font-semibold text-orange uppercase">{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
    </span>
  )
}

/** Mention « Organisé par … / Adjougbe intervient » pour les formations des partenaires. */
function HostTag({ t, light = false }: { t: any; light?: boolean }) {
  if (!t.organizer && t.author_role !== 'speaker') return null
  const role = t.author_role === 'speaker' ? 'Intervenant' : 'Co-organisateur'
  return (
    <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full px-2.5 py-1 text-[12.5px] font-semibold ${light ? 'bg-white/95 text-ink shadow' : 'bg-blue-tint text-blue'}`}>
      <Icon name="handshake" className="shrink-0" /><span className="truncate">{role} · {hostLabel(t)}</span>
    </span>
  )
}

const day = (iso: string, o: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('fr-FR', o)

/** Miniature « billet » : l'affiche, une découpe, puis le talon avec la date et l'action. */
function TrainingCard({ t }: { t: any }) {
  const s = t.next_session
  const ext = isExternal(t)
  const [lbl, tone] = STATUS_TXT[s?.status ?? 'done']
  const href = `/formations/${t.slug}`
  const where = s?.location ? s.location.split(',')[0] : ''
  return (
    <article className="group relative flex flex-col overflow-hidden rounded-[18px] bg-[var(--card)] shadow-[0_24px_48px_-32px_rgba(4,28,92,.55)] ring-1 ring-ink/[.06] transition-shadow hover:shadow-[0_30px_60px_-30px_rgba(4,28,92,.7)]">
      <Link to={href} className="relative block" tabIndex={-1} aria-hidden="true">
        <TrainingPoster t={t} className="aspect-[4/3]" />
        <span className="absolute top-3 left-3 right-3 flex flex-wrap items-start justify-between gap-2">
          <HostTag t={t} light />
          {s && !ext && <span className={`chip ${tone} ml-auto shadow`}>{lbl}</span>}
        </span>
      </Link>
      {/* Découpe du billet */}
      <div className="relative h-0 border-t-2 border-dashed border-line" aria-hidden="true">
        <span className="absolute -top-3 -left-3 h-6 w-6 rounded-full bg-paper" /><span className="absolute -top-3 -right-3 h-6 w-6 rounded-full bg-paper" />
      </div>
      <div className="flex flex-1 gap-4 p-5">
        {s ? (
          <span className="flex w-14 shrink-0 flex-col items-center border-r border-line pr-4 text-center">
            <span className="text-[12px] font-semibold text-orange capitalize">{day(s.starts_at, { weekday: 'short' })}</span>
            <b className="text-[28px] leading-none">{new Date(s.starts_at).getDate()}</b>
            <span className="text-[13px] text-muted capitalize">{day(s.starts_at, { month: 'short' })}</span>
          </span>
        ) : (
          <span className="grid w-14 shrink-0 place-items-center border-r border-line pr-4 text-muted"><Icon name="calendar-clock" className="text-xl" /></span>
        )}
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="text-[17px] leading-snug"><Link to={href} className="after:absolute after:inset-0 hover:text-blue">{t.title}</Link></h2>
          <p className="mt-1 text-[13.5px] text-muted">{[t.format_label, where, t.duration_label].filter(Boolean).join(' · ')}</p>
          <div className="mt-auto flex items-center justify-between gap-3 pt-4">
            <b className="text-[17px] whitespace-nowrap">{t.price_xof ? fcfa(t.price_xof) : ext ? '' : 'Gratuit'}</b>
            <span className={`relative z-[1] text-[14px] font-semibold ${s?.status === 'full' && !ext ? 'text-muted' : 'text-blue'}`}>
              {!s ? 'Voir le détail' : ext ? "S'inscrire" : s.status === 'full' ? "Liste d'attente" : s.status === 'open' ? 'Réserver' : 'Voir le détail'}
            </span>
          </div>
          {s && !ext && s.status !== 'done' && (
            <p className="mt-2 text-[12.5px] text-muted">{s.status === 'full' ? 'Complet' : `${s.seats_left} place${s.seats_left > 1 ? 's' : ''} sur ${s.capacity}`}</p>
          )}
        </div>
      </div>
    </article>
  )
}

/** Bandeau « À l'affiche » : les prochaines formations, en affiches que l'on fait défiler. */
function UpcomingRail({ items, title = "À l'affiche" }: { items: any[]; title?: string }) {
  if (!items.length) return null
  return (
    <section aria-labelledby="affiche-titre" className="relative overflow-hidden rounded-[22px] bg-[#041C5C] text-white shadow-[0_40px_80px_-40px_rgba(4,28,92,.9)]">
      <span className="pointer-events-none absolute inset-0 opacity-[.05]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
      <span className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(520px 260px at 100% 0%,rgba(63,162,255,.35),transparent 70%)' }} />
      <div className="relative flex items-end justify-between gap-4 px-5 pt-6 md:px-8 md:pt-7">
        <div>
          <h2 id="affiche-titre" className="text-[22px] text-white md:text-[26px]">{title}</h2>
          <p className="mt-1 text-[14px] text-white/70">{items.length === 1 ? 'La prochaine date' : `Les ${items.length} prochaines dates`}, ici et chez nos partenaires.</p>
        </div>
      </div>
      <ol className="relative flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pt-5 pb-7 [scrollbar-width:thin] md:px-8">
        {items.map((t) => {
          const s = t.next_session
          return (
            <li key={t.id} className="w-[210px] shrink-0 snap-start md:w-[230px]">
              <Link to={`/formations/${t.slug}`} className="group block focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange">
                <span className="relative block overflow-hidden rounded-[14px] ring-1 ring-white/15">
                  <TrainingPoster t={t} className="aspect-[4/5] transition-transform duration-300 group-hover:scale-[1.03]" />
                  <span className="absolute top-3 left-3 rounded-lg bg-white px-2.5 py-1.5 text-[13px] font-bold text-ink shadow">
                    {day(s.starts_at, { day: 'numeric', month: 'short' })}
                  </span>
                </span>
                <b className="mt-3 line-clamp-2 block text-[15px] leading-snug group-hover:text-orange">{t.title}</b>
                <span className="mt-0.5 block truncate text-[13px] text-white/65">{isExternal(t) ? hostLabel(t) : t.format_label}</span>
              </Link>
            </li>
          )
        })}
      </ol>
    </section>
  )
}

const FILTERS: [string, string][] = [['upcoming', 'À venir'], ['onsite', 'Présentiel'], ['online', 'En ligne'], ['free', 'Gratuites'], ['partners', 'Chez nos partenaires'], ['done', 'Passées']]

export default function Trainings() {
  useTitle('Formations')
  const [filter, setFilter] = useState('upcoming')
  const { data, loading } = useApi<any[]>('/api/trainings/')
  const all = data ?? []
  const upcoming = all.filter((t) => t.next_session).sort((a, b) => a.next_session.starts_at.localeCompare(b.next_session.starts_at))
  const list = (filter === 'done' ? all.filter((t) => !t.next_session) : upcoming).filter((t) => {
    if (filter === 'onsite') return t.format === 'onsite'
    if (filter === 'online') return t.format !== 'onsite'
    if (filter === 'free') return t.is_free && !isExternal(t)
    if (filter === 'partners') return !!t.organizer || t.author_role === 'speaker'
    return true
  })
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Formations']]} title="Apprendre à" accent="diriger, ensemble."
        text="Masterclass et ateliers animés par Adjougbe, à Abidjan, en ligne ou chez des organisations partenaires." base="var(--color-paper)" />
      <div className="bg-paper pb-24">
        {upcoming.length > 0 && <div className="container-x relative z-[1] -mt-4 mb-10 md:-mt-8 md:mb-12"><UpcomingRail items={upcoming.slice(0, 8)} /></div>}
        <div className="container-x">
          <h2 className="sr-only">Toutes les formations</h2>
          <FilterBar label="Filtrer les formations" value={filter} onChange={setFilter} options={FILTERS.map(([v, l]) => ({ value: v, label: l }))} />
        </div>
        <div className="container-x mt-7 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {loading && <Spinner />}
          {!loading && !list.length && <div className="sm:col-span-2 xl:col-span-3"><Empty title="Aucune formation pour ce filtre">Essayez un autre filtre : les nouvelles dates sont publiées ici dès qu'elles sont fixées.</Empty></div>}
          {list.map((t) => <TrainingCard key={t.id} t={t} />)}
        </div>
      </div>
    </>
  )
}

export function TrainingDetail() {
  const { slug } = useParams()
  const { data: t, loading, error } = useApi(`/api/trainings/${slug}/`)
  useTitle(t?.title ?? '')
  if (loading) return <div className="container-x"><Spinner /></div>
  if (error || !t) return <div className="container-x py-10"><ErrorNote error={error} /></div>
  const open = t.sessions.filter((s: any) => ['open', 'full', 'upcoming'].includes(s.status))
  const s = open[0]
  const ext = isExternal(t)
  const [head, ...tail] = t.title.split(/ (?=&)| — /)
  const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':', 'h')
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Formations', '/formations'], [head]]}
        eyebrow={`${t.format_label.toUpperCase()}${t.duration_label ? ` · ${t.duration_label.toUpperCase()}` : ''}`}
        title={head} accent={tail.join(' ')} text={t.summary} />
      <div className="container-x grid gap-12 pb-24 lg:grid-cols-[1fr_380px]">
        <div className="grid content-start gap-10">
          {s && (
            <dl className="grid gap-4 sm:grid-cols-3">
              {[['calendar', 'Date', dateFr(s.starts_at)], ['clock', 'Horaires', `${time(s.starts_at)} – ${time(s.ends_at)}`], ['marker', 'Lieu', s.location || (ext ? 'En ligne' : 'En ligne (lien envoyé aux inscrits)')]].map(([i, k, v]) => (
                <div key={k} className="card flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-tint text-blue"><Icon name={i} /></span>
                  <span><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-semibold">{v}</dd></span>
                </div>
              ))}
            </dl>
          )}
          {(t.objectives?.length > 0 || t.audience) && (
            <section className="card grid overflow-hidden md:grid-cols-[1.35fr_1fr]">
              {t.objectives?.length > 0 && (
                <div className="p-6 sm:p-8">
                  <h2 className="text-xl">Ce que vous saurez faire</h2>
                  <ul className="mt-5 grid gap-3.5">
                    {t.objectives.map((o: string, i: number) => (
                      <li key={i} className="flex items-start gap-3.5 text-[15px] leading-snug">
                        <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-orange-tint text-[13px] text-orange"><Icon name="check" /></span>
                        <span className="pt-0.5 font-medium">{o}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {t.audience && (
                <div className="card-navy relative flex flex-col justify-center gap-3 p-6 text-white sm:p-8">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-white/12 text-lg"><Icon name="users" /></span>
                  <h2 className="text-xl text-white">Pour qui ?</h2>
                  <p className="leading-relaxed text-white/85">{t.audience}</p>
                </div>
              )}
            </section>
          )}
          {t.program?.length > 0 && (
            <section>
              <h2 className="text-2xl">Le déroulé</h2>
              <ol className="mt-5 grid gap-4 sm:grid-cols-2">
                {t.program.map((m: any, i: number) => (
                  <li key={i} className="card relative flex flex-col gap-2 overflow-hidden p-6">
                    <span className="absolute inset-x-0 top-0 h-1" style={{ background: 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} />
                    <span className="text-[13px] font-semibold text-blue">Étape {i + 1}</span>
                    <b className="text-[17px] leading-snug">{m.title}</b>
                    {m.detail && <p className="text-[15px] leading-relaxed text-muted">{m.detail}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
          {t.testimonials?.length > 0 && (
            <section><div className="kicker">Témoignages</div>
              {t.testimonials.map((x: any, i: number) => <blockquote key={i} className="mt-4 rounded-xl border border-line p-5 text-[15px]">« {x.text} » <span className="mt-2 block text-sm text-muted">— {x.author}</span></blockquote>)}
            </section>
          )}
          {t.faq?.length > 0 && (
            <section>
              <h2 className="text-2xl">Questions fréquentes</h2>
              <div className="mt-5 grid gap-3">
                {t.faq.map((f: any, i: number) => (
                  <details key={i} className="card group p-0 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-6 py-5 text-[16px] font-semibold">
                      {f.q}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blue-tint text-blue transition-transform group-open:rotate-45"><Icon name="plus" /></span>
                    </summary>
                    <p className="px-6 pb-5 leading-relaxed text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}
        </div>
        <aside className="order-first grid content-start gap-4 lg:order-none lg:sticky lg:top-32 lg:-mt-28 lg:self-start">
          <div className="card relative z-[1] overflow-hidden">
            <div className="relative">
              <TrainingPoster t={t} className="aspect-[4/3]" eager />
              {s && <span className="absolute top-4 left-5"><DateBadge iso={s.starts_at} big /></span>}
            </div>
            <div className="grid gap-4 p-6">
              <div className="flex items-center justify-between gap-3">
                <b className="text-[26px]">{t.price_xof ? fcfa(t.price_xof) : ext ? '' : 'Gratuit'}</b>
                {s && !ext && <span className={`chip ${STATUS_TXT[s.status][1]}`}>{STATUS_TXT[s.status][0]}</span>}
              </div>
              {ext ? (
                s && !t.external_registration_url ? <p className="text-sm text-muted">Les inscriptions se font auprès de {hostLabel(t)}. Le lien sera publié ici très bientôt.</p> : s ? (
                  <>
                    <a href={t.external_registration_url} target="_blank" rel="noopener noreferrer" className="btn btn-primary shadow-orange !whitespace-normal text-center">
                      S'inscrire chez l'organisateur <Icon name="arrow-up-right-from-square" />
                    </a>
                    <p className="text-[13.5px] leading-relaxed text-muted">Les inscriptions sont gérées par {hostLabel(t)}. Le formulaire s'ouvre dans un nouvel onglet.</p>
                  </>
                ) : <p className="text-sm text-muted">Aucune date annoncée pour le moment.</p>
              ) : s ? (
                <>
                  <div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Places restantes</span><b>{s.seats_left} / {s.capacity}</b></div>
                    <div className="mt-2 h-2 rounded-full bg-[#EFF0F2]"><div className="h-full rounded-full" style={{ width: `${((s.capacity - s.seats_left) / s.capacity) * 100}%`, background: 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} /></div>
                  </div>
                  {['open', 'full'].includes(s.status) ? (
                    <Link to={`/formations/${t.slug}/inscription/${s.id}`} className="btn btn-primary shadow-orange">{s.status === 'full' ? "Rejoindre la liste d'attente" : 'Réserver ma place'}</Link>
                  ) : <p className="text-sm text-muted">Les inscriptions ouvrent bientôt. Revenez sur cette page ou écrivez-nous.</p>}
                </>
              ) : <p className="text-sm text-muted">Aucune session programmée pour le moment. Les nouvelles dates sont publiées sur cette page.</p>}
              {open.length > 1 && (
                <div className="grid gap-2 border-t border-line pt-4 text-sm">
                  <span className="text-muted">Autres dates</span>
                  {open.slice(1).map((x: any) => ext
                    ? <span key={x.id} className="font-medium">{dateFr(x.starts_at)}</span>
                    : <Link key={x.id} to={`/formations/${t.slug}/inscription/${x.id}`} className="flex justify-between font-medium hover:text-blue"><span>{dateFr(x.starts_at)}</span><span>{x.seats_left} places</span></Link>)}
                </div>
              )}
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <img src="/auteur-hero.webp" alt="" className="h-12 w-12 rounded-full bg-blue-tint object-cover object-top" />
            <span className="min-w-0"><span className="block text-xs text-muted">{t.author_role === 'speaker' ? 'Intervenant' : 'Formateur'}</span><b>{t.trainer}</b></span>
          </div>
          {(t.organizer || t.author_role === 'speaker') && (
            <div className="card flex items-center gap-3 p-4">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-orange-tint text-lg text-orange"><Icon name="handshake" /></span>
              <span className="min-w-0"><span className="block text-xs text-muted">Organisé par</span><b>{hostLabel(t)}</b></span>
            </div>
          )}
        </aside>
      </div>
    </>
  )
}

/** Parcours d'inscription (maquette 13e) : connexion, formulaire, paiement, confirmation. */
export function TrainingEnroll() {
  const { slug, sessionId } = useParams()
  const nav = useNavigate()
  const { user } = useAuth()
  const t = useApi(`/api/trainings/${slug}/`)
  const form = useApi(t.data?.registration_form ? `/api/forms/${t.data.registration_form}/` : null)
  const [responseId, setResponseId] = useState<number | null>(null)
  const [method, setMethod] = useState('orange_money')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  useTitle('Inscription')
  if (t.loading || form.loading) return <div className="container-x"><Spinner /></div>
  if (t.data && isExternal(t.data)) return <Navigate to={`/formations/${slug}`} replace />
  const session = t.data?.sessions.find((s: any) => String(s.id) === sessionId)
  if (!session) return <div className="container-x py-10"><ErrorNote error={new Error('Session introuvable.')} /></div>
  const needsForm = !!t.data.registration_form && !responseId
  const price = session.effective_price
  const step = needsForm ? 2 : 3
  const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }).replace(':00', 'h').replace(':', 'h')

  const enroll = async () => {
    setBusy(true); setError(null)
    try {
      const r = await post(`/api/trainings/sessions/${session.id}/enroll/`, { form_response_id: responseId, payment_method: method })
      if (r.redirect_url) window.location.href = r.redirect_url
      else nav(`/compte/formations/${r.enrollment.id}`)
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  const steps = ['Connexion', 'Formulaire', price ? 'Paiement' : 'Validation', 'Confirmation']
  return (
    <div className="min-h-[calc(100vh-120px)] bg-paper px-4 pt-8 pb-20 md:px-14">
      <div className="mx-auto max-w-[1180px]">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-blue">{t.data.title}</span>
          <Link to={`/formations/${slug}`} className="text-sm text-muted">✕ Quitter</Link>
        </div>
        <ol className="my-8 grid grid-cols-4 gap-2.5" aria-label="Étapes de l'inscription">
          {steps.map((l, i) => {
            const n = i + 1, done = n < step, active = n === step
            return (
              <li key={l} aria-current={active ? 'step' : undefined}>
                <div className="h-1.5 rounded-full" style={{ background: done ? '#2F68B7' : active ? 'linear-gradient(90deg,#FF6B29 50%,#D9DBE0 50%)' : '#D9DBE0' }} />
                <div className={`mt-2 text-[14px] ${done ? 'font-semibold text-blue' : active ? 'font-semibold' : 'text-faint'}`}>{done ? '✓' : `${n} ·`} {l}</div>
              </li>
            )
          })}
        </ol>
        <div className="grid gap-7 lg:grid-cols-[1fr_1.3fr]">
          <div className="hero-grad relative h-max overflow-hidden rounded-[18px] p-7 text-white shadow-[0_30px_60px_-30px_rgba(4,28,92,.7)]">
            <img src="/mark-mono.svg" alt="" className="absolute -right-10 -bottom-10 h-[200px] w-[200px] opacity-[.08]" />
            <div className="text-xs font-semibold tracking-[.1em] opacity-80">VOTRE SESSION</div>
            <h1 className="mt-3 text-[24px] leading-snug md:text-[26px]">{t.data.title}</h1>
            <ul className="mt-5 grid gap-2 text-sm opacity-90">
              <li>{new Date(session.starts_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {time(session.starts_at)}–{time(session.ends_at)}</li>
              <li>{session.location || 'En ligne (lien envoyé aux inscrits)'}</li>
              <li>{session.seats_left} place(s) restante(s)</li>
            </ul>
            <div className="mt-6 text-[34px] font-bold">{price ? <>{price.toLocaleString('fr-FR')} <span className="text-sm">FCFA</span></> : 'Gratuit'}</div>
          </div>
          <div className="card grid content-start gap-4 p-7">
            {!user?.email_verified && <p className="rounded-lg bg-[#FEF3C7] px-4 py-3 text-sm text-warn">Confirmez votre adresse e-mail pour finaliser l'inscription. <Link to="/compte" className="underline">Renvoyer le lien</Link></p>}
            {needsForm && form.data ? (
              <>
                <b className="text-xl">Vos informations</b>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="field"><span>Nom</span><input className="input" value={user?.full_name ?? ''} readOnly /></label>
                  <label className="field"><span>Téléphone</span><input className="input" value={user?.phone || 'À compléter dans votre profil'} readOnly /></label>
                </div>
                <DynamicForm form={form.data} submitLabel="Continuer vers le paiement" onDone={(r) => setResponseId(r.response_id)} />
              </>
            ) : (
              <>
                <b className="text-xl">{session.status === 'full' ? "Liste d'attente" : price ? 'Paiement' : 'Validation'}</b>
                {session.status === 'full' && <p className="rounded-lg bg-blue-tint px-4 py-3">La session est complète : vous serez inscrit sur la liste d'attente et prévenu dès qu'une place se libère.</p>}
                {price > 0 && session.status !== 'full' && <PaymentPicker value={method} onChange={setMethod} />}
                <ErrorNote error={error} />
                <div className="mt-2 flex flex-wrap justify-between gap-3">
                  {t.data.registration_form && <button className="btn btn-ghost" onClick={() => setResponseId(null)}>← Retour</button>}
                  <button className="btn btn-primary ml-auto shadow-orange" onClick={enroll} disabled={busy || !user?.email_verified}>
                    {busy ? 'Un instant…' : session.status === 'full' ? "Rejoindre la liste d'attente" : price ? `Payer ${fcfa(price)}` : "Confirmer l'inscription"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Billet de confirmation (maquette 13f). */
export function EnrollmentTicket() {
  const { id } = useParams()
  const { user } = useAuth()
  const { data, loading } = useApi<any[]>('/api/trainings/mine/')
  useTitle('Inscription confirmée')
  const e = data?.find((x) => String(x.id) === id)
  if (loading) return <div className="container-x"><Spinner /></div>
  if (!e) return <div className="container-x py-10"><ErrorNote error={new Error('Inscription introuvable.')} /></div>
  const s = e.session
  const waitlist = e.status === 'waitlist'
  const d = new Date(s.starts_at)
  return (
    <div className="hero-grad relative grid min-h-[calc(100vh-120px)] place-items-center overflow-hidden px-4 py-14">
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      <div className="relative w-full max-w-[520px] overflow-hidden rounded-[22px] bg-[var(--card)] shadow-[0_50px_90px_-30px_rgba(4,28,92,.8)]">
        <div className="p-8 text-center">
          <span className={`mx-auto grid h-[72px] w-[72px] place-items-center rounded-full text-[34px] text-white ${waitlist ? 'bg-blue shadow-[0_0_0_10px_#E6F0FA]' : 'bg-ok shadow-[0_0_0_10px_#DCFCE7]'}`}><Icon name={waitlist ? 'hourglass-end' : 'check'} /></span>
          <h1 className="mt-5 text-[26px] md:text-[28px]">{waitlist ? "Vous êtes sur liste d'attente" : e.status === 'pending_payment' ? 'Paiement en attente' : 'Votre place est réservée !'}</h1>
          <p className="mt-2.5 text-sm text-muted">{waitlist ? 'Nous vous écrivons dès qu\u2019une place se libère.' : 'Confirmation envoyée par e-mail. Rappels la veille et 1 h avant.'}</p>
        </div>
        <div className="relative mx-6 border-t-2 border-dashed border-line">
          <span className="absolute -top-3 -left-9 h-6 w-6 rounded-full bg-bright" /><span className="absolute -top-3 -right-9 h-6 w-6 rounded-full bg-bright" />
        </div>
        <dl className="grid grid-cols-2 gap-4 px-8 pt-6 pb-8 text-sm">
          <div><dt className="text-xs text-muted">Formation</dt><dd className="font-bold">{s.training.title}</dd></div>
          <div><dt className="text-xs text-muted">Participant</dt><dd className="font-bold">{user?.full_name}</dd></div>
          <div><dt className="text-xs text-muted">Date</dt><dd className="font-bold">{d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })} · {d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</dd></div>
          <div><dt className="text-xs text-muted">Lieu</dt><dd className="font-bold">{s.location || 'En ligne'}</dd></div>
          <div><dt className="text-xs text-muted">N° inscription</dt><dd className="font-bold">{e.number}</dd></div>
          <div><dt className="text-xs text-muted">Payé</dt><dd className="font-bold text-ok">{e.paid ? `${e.paid.amount.toLocaleString('fr-FR')} F · ${e.paid.method.split(' ')[0]}` : s.effective_price ? '—' : 'Gratuit'}</dd></div>
          <div className="col-span-2 mt-1.5 flex flex-wrap gap-2.5">
            {!waitlist && <button className="btn btn-blue flex-1" onClick={() => downloadIcs({ title: s.training.title, start: s.starts_at, end: s.ends_at, location: s.location || e.meeting_link, description: `Inscription ${e.number}` })}>Ajouter au calendrier</button>}
            <Link to="/compte/formations" className="btn btn-ghost flex-1">Mes formations</Link>
          </div>
        </dl>
      </div>
    </div>
  )
}
