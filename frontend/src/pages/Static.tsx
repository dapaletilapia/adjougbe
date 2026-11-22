import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DynamicForm } from '../components/DynamicForm'
import { FilterBar } from '../components/FilterBar'
import { PageHero } from '../components/PageHero'
import { Icon, Spinner, WorkCover } from '../components/ui'
import { post } from '../lib/api'
import { dateFr, formatPhone } from '../lib/format'
import { useApi, useSettings, useTitle } from '../lib/hooks'

const LEGAL: Record<string, [string, string]> = {
  cgu: ['Conditions générales', 'Les règles d\u2019utilisation du site, des achats et de la lecture en ligne.'],
  confidentialite: ['Confidentialité', 'Quelles données nous collectons, pourquoi, et comment exercer vos droits.'],
  'mentions-legales': ['Mentions légales', 'Éditeur du site, hébergement et propriété intellectuelle.'],
}

const LEGAL_LINKS: [string, string][] = [['cgu', 'Conditions générales'], ['confidentialite', 'Politique de confidentialité'], ['mentions-legales', 'Mentions légales']]

export function CmsPage({ pageKey, title }: { pageKey: string; title: string }) {
  useTitle(title)
  const { data, loading } = useApi(`/api/pages/${pageKey}/`)
  if (pageKey === 'a-propos') return <About html={data?.html} loading={loading} />
  const [t, intro] = LEGAL[pageKey] ?? [title, '']
  const [head, ...tail] = t.split(' ')
  // Ancres de sections (h2/h3) et numérotation des titres pour la navigation (maquette 16a).
  const raw = (data?.html ?? '').replace(/^<h2>[^<]*<\/h2>/, '')
  const heads: string[] = []
  const html = raw.replace(/<h([23])>(.*?)<\/h\1>/g, (_m: string, l: string, txt: string) => {
    heads.push(txt.replace(/<[^>]+>/g, ''))
    return `<h${l} id="s-${heads.length}">${txt}</h${l}>`
  })
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Informations légales']]} eyebrow="INFORMATIONS LÉGALES" title={head} accent={tail.join(' ')} text={intro} />
      <div className="container-x grid gap-10 pb-24 lg:grid-cols-[280px_1fr] lg:gap-16">
        <aside className="grid content-start gap-1.5 text-sm">
          {LEGAL_LINKS.map(([k, l]) => (
            <Link key={k} to={`/${k}`} className={`rounded-[10px] px-4 py-3 ${k === pageKey ? 'bg-blue font-semibold text-white' : 'hover:bg-paper'}`}>{l}</Link>
          ))}
          <p className="mt-5 rounded-[14px] bg-paper p-4 text-[14px] leading-relaxed text-ink-soft">Exercez vos droits d'accès et de suppression depuis <Link to="/compte" className="font-semibold text-blue">Mon espace → Profil</Link>.</p>
        </aside>
        <div className="max-w-[760px]">
          {heads.length > 1 && (
            <nav className="mb-7 flex flex-wrap gap-2.5 text-[14px]" aria-label="Sections">
              {heads.map((h, i) => <a key={i} href={`#s-${i + 1}`} className={`rounded-lg px-3 py-1.5 ${i === 0 ? 'bg-blue-tint text-blue' : 'bg-paper'}`}>{h}</a>)}
            </nav>
          )}
          {loading ? <Spinner /> : <div className="prose-adj" dangerouslySetInnerHTML={{ __html: html }} />}
        </div>
      </div>
    </>
  )
}

const SEMIO: [string, string, string][] = [
  ['A', 'La lettre A', 'Symbole d\u2019identité.'],
  ['crown', 'La couronne', 'Grandeur et excellence.'],
  ['pencil', 'Le crayon', 'Humilité, apprendre par l\u2019erreur.'],
  ['users', 'L\u2019amitié', 'Solidarité et relations humaines.'],
]

/** « Inviter Adjougbe » : la page contact étant masquée, la demande part sur WhatsApp (ou par e-mail à défaut). */
function InviteLink({ className }: { className: string }) {
  const { data } = useSettings<{ contact_email: string; whatsapp_number: string }>()
  const msg = "Bonjour, je souhaite inviter Adjougbe pour une formation ou une intervention."
  const href = data?.whatsapp_number ? `https://wa.me/${data.whatsapp_number}?text=${encodeURIComponent(msg)}`
    : data?.contact_email ? `mailto:${data.contact_email}?subject=${encodeURIComponent('Invitation')}&body=${encodeURIComponent(msg)}` : ''
  if (!href) return null
  return <a href={href} target="_blank" rel="noopener noreferrer" className={className}>Inviter Adjougbe</a>
}

