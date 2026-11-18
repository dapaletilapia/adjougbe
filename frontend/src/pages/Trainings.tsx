import { useState } from 'react'
import { PageHero } from '../components/PageHero'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DynamicForm } from '../components/DynamicForm'
import { Empty, ErrorNote, Icon, Spinner } from '../components/ui'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateFr, downloadIcs, fcfa } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'
import { PaymentPicker } from './Cart'


const STATUS_TXT: Record<string, [string, string]> = {
  open: ['Ouvertes', 'chip-ok'], full: ['Complet', 'chip-orange'], upcoming: ['Bientôt', 'chip-blue'], done: ['Terminée', ''], cancelled: ['Annulée', 'chip-danger'],
}

function DateBadge({ iso, big = false }: { iso: string; big?: boolean }) {
  const d = new Date(iso)
  return (
    <span className={`grid place-content-center rounded-xl bg-white text-center text-ink shadow-[0_10px_20px_-10px_rgba(4,28,92,.5)] ${big ? 'h-16 w-16' : 'h-14 w-14'}`}>
      <b className="text-xl leading-none">{d.getDate()}</b>
      <span className="text-[10px] font-semibold text-orange uppercase">{d.toLocaleDateString('fr-FR', { month: 'short' })}</span>
    </span>
  )
}

