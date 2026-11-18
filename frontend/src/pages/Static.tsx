import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { DynamicForm } from '../components/DynamicForm'
import { PageHero } from '../components/PageHero'
import { Icon, Spinner, WorkCover } from '../components/ui'
import { post } from '../lib/api'
import { dateFr } from '../lib/format'
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
          <p className="mt-5 rounded-[14px] bg-paper p-4 text-[13px] leading-relaxed text-ink-soft">Exercez vos droits d'accès et de suppression depuis <Link to="/compte" className="font-semibold text-blue">Mon espace → Profil</Link>.</p>
        </aside>
        <div className="max-w-[760px]">
          {heads.length > 1 && (
            <nav className="mb-7 flex flex-wrap gap-2.5 text-[13px]" aria-label="Sections">
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

/** À propos (maquette 11g) : biographie éditable dans le Studio + sémiologie du logo. */
function About({ html, loading }: { html?: string; loading: boolean }) {
  const { data } = useApi('/api/blog/home/')
  const st = data?.stats
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['À propos']]} eyebrow="POSSUMUS · NOUS POUVONS" title="Écrire et former pour" accent="faire grandir les autres."
        text="Auteur et formateur basé à Abidjan, Adjougbe accompagne celles et ceux qui veulent diriger leur vie." />
      <section className="container-x grid items-center gap-12 pb-20 lg:grid-cols-[1fr_1.1fr]">
        <div className="relative mx-auto aspect-square w-full max-w-[460px]">
          <div className="absolute inset-0 rounded-full shadow-[0_40px_80px_-30px_rgba(21,96,220,.7)]" style={{ background: 'radial-gradient(circle at 35% 30%,#3FA2FF,#1560DC 55%,#0A3A9E)' }} />
          <img src="/auteur-hero.webp" alt="Adjougbe" className="absolute bottom-0 left-1/2 h-[104%] w-auto max-w-none -translate-x-1/2 rounded-b-full" onError={(e) => { (e.target as HTMLImageElement).src = '/mark-mono.svg'; (e.target as HTMLImageElement).className = 'absolute inset-[22%] h-[56%] w-[56%] opacity-90' }} />
        </div>
        <div>
          <div className="kicker">Son histoire</div>
          {loading ? <Spinner /> : <div className="prose-adj mt-3" dangerouslySetInnerHTML={{ __html: (html ?? '').replace(/^<h2>[^<]*<\/h2>/, '') }} />}
          {st && (
            <dl className="mt-8 grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-4">
              {([[st.series, 'séries publiées', 1], [st.readers, 'lecteurs', 50], [st.trainings, 'formations animées', 1]] as [number, string, number][]).filter(([n, , min]) => n >= min).map(([n, l]) => (
                <div key={l as string} className="rounded-2xl bg-paper p-4 text-center">
                  <dd className="text-[26px] font-bold text-blue">{Number(n).toLocaleString('fr-FR')}</dd><dt className="text-xs text-muted">{l}</dt>
                </div>
              ))}
            </dl>
          )}
        </div>
      </section>
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

export function Contact() {
  useTitle('Contact')
  const { data, loading } = useApi('/api/forms/contact/')
  const site = useSettings<{ contact_email: string; whatsapp_number: string }>()
  const s = site.data
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Contact']]} eyebrow="PARLONS" title="Une question, une conférence," accent="un projet ?"
        text="Dédicaces, presse, formations en entreprise : réponse sous 48 h, du lundi au vendredi." base="var(--color-paper)" />
      <div className="bg-paper pb-24">
        <div className="container-x grid gap-8 lg:grid-cols-[360px_1fr]">
          <div className="grid content-start gap-4">
            {s?.contact_email && <ContactCard icon="envelope" label="E-mail" value={s.contact_email} href={`mailto:${s.contact_email}`} />}
            {s?.whatsapp_number && <ContactCard icon="phone-call" label="WhatsApp" value={`+${s.whatsapp_number}`} href={`https://wa.me/${s.whatsapp_number}`} />}
            <ContactCard icon="marker" label="Adresse" value="Abidjan, Côte d'Ivoire" />
          </div>
          <div className="card p-6 md:p-8">
            <h2 className="mb-6 text-2xl">Envoyer un message</h2>
            {loading ? <Spinner /> : data && <DynamicForm form={data} />}
          </div>
        </div>
      </div>
    </>
  )
}

function ContactCard({ icon, label, value, href }: { icon: string; label: string; value: string; href?: string }) {
  const body = (
    <>
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-blue-tint text-lg text-blue"><Icon name={icon} /></span>
      <span><span className="block text-xs text-muted">{label}</span><b className="break-all">{value}</b></span>
    </>
  )
  return href ? <a href={href} className="card flex items-center gap-4 p-5 hover:ring-2 hover:ring-blue-tint">{body}</a> : <div className="card flex items-center gap-4 p-5">{body}</div>
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
      <div className="relative text-[110px] leading-none font-extrabold tracking-[-0.04em] [text-shadow:0_20px_60px_rgba(4,28,92,.6)] md:text-[160px]">4<span className="text-orange">0</span>4</div>
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
          <div className="flex flex-wrap gap-2.5">
            {[['all', `Tout · ${n}`], ['works', `Œuvres · ${data?.works.length ?? 0}`], ['posts', `Articles · ${data?.posts.length ?? 0}`], ['trainings', `Formations · ${data?.trainings.length ?? 0}`]].map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} aria-pressed={tab === k} className={`rounded-full px-[18px] py-2.5 text-sm ${tab === k ? 'bg-ink font-semibold text-white' : 'bg-[var(--card)]'}`}>{l}</button>
            ))}
          </div>
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
                      {t.next ? <><b className="text-[26px] leading-none">{new Date(t.next.starts_at).getDate()}</b><span className="text-[11px] font-semibold text-[#FF8A5B] uppercase">{new Date(t.next.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</span></> : <Icon name="graduation-cap" className="text-2xl" />}
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
