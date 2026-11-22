import { useRef, useState } from 'react'
import { ArticleBanner, PostBanner, splitForMiddle, type Banner } from '../components/ArticleBanner'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ShareButton } from '../components/Share'
import { FilterBar } from '../components/FilterBar'
import { PageHero } from '../components/PageHero'
import { Empty, ErrorNote, Icon, Spinner, WorkCover } from '../components/ui'
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
  // Une rubrique (catégorie) ou un type (punchline, papo) : un seul filtre actif à la fois.
  const pick = (v: string) => {
    const p = new URLSearchParams(params); p.delete('category'); p.delete('kind'); p.delete('page')
    if (KINDS.some((k) => k.value === v && v)) p.set('kind', v); else if (v !== 'tous') p.set('category', v)
    setParams(p)
  }
  const posts: any[] = data?.results ?? []
  const [lead, ...rest] = page === 1 && !q ? posts : [null, ...posts]
  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Blog']]} eyebrow="LE CARNET" title="Réflexions pour" accent="grandir chaque semaine."
        text="La punchline du jour, des Papos de Tiékar et des articles sur le leadership, l'écriture et l'entraide." />
      <div className="container-x">
        <FilterBar label="Rubriques" value={cat || kind || 'tous'} onChange={pick}
          options={[{ value: 'tous', label: 'Tous' }, ...(cats.data ?? []).map((c: any) => ({ value: c.slug, label: c.name })),
            ...KINDS.filter((k) => ['punchline', 'papo'].includes(k.value)).map((k) => ({ value: k.value, label: k.label }))]}
          search={{ id: 'blog-q', value: search, onChange: setSearch, onSubmit: () => upd('q', search), placeholder: 'Rechercher un article' }} />
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
  const punch = p.kind === 'punchline'
  const shareText = punch ? `« ${p.quote} » — Adjougbe` : `${p.title} — ${p.excerpt}`.slice(0, 220)
  const cardUrl = punch ? `/api/blog/posts/${p.slug}/card.png` : undefined
  const label = p.category?.name ?? p.kind_label
  const bs: Banner[] = p.banners ?? []
  const at = (pos: string) => bs.filter((b) => b.position === pos).map((b, i) => <ArticleBanner key={pos + i} b={b} />)
  const [first, rest] = bs.some((b) => b.position === 'milieu') ? splitForMiddle(html) : [html, '']
  const share = <ShareButton url={`/blog/${p.slug}`} text={shareText} slug={p.slug} cardUrl={cardUrl} />
  return (
    <article className="pb-24">
      {/* En-tête : grande image, titre et auteur posés dessus. */}
      <header className="container-x max-w-[1180px] pt-6 md:pt-8">
        <nav aria-label="Fil d'Ariane" className="text-[14px] text-muted">
          <Link to="/" className="hover:text-blue">Accueil</Link> / <Link to="/blog" className="hover:text-blue">Blog</Link> / <span aria-current="page">{label}</span>
        </nav>
        <div className="relative mt-4 aspect-[4/5] overflow-hidden rounded-[22px] shadow-[0_30px_60px_-34px_rgba(4,28,92,.55)] sm:aspect-[16/9] lg:aspect-[21/9]">
          <PostBanner p={p} size="hero" plain />
          <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(4,12,40,0) 35%,rgba(4,12,40,.78) 100%)' }} />
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-5 p-6 text-white md:flex-row md:items-end md:justify-between md:p-10">
            <div className="max-w-[780px]">
              <p className="text-[13.5px] font-medium text-white/80">{label} · {p.read_minutes} min de lecture</p>
              <h1 className="mt-2 text-[28px] leading-[1.12] text-white [text-shadow:0_8px_30px_rgba(0,0,0,.35)] md:text-[44px]">{punch ? 'La punchline du jour' : p.title}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <img src="/auteur-hero.webp" alt="" className="h-11 w-11 rounded-full bg-white/20 object-cover object-top ring-2 ring-white/40" />
              <span className="leading-tight"><span className="block text-[12.5px] text-white/70">Écrit par</span><b>{p.author_name}</b></span>
            </div>
          </div>
        </div>
      </header>

      <div className="container-x mt-10 grid max-w-[1180px] gap-10 md:mt-14 lg:grid-cols-[200px_minmax(0,720px)] lg:justify-center lg:gap-16">
        {/* Colonne d'informations : en haut sur mobile, à gauche et fixe à l'écran sur ordinateur. */}
        <aside className="lg:sticky lg:top-32 lg:self-start">
          <dl className="grid grid-cols-3 gap-x-6 gap-y-5 text-[14px] lg:grid-cols-1">
            <div><dt className="text-[12.5px] text-muted">Publié le</dt><dd className="mt-0.5 font-semibold">{dateFr(p.published_at)}</dd></div>
            <div><dt className="text-[12.5px] text-muted">Rubrique</dt><dd className="mt-0.5 font-semibold"><Link to={p.category ? `/blog?category=${p.category.slug}` : `/blog?kind=${p.kind}`} className="hover:text-blue">{label}</Link></dd></div>
            <div><dt className="text-[12.5px] text-muted">Lecture</dt><dd className="mt-0.5 font-semibold">{p.read_minutes} min</dd></div>
          </dl>
          <div className="mt-6 border-t border-line pt-6">{share}</div>
          {toc.length > 1 && (
            <nav aria-label="Sommaire de l'article" className="mt-8 hidden lg:block">
              <b className="mb-3 block text-[13px]">Dans cet article</b>
              <ol className="grid gap-2.5 border-l-2 border-blue-tint pl-4 text-[14px]">
                {toc.map((t: string) => <li key={t}><a href={`#${slugify(t)}`} className="text-ink-soft hover:text-blue">{t}</a></li>)}
              </ol>
            </nav>
          )}
        </aside>

        <div className="min-w-0">
          {punch && p.quote && <blockquote className="mb-8 border-l-4 border-orange pl-6 font-serif text-[26px] leading-[1.4] md:text-[32px]">« {p.quote} »</blockquote>}
          {!punch && p.excerpt && <p className="mb-8 text-[19px] leading-relaxed font-semibold text-[var(--fg)] md:text-[20px]">{p.excerpt}</p>}
          {p.media_url && <div className="mb-8">{embed(p.media_url)}</div>}
          {p.locked ? (
            <div className="grid gap-4 rounded-2xl bg-blue-tint p-6 md:p-8">
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

          {/* Fin de lecture : réagir, puis partager. */}
          <section className="mt-12 grid gap-5 border-y border-line py-7 sm:grid-cols-[1fr_auto] sm:items-center" aria-labelledby="reagir">
            <div>
              <h2 id="reagir" className="text-[18px]">{punch ? 'Cette punchline vous parle ?' : 'Cet article vous a plu ?'}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {Object.entries(REACTIONS).map(([k, e]) => (
                  <button key={k} onClick={() => react(k)} disabled={!user} title={user ? '' : 'Connectez-vous pour réagir'} aria-pressed={p.reactions.mine.includes(k)}
                    className={`flex items-center gap-2 rounded-full border-[1.5px] px-3.5 py-1.5 text-[16px] transition-colors disabled:cursor-not-allowed ${p.reactions.mine.includes(k) ? 'border-orange bg-orange-tint' : 'border-line hover:border-orange'}`}>
                    {e} <span className="text-[13.5px] font-medium tabular-nums">{p.reactions.counts[k]}</span>
                  </button>
                ))}
              </div>
            </div>
            <ShareButton url={`/blog/${p.slug}`} text={shareText} slug={p.slug} cardUrl={cardUrl} align="right" up />
          </section>
          {p.tags.length > 0 && <div className="mt-6 flex flex-wrap gap-2">{p.tags.map((t: any) => <Link key={t.id} to={`/blog?q=${t.name}`} className="chip">#{t.name}</Link>)}</div>}
        </div>
      </div>

      {p.related?.length > 0 && <LatestPosts posts={p.related} />}
      <div className="container-x mt-16 max-w-[1180px]"><BooksPromo /></div>
    </article>
  )
}

/** Carrousel « À lire aussi » : défilement horizontal, flèches sur ordinateur, glisser au doigt sur mobile. */
function LatestPosts({ posts }: { posts: any[] }) {
  const rail = useRef<HTMLDivElement>(null)
  const go = (dir: number) => { const el = rail.current; if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' }) }
  return (
    <section className="container-x mt-20 max-w-[1180px]" aria-labelledby="a-lire">
      <div className="flex items-end justify-between gap-4">
        <h2 id="a-lire" className="text-[26px] md:text-[30px]">À lire aussi</h2>
        <div className="hidden gap-2 md:flex">
          <button type="button" onClick={() => go(-1)} aria-label="Articles précédents" className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-line hover:border-blue hover:text-blue"><Icon name="arrow-small-left" /></button>
          <button type="button" onClick={() => go(1)} aria-label="Articles suivants" className="grid h-11 w-11 place-items-center rounded-full border-[1.5px] border-line hover:border-blue hover:text-blue"><Icon name="arrow-small-right" /></button>
        </div>
      </div>
      <div ref={rail} className="scroll-rail -mx-4 mt-6 flex gap-5 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
        {posts.map((r: any) => (
          <Link key={r.id} to={`/blog/${r.slug}`} className="group flex w-[270px] shrink-0 flex-col md:w-[280px]">
            <div className="aspect-[4/3] overflow-hidden rounded-2xl"><PostBanner p={r} className="transition-transform duration-300 group-hover:scale-[1.03]" /></div>
            <span className="mt-4 text-[13px] text-muted">{r.category?.name ?? r.kind_label} · {r.read_minutes} min</span>
            <h3 className="mt-1.5 text-[18px] leading-snug group-hover:text-blue">{r.kind === 'punchline' ? 'Punchline du jour' : r.title}</h3>
            {r.kind !== 'punchline' && r.excerpt && <p className="mt-1.5 line-clamp-2 text-[14.5px] text-muted">{r.excerpt}</p>}
            <span className="mt-4 flex items-center gap-2.5 text-[13px]">
              <img src="/auteur-hero.webp" alt="" className="h-8 w-8 rounded-full bg-blue-tint object-cover object-top" />
              <span className="leading-tight"><span className="block text-muted">Écrit par</span><b>Adjougbe</b></span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  )
}

/** Mise en avant des livres en fin d'article, avec les vraies couvertures. */
function BooksPromo() {
  const works = useApi<any[]>('/api/catalog/works/')
  const list = (Array.isArray(works.data) ? works.data : (works.data as any)?.results ?? []).slice(0, 3)
  return (
    <Link to="/boutique" className="card-navy group grid items-center gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:p-8">
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