export default function Trainings() {
  useTitle('Formations')
  const [filter, setFilter] = useState('upcoming')
  const { data, loading } = useApi<any[]>('/api/trainings/')
  const list = (data ?? []).filter((t) => {
    if (filter === 'done') return !t.next_session
    if (!t.next_session) return false
    if (filter === 'onsite') return t.format === 'onsite'
    if (filter === 'online') return t.format === 'online'
    if (filter === 'free') return t.is_free
    return true
  })
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Formations']]} eyebrow="PRÉSENTIEL · EN LIGNE" title="Apprendre à" accent="diriger, ensemble."
        text="Masterclass et ateliers animés par Adjougbe, à Abidjan ou en direct en ligne." base="var(--color-paper)" />
      <div className="bg-paper pb-24">
        <div className="container-x relative z-[1] flex flex-wrap gap-2.5">
          {[['upcoming', 'À venir'], ['onsite', 'Présentiel'], ['online', 'En ligne'], ['free', 'Gratuites'], ['done', 'Terminées']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v}
              className={`rounded-full px-[18px] py-2.5 text-sm font-medium ${filter === v ? 'bg-ink text-white' : 'bg-[var(--card)]'}`}>{l}</button>
          ))}
        </div>
        <div className="container-x mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {loading && <Spinner />}
          {!loading && !list.length && <Empty title="Aucune formation pour ce filtre">Inscrivez-vous à la newsletter pour être prévenu des prochaines sessions.</Empty>}
          {list.map((t) => {
            const s = t.next_session
            const taken = s ? s.capacity - s.seats_left : 0
            const [lbl, tone] = STATUS_TXT[s?.status ?? 'done']
            return (
              <article key={t.id} className="card flex flex-col overflow-hidden">
                <Link to={`/formations/${t.slug}`} className="relative block h-44">
                  {t.cover ? <img src={t.cover} alt="" className="h-full w-full object-cover" /> : <div className="hero-grad h-full w-full"><img src="/mark-mono.svg" alt="" className="absolute -right-6 -bottom-8 h-40 opacity-10" /></div>}
                  {s && <span className="absolute top-4 left-4"><DateBadge iso={s.starts_at} /></span>}
                  <span className={`chip ${tone} absolute top-4 right-4`}>{lbl}</span>
                </Link>
                <div className="flex flex-1 flex-col p-5">
                  <p className="text-xs text-muted">{t.format_label}{s?.location ? ` · ${s.location.split(',')[0]}` : ''}{t.duration_label ? ` · ${t.duration_label}` : ''}</p>
                  <h2 className="mt-1.5 text-lg leading-snug"><Link to={`/formations/${t.slug}`}>{t.title}</Link></h2>
                  {s && (
                    <>
                      <div className="mt-4 h-1.5 rounded-full bg-[#EFF0F2]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (taken / s.capacity) * 100)}%`, background: s.status === 'full' ? '#FF6B29' : 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} /></div>
                      <div className="mt-1.5 flex justify-between text-xs text-muted"><span>{taken} / {s.capacity} inscrits</span><span>{s.status === 'full' ? 'Complet' : `${s.seats_left} places`}</span></div>
                    </>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-5">
                    <b className="text-lg">{t.price_xof ? `${t.price_xof.toLocaleString('fr-FR')} F` : 'Gratuit'}</b>
                    {s ? <Link to={`/formations/${t.slug}`} className={`btn btn-sm ${s.status === 'full' ? 'btn-ghost' : 'btn-primary'}`}>{s.status === 'full' ? "Liste d'attente" : "S'inscrire"}</Link>
                      : <Link to={`/formations/${t.slug}`} className="btn btn-ghost btn-sm">Voir</Link>}
                  </div>
                </div>
              </article>
            )
          })}
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
              {[['calendar', 'Date', dateFr(s.starts_at)], ['clock', 'Horaires', `${time(s.starts_at)} – ${time(s.ends_at)}`], ['marker', 'Lieu', s.location || 'En ligne (lien envoyé aux inscrits)']].map(([i, k, v]) => (
                <div key={k} className="card flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-blue-tint text-blue"><Icon name={i} /></span>
                  <span><dt className="text-xs text-muted">{k}</dt><dd className="text-sm font-semibold">{v}</dd></span>
                </div>
              ))}
            </dl>
          )}
          {t.objectives?.length > 0 && (
            <section>
              <div className="kicker">Objectifs</div>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {t.objectives.map((o: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 rounded-xl bg-paper p-4"><span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-ok text-xs text-white"><Icon name="check" /></span>{o}</li>
                ))}
              </ul>
            </section>
          )}
          {t.audience && <section><div className="kicker">Pour qui ?</div><p className="mt-3 text-ink-soft">{t.audience}</p></section>}
          {t.program?.length > 0 && (
            <section>
              <div className="kicker">Programme</div>
              <ol className="relative mt-5 grid gap-6 pl-8">
                <span className="absolute top-2 bottom-2 left-[9px] w-0.5" style={{ background: 'linear-gradient(180deg,#1560DC,#E6F0FA)' }} />
                {t.program.map((m: any, i: number) => (
                  <li key={i} className="relative">
                    <span className="absolute top-1 -left-8 h-[18px] w-[18px] rounded-full border-4 border-[var(--card)] bg-orange shadow-[0_0_0_2px_#FFEDE4]" />
                    <b className="text-[15px]">{m.title}</b>
                    {m.detail && <p className="text-sm text-muted">{m.detail}</p>}
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
            <section><div className="kicker">Questions fréquentes</div>
              {t.faq.map((f: any, i: number) => (
                <details key={i} className="border-b border-line py-4"><summary className="cursor-pointer font-semibold">{f.q}</summary><p className="mt-2 text-muted">{f.a}</p></details>
              ))}
            </section>
          )}
        </div>
        <aside className="grid content-start gap-4 lg:sticky lg:top-32 lg:-mt-28">
          <div className="card relative z-[1] overflow-hidden">
            <div className="hero-grad relative h-36">
              {t.cover && <img src={t.cover} alt="" className="h-full w-full object-cover" />}
              {s && <span className="absolute bottom-4 left-5"><DateBadge iso={s.starts_at} big /></span>}
            </div>
            <div className="grid gap-4 p-6">
              <div className="flex items-center justify-between">
                <b className="text-[28px]">{t.price_xof ? fcfa(t.price_xof) : 'Gratuit'}</b>
                {s && <span className={`chip ${STATUS_TXT[s.status][1]}`}>{STATUS_TXT[s.status][0]}</span>}
              </div>
              {s ? (
                <>
                  <div>
                    <div className="flex justify-between text-sm"><span className="text-muted">Places restantes</span><b>{s.seats_left} / {s.capacity}</b></div>
                    <div className="mt-2 h-2 rounded-full bg-[#EFF0F2]"><div className="h-full rounded-full" style={{ width: `${((s.capacity - s.seats_left) / s.capacity) * 100}%`, background: 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} /></div>
                  </div>
                  {['open', 'full'].includes(s.status) && (
                    <Link to={`/formations/${t.slug}/inscription/${s.id}`} className="btn btn-primary shadow-orange">{s.status === 'full' ? "Rejoindre la liste d'attente" : 'Réserver ma place'}</Link>
                  )}
                </>
              ) : <p className="text-sm text-muted">Aucune session programmée. Inscrivez-vous à la newsletter pour être prévenu.</p>}
              {open.length > 1 && (
                <div className="grid gap-2 border-t border-line pt-4 text-sm">
                  <span className="text-muted">Autres dates</span>
                  {open.slice(1).map((x: any) => <Link key={x.id} to={`/formations/${t.slug}/inscription/${x.id}`} className="flex justify-between font-medium hover:text-blue"><span>{dateFr(x.starts_at)}</span><span>{x.seats_left} places</span></Link>)}
                </div>
              )}
            </div>
          </div>
          <div className="card flex items-center gap-3 p-4">
            <img src="/mark-color.svg" alt="" className="h-12 w-12 rounded-full bg-paper p-1.5" />
            <span><span className="block text-xs text-muted">Formateur</span><b>{t.trainer}</b></span>
          </div>
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
                <div className={`mt-2 text-[13px] ${done ? 'font-semibold text-blue' : active ? 'font-semibold' : 'text-faint'}`}>{done ? '✓' : `${n} ·`} {l}</div>
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
