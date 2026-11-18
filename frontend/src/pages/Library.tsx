import { Link, useNavigate, useParams } from 'react-router-dom'
import { DynamicForm } from '../components/DynamicForm'
import { ClientShell, greeting } from '../components/ClientShell'
import { BackLink, Empty, ErrorNote, Spinner, WorkCover } from '../components/ui'
import { useAuth } from '../lib/auth'
import { useApi, useTitle } from '../lib/hooks'

function ago(iso: string) {
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 864e5)
  return d <= 0 ? "aujourd'hui" : d === 1 ? 'hier' : `il y a ${d} jours`
}

export default function Library() {
  useTitle('Ma bibliothèque')
  const { user } = useAuth()
  const { data, loading } = useApi<any[]>('/api/reader/library/')
  const devices = useApi<any[]>('/api/auth/devices/')
  const trainings = useApi<any[]>('/api/trainings/mine/')
  const items = data ?? []
  const last = [...items].filter((i) => i.resume).sort((a, b) => +new Date(b.resume.updated_at) - +new Date(a.resume.updated_at))[0]
  const nextTraining = (trainings.data ?? []).filter((e) => e.status === 'confirmed' && new Date(e.session.starts_at) > new Date())
    .sort((a, b) => +new Date(a.session.starts_at) - +new Date(b.session.starts_at))[0]
  const bgs = ['radial-gradient(160px 140px at 50% 40%,#FF9A6B,#FF6B29 70%)', 'radial-gradient(160px 140px at 50% 40%,#1560DC,#041C5C 75%)', 'radial-gradient(160px 140px at 50% 40%,#3FA2FF,#2F68B7 75%)']
  return (
    <ClientShell>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div><div className="text-sm text-muted">{greeting()} {user?.full_name.split(' ')[0]}</div><h1 className="mt-1 text-[28px] md:text-[32px]">Ma bibliothèque</h1></div>
        <Link to="/compte/securite" className="rounded-full bg-[var(--card)] px-4 py-2.5 text-[13px] shadow-[0_10px_20px_-16px_rgba(4,28,92,.5)]">Appareils : <b>{devices.data?.length ?? '…'} / 2</b></Link>
      </div>
      {loading ? <Spinner /> : !items.length ? (
        <div className="mt-8"><Empty title="Aucun livre pour l'instant" action={<Link to="/boutique" className="btn btn-primary">Découvrir les œuvres</Link>}>Les livres achetés ou offerts apparaissent ici, prêts à lire.</Empty></div>
      ) : (
        <>
          {last && (
            <section className="relative mt-10 grid items-center gap-8 overflow-hidden rounded-[18px] px-7 py-8 text-white shadow-[0_30px_60px_-30px_rgba(4,28,92,.7)] md:grid-cols-[140px_1fr_auto] md:px-10"
              style={{ background: 'radial-gradient(500px 300px at 85% 30%,#3FA2FF,transparent 70%),linear-gradient(125deg,#041C5C,#0A3A9E 45%,#1560DC)' }}>
              <div className="pointer-events-none absolute inset-0 opacity-[.04]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
              <div className="relative hidden w-[140px] md:-my-12 md:block"><WorkCover work={last.work} /></div>
              <div className="relative">
                <div className="text-xs font-semibold tracking-[.12em] opacity-80">REPRENDRE · LU {ago(last.resume.updated_at).toUpperCase()}{last.resume.device ? ` SUR ${last.resume.device.split(' sur ')[1]?.toUpperCase() ?? ''}` : ''}</div>
                <h2 className="mt-2 text-[24px] md:text-[28px]">{last.work.title}</h2>
                <p className="mt-1 opacity-85">{last.work.unit_label === 'série' ? 'Série' : 'Histoire'} {last.resume.number}{last.resume.title ? ` · ${last.resume.title}` : ''}</p>
                <div className="mt-4 flex max-w-[460px] items-center gap-3.5">
                  <div className="h-2 flex-1 rounded-full bg-white/20"><div className="h-full rounded-full bg-orange shadow-[0_0_12px_rgba(255,107,41,.8)]" style={{ width: `${last.percent}%` }} /></div>
                  <span className="text-[13px] font-semibold">{last.sections_read} / {last.sections_total}</span>
                </div>
              </div>
              <Link to={`/lire/${last.work.slug}`} className="btn btn-primary relative shadow-orange">Continuer →</Link>
            </section>
          )}
          <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {items.filter((i) => i !== last).map((it, k) => (
              <article key={it.work.id} className="card p-4">
                <Link to={it.work.status === 'preorder' ? `/livres/${it.work.slug}` : `/lire/${it.work.slug}`} className="grid h-60 place-items-center rounded-xl" style={{ background: bgs[k % 3] }}>
                  <div className="w-[120px] shadow-[0_18px_28px_-10px_rgba(0,0,0,.5)]"><WorkCover work={it.work} /></div>
                </Link>
                <b className="mt-3.5 block">{it.work.title}</b>
                {it.work.status === 'preorder' ? <span className="chip chip-blue mt-2">Précommande · à la sortie</span>
                  : it.percent >= 100 ? <div className="mt-2 text-xs font-semibold text-ok">✓ Terminé</div>
                  : (
                    <div className="mt-2 flex items-center gap-2.5">
                      <div className="h-[5px] flex-1 rounded-full bg-[#EFF0F2]"><div className="h-full rounded-full bg-blue" style={{ width: `${it.percent}%` }} /></div>
                      <span className="text-xs text-muted">{it.sections_read}/{it.sections_total}</span>
                    </div>
                  )}
                {it.buyers_group_link && <a href={it.buyers_group_link} target="_blank" rel="noopener noreferrer" className="mt-2 block text-xs font-semibold text-blue">Rejoindre le groupe des lecteurs</a>}
              </article>
            ))}
            <Link to="/boutique" className="flex min-h-[200px] flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed border-[#D9DBE0] p-4 text-muted">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-blue-tint text-2xl text-blue">+</span><b className="text-ink">Découvrir le catalogue</b>
            </Link>
            {nextTraining && (
              <Link to="/compte/formations" className="card-orange relative flex min-h-[200px] flex-col overflow-hidden p-5">
                <img src="/mark-mono.svg" alt="" className="absolute -right-10 -bottom-10 h-44 w-44 opacity-15" />
                <div className="relative text-xs font-semibold tracking-[.1em] opacity-90">MA PROCHAINE FORMATION</div>
                <b className="relative mt-3 text-[19px] leading-snug">{nextTraining.session.training.title}</b>
                <div className="relative mt-1 text-[13px] opacity-90">{new Date(nextTraining.session.starts_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}{nextTraining.session.location ? ` · ${nextTraining.session.location.split(',')[0]}` : ''}</div>
                <div className="relative mt-auto text-[48px] font-bold">J-{Math.max(0, Math.ceil((+new Date(nextTraining.session.starts_at) - Date.now()) / 864e5))}</div>
              </Link>
            )}
          </div>
        </>
      )}
    </ClientShell>
  )
}

/** Mode « gratuit avec formulaire » : le formulaire débloque l'œuvre. */
export function AccessForm() {
  const { slug } = useParams()
  const nav = useNavigate()
  const toc = useApi(`/api/reader/works/${slug}/toc/`)
  const formSlug = toc.data?.work.access_form
  const form = useApi(formSlug ? `/api/forms/${formSlug}/` : null)
  useTitle(toc.data?.work.title ?? '')
  if (toc.loading || form.loading) return <div className="container-x"><Spinner /></div>
  if (toc.error) return <div className="container-x py-10"><ErrorNote error={toc.error} /></div>
  if (toc.data.full_access) {
    nav(`/lire/${slug}`, { replace: true })
    return null
  }
  const w = toc.data.work
  return (
    <div className="grid min-h-[calc(100vh-120px)] lg:grid-cols-[1fr_1.1fr]">
      <div className="relative flex flex-col items-center justify-center overflow-hidden px-8 py-14 text-center text-white"
        style={{ background: 'radial-gradient(500px 400px at 50% 40%,#3FA2FF 0%,rgba(31,120,240,.55) 38%,transparent 72%),linear-gradient(125deg,#041C5C 0%,#0A3A9E 45%,#1560DC 100%)' }}>
        <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
        <span className="relative rounded-md bg-orange px-3.5 py-1.5 text-xs font-semibold">Œuvre offerte</span>
        <div className="relative mt-8 w-[200px] shadow-[20px_30px_50px_-14px_rgba(4,28,92,.8)] md:w-[240px]" style={{ transform: 'perspective(1000px) rotateY(-14deg)' }}>
          <WorkCover work={{ title: w.title, access_mode: 'free_form', cover_color: '#0E0F13' }} />
        </div>
        <p className="relative mt-9 max-w-[340px] text-[22px] leading-snug font-semibold">Offerte contre trois minutes de votre temps.</p>
      </div>
      <div className="flex flex-col gap-4 px-6 py-12 sm:px-12 lg:px-[60px]">
        <BackLink to={`/livres/${slug}`}>{w.title}</BackLink>
        <div className="kicker mt-2">{w.title}</div>
        <h1 className="text-[28px] leading-tight md:text-[30px]">Dites-nous qui vous êtes,<br />on vous ouvre le livre.</h1>
        {form.data?.description && <p className="text-muted">{form.data.description}</p>}
        <div className="mt-2">
          {form.data ? (
            <DynamicForm form={form.data} query={`?work=${slug}`} submitLabel="Débloquer ma lecture →"
              onDone={(r) => r.work_unlocked && nav(`/lire/${r.work_unlocked}`)} />
          ) : <ErrorNote error={new Error("Le formulaire d'accès n'est pas configuré.")} />}
        </div>
      </div>
    </div>
  )
}
