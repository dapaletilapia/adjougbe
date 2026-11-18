import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Empty, ErrorNote, Icon, PayLogo, WorkCover } from '../components/ui'
import { ApiError, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useCart } from '../lib/cart'
import { fcfa, PAYMENT_METHODS } from '../lib/format'
import { useApi, useSettings, useTitle } from '../lib/hooks'

const SHORT: Record<string, string> = { orange_money: 'Orange Money', mtn_momo: 'MTN MoMo', moov_money: 'Moov Money', wave: 'Wave', card: 'Carte' }
const BRAND: Record<string, [string, string]> = { orange_money: ['#FF7900', '#FFF7F0'], mtn_momo: ['#E0B400', '#FFFBEA'], moov_money: ['#0067B1', '#EEF6FD'], wave: ['#1DC8F2', '#EDFBFF'], card: ['#1A1F71', '#F1F2FA'] }

/** Étapes du tunnel d'achat (maquette 12c). */
export function Steps({ current }: { current: 1 | 2 | 3 }) {
  const steps = ['Panier', 'Paiement', 'Lecture']
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm" aria-label="Étapes de l'achat">
      {steps.map((s, i) => {
        const n = i + 1
        const done = n < current, active = n === current
        return (
          <li key={s} className="flex items-center gap-3">
            {i > 0 && <span className={`h-0.5 w-10 md:w-[60px] ${n <= current ? 'bg-ok' : 'bg-[#D9DBE0]'}`} />}
            <span className={`flex items-center gap-2 font-semibold ${done ? 'text-ok' : active ? 'text-blue' : 'text-faint'}`} aria-current={active ? 'step' : undefined}>
              <span className={`grid h-[26px] w-[26px] place-items-center rounded-full text-xs ${done ? 'bg-ok text-white' : active ? 'bg-blue text-white shadow-[0_0_0_5px_rgba(47,104,183,.15)]' : 'border-2 border-[#D9DBE0]'}`}>
                {done ? <Icon name="check" /> : n}
              </span>{s}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

/** Choix du moyen de paiement en tuiles (maquette 12c). */
export function PaymentPicker({ value, onChange, enabled }: { value: string; onChange: (v: string) => void; enabled?: string[] }) {
  const methods = PAYMENT_METHODS.filter((m) => !enabled || enabled.includes(m.value))
  return (
    <div role="radiogroup" aria-label="Moyen de paiement" className="flex flex-col gap-2 sm:grid sm:grid-cols-5 sm:gap-3">
      {methods.map((m) => {
        const on = value === m.value
        const [c, bg] = BRAND[m.value]
        return (
          <button type="button" role="radio" aria-checked={on} key={m.value} onClick={() => onChange(m.value)}
            className="relative flex items-center gap-3 rounded-[14px] bg-[var(--card)] p-3 text-left transition-colors sm:block sm:px-2 sm:py-4 sm:text-center"
            style={on ? { border: `2px solid ${c}`, background: bg } : { border: '1px solid var(--color-line)' }}>
            {on && <span className="absolute top-2 right-2 hidden h-[18px] w-[18px] place-items-center rounded-full text-[10px] text-white sm:grid" style={{ background: c }}><Icon name="check" /></span>}
            <span className="flex justify-center"><PayLogo method={m.value} size={44} /></span>
            <span className="flex-1 text-sm font-semibold sm:mt-2.5 sm:block sm:text-[13px]">{SHORT[m.value]}</span>
            <span className="h-5 w-5 shrink-0 rounded-full sm:hidden" style={on ? { border: `6px solid ${c}` } : { border: '2px solid #D9DBE0' }} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

/** Étape 2 : paiement (maquette 12c). */
export function Checkout() {
  useTitle('Paiement')
  const cart = useCart()
  const { user } = useAuth()
  const nav = useNavigate()
  const works = useApi<any[]>('/api/catalog/works/')
  const bundles = useApi<any[]>('/api/catalog/bundles/')
  const site = useSettings<{ payment_methods: string[] }>()
  const [params] = useSearchParams()
  const [promo, setPromo] = useState(params.get('promo') ?? '')
  const [appliedPromo, setAppliedPromo] = useState(params.get('promo') ?? '')
  const [quote, setQuote] = useState<any>(null)
  const [method, setMethod] = useState('orange_money')
  const [phone, setPhone] = useState('')
  const [gift, setGift] = useState(false)
  const [giftEmail, setGiftEmail] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [promoErr, setPromoErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => { if (user?.phone) setPhone(user.phone) }, [user])
  const items = cart.items.map(({ type, id }) => ({ type, id }))
  useEffect(() => {
    if (!items.length) { setQuote(null); return }
    post('/api/shop/quote/', { items, promo_code: appliedPromo, gift })
      .then((q) => { setQuote(q); setPromoErr(''); setError(null) })
      .catch((e: ApiError) => {
        if (e.field('promo_code')) { setPromoErr(e.field('promo_code')!); setAppliedPromo('') }
        else { setQuote(null); setError(new Error(`${e.field('items') || e.message} Retirez l'article concerné du panier.`)) }
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), appliedPromo, gift])

  // Couvertures des articles du panier (œuvres seules ou contenues dans un pack).
  const coverWorks = cart.items.flatMap((i) => i.type === 'work'
    ? (works.data ?? []).filter((w) => w.id === i.id)
    : (bundles.data ?? []).find((b) => b.id === i.id)?.works ?? [])

  const pay = async () => {
    if (!user) return nav('/connexion?suivant=/paiement')
    setBusy(true); setError(null)
    try {
      const r = await post('/api/shop/checkout/', {
        items, payment_method: method, promo_code: appliedPromo, gift_email: gift ? giftEmail : '', payer_phone: method === 'card' ? '' : phone,
      })
      cart.clear()
      window.location.href = r.redirect_url
    } catch (e) { setError(e) } finally { setBusy(false) }
  }

  if (!cart.items.length)
    return (
      <div className="container-x py-16">
        <Empty title="Votre panier est vide" action={<Link to="/boutique" className="btn btn-primary">Voir les œuvres</Link>}>
          Choisissez un livre ou un pack, puis revenez ici pour payer en Mobile Money ou par carte.
        </Empty>
      </div>
    )

  const owned = cart.items.filter((i) => quote && !quote.lines.some((l: any) => l.type === i.type && l.id === i.id))
  const mm = method !== 'card'
  return (
    <div className="bg-paper pb-24">
      <div className="container-x pt-10"><Link to="/panier" className="mb-4 inline-block text-sm text-muted">← Modifier le panier</Link><Steps current={2} /></div>
      <div className="container-x mt-7 grid gap-7 lg:grid-cols-[1.5fr_1fr]">
        <section className="card p-6 md:p-8">
          <h1 className="text-[24px] md:text-[28px]">Choisissez votre moyen de paiement</h1>
          <div className="mt-6"><PaymentPicker value={method} onChange={setMethod} enabled={site.data?.payment_methods} /></div>
          {mm && (
            <label className="field mt-6">
              <span>Numéro {SHORT[method]}</span>
              <input className="input text-base font-semibold tracking-wide" type="tel" inputMode="tel" autoComplete="tel" placeholder="+225 07 00 00 00 00" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
          )}
          <div className="hero-grad mt-6 flex items-center gap-4 rounded-[14px] p-5 text-white">
            <span className="h-14 w-14 shrink-0 animate-spin rounded-full border-4 border-white/20 border-t-orange border-r-orange [animation-duration:2.4s]" aria-hidden="true" />
            <div>
              <b className="text-[17px]">{mm ? 'Vous confirmerez sur votre téléphone' : 'Paiement sécurisé par carte'}</b>
              <p className="mt-1 text-[13px] leading-relaxed opacity-85">
                {mm ? `Après « Payer », validez la notification ${SHORT[method]} sur votre téléphone. L'accès se débloque automatiquement.`
                  : 'Vous serez redirigé vers la page sécurisée de la banque (Visa, Mastercard), puis ramené ici.'}
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <h2 className="text-lg">Votre panier</h2>
            <ul className="mt-3 divide-y divide-line">
              {cart.items.map((i) => (
                <li key={`${i.type}-${i.id}`} className="flex items-center gap-4 py-3">
                  <span className="flex-1 font-medium">{i.label}</span>
                  <span className="tabular-nums">{fcfa(i.price)}</span>
                  <button className="text-sm text-muted underline" onClick={() => cart.remove(i.type, i.id)}>Retirer</button>
                </li>
              ))}
            </ul>
            {owned.length > 0 && !gift && <p className="mt-2 rounded-lg bg-blue-tint px-4 py-3 text-sm">Vous possédez déjà : {owned.map((o) => o.label).join(', ')}. Ils ne vous seront pas facturés.</p>}
            <label className="mt-4 flex items-center gap-3 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-orange" checked={gift} onChange={(e) => setGift(e.target.checked)} />
              C'est un cadeau : le destinataire reçoit un code d'accès par e-mail
            </label>
            {gift && <input className="input mt-3 max-w-md" type="email" placeholder="E-mail du destinataire" aria-label="E-mail du destinataire" value={giftEmail} onChange={(e) => setGiftEmail(e.target.value)} />}
          </div>
        </section>

        <aside className="card flex h-max flex-col gap-3.5 p-7 lg:sticky lg:top-32">
          <div className="text-xs font-semibold tracking-[.1em] text-faint">VOTRE COMMANDE</div>
          <div className="flex items-center gap-3.5 rounded-xl bg-paper p-3.5">
            <div className="flex">
              {coverWorks.slice(0, 3).map((w: any, i: number) => <div key={`${w.id}-${i}`} className="w-12" style={{ marginLeft: i ? -16 : 0 }}><WorkCover work={w} /></div>)}
            </div>
            <div className="min-w-0"><b className="block truncate">{cart.items.map((i) => i.label).join(' + ')}</b><span className="text-[13px] text-muted">{cart.items.length} article(s)</span></div>
          </div>
          <div className="flex gap-2">
            <input className="input !min-h-10" placeholder="Code promo" aria-label="Code promo" value={promo} onChange={(e) => setPromo(e.target.value)} />
            <button className="btn btn-ghost btn-sm" onClick={() => setAppliedPromo(promo.trim())} disabled={!promo.trim()}>Appliquer</button>
          </div>
          {promoErr && <span className="err -mt-2">{promoErr}</span>}
          {quote && (
            <>
              <div className="flex justify-between text-sm text-muted"><span>Sous-total</span><span>{fcfa(quote.subtotal)}</span></div>
              {quote.discount > 0 && <div className="flex justify-between text-sm text-ok"><span>Remise {quote.promo_code}</span><span>− {fcfa(quote.discount)}</span></div>}
              <div className="h-px bg-[#EFF0F2]" />
              <div className="flex items-baseline justify-between"><b>Total</b><b className="text-[32px]">{quote.total.toLocaleString('fr-FR')} <span className="text-sm font-medium">FCFA</span></b></div>
            </>
          )}
          {user && !user.email_verified && <p className="rounded-lg bg-[#FEF3C7] px-4 py-3 text-sm text-warn">Confirmez votre adresse e-mail avant votre premier achat. <Link to="/compte" className="underline">Renvoyer le lien</Link></p>}
          <ErrorNote error={error} />
          <button className="btn btn-primary !py-4 shadow-orange" onClick={pay}
            disabled={busy || !quote?.lines.length || (gift && !giftEmail) || (!!user && !user.email_verified) || (mm && !!user && phone.replace(/\D/g, '').length < 8)}>
            {busy ? 'Redirection…' : !user ? 'Se connecter pour payer' : quote?.total ? `Payer ${fcfa(quote.total)}` : 'Valider'}
          </button>
          <p className="flex items-center gap-2 text-xs text-muted"><Icon name="lock" />Paiement sécurisé · reçu envoyé par e-mail · aucun fichier téléchargé</p>
        </aside>
      </div>
    </div>
  )
}


/** Étape 1 : panier, code promo et passage au pack (maquette 13c). */
export default function Cart() {
  useTitle('Mon panier')
  const cart = useCart()
  const nav = useNavigate()
  const works = useApi<any[]>('/api/catalog/works/')
  const bundles = useApi<any[]>('/api/catalog/bundles/')
  const [promo, setPromo] = useState('')
  const [applied, setApplied] = useState('')
  const [quote, setQuote] = useState<any>(null)
  const [promoErr, setPromoErr] = useState('')
  const [error, setError] = useState<unknown>(null)
  const items = cart.items.map(({ type, id }) => ({ type, id }))
  useEffect(() => {
    if (!items.length) { setQuote(null); return }
    post('/api/shop/quote/', { items, promo_code: applied })
      .then((q) => { setQuote(q); setPromoErr(''); setError(null) })
      .catch((e: ApiError) => {
        if (e.field('promo_code')) { setPromoErr(e.field('promo_code')!); setApplied('') }
        else setError(new Error(`${e.field('items') || e.message} Retirez l'article concerné.`))
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(items), applied])

  const workOf = (id: number) => (works.data ?? []).find((w) => w.id === id)
  // Pack proposé quand toutes ses œuvres sont dans le panier à l'unité.
  const upsell = (bundles.data ?? []).find((b) => b.works.every((w: any) => cart.has('work', w.id)) && !cart.has('bundle', b.id))
  const unitTotal = upsell ? upsell.works.reduce((a: number, w: any) => a + (cart.items.find((i) => i.type === 'work' && i.id === w.id)?.price ?? 0), 0) : 0
  const toBundle = () => { upsell.works.forEach((w: any) => cart.remove('work', w.id)); cart.add({ type: 'bundle', id: upsell.id, label: upsell.title, price: upsell.price_xof }) }

  if (!cart.items.length)
    return (
      <div className="container-x py-16">
        <Empty title="Votre panier est vide" action={<Link to="/boutique" className="btn btn-primary">Voir les œuvres</Link>}>
          Choisissez un livre ou un pack, puis payez en Mobile Money ou par carte.
        </Empty>
      </div>
    )
  return (
    <div className="bg-paper pb-24">
      <div className="container-x pt-10"><Steps current={1} /></div>
      <div className="container-x mt-7 grid gap-7 lg:grid-cols-[1.5fr_1fr]">
        <section className="grid content-start gap-3.5">
          <h1 className="mb-1 text-[28px] md:text-[30px]">Mon panier <span className="font-medium text-faint">({cart.items.length})</span></h1>
          {cart.items.map((i) => {
            const w = i.type === 'work' ? workOf(i.id) : null
            const b = i.type === 'bundle' ? (bundles.data ?? []).find((x) => x.id === i.id) : null
            return (
              <div key={`${i.type}-${i.id}`} className="card flex items-center gap-5 p-4 md:p-[18px]">
                <div className="flex shrink-0">
                  {(w ? [w] : b?.works ?? []).slice(0, 2).map((x: any, k: number) => <div key={x.id} className="w-[54px] md:w-[70px]" style={{ marginLeft: k ? -22 : 0 }}><WorkCover work={x} /></div>)}
                </div>
                <div className="min-w-0 flex-1"><b className="block text-[15px] md:text-[17px]">{i.label}</b><span className="text-[13px] text-muted">Lecture en ligne · accès illimité</span></div>
                <b className="text-base md:text-lg">{i.price.toLocaleString('fr-FR')} F</b>
                <button onClick={() => cart.remove(i.type, i.id)} className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-paper text-faint hover:text-ink" aria-label={`Retirer ${i.label}`}><Icon name="cross-small" /></button>
              </div>
            )
          })}
          {upsell && unitTotal > upsell.price_xof && (
            <div className="hero-grad flex flex-wrap items-center gap-4 rounded-2xl px-5 py-[18px] text-white shadow-[0_20px_40px_-24px_rgba(4,28,92,.7)]">
              <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-orange font-bold">%</span>
              <div className="min-w-0 flex-1"><b>Passez au pack et économisez {(unitTotal - upsell.price_xof).toLocaleString('fr-FR')} FCFA</b><div className="text-[13px] opacity-85">{upsell.title} en une seule commande.</div></div>
              <button onClick={toBundle} className="btn btn-sm bg-white text-blue-dark">Convertir en pack</button>
            </div>
          )}
          {quote && cart.items.some((i) => !quote.lines.some((l: any) => l.type === i.type && l.id === i.id)) && (
            <p className="rounded-xl bg-blue-tint px-4 py-3 text-sm">
              Déjà dans votre bibliothèque : {cart.items.filter((i) => !quote.lines.some((l: any) => l.type === i.type && l.id === i.id)).map((i) => i.label).join(', ')}. Ces articles ne seront pas facturés.
              {!quote.lines.length && <> <Link to="/bibliotheque" className="font-semibold text-blue">Ouvrir ma bibliothèque</Link></>}
            </p>
          )}
          <ErrorNote error={error} />
        </section>
        <aside className="card flex h-max flex-col gap-3.5 p-7 lg:sticky lg:top-32">
          <b className="text-lg">Récapitulatif</b>
          <label className="field">
            <span>Code promo</span>
            <div className="flex gap-2">
              <input className={`input font-semibold tracking-wider uppercase ${promoErr ? '!border-[#E2582A]' : ''}`} value={promo} onChange={(e) => setPromo(e.target.value)} />
              <button className="btn btn-ghost" onClick={() => setApplied(promo.trim())} disabled={!promo.trim()}>Appliquer</button>
            </div>
            {promoErr && <span className="err">{promoErr}</span>}
            {applied && quote?.promo_code && <span className="text-xs text-ok">Code {quote.promo_code} appliqué.</span>}
          </label>
          {quote && (
            <>
              <div className="flex justify-between text-sm text-muted"><span>Sous-total</span><span>{fcfa(quote.subtotal)}</span></div>
              <div className="flex justify-between text-sm text-muted"><span>Réduction</span><span className={quote.discount ? 'text-ok' : ''}>{quote.discount ? `− ${fcfa(quote.discount)}` : '0 F'}</span></div>
              <div className="h-px bg-[#EFF0F2]" />
              <div className="flex items-baseline justify-between"><b>Total</b><b className="text-[30px]">{quote.total.toLocaleString('fr-FR')} <span className="text-sm font-medium">FCFA</span></b></div>
            </>
          )}
          <button className="btn btn-primary !py-4 shadow-orange" disabled={!quote?.lines.length} onClick={() => nav(`/paiement${applied ? `?promo=${encodeURIComponent(applied)}` : ''}`)}>Passer au paiement →</button>
          <p className="text-center text-xs text-muted">Panier conservé même après déconnexion.</p>
        </aside>
      </div>
    </div>
  )
}
