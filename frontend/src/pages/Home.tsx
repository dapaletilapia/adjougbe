import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ShareButtons } from '../components/Share'
import { PunchlinePopup } from '../components/PunchlinePopup'
import { Icon, Spinner, Stars, WorkCover } from '../components/ui'
import { useCart } from '../lib/cart'
import { dateFr, fcfa } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'

const nf = new Intl.NumberFormat('fr-FR')

/** Photo de l'auteur : /auteur-hero.webp (dossier public). En son absence, on montre les livres. */
function AuthorOrBooks({ works, variant }: { works: any[]; variant: 'hero' | 'circle' }) {
  const [missing, setMissing] = useState(false)
  if (!missing)
    return (
      <img src="/auteur-hero.webp" alt="Adjougbe" onError={() => setMissing(true)}
        className={variant === 'hero' ? 'absolute right-[3%] bottom-[120px] h-[78%] w-auto max-w-none xl:right-[8%]' : 'absolute bottom-0 left-1/2 h-full w-auto max-w-none -translate-x-1/2'} />
    )
  const three = works.slice(0, 3)
  return (
    <div className={`absolute ${variant === 'hero' ? 'right-[6%] bottom-[150px]' : 'bottom-16 left-1/2 -translate-x-1/2'} flex items-end`}>
      {three.map((w, i) => (
        <div key={w.id} className="w-[150px] md:w-[180px]"
          style={{ transform: `rotate(${(i - 1) * 8}deg) translateY(${i === 1 ? -24 : 0}px)`, marginLeft: i ? -40 : 0, zIndex: i === 1 ? 2 : 1 }}>
          <WorkCover work={w} />
        </div>
      ))}
    </div>
  )
}

