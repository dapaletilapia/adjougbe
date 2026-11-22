import { useState } from 'react'
import { ArticleBanner, PostBanner, splitForMiddle, type Banner } from '../components/ArticleBanner'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ShareButtons } from '../components/Share'
import { PageHero } from '../components/PageHero'
import { Empty, ErrorNote, Icon, initials, Spinner, WorkCover } from '../components/ui'
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
      <div className="container-x flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Rubriques">
          {[{ key: 'tous', label: 'Tous', on: !cat && !kind, go: () => { const p = new URLSearchParams(params); p.delete('category'); p.delete('kind'); p.delete('page'); setParams(p) } },
            ...(cats.data ?? []).map((c: any) => ({ key: c.slug, label: c.name, on: cat === c.slug, go: () => { const p = new URLSearchParams(params); p.set('category', c.slug); p.delete('kind'); p.delete('page'); setParams(p) } })),
            ...KINDS.filter((k) => ['punchline', 'papo'].includes(k.value)).map((k) => ({ key: k.value, label: k.label, on: kind === k.value, go: () => { const p = new URLSearchParams(params); p.set('kind', k.value); p.delete('category'); p.delete('page'); setParams(p) } })),
          ].map((x) => (
            <button key={x.key} onClick={x.go} aria-pressed={x.on}
              className={`shrink-0 rounded-full border-[1.5px] px-4 py-2 text-[14.5px] font-medium transition-colors ${x.on ? 'border-blue bg-blue text-white' : 'border-line bg-[var(--card)] hover:border-blue hover:text-blue'}`}>{x.label}</button>
          ))}
        </div>
        <form className="input-icon w-full md:w-[280px] md:shrink-0" onSubmit={(e) => { e.preventDefault(); upd('q', search) }}>
          <label htmlFor="blog-q" className="sr-only">Rechercher</label>
          <Icon name="search" />
          <input id="blog-q" className="input !rounded-full" placeholder="Rechercher un article" value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
      </div>
      <div className="container-x mt-8 pb-24 md:mt-10">
        {loading ? <Spinner /> : !posts.length ? <Empty title="Rien trouvé">Essayez une autre rubrique ou un autre mot.</Empty> : (
          <>
            {lead && (
              <Link to={`/blog/${lead.slug}`} className="card group mb-8 grid overflow-hidden md:grid-cols-[1.25fr_1fr]">
                <div className="aspect-[16/9] md:aspect-auto md:min-h-[340px]"><PostBanner p={lead} size="lead" /></div>
                <div className="flex flex-col gap-3 p-6 md:p-10">
                  <div className="flex flex-wrap items-center gap-2.5 text-[13px]"><span className="chip chip-orange">À la une</span><span className="font-semibold text-blue">{lead.category?.name ?? lead.kind_label}</span></div>
                  <h2 className="text-[24px] leading-tight group-hover:text-blue md:text-[30px]">{lead.kind === 'punchline' ? 'La punchline du jour' : lead.title}</h2>
                  {lead.kind !== 'punchline' && <p className="line-clamp-3 text-muted">{lead.excerpt}</p>}
                  <Byline p={lead} />
                </div>
              </Link>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {rest.filter(Boolean).map((p: any) => (
                <Link key={p.id} to={`/blog/${p.slug}`} className="card group flex flex-col overflow-hidden">
                  <div className="aspect-[16/9] overflow-hidden"><PostBanner p={p} className="transition-transform duration-300 group-hover:scale-[1.03]" /></div>
                  <div className="flex flex-1 flex-col gap-2 p-5">
                    <span className="text-[13px] font-semibold text-blue">{p.category?.name ?? p.kind_label}</span>
                    <h2 className="text-[18px] leading-snug group-hover:text-blue">{p.kind === 'punchline' ? 'Punchline du jour' : p.title}</h2>
                    {p.kind !== 'punchline' && <p className="line-clamp-2 text-[15px] text-muted">{p.excerpt}</p>}
                    {p.members_only && <span className="chip chip-blue self-start">Réservé aux membres</span>}
                    <Byline p={p} small />
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

function Byline({ p, small }: { p: any; small?: boolean }) {
  return (
    <div className={`mt-auto flex items-center gap-3 border-t border-line pt-4 ${small ? 'text-[13px]' : 'text-sm'}`}>
      <img src="/auteur-hero.webp" alt="" className={`${small ? 'h-8 w-8' : 'h-10 w-10'} rounded-full bg-blue-tint object-cover object-top`} />
      <span className="leading-tight"><b className="block">Adjougbe</b><span className="text-muted">{dateFr(p.published_at)} · {p.read_minutes} min</span></span>
    </div>
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
  const shareText = p.kind === 'punchline' ? `« ${p.quote} » — Adjougbe` : `${p.title} — ${p.excerpt}`.slice(0, 220)
  const cardUrl = p.kind === 'punchline' ? `/api/blog/posts/${p.slug}/card.png` : undefined
  const label = p.category?.name ?? p.kind_label
  const bs: Banner[] = p.banners ?? []
  const at = (pos: string) => bs.filter((b) => b.position === pos).map((b, i) => <ArticleBanner key={pos + i} b={b} />)
  const [first, rest] = bs.some((b) => b.position === 'milieu') ? splitForMiddle(html) : [html, '']
  return (
    <article className="pb-24">
      {/* En-tête : titre puis bannière de l'article (image ou visuel généré). */}
      <header className="container-x max-w-[1100px] pt-8 md:pt-12">
        <nav aria-label="Fil d'Ariane" className="text-[14px] text-muted">
          <Link to="/" className="hover:text-blue">Accueil</Link> / <Link to="/blog" className="hover:text-blue">Blog</Link> / <span aria-current="page">{label}</span>
        </nav>
        <div className="mt-5 max-w-[820px]">
          <span className="chip chip-blue">{label}</span>
          <h1 className="mt-4 text-[30px] leading-[1.15] md:text-[44px]">{p.kind === 'punchline' ? 'La punchline du jour' : p.title}</h1>
          {p.kind !== 'punchline' && p.excerpt && <p className="mt-4 text-[17px] leading-relaxed text-ink-soft md:text-lg">{p.excerpt}</p>}
          <div className="mt-6 flex items-center gap-3 text-sm">
            <img src="/auteur-hero.webp" alt="" className="h-11 w-11 rounded-full bg-blue-tint object-cover object-top" />
            <span className="leading-tight"><b className="block">{p.author_name}</b><span className="text-muted">{dateFr(p.published_at)} · {p.read_minutes} min de lecture</span></span>
          </div>
        </div>
        <div className="mt-8 aspect-[16/9] overflow-hidden rounded-2xl shadow-[0_30px_60px_-34px_rgba(4,28,92,.55)] md:aspect-[2/1]">
          <PostBanner p={p} size="hero" />
        </div>
      </header>

      <div className="container-x mt-10 grid max-w-[1100px] gap-10 md:mt-14 lg:grid-cols-[minmax(0,1fr)_240px] lg:gap-14">
        <div className="min-w-0">
          {p.media_url && <div className="mb-8">{embed(p.media_url)}</div>}
          {p.locked ? (
            <div className="grid gap-4 rounded-2xl bg-blue-tint p-6 md:p-8">
              <p className="text-lg">{p.excerpt}</p>
              <p className="font-semibold">La suite est réservée aux membres. L'inscription est gratuite.</p>
              <div className="flex flex-wrap gap-3">
                <Link to={`/inscription?suivant=/blog/${p.slug}`} className="btn btn-primary">Créer un compte</Link>
                <Link to={`/connexion?suivant=/blog/${p.slug}`} className="btn btn-ghost">Se connecter</Link>
              </div>
            </div>
          ) : (
            <>
              {at('debut')}
              {first && <div className="prose-adj article-prose" dangerouslySetInnerHTML={{ __html: first }} />}
              {at('milieu')}
              {rest && <div className="prose-adj article-prose" dangerouslySetInnerHTML={{ __html: rest }} />}
              {at('fin')}
            </>
          )}

          {/* Réactions et partage, réunis : c'est le moment où le lecteur a envie d'agir. */}
          <section className="card mt-12 grid gap-6 p-6 md:p-8" aria-labelledby="reagir">
            <div>
              <h2 id="reagir" className="text-[22px]">{p.kind === 'punchline' ? 'Cette punchline vous parle ?' : 'Cet article vous a plu ?'}</h2>
              <p className="mt-1 text-muted">{user ? 'Réagissez, puis partagez-le à quelqu\u2019un qui en a besoin aujourd\u2019hui.' : 'Partagez-le à quelqu\u2019un qui en a besoin aujourd\u2019hui.'}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(REACTIONS).map(([k, e]) => (
                <button key={k} onClick={() => react(k)} disabled={!user} title={user ? '' : 'Connectez-vous pour réagir'} aria-pressed={p.reactions.mine.includes(k)}
                  className={`flex items-center gap-2 rounded-full border-[1.5px] px-4 py-2 text-[17px] transition-colors disabled:cursor-not-allowed ${p.reactions.mine.includes(k) ? 'border-orange bg-orange-tint' : 'border-line hover:border-orange'}`}>
                  {e} <span className="text-[14px] font-medium tabular-nums">{p.reactions.counts[k]}</span>
                </button>
              ))}
            </div>
            <div className="border-t border-line pt-6"><ShareButtons url={`/blog/${p.slug}`} text={shareText} slug={p.slug} cardUrl={cardUrl} /></div>
            {p.tags.length > 0 && <div className="flex flex-wrap gap-2">{p.tags.map((t: any) => <Link key={t.id} to={`/blog?q=${t.name}`} className="chip">#{t.name}</Link>)}</div>}
          </section>

          <BooksPromo />
          {p.allow_comments && <Comments slug={p.slug} />}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-32 grid gap-8">
            {toc.length > 0 && (
              <nav aria-label="Sommaire de l'article">
                <b className="mb-3 block text-[14px]">Dans cet article</b>
                <ol className="grid gap-2.5 border-l-2 border-blue-tint pl-4 text-[14.5px]">
                  {toc.map((t: string) => <li key={t}><a href={`#${slugify(t)}`} className="text-ink-soft hover:text-blue">{t}</a></li>)}
                </ol>
              </nav>
            )}
            <ShareButtons url={`/blog/${p.slug}`} text={shareText} slug={p.slug} cardUrl={cardUrl} vertical />
          </div>
        </aside>
      </div>

      {p.related?.length > 0 && (
        <section className="container-x mt-16 max-w-[1100px]">
          <h2 className="text-[26px]">À lire aussi</h2>
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {p.related.map((r: any) => (
              <Link key={r.id} to={`/blog/${r.slug}`} className="card group flex flex-col overflow-hidden">
                <div className="aspect-[16/9] overflow-hidden"><PostBanner p={r} className="transition-transform duration-300 group-hover:scale-[1.03]" /></div>
                <div className="flex flex-1 flex-col gap-2 p-5">
                  <span className="text-[13px] font-semibold text-blue">{r.category?.name ?? r.kind_label}</span>
                  <h3 className="text-[17px] leading-snug group-hover:text-blue">{r.kind === 'punchline' ? 'Punchline du jour' : r.title}</h3>
                  <span className="mt-auto pt-2 text-[13px] text-muted">{dateFr(r.published_at)} · {r.read_minutes} min</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

/** Mise en avant des livres en fin d'article, avec les vraies couvertures. */
function BooksPromo() {
  const works = useApi<any[]>('/api/catalog/works/')
  const list = (Array.isArray(works.data) ? works.data : (works.data as any)?.results ?? []).slice(0, 3)
  return (
    <Link to="/boutique" className="card-navy group mt-8 grid items-center gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:p-8">
      <span className="pointer-events-none absolute inset-0 opacity-[.05]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
      <span className="relative flex -space-x-6">
        {list.map((w: any, i: number) => <span key={w.id} className="w-[64px] drop-shadow-xl md:w-[72px]" style={{ transform: `rotate(${(i - 1) * 6}deg)` }}><WorkCover work={w} /></span>)}
      </span>
      <span className="relative">
        <b className="block text-[20px]">Les livres d'Adjougbe</b>
        <span className="mt-1 block text-white/80">Commencez par un extrait gratuit, sans créer de compte.</span>
      </span>
      <span className="btn btn-primary relative justify-self-start shadow-orange md:justify-self-end">Voir les œuvres</span>
    </Link>
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
    <section className="mt-12" aria-labelledby="commentaires">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="commentaires" className="text-[24px]">Commentaires <span className="text-muted">({data?.length ?? 0})</span></h2>
        <span className="text-sm text-muted">Relus avant publication</span>
      </div>
      <div className="mt-6 grid gap-4">
        {data?.length === 0 && <p className="rounded-2xl bg-paper px-5 py-4 text-muted">Aucun commentaire pour l'instant. Lancez la conversation.</p>}
        {data?.map((c) => (
          <div key={c.id} className={`flex gap-3 ${c.parent ? 'ml-6 md:ml-12' : ''}`}>
            {c.is_author_reply ? <img src="/auteur-hero.webp" alt="" className="h-10 w-10 shrink-0 rounded-full bg-blue-tint object-cover object-top" />
              : <span className="avatar h-10 w-10 text-[13px]">{initials(c.author || '?')}</span>}
            <div className={`min-w-0 flex-1 rounded-2xl px-4 py-3 ${c.is_author_reply ? 'bg-orange-tint' : 'bg-[var(--card)] shadow-[0_8px_24px_-18px_rgba(4,28,92,.4)]'}`}>
              <p className="text-sm"><strong>{c.is_author_reply ? 'Adjougbe' : c.author}</strong> <span className="text-muted">· {dateFr(c.created_at)}</span>
                {c.is_author_reply && <span className="chip chip-orange ml-2">L'auteur</span>}</p>
              <p className="mt-1 whitespace-pre-line">{c.body}</p>
            </div>
          </div>
        ))}
      </div>
      {user ? (
        <div className="card mt-6 grid gap-3 p-5">
          <label htmlFor="comment" className="font-semibold">Votre commentaire</label>
          <textarea id="comment" className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000} placeholder="Ce que ce texte vous inspire…" />
          {msg && <p className="text-sm text-ok">{msg}</p>}
          <ErrorNote error={error} />
          <button className="btn btn-blue justify-self-start" onClick={send} disabled={body.trim().length < 2}>Publier le commentaire</button>
        </div>
      ) : (
        <div className="card mt-6 flex flex-wrap items-center justify-between gap-4 p-5">
          <span>Connectez-vous pour rejoindre la conversation.</span>
          <Link to={`/connexion?suivant=/blog/${slug}`} className="btn btn-blue btn-sm">Se connecter</Link>
        </div>
      )}
    </section>
  )
}