/** Domaines de formation et d'intervention, gérés dans Studio → Paramètres → Pages. */
function Expertise() {
  const { data, loading } = useApi<{ id: number; title: string; description: string; icon: string }[]>('/api/expertise/')
  if (loading) return null  // pas d'ancre avant les données : le défilement vers #domaines attend la vraie section
  if (!data?.length) return <span id="domaines" />
  return (
    <section id="domaines" aria-labelledby="domaines-titre" className="scroll-mt-28 border-t border-line py-16 md:py-20">
      <div className="container-x grid max-w-[1120px] gap-10 lg:grid-cols-[340px_minmax(0,1fr)] lg:gap-16">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 id="domaines-titre" className="text-[28px] leading-tight md:text-[32px]">Domaines d'intervention</h2>
          <p className="mt-3 text-[15.5px] leading-relaxed text-muted">Les sujets sur lesquels Adjougbe forme, anime des ateliers et intervient en conférence : pour ses propres formations comme pour celles d'écoles, d'entreprises et d'associations.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <InviteLink className="btn btn-primary shadow-orange" />
            <Link to="/formations" className="btn btn-ghost">Voir les formations</Link>
          </div>
        </div>
        <ul className="grid gap-x-10 sm:grid-cols-2">
          {data.map((a) => (
            <li key={a.id} className="flex gap-4 border-b border-line py-6">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-blue-tint text-[20px] text-blue"><Icon name={a.icon} /></span>
              <span><b className="block text-[17px] leading-snug">{a.title}</b>{a.description && <span className="mt-1.5 block text-[14.5px] leading-relaxed text-muted">{a.description}</span>}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** À propos (maquette 11g) : biographie éditable dans le Studio + sémiologie du logo. */
function About({ html, loading }: { html?: string; loading: boolean }) {
  const { data } = useApi('/api/blog/home/')
  const st = data?.stats
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['À propos']]} eyebrow="POSSUMUS · NOUS POUVONS" title="Écrire et former pour" accent="faire grandir les autres."
        text="Auteur et formateur basé à Abidjan, Adjougbe accompagne celles et ceux qui veulent diriger leur vie." />
      <section className="container-x grid max-w-[1120px] items-start gap-10 pb-20 lg:grid-cols-[360px_minmax(0,1fr)] lg:gap-16">
        <aside className="lg:sticky lg:top-28">
          <figure className="card overflow-hidden">
            <div className="hero-grad relative aspect-[4/5] overflow-hidden">
              <span className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '72px 72px' }} />
              <img src="/auteur-hero.webp" alt="Adjougbe" className="absolute bottom-0 left-1/2 h-[94%] w-auto max-w-none -translate-x-1/2 object-contain" />
            </div>
            <figcaption className="p-5">
              <b className="block text-[19px]">Adjougbe</b>
              <span className="text-[14.5px] text-muted">Auteur et formateur · Abidjan</span>
              {st && (
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
                  {([[st.series, 'séries'], [st.readers, 'lecteurs'], [st.trainings, 'formations']] as [number, string][]).map(([n, l]) => (
                    <div key={l}><dd className="text-[20px] font-bold text-blue">{Number(n).toLocaleString('fr-FR')}</dd><dt className="text-[13px] text-muted">{l}</dt></div>
                  ))}
                </dl>
              )}
            </figcaption>
          </figure>
        </aside>
        <div className="max-w-[680px]">
          <h2 className="text-[28px] md:text-[32px]">Son histoire</h2>
          {loading ? <Spinner /> : <div className="prose-adj about-prose mt-5" dangerouslySetInnerHTML={{ __html: (html ?? '').replace(/^<h2>[^<]*<\/h2>/, '') }} />}
          <InviteLink className="btn btn-blue mt-8" />
        </div>
      </section>
      {!loading && <Expertise />}
      <section className="bg-paper py-20">
        <div className="container-x grid items-center gap-12 lg:grid-cols-[auto_1fr]">
          <div className="hero-grad relative mx-auto grid h-64 w-64 place-items-center rounded-[28px] shadow-[0_30px_60px_-24px_rgba(4,28,92,.7)]">
            <img src="/mark-mono.svg" alt="" className="h-40 w-40" style={{ filter: 'none' }} />
          </div>
          <div>
            <div className="kicker">Sémiologie du logo</div>
            <h2 className="mt-2 text-[30px]">A = Crayon + Couronne + Amitié. <span className="text-blue">Ohene.</span></h2>
            <p className="mt-3 max-w-2xl text-muted">Le symbole africain Ohene évoque le leadership et la responsabilité. Le logo porte des valeurs d'excellence, d'humilité, de leadership et d'entraide, au service de la réussite individuelle et collective.</p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {SEMIO.map(([i, t, d]) => (
                <div key={t} className="card flex items-center gap-3 p-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-orange-tint text-lg font-bold text-orange">{i.length === 1 ? i : <Icon name={i} />}</span>
                  <span><b className="block text-sm">{t}</b><span className="text-sm text-muted">{d}</span></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/** Sujet passé dans l'adresse (?objet=…) : présélectionné dans le premier champ à choix qui le propose. */
function prefill(form: { fields: { key: string; options: string[] }[] }, objet: string) {
  const f = objet ? form.fields.find((x) => x.options?.some((o) => o.toLowerCase() === objet.toLowerCase())) : undefined
  return f ? { [f.key]: f.options.find((o) => o.toLowerCase() === objet.toLowerCase())! } : undefined
}

export function Contact() {
  useTitle('Contact')
  const { data, loading } = useApi('/api/forms/contact/')
  const objet = useSearchParams()[0].get('objet') ?? ''
  const site = useSettings<{ contact_email: string; whatsapp_number: string }>()
  const s = site.data
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Contact']]} eyebrow="PARLONS" title="Une question, une conférence," accent="un projet ?"
        text="Dédicaces, presse, formations en entreprise : réponse sous 48 h, du lundi au vendredi." base="var(--color-paper)" />
      <div className="bg-paper pb-24">
        <div className="container-x grid max-w-[1120px] items-start gap-8 lg:grid-cols-[380px_minmax(0,1fr)] lg:gap-10">
          <aside className="card-navy grid gap-6 p-7 md:p-8">
            <span className="pointer-events-none absolute inset-0 opacity-[.05]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
            <div className="relative">
              <h2 className="text-[24px] text-white">Le plus rapide : WhatsApp</h2>
              <p className="mt-2 text-white/80">Une question sur une commande, un accès ou une formation ? Écrivez-nous, nous répondons dans la journée.</p>
            </div>
            {s?.whatsapp_number && (
              <a href={`https://wa.me/${s.whatsapp_number}`} target="_blank" rel="noopener noreferrer" className="btn relative !justify-start gap-3 !py-3.5 text-white" style={{ background: '#25D366' }}>
                <i className="fi fi-brands-whatsapp text-xl" aria-hidden="true" />
                <span className="text-left leading-tight"><b className="block">Discuter sur WhatsApp</b><span className="text-[13px] font-normal opacity-90">{formatPhone(s.whatsapp_number)}</span></span>
              </a>
            )}
            <ul className="relative grid gap-4 border-t border-white/15 pt-6 text-[15px]">
              {s?.contact_email && <li className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12"><Icon name="envelope" /></span><a href={`mailto:${s.contact_email}`} className="break-all hover:underline">{s.contact_email}</a></li>}
              <li className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12"><Icon name="marker" /></span>Abidjan, Côte d'Ivoire</li>
              <li className="flex items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/12"><Icon name="clock" /></span>Réponse sous 48 h, du lundi au vendredi</li>
            </ul>
            <div className="relative border-t border-white/15 pt-6">
              <b className="block text-[15px]">On nous écrit souvent pour</b>
              <div className="mt-3 flex flex-wrap gap-2">
                {['Une dédicace', 'Une interview', 'Une conférence', 'Une formation en entreprise'].map((x) => <span key={x} className="rounded-full bg-white/12 px-3 py-1.5 text-[14px]">{x}</span>)}
              </div>
            </div>
          </aside>
          <div className="card p-6 md:p-10">
            <h2 className="text-[26px]">Envoyer un message</h2>
            <p className="mt-1.5 mb-7 text-muted">Tous les champs marqués d'un astérisque sont obligatoires.</p>
            {loading ? <Spinner /> : data && <DynamicForm key={objet} form={data} initial={prefill(data, objet)} />}
          </div>
        </div>
      </div>
    </>
  )
}

export function CertificateCheck() {
  const { code } = useParams()
  useTitle('Vérification d’attestation')
  const { data, loading, error } = useApi(`/api/trainings/certificates/${code}/`)
  return (
    <div className="container-x max-w-xl py-16">
      <h1 className="mb-6 text-3xl">Vérification d'attestation</h1>
      {loading ? <Spinner /> : error ? (
        <p className="rounded-xl bg-danger/10 px-5 py-4 text-danger">Aucune attestation ne correspond au code {code}.</p>
      ) : (
        <div className="rounded-xl bg-ok/10 px-5 py-4">
          <p className="font-semibold text-ok">Attestation authentique</p>
          <p className="mt-2"><strong>{data.name}</strong> a suivi « {data.training} » le {dateFr(data.date)}.</p>
        </div>
      )}
    </div>
  )
}

export function Unsubscribe() {
  const [params] = useSearchParams()
  const [ok, setOk] = useState<boolean | null>(null)
  useEffect(() => { post('/api/newsletter/unsubscribe/', { token: params.get('token') }).then((r) => setOk(r.ok)) }, [params])
  return (
    <div className="container-x max-w-xl py-16">
      <h1 className="text-3xl">Désinscription</h1>
      <p className="mt-4">{ok === null ? '…' : ok ? 'Vous ne recevrez plus nos e-mails.' : 'Ce lien n’est plus valide.'}</p>
    </div>
  )
}

export function NotFound() {
  useTitle('Page introuvable')
  return (
    <div className="hero-grad relative flex min-h-[calc(100vh-120px)] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center text-white">
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      <div className="relative text-[110px] leading-none font-extrabold tracking-[-0.04em] [text-shadow:0_20px_60px_rgba(4,28,92,.6)] md:text-[160px]">4<span className="text-peach">0</span>4</div>
      <h1 className="relative mt-3 text-[26px] md:text-[28px]">Cette page a été raturée.</h1>
      <p className="relative mt-2 opacity-85">Le crayon a une gomme : revenons à l'essentiel.</p>
      <div className="relative mt-8 flex flex-wrap justify-center gap-3">
        <Link to="/" className="btn btn-primary">Retour à l'accueil</Link>
        <Link to="/boutique" className="btn border border-white/30 bg-white/14 text-white">Voir les œuvres</Link>
      </div>
    </div>
  )
}

export function Maintenance({ message }: { message: string }) {
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="max-w-md text-center">
        <img src="/mark-color.svg" alt="" className="mx-auto h-20" />
        <h1 className="mt-6 text-3xl">Petite pause technique</h1>
        <p className="mt-3 text-muted">{message || 'Le site revient dans quelques minutes.'}</p>
      </div>
    </div>
  )
}


const mark = (text: string, q: string) => {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0) return text
  return <>{text.slice(0, i)}<mark className="rounded-[3px] bg-orange-tint px-0.5 text-[#C2410C]">{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>
}

/** Recherche globale : œuvres, articles, formations (maquette 16b). */
export function Search() {
  const [params, setParams] = useSearchParams()
  const q = params.get('q') ?? ''
  const [v, setV] = useState(q)
  const [tab, setTab] = useState('all')
  const { data, loading } = useApi(q.length >= 2 ? `/api/search/?q=${encodeURIComponent(q)}` : null, [q])
  useTitle(q ? `Recherche : ${q}` : 'Recherche')
  const n = data ? data.works.length + data.posts.length + data.trainings.length : 0
  const show = (k: string) => tab === 'all' || tab === k
  return (
    <div className="bg-paper pb-24">
      <section className="hero-grad relative overflow-hidden pt-12 pb-24 text-white">
        <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
        <div className="container-x relative">
          <div className="text-sm opacity-80">{q ? 'Résultats pour' : 'Rechercher dans les œuvres, le blog et les formations'}</div>
          <form onSubmit={(e) => { e.preventDefault(); setParams(v.trim() ? { q: v.trim() } : {}) }}
            className="mt-3 flex max-w-[780px] items-center gap-3 rounded-[14px] bg-white py-2 pr-2 pl-5 shadow-[0_30px_60px_-24px_rgba(4,28,92,.7)]">
            <Icon name="search" className="text-lg text-bright" />
            <label htmlFor="q-global" className="sr-only">Rechercher</label>
            <input id="q-global" autoFocus className="min-w-0 flex-1 bg-transparent py-2 text-[17px] text-ink outline-none" value={v} onChange={(e) => setV(e.target.value)} placeholder="leader, punchline, formation…" />
            <button className="btn btn-primary">Rechercher</button>
          </form>
        </div>
        <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-12 w-full md:h-20" aria-hidden="true"><path d="M0 0 Q720 160 1440 0 L1440 80 L0 80 Z" fill="var(--color-paper)" /></svg>
      </section>
      {q && (
        <div className="container-x relative z-[1]">
          <FilterBar label="Type de résultat" value={tab} onChange={setTab}
            options={[{ value: 'all', label: 'Tout', count: n }, { value: 'works', label: 'Œuvres', count: data?.works.length ?? 0 }, { value: 'posts', label: 'Articles', count: data?.posts.length ?? 0 }, { value: 'trainings', label: 'Formations', count: data?.trainings.length ?? 0 }]} />
          {loading ? <Spinner /> : !n ? <p className="card mt-7 p-8 text-muted">Aucun résultat pour « {q} ». Essayez un autre mot.</p> : (
            <ul className="mt-7 grid gap-3.5">
              {show('works') && data.works.map((w: any) => (
                <li key={w.slug}>
                  <Link to={`/livres/${w.slug}`} className="card flex items-center gap-5 p-5 hover:ring-2 hover:ring-blue-tint">
                    <div className="w-[60px] shrink-0 md:w-[70px]"><WorkCover work={w} /></div>
                    <div className="min-w-0 flex-1"><span className="text-xs font-semibold text-blue">ŒUVRE</span><b className="mt-1 block text-lg">{mark(w.title, q)}</b><p className="mt-1 line-clamp-2 text-sm text-muted">{mark(w.snippet, q)}</p></div>
                    <span className="btn btn-primary btn-sm">{w.access_mode === 'paid' ? `${w.price_xof.toLocaleString('fr-FR')} F` : 'Offert'}</span>
                  </Link>
                </li>
              ))}
              {show('posts') && data.posts.map((p: any) => (
                <li key={p.slug}>
                  <Link to={`/blog/${p.slug}`} className="card flex items-center gap-5 p-5 hover:ring-2 hover:ring-blue-tint">
                    {p.cover ? <img src={p.cover} alt="" className="h-20 w-[120px] shrink-0 rounded-[10px] object-cover" /> : <span className="hero-grad grid h-20 w-[120px] shrink-0 place-items-center rounded-[10px] text-xl text-white">«</span>}
                    <div className="min-w-0 flex-1"><span className="text-xs font-semibold text-orange uppercase">Article · {p.category}</span><b className="mt-1 block text-lg">{mark(p.kind === 'punchline' ? `« ${p.quote} »` : p.title, q)}</b>{p.kind !== 'punchline' && <p className="mt-1 line-clamp-1 text-sm text-muted">{mark(p.snippet, q)}</p>}</div>
                    <span className="text-sm font-semibold text-blue">Lire →</span>
                  </Link>
                </li>
              ))}
              {show('trainings') && data.trainings.map((t: any) => (
                <li key={t.slug}>
                  <Link to={`/formations/${t.slug}`} className="card flex items-center gap-5 p-5 hover:ring-2 hover:ring-blue-tint">
                    <span className="flex h-20 w-[120px] shrink-0 flex-col items-center justify-center rounded-[10px] text-white" style={{ background: 'linear-gradient(135deg,#1560DC,#041C5C)' }}>
                      {t.next ? <><b className="text-[26px] leading-none">{new Date(t.next.starts_at).getDate()}</b><span className="text-[12px] font-semibold text-peach uppercase">{new Date(t.next.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</span></> : <Icon name="graduation-cap" className="text-2xl" />}
                    </span>
                    <div className="min-w-0 flex-1"><span className="text-xs font-semibold text-ok uppercase">Formation · {t.next ? `${t.next.seats_left} places` : t.format}</span><b className="mt-1 block text-lg">{mark(t.title, q)}</b></div>
                    <span className="text-sm font-semibold text-blue">Voir →</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