export default function Home() {
  useTitle('')
  const { data, loading } = useApi('/api/blog/home/')
  const [idx, setIdx] = useState(0)
  const cart = useCart()
  const nav = useNavigate()
  if (loading || !data) return <div className="container-x"><Spinner /></div>
  const works: any[] = data.works
  const st = data.stats
  const p = data.punchline
  const cur = works[idx % Math.max(1, works.length)]
  const buy = (w: any) => { cart.add({ type: 'work', id: w.id, label: w.title, price: w.current_price_xof }); nav('/paiement') }
  const at = (d: number) => works[(idx + d + works.length * 3) % works.length]

  return (
    <>
      {/* Hero en dôme (maquette 10a) */}
      <section className="relative min-h-[640px] overflow-hidden text-white md:h-[780px]"
        style={{ background: 'radial-gradient(900px 620px at 72% 40%,#3FA2FF 0%,rgba(31,120,240,.6) 35%,transparent 70%),linear-gradient(125deg,#041C5C 0%,#0A3A9E 35%,#1560DC 65%,#2A86F2 100%)' }}>
        <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 38%,rgba(255,255,255,.10) 46%,rgba(255,255,255,.02) 52%,transparent 60%)' }} />
        <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px', maskImage: 'linear-gradient(100deg,#000 0%,rgba(0,0,0,.6) 35%,transparent 58%)', WebkitMaskImage: 'linear-gradient(100deg,#000 0%,rgba(0,0,0,.6) 35%,transparent 58%)' }} />
        <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(520px 380px at 18% 92%,rgba(255,107,41,.22),transparent 70%),radial-gradient(900px 500px at 50% 120%,rgba(4,28,92,.6),transparent 70%)' }} />
        <div className="pointer-events-none absolute inset-0 hidden lg:block"><AuthorOrBooks works={works} variant="hero" /></div>
        <div className="container-x relative pt-14 pb-56 md:pt-20">
          <div className="max-w-[640px]">
            <span className="inline-flex items-center gap-3 text-xs font-semibold tracking-[.22em] text-white/85">
              <span className="h-px w-[34px]" style={{ background: 'linear-gradient(90deg,#FF6B29,rgba(255,107,41,0))' }} />LIVRES · FORMATIONS · LEADERSHIP
            </span>
            <h1 className="mt-5 text-[40px] leading-[1.1] font-bold tracking-[-0.02em] [text-shadow:0_10px_40px_rgba(4,28,92,.45)] md:text-[60px]">
              Osez diriger,<br />
              <span className="text-orange">écrivez votre{' '}
                réussite.
              </span>
            </h1>
            <p className="mt-6 max-w-[500px] text-[17px] leading-[1.65] text-white/90 md:text-lg">
              Des punchlines pour se relever, des formations pour grandir. Lisez en ligne et payez en Mobile Money.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/boutique" className="btn btn-primary !rounded-lg !px-6 !py-4 shadow-orange">
                Découvrir les œuvres <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-white/25 text-xs"><Icon name="arrow-small-right" /></span>
              </Link>
              <Link to="/formations" className="btn !rounded-lg bg-white !px-6 !py-4 text-ink">
                Nos formations <span className="grid h-[22px] w-[22px] place-items-center rounded-full bg-blue text-[9px] text-white"><Icon name="play" /></span>
              </Link>
            </div>
            {/* Preuve sociale affichée seulement quand elle est significative. */}
            {((st.rating && st.reviews >= 3) || st.readers >= 50) && (
              <div className="mt-10 flex items-center gap-3.5 text-[14px]">
                {st.rating && st.reviews >= 3 && <span className="tracking-[2px] text-orange">★★★★★</span>}
                <span>{st.rating && st.reviews >= 3 && <><b>{String(st.rating).replace('.', ',')}/5</b> · </>}{st.readers >= 50 && <>{nf.format(st.readers)} lecteurs</>}</span>
              </div>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute right-[-25%] -bottom-[410px] left-[-25%] h-[560px] rounded-[50%] bg-[var(--card)] shadow-[0_-20px_60px_-20px_rgba(4,28,92,.35)]" />
      </section>

      {/* Trois services */}
      <section className="container-x relative -mt-[120px] text-center md:-mt-[90px]">
        <h2 className="text-[30px] md:text-[38px]">Lire, apprendre, grandir</h2>
        <p className="mx-auto mt-3 max-w-[560px] text-[15px] leading-[1.7] text-muted">Tout l'univers d'Adjougbe au même endroit : des livres, des formations et un carnet pour avancer chaque semaine.</p>
        <div className="mt-12 grid gap-7 md:grid-cols-3">
          {[
            ['book-alt', 'Les œuvres', 'Les Punchlines et une œuvre offerte. Lecture en ligne protégée, extrait gratuit.', 'Voir les livres', '/boutique'],
            ['users', 'Les formations', 'Masterclass et ateliers à Abidjan ou en ligne, pour diriger et prendre la parole.', 'Réserver ma place', '/formations'],
            ['pencil', 'Le blog', 'La punchline du jour, des articles sur le leadership, l’échec, l’entraide et l’écriture.', 'Lire le blog', '/blog'],
          ].map(([icon, title, text, cta, to]) => (
            <div key={title} className="flex flex-col items-center gap-3.5 rounded-[18px] bg-[var(--card)] px-7 pt-9 pb-8 shadow-[0_24px_50px_-28px_rgba(4,28,92,.35),0_1px_3px_rgba(14,15,19,.05)]">
              <span className="grid h-[60px] w-[60px] place-items-center rounded-full bg-orange text-2xl text-white shadow-[0_0_0_8px_#FFEDE4]"><Icon name={icon} /></span>
              <h3 className="mt-1.5 text-xl">{title}</h3>
              <p className="text-sm leading-[1.7] text-muted">{text}</p>
              <Link to={to} className="btn btn-primary btn-pill btn-sm mt-2 !px-5 shadow-orange">{cta}</Link>
            </div>
          ))}
        </div>
      </section>

      {p && <PunchlinePopup p={p} />}
      {/* Punchline du jour (cahier des charges : bloc d'accueil) */}
      {p && (
        <section className="container-x mt-20">
          <div className="hero-grad relative overflow-hidden rounded-[18px] px-7 py-10 text-white md:px-14 md:py-12">
            <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -top-10 -right-10 h-72 w-72 opacity-[.07]" />
            <div className="kicker relative">Punchline du jour · {dateFr(p.published_at)}</div>
            <blockquote className="relative mt-4 max-w-3xl text-[26px] leading-[1.35] font-semibold md:text-[34px]">« {p.quote || p.excerpt} »</blockquote>
            <div className="relative mt-6 flex flex-wrap items-center gap-4">
              <ShareButtons dark url={`/blog/${p.slug}`} text={`« ${p.quote} » — Adjougbe`} slug={p.slug} cardUrl={`/api/blog/posts/${p.slug}/card.png`} />
              <Link to="/blog?kind=punchline" className="text-sm font-semibold text-white/85 underline underline-offset-4">Toutes les punchlines</Link>
            </div>
          </div>
        </section>
      )}

      {/* Carrousel des livres */}
      {cur && (
        <section className="mt-24 bg-paper px-4 py-20 text-center md:py-[90px]">
          <div className="kicker">Les livres</div>
          <h2 className="mt-2.5 text-[30px] md:text-[38px]">Les livres d'Adjougbe</h2>
          <p className="mx-auto mt-3 max-w-[520px] text-[15px] leading-[1.7] text-muted">Lecture en ligne protégée. Extrait gratuit, sans compte.</p>
          <div className="relative mx-auto mt-12 h-[330px] max-w-[900px] md:h-[420px]">
            {works.length > 1 && (
              <>
                <button onClick={() => setIdx(idx - 1)} className="absolute top-1/2 left-0 z-10 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-[var(--card)] text-xl text-blue shadow-[0_14px_30px_-10px_rgba(4,28,92,.4)] md:left-6" aria-label="Livre précédent"><Icon name="arrow-small-left" /></button>
                <button onClick={() => setIdx(idx + 1)} className="absolute top-1/2 right-0 z-10 grid h-14 w-14 -translate-y-1/2 place-items-center rounded-full bg-[var(--card)] text-xl text-blue shadow-[0_14px_30px_-10px_rgba(4,28,92,.4)] md:right-6" aria-label="Livre suivant"><Icon name="arrow-small-right" /></button>
              </>
            )}
            {works.length > 2 && [-1, 1].map((d) => (
              <button key={d} onClick={() => setIdx(idx + d)} aria-label={at(d).title}
                className="absolute top-10 left-1/2 hidden w-[180px] opacity-75 transition-transform hover:opacity-100 sm:block md:w-[210px]"
                style={{ transform: `translateX(calc(-50% + ${d * 230}px))` }}>
                <WorkCover work={at(d)} />
              </button>
            ))}
            <Link to={`/livres/${cur.slug}`} className="absolute top-0 left-1/2 z-[3] w-[200px] -translate-x-1/2 md:w-[260px]" style={{ filter: 'drop-shadow(0 30px 40px rgba(21,96,220,.45))' }}>
              <WorkCover work={cur} />
            </Link>
          </div>
          <h3 className="mt-2 text-[17px] font-semibold">{cur.title}</h3>
          <p className="mt-0.5 text-[14px] text-muted">par Adjougbe · {cur.access_mode === 'paid' ? fcfa(cur.current_price_xof) : 'Offert'}</p>
          {cur.rating?.average && <div className="mt-2 flex justify-center"><Stars value={cur.rating.average} /></div>}
          <div className="mt-5 flex justify-center gap-2.5">
            {cur.owned ? <Link to={`/lire/${cur.slug}`} className="btn btn-blue btn-pill btn-sm !px-5">Continuer la lecture</Link>
              : cur.access_mode === 'paid' ? <button onClick={() => buy(cur)} className="btn btn-primary btn-pill btn-sm !px-5 shadow-orange">Acheter maintenant</button>
                : <Link to={`/livres/${cur.slug}`} className="btn btn-primary btn-pill btn-sm !px-5 shadow-orange">Recevoir le livre</Link>}
            <Link to={`/lire/${cur.slug}`} className="btn btn-ghost btn-pill btn-sm !px-5">Lire l'extrait</Link>
          </div>
          {works.length > 1 && (
            <div className="mt-6 flex justify-center gap-2">
              {works.map((w, i) => (
                <button key={w.id} onClick={() => setIdx(i)} aria-label={w.title} aria-current={i === idx % works.length}
                  className={`h-2 rounded-full ${i === idx % works.length ? 'w-[22px] bg-blue' : 'w-2 bg-[#D9DBE0]'}`} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Offre groupée */}
      {data.bundle && (
        <section className="container-x mt-20 md:mt-[90px]">
          <div className="relative grid items-center gap-10 overflow-hidden rounded-[18px] px-7 py-10 text-white shadow-[0_30px_60px_-24px_rgba(23,103,230,.75)] md:grid-cols-[auto_1fr_auto] md:gap-14 md:px-14 md:py-11"
            style={{ background: 'radial-gradient(500px 300px at 85% 30%,#3FA2FF,transparent 70%),linear-gradient(125deg,#041C5C,#0A3A9E 45%,#1560DC)' }}>
            <div className="pointer-events-none absolute -top-40 -right-32 h-[420px] w-[420px] rounded-full border border-white/18" />
            <div className="relative flex justify-center gap-4">
              {data.bundle.works.slice(0, 2).map((w: any) => (
                <div key={w.id} className="w-[120px] md:w-[150px]" style={{ transform: 'perspective(1200px) rotateY(-22deg) rotateX(4deg)' }}><WorkCover work={w} /></div>
              ))}
            </div>
            <div className="relative">
              {data.bundle.full_price_xof > data.bundle.price_xof && (
                <span className="rounded-md bg-orange px-3 py-1 text-xs font-semibold">Offre spéciale · −{Math.round(100 - (data.bundle.price_xof / data.bundle.full_price_xof) * 100)} %</span>
              )}
              <h2 className="mt-4 text-[30px] leading-tight md:text-[36px]">{data.bundle.title}</h2>
              <p className="mt-2.5 max-w-[440px] text-base opacity-85">{data.bundle.description || 'Les deux tomes en une seule commande, lecture en ligne protégée.'}</p>
              <div className="mt-5 flex w-max max-w-full items-center gap-3 rounded-xl bg-white px-4 py-3 text-ink shadow-[0_16px_30px_-16px_rgba(14,15,19,.5)]">
                <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-orange-tint text-orange"><Icon name="check" /></span>
                <div><div className="text-[14px] font-semibold">Paiement reçu · accès débloqué</div><div className="text-xs text-muted">L'œuvre est dans votre bibliothèque en moins d'une minute</div></div>
              </div>
            </div>
            <div className="relative md:text-right">
              {data.bundle.full_price_xof > data.bundle.price_xof && <div className="text-[15px] line-through opacity-70">{fcfa(data.bundle.full_price_xof)}</div>}
              <div className="text-[44px] leading-[1.1] font-bold">{nf.format(data.bundle.price_xof)} <span className="text-base font-medium">FCFA</span></div>
              <button onClick={() => { cart.add({ type: 'bundle', id: data.bundle.id, label: data.bundle.title, price: data.bundle.price_xof }); nav('/paiement') }}
                className="btn btn-primary mt-4 !rounded-lg !px-6 !py-4 shadow-orange">Prendre le pack →</button>
            </div>
          </div>
        </section>
      )}

      {/* Pourquoi Adjougbe */}
      <section className="container-x mt-24 grid items-center gap-14 md:mt-[100px] lg:grid-cols-2">
        <div>
          <div className="kicker">Pourquoi Adjougbe</div>
          <h2 className="mt-3 text-[32px] leading-tight md:text-[40px]">Grandissez en toute confiance, <span className="text-blue">à votre rythme.</span></h2>
          <p className="mt-4 max-w-[480px] text-[15px] leading-[1.75] text-muted">Nous nous occupons de tout pour que vous puissiez vous concentrer sur l'essentiel : progresser.</p>
          <ul className="mt-6 grid gap-3.5 text-[15px] text-ink-soft">
            {[['Lecture protégée', 'filigrane nominatif, 2 appareils'], ['Mobile Money et carte', 'Orange, MTN, Moov, Wave, Visa'], ['Accès immédiat', 'votre livre en moins d’une minute'], ['Formations en direct', 'Abidjan ou en ligne']].map(([b, t]) => (
              <li key={b} className="flex items-start gap-3"><span className="mt-[7px] h-2.5 w-2.5 flex-none rounded-full bg-orange shadow-[0_0_0_4px_#FFEDE4]" /><span><b>{b}</b> · {t}</span></li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link to="/inscription" className="btn btn-primary btn-pill btn-sm !px-5 shadow-orange">Créer mon compte</Link>
            <Link to="/a-propos" className="text-sm font-semibold text-blue">En savoir plus →</Link>
          </div>
        </div>
        <div className="relative mx-auto h-[420px] w-full max-w-[560px] md:h-[540px]">
          <div className="absolute bottom-0 left-1/2 aspect-square w-[86%] -translate-x-1/2 rounded-full shadow-[0_40px_80px_-30px_rgba(21,96,220,.7)]" style={{ background: 'radial-gradient(circle at 35% 30%,#3FA2FF,#1560DC 55%,#0A3A9E)' }} />
          <div className="absolute inset-x-0 bottom-0 h-full overflow-hidden rounded-b-full"><AuthorOrBooks works={works} variant="circle" /></div>
          {st.readers >= 50 && (
            <div className="absolute top-[22%] left-0 rounded-[14px] bg-[var(--card)] px-4 py-3.5 shadow-[0_20px_40px_-18px_rgba(4,28,92,.4)]">
              <div className="text-[22px] font-bold text-blue">{nf.format(st.readers)}</div><div className="text-xs text-muted">lecteur{st.readers > 1 ? 's' : ''}</div>
            </div>
          )}
          {st.series > 0 && (
            <div className="absolute right-0 bottom-[17%] rounded-[14px] bg-orange px-4 py-3.5 text-white shadow-[0_20px_40px_-18px_rgba(255,107,41,.8)]">
              <div className="text-[22px] font-bold">{nf.format(st.series)}</div><div className="text-xs opacity-90">séries publiées</div>
            </div>
          )}
        </div>
      </section>

      {/* Avis lecteurs */}
      {data.testimonials.length > 0 && (
        <section className="container-x mt-24 text-center">
          <div className="kicker">Avis lecteurs</div>
          <h2 className="mt-2.5 text-[30px] md:text-[36px]">Ils ont grandi avec Adjougbe</h2>
          <div className="mt-10 grid gap-6 text-left md:grid-cols-3">
            {data.testimonials.slice(0, 3).map((t: any, i: number) => (
              <figure key={i} className="rounded-[14px] border border-[#EFF0F2] bg-[var(--card)] p-6 shadow-[0_14px_30px_-22px_rgba(14,15,19,.35)]">
                <blockquote className="text-[14.5px] leading-[1.7] text-ink-soft">« {t.body} »</blockquote>
                <div className="my-3.5"><Stars value={t.rating} /></div>
                <figcaption className="flex items-center gap-3">
                  <span className="avatar h-[42px] w-[42px]">{t.author.slice(0, 1)}</span>
                  <span><b className="block text-sm">{t.author}</b><span className="text-xs text-muted">Lecteur de {t.work}</span></span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      {/* Blog et formations */}
      <section className="container-x mt-24 mb-24 grid gap-10 lg:grid-cols-2">
        {data.posts.length > 0 && (
          <div>
            <div className="mb-5 flex items-end justify-between"><h2 className="text-[26px]">Du côté du blog</h2><Link to="/blog" className="text-sm font-semibold text-blue">Tous les articles →</Link></div>
            <ul className="grid gap-3">
              {data.posts.slice(0, 3).map((post: any) => (
                <li key={post.id}>
                  <Link to={`/blog/${post.slug}`} className="card flex items-center gap-4 p-4 hover:ring-2 hover:ring-blue-tint">
                    {post.cover ? <img src={post.cover} alt="" className="h-16 w-20 rounded-lg object-cover" /> : <span className="hero-grad grid h-16 w-20 shrink-0 place-items-center rounded-lg text-white"><Icon name="document" /></span>}
                    <span className="min-w-0"><span className="text-xs font-semibold text-orange">{post.category?.name ?? post.kind_label}</span><b className="block truncate">{post.title}</b><span className="text-xs text-muted">{dateFr(post.published_at)}</span></span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.sessions.length > 0 && (
          <div>
            <div className="mb-5 flex items-end justify-between"><h2 className="text-[26px]">Prochaines formations</h2><Link to="/formations" className="text-sm font-semibold text-blue">Toutes →</Link></div>
            <ul className="grid gap-3">
              {data.sessions.map((s: any) => (
                <li key={s.id}>
                  <Link to={`/formations/${s.training.slug}`} className="card flex items-center gap-4 p-4 hover:ring-2 hover:ring-blue-tint">
                    <span className="grid h-16 w-14 shrink-0 place-content-center rounded-xl text-center text-white" style={{ background: 'linear-gradient(135deg,#1560DC,#041C5C)' }}>
                      <b className="text-xl leading-none">{new Date(s.starts_at).getDate()}</b>
                      <span className="text-[9px] font-semibold text-[#FF8A5B] uppercase">{new Date(s.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                    </span>
                    <span className="min-w-0 flex-1"><b className="block truncate">{s.training.title}</b><span className="text-xs text-muted">{s.training.format_label} · {s.seats_left} place(s)</span></span>
                    <b className="text-sm">{s.effective_price ? fcfa(s.effective_price) : 'Gratuit'}</b>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  )
}
