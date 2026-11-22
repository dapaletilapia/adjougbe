import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHero } from '../components/PageHero'
import { Icon, Spinner, WorkCover } from '../components/ui'
import { useCart } from '../lib/cart'
import { fcfa } from '../lib/format'
import { useApi, useTitle } from '../lib/hooks'

export default function Shop() {
  useTitle('Œuvres')
  const works = useApi<any[]>('/api/catalog/works/')
  const bundles = useApi<any[]>('/api/catalog/bundles/')
  const cart = useCart()
  const nav = useNavigate()
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const list = (works.data ?? []).filter((w) =>
    (filter === 'all' || (filter === 'paid' ? w.access_mode === 'paid' : w.access_mode !== 'paid'))
    && (!q || `${w.title} ${w.summary}`.toLowerCase().includes(q.toLowerCase())))
  const count = (f: (w: any) => boolean) => (works.data ?? []).filter(f).length
  const buy = (type: 'work' | 'bundle', item: any, price: number) => { cart.add({ type, id: item.id, label: item.title, price }); nav('/paiement') }

  return (
    <>
      <PageHero crumbs={[['Accueil', '/'], ['Œuvres']]} eyebrow="NOS ŒUVRES" title="Des livres pour" accent="se relever et diriger."
        text="Lecture en ligne protégée, extrait gratuit sans compte, accès immédiat après paiement." />
      <div className="container-x relative z-[1] -mt-2 flex flex-wrap items-center gap-2.5">
        {[['all', `Tout · ${count(() => true)}`], ['paid', `Payantes · ${count((w) => w.access_mode === 'paid')}`], ['free', `Offertes · ${count((w) => w.access_mode !== 'paid')}`]].map(([v, l]) => (
          <button key={v} onClick={() => setFilter(v)} aria-pressed={filter === v}
            className={`rounded-full px-[18px] py-2.5 text-sm font-medium ${filter === v ? 'bg-ink text-white' : 'bg-[var(--card)] shadow-[0_6px_16px_-12px_rgba(4,28,92,.4)]'}`}>{l}</button>
        ))}
        <label className="relative ml-auto w-full max-w-[320px]">
          <span className="sr-only">Rechercher dans les œuvres</span>
          <Icon name="search" className="absolute top-1/2 left-4 -translate-y-1/2 text-faint" />
          <input className="input !rounded-full !bg-[var(--card)] !pl-11 shadow-[0_6px_16px_-12px_rgba(4,28,92,.4)]" placeholder="Rechercher dans les œuvres…" value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
      </div>

      <section className="container-x mt-10 grid gap-7 md:grid-cols-2 xl:grid-cols-3">
        {works.loading && <Spinner />}
        {list.map((w) => {
          const free = w.access_mode !== 'paid'
          return (
            <article key={w.id} className="card relative flex gap-5 p-5">
              <Link to={`/livres/${w.slug}`} className="block w-[110px] shrink-0 sm:w-[130px] md:w-[140px]"><WorkCover work={w} /></Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  {free && <span className="rounded-md bg-orange px-2.5 py-1 text-[12px] font-semibold text-white">Offerte</span>}
                  <span className="chip">{free ? 'Contre un formulaire' : `${w.sections_count} ${w.unit_label}s`}</span>
                  {w.rating?.average && <span><span className="text-orange">★</span> {String(w.rating.average).replace('.', ',')}</span>}
                </div>
                <h2 className="mt-2.5 text-lg leading-snug"><Link to={`/livres/${w.slug}`}>{w.title}</Link></h2>
                <p className="mt-1.5 line-clamp-3 text-[14.5px] leading-relaxed text-muted">{w.subtitle || w.summary}</p>
                <p className="mt-auto pt-3 text-lg font-bold">
                  {free ? 'Gratuit' : <>{w.is_promo_active && <s className="mr-2 text-sm font-normal text-faint">{fcfa(w.price_xof)}</s>}{fcfa(w.current_price_xof)}</>}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 [&>*]:min-w-[104px] [&>*]:flex-1">
                  <Link to={`/lire/${w.slug}`} className="btn btn-ghost btn-sm">{w.owned ? 'Lire' : 'Extrait'}</Link>
                  {w.owned ? <span className="chip chip-ok justify-center">Dans ma bibliothèque</span>
                    : free ? <Link to={`/livres/${w.slug}`} className="btn btn-primary btn-sm">Recevoir</Link>
                      : <button className="btn btn-primary btn-sm" onClick={() => buy('work', w, w.current_price_xof)}>Acheter</button>}
                </div>
              </div>
            </article>
          )
        })}
        {!works.loading && !list.length && <p className="text-muted">Aucune œuvre ne correspond à votre recherche.</p>}
      </section>

      {bundles.data?.map((b) => (
        <section key={b.id} className="container-x mt-10">
          <div className="hero-grad relative flex flex-wrap items-center gap-6 overflow-hidden rounded-[18px] px-7 py-7 text-white md:px-10">
            <div className="flex">
              {b.works.slice(0, 2).map((w: any, i: number) => <div key={w.id} className="w-[84px]" style={{ marginLeft: i ? -24 : 0, transform: `rotate(${i ? 6 : -6}deg)` }}><WorkCover work={w} /></div>)}
            </div>
            <div className="min-w-0 flex-1">
              {b.full_price_xof > b.price_xof && <span className="rounded-md bg-orange px-2.5 py-1 text-xs font-semibold">Offre spéciale · −{Math.round(100 - (b.price_xof / b.full_price_xof) * 100)} %</span>}
              <h2 className="mt-2.5 text-2xl">{b.title}</h2>
              <p className="text-sm opacity-85">{b.works.map((w: any) => w.title).join(' + ')}</p>
            </div>
            <div className="text-right">
              {b.full_price_xof > b.price_xof && <s className="block text-sm opacity-70">{fcfa(b.full_price_xof)}</s>}
              <b className="text-3xl">{fcfa(b.price_xof)}</b>
            </div>
            <button className="btn btn-primary shadow-orange" onClick={() => buy('bundle', b, b.price_xof)}>Prendre le pack →</button>
          </div>
        </section>
      ))}
      <div className="h-24" />
    </>
  )
}
