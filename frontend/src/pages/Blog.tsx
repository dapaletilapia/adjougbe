import { useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ShareButtons } from '../components/Share'
import { PageHero } from '../components/PageHero'
import { Empty, ErrorNote, Icon, Spinner } from '../components/ui'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateFr } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'

const KINDS = [
  { value: '', label: 'Tout' },
  { value: 'punchline', label: 'Punchlines du jour' },
  { value: 'papo', label: 'Papos de Tiékar' },
  { value: 'article', label: 'Articles' },
  { value: 'media', label: 'Vidéos et audios' },
  { value: 'event', label: 'Annonces' },
]

export default function Blog() {
  useTitle('Blog')
  const [params, setParams] = useSearchParams()
  const kind = params.get('kind') ?? ''
  const cat = params.get('category') ?? ''
  const q = params.get('q') ?? ''
  const page = Number(params.get('page') || 1)
  const [search, setSearch] = useState(q)
  const cats = useApi<any[]>('/api/blog/categories/')
  const { data, loading } = useApi(`/api/blog/posts/?kind=${kind}&category=${cat}&search=${encodeURIComponent(q)}&page=${page}`)
  const upd = (k: string, v: string) => { const p = new URLSearchParams(params); if (v) p.set(k, v); else p.delete(k); p.delete('page'); setParams(p) }
  const posts: any[] = data?.results ?? []
  const [lead, ...rest] = page === 1 && !q ? posts : [null, ...posts]
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Blog']]} eyebrow="LE CARNET" title="Réflexions pour" accent="grandir chaque semaine."
        text="La punchline du jour, des Papos de Tiékar et des articles sur le leadership, l'écriture et l'entraide." />
      <div className="container-x relative z-[1] flex flex-wrap items-center gap-2.5">
        <button onClick={() => { upd('category', ''); upd('kind', '') }} aria-pressed={!cat && !kind} className={`rounded-full px-[18px] py-2.5 text-sm font-medium ${!cat && !kind ? 'bg-ink text-white' : 'bg-paper'}`}>Tous</button>
        {cats.data?.map((c) => (
          <button key={c.id} onClick={() => upd('category', c.slug)} aria-pressed={cat === c.slug} className={`rounded-full px-[18px] py-2.5 text-sm font-medium ${cat === c.slug ? 'bg-ink text-white' : 'bg-paper'}`}>{c.name}</button>
        ))}
        {KINDS.filter((k) => ['punchline', 'papo'].includes(k.value)).map((k) => (
          <button key={k.value} onClick={() => upd('kind', k.value)} aria-pressed={kind === k.value} className={`rounded-full px-[18px] py-2.5 text-sm font-medium ${kind === k.value ? 'bg-orange text-white' : 'bg-orange-tint text-orange-dark'}`}>{k.label}</button>
        ))}
        <form className="relative ml-auto w-full max-w-[300px]" onSubmit={(e) => { e.preventDefault(); upd('q', search) }}>
          <label htmlFor="blog-q" className="sr-only">Rechercher</label>
          <Icon name="search" className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input id="blog-q" className="input !rounded-full !pl-11" placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>
      <div className="container-x mt-10 pb-24">
        {loading ? <Spinner /> : !posts.length ? <Empty title="Rien trouvé">Essayez une autre rubrique ou un autre mot.</Empty> : (
          <>
            {lead && (
              <Link to={`/blog/${lead.slug}`} className="card mb-8 grid overflow-hidden md:grid-cols-[1.1fr_1fr]">
                <div className="hero-grad relative min-h-64">
                  {lead.cover ? <img src={lead.cover} alt="" className="absolute inset-0 h-full w-full object-cover" />
                    : lead.kind === 'punchline' ? <p className="relative p-10 text-2xl leading-snug font-semibold text-white">« {lead.quote} »</p>
                    : <img src="/mark-mono.svg" alt="" className="absolute -right-8 -bottom-10 h-64 opacity-10" />}
                </div>
                <div className="flex flex-col p-7 md:p-10">
                  <div className="flex items-center gap-3 text-xs"><span className="chip chip-orange">À la une</span><span className="font-semibold text-blue">{lead.category?.name ?? lead.kind_label}</span><span className="text-faint">{lead.read_minutes} min</span></div>
                  <h2 className="mt-4 text-[26px] leading-tight md:text-[30px]">{lead.kind === 'punchline' ? 'Punchline du jour' : lead.title}</h2>
                  <p className="mt-3 text-muted">{lead.excerpt}</p>
                  <div className="mt-auto flex items-center gap-3 pt-6 text-sm">
                    <img src="/mark-color.svg" alt="" className="h-9 w-9 rounded-full bg-paper p-1" />
                    <span><b className="block">Adjougbe</b><span className="text-xs text-muted">{dateFr(lead.published_at)}</span></span>
                    <span className="ml-auto font-semibold text-blue">Lire →</span>
                  </div>
                </div>
              </Link>
            )}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {rest.filter(Boolean).map((p: any) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="card group flex flex-col overflow-hidden">
                  {p.kind === 'punchline' ? (
                    <div className="hero-grad p-6 text-white"><p className="text-lg leading-snug font-semibold">« {p.quote} »</p></div>
                  ) : p.cover ? <img src={p.cover} alt="" className="aspect-video w-full object-cover" loading="lazy" /> : null}
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-center gap-3 text-xs"><span className="font-semibold text-blue">{p.category?.name ?? p.kind_label}</span><span className="text-faint">{p.read_minutes} min · {dateFr(p.published_at)}</span></div>
                    {p.kind !== 'punchline' && <h2 className="mt-2 text-lg leading-snug group-hover:text-blue">{p.title}</h2>}
                    {p.kind !== 'punchline' && <p className="mt-1.5 line-clamp-2 text-sm text-muted">{p.excerpt}</p>}
                    {p.members_only && <span className="chip chip-blue mt-3 self-start">Réservé aux membres</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
        {data && (data.next || data.previous) && (
          <div className="mt-10 flex gap-3">
            {data.previous && <button className="btn btn-ghost" onClick={() => { const p = new URLSearchParams(params); p.set('page', String(page - 1)); setParams(p) }}>Plus récents</button>}
            {data.next && <button className="btn btn-ghost" onClick={() => { const p = new URLSearchParams(params); p.set('page', String(page + 1)); setParams(p) }}>Plus anciens</button>}
          </div>
        )}
      </div>
    </>
  )
}

const REACTIONS: Record<string, string> = { love: '❤️', lol: '😂', fire: '🔥', clap: '👏' }

function embed(url: string) {
  const yt = url.match(/(?:youtu\.be\/|v=)([\w-]{11})/)
  if (yt) return <iframe className="aspect-video w-full rounded-2xl" src={`https://www.youtube-nocookie.com/embed/${yt[1]}`} title="Vidéo" allowFullScreen />
  if (/\.(mp3|m4a|ogg|wav)$/i.test(url)) return <audio controls src={url} className="w-full" />
  return <a href={url} className="link" target="_blank" rel="noopener noreferrer">Voir le média</a>
}

export function PostDetail() {
  const { slug } = useParams()
  const { user } = useAuth()
  const { data: p, loading, error, setData } = useApi(`/api/blog/posts/${slug}/`)
  useTitle(p?.title ?? '')
  if (loading) return <div className="container-x"><Spinner /></div>
  if (error || !p) return <div className="container-x py-10"><ErrorNote error={error} /></div>
  const react = async (kind: string) => {
    if (!user) return
    const reactions = await post(`/api/blog/posts/${slug}/react/`, { kind })
    setData({ ...p, reactions })
  }
  const toc = (p.body.match(/<h2[^>]*>(.*?)<\/h2>/g) ?? []).map((h: string) => h.replace(/<[^>]+>/g, ''))
  const html = toc.length ? p.body.replace(/<h2([^>]*)>(.*?)<\/h2>/g, (_m: string, a: string, t: string) => `<h2${a} id="${slugify(t.replace(/<[^>]+>/g, ''))}">${t}</h2>`) : p.body
  const shareText = p.kind === 'punchline' ? `« ${p.quote} » — Adjougbe` : p.title
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Blog', '/blog'], [p.category?.name ?? p.kind_label]]}
        eyebrow={`${(p.category?.name ?? p.kind_label).toUpperCase()} · ${p.read_minutes} MIN`}
        title={p.kind === 'punchline' ? `« ${p.quote} »` : p.title}
        text={`Par ${p.author_name} · ${dateFr(p.published_at)}`} />
      <article className="container-x grid gap-10 pb-24 lg:grid-cols-[180px_1fr_220px]">
        <aside className="order-2 lg:order-none">
          <div className="lg:sticky lg:top-32">
            <div className="mb-3 text-xs font-semibold tracking-[.1em] text-faint">PARTAGER</div>
            <div className="flex flex-wrap gap-2 lg:flex-col"><ShareButtons url={`/blog/${p.slug}`} text={shareText} slug={p.slug} cardUrl={p.kind === 'punchline' ? `/api/blog/posts/${p.slug}/card.png` : undefined} /></div>
          </div>
        </aside>
        <div className="min-w-0">
          {p.cover && <img src={p.cover} alt="" className="-mt-16 mb-8 w-full rounded-2xl shadow-[0_30px_60px_-30px_rgba(4,28,92,.5)] md:-mt-24" />}
          {p.media_url && <div className="mb-8">{embed(p.media_url)}</div>}
          {p.locked ? (
            <div className="grid gap-4 rounded-2xl bg-blue-tint p-8">
              <p className="text-lg">{p.excerpt}</p>
              <p className="font-semibold">La suite est réservée aux membres. L'inscription est gratuite.</p>
              <div className="flex gap-3">
                <Link to={`/inscription?suivant=/blog/${p.slug}`} className="btn btn-primary">Créer un compte</Link>
                <Link to={`/connexion?suivant=/blog/${p.slug}`} className="btn btn-ghost">Se connecter</Link>
              </div>
            </div>
          ) : p.body ? <div className="prose-adj article-prose" dangerouslySetInnerHTML={{ __html: html }} /> : null}

          <div className="mt-10 flex flex-wrap items-center gap-2 border-y border-line py-5">
            {Object.entries(REACTIONS).map(([k, e]) => (
              <button key={k} onClick={() => react(k)} disabled={!user} title={user ? '' : 'Connectez-vous pour réagir'} aria-pressed={p.reactions.mine.includes(k)}
                className={`rounded-full border-[1.5px] px-3 py-1.5 ${p.reactions.mine.includes(k) ? 'border-orange bg-orange/10' : 'border-line'}`}>
                {e} <span className="text-sm tabular-nums">{p.reactions.counts[k]}</span>
              </button>
            ))}
            {p.tags.map((t: any) => <Link key={t.id} to={`/blog?q=${t.name}`} className="chip ml-1">#{t.name}</Link>)}
          </div>

          <Link to="/boutique" className="card mt-8 flex items-center gap-4 p-4 hover:ring-2 hover:ring-blue-tint">
            <span className="hero-grad grid h-[90px] w-[60px] shrink-0 place-items-center rounded-md"><img src="/mark-mono.svg" alt="" className="h-8" /></span>
            <span className="flex-1"><b className="block">Les livres d'Adjougbe</b><span className="text-sm text-muted">Extrait gratuit disponible, sans compte</span></span>
            <span className="btn btn-blue btn-sm">Voir les œuvres</span>
          </Link>

          {p.allow_comments && <Comments slug={p.slug} />}
          {p.related?.length > 0 && (
            <section className="mt-14">
              <h2 className="mb-4 text-2xl">À lire aussi</h2>
              <ul className="grid gap-3">{p.related.map((r: any) => <li key={r.id}><Link to={`/blog/${r.slug}`} className="font-medium text-blue hover:underline">{r.title}</Link></li>)}</ul>
            </section>
          )}
        </div>
        <aside className="hidden lg:block">
          {toc.length > 0 && (
            <nav className="sticky top-32" aria-label="Sommaire de l'article">
              <div className="mb-3 text-xs font-semibold tracking-[.1em] text-faint">SOMMAIRE</div>
              <ol className="grid gap-2 border-l-2 border-blue-tint pl-4 text-sm">
                {toc.map((t: string) => <li key={t}><a href={`#${slugify(t)}`} className="text-ink-soft hover:text-blue">{t}</a></li>)}
              </ol>
            </nav>
          )}
        </aside>
      </article>
    </>
  )
}

const slugify = (t: string) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function Comments({ slug }: { slug: string }) {
  const { user } = useAuth()
  const { data, reload } = useApi<any[]>(`/api/blog/posts/${slug}/comments/`)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState('')
  const [error, setError] = useState<unknown>(null)
  const send = async () => {
    try {
      const r = await post(`/api/blog/posts/${slug}/comments/`, { body })
      setBody('')
      setMsg(r.status === 'approved' ? '' : r.message)
      reload()
    } catch (e) { setError(e) }
  }
  return (
    <section className="mt-14">
      <h2 className="mb-1 text-2xl">Commentaires ({data?.length ?? 0})</h2>
      <p className="mb-6 text-sm text-muted">Modérés avant publication</p>
      <div className="grid gap-5">
        {data?.length === 0 && <p className="text-muted">Soyez le premier à réagir.</p>}
        {data?.map((c) => (
          <div key={c.id} className={`${c.parent ? 'ml-8 border-l-4 border-orange pl-4' : ''}`}>
            <p className="text-sm"><strong>{c.is_author_reply ? 'Adjougbe' : c.author}</strong> <span className="text-muted">· {dateFr(c.created_at)}</span>
              {c.is_author_reply && <span className="chip chip-orange ml-2">L'auteur</span>}</p>
            <p className="mt-1 whitespace-pre-line">{c.body}</p>
          </div>
        ))}
      </div>
      {user ? (
        <div className="mt-8 grid gap-3">
          <label htmlFor="comment" className="font-medium">Votre commentaire</label>
          <textarea id="comment" className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} />
          {msg && <p className="text-sm text-ok">{msg}</p>}
          <ErrorNote error={error} />
          <button className="btn btn-dark justify-self-start" onClick={send} disabled={body.trim().length < 2}>Publier</button>
        </div>
      ) : (
        <p className="mt-8"><Link to={`/connexion?suivant=/blog/${slug}`} className="link">Connectez-vous</Link> pour commenter.</p>
      )}
    </section>
  )
}
