import { useEffect, useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ErrorNote, PayLogo, Spinner, WorkCover } from '../components/ui'
import { get, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { fcfa, PAYMENT_METHODS } from '../lib/format'
import { useApi, useSettings, useTitle } from '../lib/hooks'
import { Steps } from './Cart'

function GradientScreen({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-[calc(100vh-120px)] flex-col items-center justify-center overflow-hidden px-6 py-16 text-center text-white"
      style={{ background: 'radial-gradient(500px 400px at 50% 35%,#3FA2FF 0%,rgba(31,120,240,.55) 38%,transparent 72%),linear-gradient(125deg,#041C5C 0%,#0A3A9E 45%,#1560DC 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      <div className="relative flex flex-col items-center">{children}</div>
    </div>
  )
}

/** Écran de paiement simulé (développement uniquement : remplacé par CinetPay en recette et production). */
export function PaymentSimulation() {
  useTitle('Paiement (simulation)')
  const [params] = useSearchParams()
  const ref = params.get('ref') ?? ''
  const [order, setOrder] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  useEffect(() => { get(`/api/shop/orders/${ref}/`).then(setOrder).catch(setError) }, [ref])
  const go = async (outcome: string) => {
    await post(`/api/shop/orders/${ref}/simulate/`, { outcome })
    window.location.href = `/paiement/retour?ref=${ref}`
  }
  if (error) return <div className="container-x py-10"><ErrorNote error={error} /></div>
  if (!order) return <div className="container-x"><Spinner /></div>
  return (
    <div className="bg-paper py-10">
      <div className="container-x"><Steps current={2} /></div>
      <div className="container-x mt-8 max-w-xl">
        <div className="card grid gap-5 p-8">
          <span className="chip chip-warn justify-self-start">Mode simulation : aucun argent n'est débité</span>
          <div className="flex items-center gap-4">
            {PAYMENT_METHODS.some((m) => m.value === order.payment_method) && <PayLogo method={order.payment_method} size={52} />}
            <div><h1 className="text-2xl">Paiement {order.payment_method_label}</h1><p className="text-muted">Commande {order.reference} · <b className="text-ink">{fcfa(order.total)}</b></p></div>
          </div>
          <p className="text-sm text-muted">En production, c'est ici que la page de l'opérateur demande la validation sur le téléphone.</p>
          <div className="flex flex-wrap gap-3">
            <button className="btn btn-primary" onClick={() => go('success')}>Simuler un paiement réussi</button>
            <button className="btn btn-ghost" onClick={() => go('failure')}>Simuler un échec</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PaymentReturn() {
  useTitle('Paiement')
  const [params] = useSearchParams()
  const { user } = useAuth()
  const ref = params.get('ref') ?? ''
  const [order, setOrder] = useState<any>(null)
  const [tries, setTries] = useState(0)
  const works = useApi<any[]>('/api/catalog/works/')
  const enrollments = useApi<any[]>('/api/trainings/mine/', [order?.status])
  useEffect(() => {
    let stop = false
    get(`/api/shop/orders/${ref}/`).then((o) => {
      if (stop) return
      setOrder(o)
      // La passerelle peut confirmer quelques secondes après le retour : on revérifie.
      if (o.status === 'pending' && tries < 10) setTimeout(() => setTries((t) => t + 1), 3000)
    })
    return () => { stop = true }
  }, [ref, tries])
  if (!order) return <GradientScreen><Spinner label="Vérification du paiement…" /></GradientScreen>

  if (order.status === 'paid' && order.items.every((i: any) => !i.work_slug) && enrollments.data?.some((e) => e.order_reference === order.reference))
    return <Navigate to={`/compte/formations/${enrollments.data.find((e) => e.order_reference === order.reference)!.id}`} replace />
  if (order.status === 'paid') {
    const slugs = order.items.map((i: any) => i.work_slug).filter(Boolean)
    const bought = (works.data ?? []).filter((w) => slugs.includes(w.slug) || (!slugs.length && w.owned)).slice(0, 2)
    const first = (user?.full_name ?? '').split(' ')[0]
    return (
      <GradientScreen>
        <span className="inline-flex items-center gap-2 rounded-full border border-[#4ADE80]/40 bg-ok/20 px-4 py-2 text-[14px] font-semibold text-[#86EFAC]">
          <span className="h-2 w-2 rounded-full bg-[#4ADE80]" />Paiement confirmé · {order.payment_method_label}
        </span>
        {bought.length > 0 && (
          <div className="mt-11 flex">
            {bought.map((w, i) => (
              <div key={w.id} className="w-[130px] md:w-[150px]" style={{ transform: `perspective(900px) rotateY(${i ? -18 : 18}deg) translateX(${i ? -24 : 24}px)` }}><WorkCover work={w} /></div>
            ))}
          </div>
        )}
        <h1 className="mt-10 text-[36px] md:text-[44px]">C'est à vous{first && <>, <span className="text-peach">{first} !</span></>}</h1>
        <p className="mt-3 max-w-[460px] text-base leading-relaxed opacity-90">
          {order.is_gift ? `Le code cadeau a été envoyé à ${order.gift_recipient_email}.` : `Votre achat est dans votre bibliothèque. Le reçu a été envoyé à ${user?.email ?? 'votre adresse'}.`}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {!order.is_gift && <Link to={bought[0] ? `/lire/${bought[0].slug}` : '/bibliotheque'} className="btn btn-primary !py-4 shadow-orange">Commencer la lecture →</Link>}
          <Link to="/compte/commandes" className="btn border border-white/30 bg-white/12 !py-4 text-white">Voir le reçu</Link>
        </div>
      </GradientScreen>
    )
  }
  if (order.status === 'pending')
    return (
      <GradientScreen>
        <span className="h-16 w-16 animate-spin rounded-full border-4 border-white/20 border-t-orange border-r-orange" aria-hidden="true" />
        <h1 className="mt-8 text-[32px]">Confirmez sur votre téléphone</h1>
        <p className="mt-3 max-w-[440px] opacity-90">Validez l'opération {order.payment_method_label} si ce n'est pas déjà fait. Cette page se met à jour automatiquement.</p>
        <p className="mt-6 text-sm opacity-70">Commande {order.reference} · {fcfa(order.total)}</p>
      </GradientScreen>
    )
  return <PaymentFailed order={order} />
}

/** Paiement échoué (maquette 13d) : réessayer avec le même moyen ou en changer. */
function PaymentFailed({ order }: { order: any }) {
  const site = useSettings<{ whatsapp_number: string }>()
  const [busy, setBusy] = useState(false)
  const retry = async () => {
    setBusy(true)
    try { const r = await post(`/api/shop/orders/${order.reference}/retry/`, {}); window.location.href = r.redirect_url } finally { setBusy(false) }
  }
  return (
    <div className="grid min-h-[calc(100vh-120px)] place-items-center bg-paper px-4 py-16">
      <div className="card flex w-full max-w-[480px] flex-col gap-3.5 p-8 md:p-10">
        <span className="grid h-[72px] w-[72px] place-items-center rounded-[20px] text-[34px] font-bold text-white shadow-[0_16px_30px_-12px_rgba(226,88,42,.8)]" style={{ background: 'linear-gradient(135deg,#FF8A3D,#E2582A)' }}>!</span>
        <h1 className="mt-2.5 text-[26px] md:text-[28px]">Le paiement n'a pas abouti</h1>
        <p className="text-[15px] leading-relaxed text-muted">Solde insuffisant ou délai dépassé. Rien n'a été débité, votre commande reste en attente.</p>
        <div className="flex items-center justify-between rounded-xl bg-paper p-4">
          <div><div className="text-xs text-muted">Commande {order.reference}</div><b className="text-xl">{fcfa(order.total)}</b></div>
          <span className="chip chip-warn">En attente</span>
        </div>
        <button className="btn btn-primary !py-3.5 shadow-orange" onClick={retry} disabled={busy}>Réessayer avec {order.payment_method_label}</button>
        <Link to="/compte/commandes" className="btn btn-ghost !py-3.5">Changer de moyen de paiement</Link>
        {site.data?.whatsapp_number && <p className="text-center text-[14px] text-muted">Besoin d'aide ? <a href={`https://wa.me/${site.data.whatsapp_number}`} className="font-semibold text-blue">WhatsApp support</a></p>}
      </div>
    </div>
  )
}

export function GiftRedeem() {
  useTitle('Code cadeau')
  const [code, setCode] = useState('')
  const [done, setDone] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  const submit = async () => {
    try { setDone(await post('/api/shop/gift/redeem/', { code })) } catch (e) { setError(e) }
  }
  return (
    <div className="container-x max-w-lg py-16">
      <h1 className="mb-4 text-3xl">Utiliser un code cadeau</h1>
      {done ? (
        <div className="grid gap-4">
          <p className="text-lg"><strong>{done.work.title}</strong> est dans votre bibliothèque.</p>
          <Link to={`/lire/${done.work.slug}`} className="btn btn-primary justify-self-start">Commencer la lecture</Link>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-muted">Connectez-vous ou créez un compte, puis saisissez le code reçu.</p>
          <input className="input text-lg tracking-widest uppercase" placeholder="XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
          <ErrorNote error={error} />
          <button className="btn btn-primary justify-self-start" onClick={submit} disabled={!code}>Activer le code</button>
        </div>
      )}
    </div>
  )
}
