import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorNote, Icon, PayLogo, Spinner, Stars, WorkCover } from '../components/ui'
import { post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { fcfa, PAYMENT_METHODS } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'
import { useToast } from '../lib/toast'

function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const ms = Math.max(0, new Date(until).getTime() - now)
  const d = Math.floor(ms / 864e5), h = Math.floor((ms % 864e5) / 36e5), m = Math.floor((ms % 36e5) / 6e4), s = Math.floor((ms % 6e4) / 1e3)
  return <span className="chip chip-orange tabular-nums">Prix de lancement encore {d} j {h} h {m} min {s} s</span>
}

export default function WorkDetail() {
  const { slug } = useParams()
  const { data: w, loading, error, reload } = useApi(`/api/catalog/works/${slug}/`)
  const { user } = useAuth()
  const cart = useCart()
  const nav = useNavigate()
  const toast = useToast()
  useTitle(w?.title ?? '')
  if (loading) return <div className="container-x"><Spinner /></div>
  if (error || !w) return <div className="container-x py-10"><ErrorNote error={error} /></div>

  const buyNow = () => {
    cart.add({ type: 'work', id: w.id, label: w.title, price: w.current_price_xof })
    nav('/paiement')
  }
  const claim = async () => {
    if (!user) return nav(`/connexion?suivant=/livres/${w.slug}`)
    await post(`/api/reader/works/${w.slug}/claim/`)
    toast('Ajouté à votre bibliothèque.')
    nav(`/lire/${w.slug}`)
  }

  const free = w.access_mode !== 'paid'
  const freeSections = w.sections.filter((x: any) => x.free)
  const minutes = Math.max(1, Math.round((w.sections.length * 2) / 60))

  return (
    <div className="bg-[var(--card)]">
      <div className="container-x pt-8">
        <nav className="text-[14px] text-muted" aria-label="Fil d'Ariane"><Link to="/">Accueil</Link> / <Link to="/boutique">Œuvres</Link> / <span aria-current="page" className="text-ink">{w.title}</span></nav>
        <div className="mt-8 grid gap-12 md:grid-cols-[minmax(220px,300px)_1fr] lg:gap-16">
          <div className="mx-auto w-full max-w-[300px] md:sticky md:top-32 md:self-start"><WorkCover work={w} /></div>
          <div className="grid content-start gap-5">
            <div className="flex flex-wrap gap-2">
              {w.title.split(/ — /)[1] && <span className="chip chip-blue">{w.title.split(/ — /)[1]}</span>}
              <span className="chip">{w.kind === 'punchlines' ? 'Développement personnel' : 'Histoires'}</span>
              {free && <span className="chip chip-orange">Œuvre offerte</span>}
              {w.status === 'preorder' && <span className="chip chip-blue">Précommande</span>}
            </div>
            <h1 className="text-[34px] leading-[1.1] md:text-[46px]">{w.title.split(/ — /)[0]}{w.title.split(/ — /)[1] && <><br /><span className="text-blue">{w.title.split(/ — /)[1]}</span></>}</h1>
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
              {w.rating.count > 0 && <><Stars value={w.rating.average} /> <b className="text-ink">{String(w.rating.average).replace('.', ',')}</b> · </>}
              {w.readers_count} lecteur{w.readers_count > 1 ? 's' : ''}
            </p>
            <p className="max-w-2xl text-[17px] leading-relaxed text-ink-soft">{w.summary}</p>
            <div className="flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2"><Icon name="book-alt" className="text-blue" />{w.sections.length} {w.unit_label}s</span>
              <span className="flex items-center gap-2"><Icon name="clock" className="text-blue" />≈ {minutes} h de lecture</span>
              <span className="flex items-center gap-2"><Icon name="devices" className="text-blue" />2 appareils</span>
            </div>
            <div className="card grid max-w-xl gap-4 p-6">
              {!free && !w.owned && (
                <div className="flex flex-wrap items-end gap-3">
                  <div><div className="text-xs text-muted">Prix</div>
                    <div className="text-[32px] leading-none font-bold">{w.is_promo_active && <s className="mr-2 text-base font-normal text-faint">{fcfa(w.price_xof)}</s>}{fcfa(w.current_price_xof)}</div></div>
                  {w.is_promo_active && w.promo_ends_at && <Countdown until={w.promo_ends_at} />}
                </div>
              )}
              <div className="flex flex-wrap gap-3">
                {w.owned ? <Link to={`/lire/${w.slug}`} className="btn btn-blue flex-1">Continuer la lecture</Link>
                  : w.status === 'preorder' ? <button className="btn btn-primary flex-1 shadow-orange" onClick={buyNow}>Précommander</button>
                  : !free ? <button className="btn btn-primary flex-1 shadow-orange" onClick={buyNow}>Acheter maintenant</button>
                  : w.access_mode === 'free_form' ? <Link to={user ? `/acces/${w.slug}` : `/connexion?suivant=/acces/${w.slug}`} className="btn btn-primary flex-1 shadow-orange">Recevoir le livre</Link>
                  : w.access_mode === 'free_account' ? <button className="btn btn-primary flex-1" onClick={claim}>Ajouter à ma bibliothèque</button>
                  : <Link to={`/lire/${w.slug}`} className="btn btn-primary flex-1">Lire</Link>}
                {!w.owned && <Link to={`/lire/${w.slug}`} className="btn btn-ghost flex-1">Lire l'extrait</Link>}
                {!free && !w.owned && (
                  <button className="btn btn-ghost" disabled={cart.has('work', w.id)} aria-label="Ajouter au panier" title="Ajouter au panier"
                    onClick={() => { cart.add({ type: 'work', id: w.id, label: w.title, price: w.current_price_xof }); toast('Ajouté au panier.') }}>
                    <Icon name={cart.has('work', w.id) ? 'check' : 'shopping-bag'} />
                  </button>
                )}
              </div>
              {!free && <div className="flex flex-wrap items-center gap-2 text-xs text-muted">{PAYMENT_METHODS.map((m) => <PayLogo key={m.value} method={m.value} size={26} />)}<span className="ml-1">Orange Money · MTN · Moov · Wave · Visa</span></div>}
            </div>
            {w.bundles.map((b: any) => (
              <div key={b.id} className="flex max-w-xl flex-wrap items-center gap-3 rounded-xl bg-blue-tint px-5 py-4 text-sm">
                <span><b>{b.title}</b> — {fcfa(b.price_xof)} au lieu de {fcfa(b.full_price_xof)}</span>
                <button className="btn btn-blue btn-sm ml-auto" onClick={() => { cart.add({ type: 'bundle', id: b.id, label: b.title, price: b.price_xof }); nav('/paiement') }}>Prendre le pack</button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Extrait gratuit (maquette 11b) */}
      {freeSections.length > 0 && !w.owned && (
        <section className="mt-16 bg-paper py-16">
          <div className="container-x grid gap-10 lg:grid-cols-[1fr_1.1fr]">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[.12em] text-orange"><Icon name="book-open-reader" />EXTRAIT GRATUIT</div>
              <h2 className="mt-3 text-[28px]">Les {freeSections.length === 1 ? 'premières pages' : `${freeSections.length} premières ${w.unit_label}s`}</h2>
              <p className="mt-2 text-muted">Lisibles sans compte. {w.sections.length > freeSections.length && `Les ${w.sections.length - freeSections.length} autres ${w.unit_label}s sont débloquées ${free ? 'gratuitement' : 'après l\u2019achat'}.`}</p>
              <ol className="mt-6 grid gap-2">
                {w.sections.slice(0, freeSections.length + 1).map((x: any) => (
                  <li key={x.id}>
                    <Link to={`/lire/${w.slug}?section=${x.id}`} className={`flex items-center gap-4 rounded-xl bg-[var(--card)] px-4 py-3.5 ${x.free ? 'hover:ring-2 hover:ring-blue-tint' : 'opacity-60'}`}>
                      <b className="w-7 text-blue tabular-nums">{String(x.number).padStart(2, '0')}</b>
                      <span className="flex-1 font-medium">{x.title || `${w.unit_label === 'série' ? 'Série' : 'Histoire'} ${x.number}`}</span>
                      {x.free ? <span className="text-sm font-semibold text-blue">Lire →</span> : <Icon name="lock" className="text-faint" />}
                    </Link>
                  </li>
                ))}
              </ol>
            </div>
            <ExtractPreview work={w} sectionId={freeSections[0].id} />
          </div>
        </section>
      )}

      {/* Barre d'achat collante en mobile (maquette 16f) */}
      {!free && !w.owned && (
        <div className="fixed inset-x-0 bottom-[84px] z-30 flex items-center gap-3.5 bg-[var(--card)] px-5 py-3 shadow-[0_-10px_30px_-14px_rgba(4,28,92,.3)] md:hidden">
          <div><div className="text-[12px] text-muted">Prix</div><b className="text-xl">{w.current_price_xof.toLocaleString('fr-FR')} F</b></div>
          <button className="btn btn-primary flex-1" onClick={buyNow}>Acheter</button>
        </div>
      )}
      <div className="container-x grid gap-14 py-16 lg:grid-cols-2">
        <Reviews work={w} onPosted={reload} />
        {w.related.length > 0 && (
          <section>
            <h2 className="mb-4 text-2xl">À lire aussi</h2>
            <div className="grid grid-cols-3 gap-4">
              {w.related.map((r: any) => (
                <Link key={r.id} to={`/livres/${r.slug}`} className="grid gap-2">
                  <WorkCover work={r} />
                  <span className="text-sm font-semibold">{r.title}</span>
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  )
}

/** Première page de l'extrait : la même image filigranée que dans le lecteur. */
function ExtractPreview({ work, sectionId }: { work: any; sectionId: number }) {
  const { data } = useApi(`/api/reader/sections/${sectionId}/manifest/`)
  return (
    <div className="card relative overflow-hidden p-4">
      <div className="mb-3 flex justify-between px-2 text-xs font-semibold tracking-[.08em] text-faint">
        <span>{data ? `${work.unit_label === 'série' ? 'SÉRIE' : 'HISTOIRE'} ${String(data.section.number).padStart(2, '0')}${data.section.title ? ` · ${data.section.title.toUpperCase()}` : ''}` : '…'}</span>
        {data && <span>1 / {data.pages.length}</span>}
      </div>
      {data?.pages?.[0] ? <img src={data.pages[0]} alt="Première page de l'extrait" draggable={false} className="no-copy pointer-events-none w-full rounded-lg" /> : <Spinner />}
      <Link to={`/lire/${work.slug}?section=${sectionId}`} className="btn btn-blue mt-4 w-full">Continuer la lecture →</Link>
    </div>
  )
}

function Reviews({ work, onPosted }: { work: any; onPosted: () => void }) {
  const [rating, setRating] = useState(0)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState<unknown>(null)
  const send = async () => {
    try {
      const r = await post(`/api/catalog/works/${work.slug}/reviews/`, { rating, body })
      setMsg(r.message)
      onPosted()
    } catch (e) {
      setErr(e)
    }
  }
  return (
    <section className="mt-6">
      <h2 className="mb-4 text-2xl">Avis des lecteurs</h2>
      {work.reviews.length === 0 && <p className="text-muted">Pas encore d'avis publié.</p>}
      <div className="grid gap-5">
        {work.reviews.map((r: any) => (
          <figure key={r.id} className="border-b border-line pb-4">
            <Stars value={r.rating} />
            <blockquote className="mt-1 font-serif text-lg">{r.body}</blockquote>
            <figcaption className="text-sm text-muted">{r.author}</figcaption>
          </figure>
        ))}
      </div>
      {work.owned && (
        msg ? <p className="mt-4 text-ok">{msg}</p> : (
          <div className="card mt-6 grid gap-3 p-5">
            <p className="font-semibold">Votre avis</p>
            <div className="flex gap-1" role="radiogroup" aria-label="Note">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} sur 5`} onClick={() => setRating(n)}
                  className={`text-2xl ${n <= rating ? 'text-orange' : 'text-line'}`}>★</button>
              ))}
            </div>
            <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Qu'avez-vous pensé du livre ?" />
            <ErrorNote error={err} />
            <button className="btn btn-dark justify-self-start" disabled={!rating} onClick={send}>Publier mon avis</button>
          </div>
        )
      )}
    </section>
  )
}
