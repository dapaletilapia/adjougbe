import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { FilterBar } from '../components/FilterBar'
import { PageHero } from '../components/PageHero'
import { Spinner, WorkCover } from '../components/ui'
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
      <div className="container-x relative z-[1] -mt-2">
        <FilterBar label="Filtrer les œuvres" value={filter} onChange={setFilter}
          options={[{ value: 'all', label: 'Tout', count: count(() => true) }, { value: 'paid', label: 'Payantes', count: count((w) => w.access_mode === 'paid') }, { value: 'free', label: 'Offertes', count: count((w) => w.access_mode !== 'paid') }]}
          search={{ id: 'shop-q', value: q, onChange: setQ, placeholder: 'Rechercher une œuvre' }} />
      </div>

      <section className="container-x mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
        {works.loading && <Spinner />}
        {list.map((w) => {
          const free = w.access_mode !== 'paid'
          const promo = !free && w.is_promo_active && w.price_xof > w.current_price_xof
          const tint = w.cover_color || '#2F68B7'
          return (
            <article key={w.id} className="card group relative flex flex-col overflow-hidden !p-0">
              {/* Scène : la couverture posée sur un fond teinté de sa couleur dominante. */}
              <Link to={`/livres/${w.slug}`} aria-label={w.title} className="relative grid place-items-center overflow-hidden px-8 pt-9 pb-8"
                style={{ background: `radial-gradient(120% 90% at 50% 100%, color-mix(in srgb, ${tint} 34%, transparent), color-mix(in srgb, ${tint} 10%, transparent) 70%)` }}>
                <div className="w-[150px] transition-transform duration-300 group-hover:-translate-y-1.5 group-hover:-rotate-1 sm:w-[168px]"><WorkCover work={w} /></div>
                {free && <span className="absolute top-4 left-4 rounded-full bg-orange px-3 py-1 text-[12.5px] font-semibold text-white">Offerte</span>}
                {promo && <span className="absolute top-4 left-4 rounded-full bg-orange px-3 py-1 text-[12.5px] font-semibold text-white">−{Math.round(100 - (w.current_price_xof / w.price_xof) * 100)} %</span>}
              </Link>
              <div className="flex flex-1 flex-col p-5 pt-4">
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted">
                  <span>{w.sections_count} {w.unit_label}s</span>
                  {w.rating?.average && <span><span className="text-orange">★</span> {String(w.rating.average).replace('.', ',')}</span>}
                </p>
                <h2 className="mt-1.5 text-[19px] leading-snug"><Link to={`/livres/${w.slug}`} className="hover:text-blue">{w.title}</Link></h2>
                <p className="mt-1 mb-5 line-clamp-2 text-[14.5px] leading-relaxed text-muted">{w.subtitle || w.summary}</p>
                <div className="mt-auto flex items-baseline justify-between gap-3 border-t border-line pt-4">
                  <p className="text-[20px] font-bold whitespace-nowrap">
                    {free ? 'Gratuit' : fcfa(w.current_price_xof)}
                    {promo && <s className="ml-2 text-[13.5px] font-normal text-faint">{fcfa(w.price_xof)}</s>}
                  </p>
                  {free && <span className="text-right text-[12.5px] text-muted">contre un formulaire</span>}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
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
