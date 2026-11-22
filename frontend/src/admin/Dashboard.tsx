import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, Spinner } from '../components/ui'
import { download, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Panel, Stat, StatusChip } from './kit'
import { BarList, ColumnChart, DataTable, LineChart, SegmentBar, Sparkline } from './charts'
import { nf } from '../lib/format'

const RANGES: [string, string][] = [['7', '7 jours'], ['30', '30 jours'], ['90', '90 jours'], ['365', '12 mois']]
const PERIOD_TXT: Record<string, string> = { '7': 'aux 7 jours précédents', '30': 'aux 30 jours précédents', '90': 'aux 90 jours précédents', '365': 'aux 12 mois précédents' }

/** Évolution vs période précédente : flèche + texte (jamais la couleur seule). */
function Delta({ now, prev, invert = false, tone }: { now: number; prev: number; invert?: boolean; tone?: 'navy' }) {
  if (!prev) return <span className={tone ? 'text-white/75' : 'text-muted'}>{now ? 'Nouveau sur la période' : 'Pas encore de données'}</span>
  const pct = Math.round(((now - prev) / prev) * 100)
  const good = invert ? pct < 0 : pct > 0
  const cls = tone ? 'bg-white/18 text-white' : pct === 0 ? 'bg-paper text-muted' : good ? 'bg-[#DCFCE7] text-[#15803D]' : 'bg-[#FEE2E2] text-[#B91C1C]'
  return <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[12.5px] font-semibold ${cls}`}>{pct > 0 ? '▲' : pct < 0 ? '▼' : '='} {Math.abs(pct)} %</span>
}

function Kpi({ label, value, now, prev, spark, sub, hero = false }: { label: string; value: string; now: number; prev: number; spark?: number[]; sub?: string; hero?: boolean }) {
  return (
    <div className={`${hero ? 'card-navy' : 'card'} relative flex flex-col gap-1 overflow-hidden p-5`}>
      {hero && <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -right-8 -bottom-8 h-[140px] w-[140px] opacity-10" />}
      <span className={`text-[13.5px] ${hero ? 'text-white/80' : 'text-muted'}`}>{label}</span>
      <b className={`font-bold ${hero ? 'text-[34px] md:text-[40px]' : 'text-[26px]'} leading-tight`}>{value}</b>
      <span className="flex flex-wrap items-center gap-1.5 text-[12.5px]"><Delta now={now} prev={prev} tone={hero ? 'navy' : undefined} />{sub && <span className={hero ? 'text-white/75' : 'text-muted'}>{sub}</span>}</span>
      {spark && <div className="mt-2"><Sparkline values={spark} color={hero ? '#ffffff' : 'var(--chart-1)'} /></div>}
    </div>
  )
}

export default function Dashboard() {
  const [range, setRange] = useState('30')
  const { data: d, loading, reload } = useApi('/api/backoffice/dashboard/')
  const { data: a, loading: aLoading } = useApi(`/api/backoffice/analytics/?range=${range}`)
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  if ((loading && !d) || (aLoading && !a)) return <Spinner />
  if (!d || !a) return null
  const finance = 'revenue' in a.kpis
  const alert = d.alerts?.[0]
  const session = d.upcoming_sessions?.[0]
  const moderation = d.pending_comments + d.pending_reviews
  const k = a.kpis
  const monthly = a.monthly
  const short = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('fr-FR', monthly ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })
  const full = (iso: string) => new Date(iso + 'T12:00').toLocaleDateString('fr-FR', monthly ? { month: 'long', year: 'numeric' } : { weekday: 'long', day: 'numeric', month: 'long' })
  const labels = a.series.map((x: any) => short(x.date))
  const fulls = a.series.map((x: any) => full(x.date))
  const col = (key: string, src = a.series) => src.map((x: any) => x[key] ?? 0)
  const vs = `par rapport ${PERIOD_TXT[range]}`
  const funnelTop = Math.max(1, a.funnel[0].value)

  return (
    <AdminPage
      crumb={<span className="capitalize">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
      title={`Bonjour, ${user?.full_name.split(' ')[0] ?? ''}`}
      search
      actions={<>
        {finance && <button className="btn btn-ghost btn-sm !min-h-[42px]" onClick={() => download('/api/backoffice/finance/export/?format=xlsx', 'ventes.xlsx')}>Export comptable</button>}
        <button className="btn btn-primary !min-h-[42px]" onClick={() => nav('/admin/blog/nouveau')}>+ Nouveau</button>
      </>}>

      {/* Un seul filtre, au-dessus de tout ce qu'il règle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="seg" role="tablist" aria-label="Période analysée">
          {RANGES.map(([v, l]) => <button key={v} role="tab" aria-selected={range === v} onClick={() => setRange(v)}>{l}</button>)}
        </div>
        <span className="text-[13.5px] text-muted">Comparé {PERIOD_TXT[range]}</span>
      </div>

      <div className={`grid gap-4 transition-opacity ${aLoading ? 'opacity-50' : ''}`} aria-busy={aLoading}>
        <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
          <div className="col-span-2 xl:col-span-1">
            {finance
              ? <Kpi hero label="Chiffre d'affaires" value={`${nf.format(k.revenue.value)} F`} now={k.revenue.value} prev={k.revenue.prev} sub={vs} spark={col('revenue')} />
              : <Kpi hero label="Visiteurs" value={nf.format(k.visitors.value)} now={k.visitors.value} prev={k.visitors.prev} sub={vs} spark={col('visitors')} />}
          </div>
          {finance && <Kpi label="Visiteurs" value={nf.format(k.visitors.value)} now={k.visitors.value} prev={k.visitors.prev} spark={col('visitors')} />}
          {finance
            ? <Kpi label="Commandes payées" value={nf.format(k.orders.value)} now={k.orders.value} prev={k.orders.prev} sub={k.orders.value ? `panier moyen ${nf.format(k.avg_order.value)} F` : undefined} spark={col('orders')} />
            : <Kpi label="Pages vues" value={nf.format(k.views.value)} now={k.views.value} prev={k.views.prev} sub={`${String(k.pages_per_visit.value).replace('.', ',')} par visite`} spark={col('views')} />}
          <Kpi label="Comptes créés" value={nf.format(k.signups.value)} now={k.signups.value} prev={k.signups.prev} spark={col('signups')} />
          {!finance && <Kpi label="Taux de conversion" value={`${String(k.conversion.value).replace('.', ',')} %`} now={k.conversion.value} prev={k.conversion.prev} sub="visiteurs devenus acheteurs" />}
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          <Panel title="Visiteurs uniques" action={
            <span className="flex items-center gap-4 text-[12.5px] text-muted">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--chart-1)]" />Période</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-[var(--chart-prev)]" />Précédente</span>
            </span>}>
            <LineChart label={`Visiteurs uniques par ${monthly ? 'mois' : 'jour'}, comparés à la période précédente`} labels={labels} fullLabels={fulls} format={(n) => nf.format(n)}
              series={[
                { key: 'prev', name: 'Période précédente', color: 'var(--chart-prev)', values: col('visitors', a.previous), muted: true },
                { key: 'cur', name: 'Visiteurs', color: 'var(--chart-1)', values: col('visitors') },
              ]} />
            <DataTable caption="Visiteurs par date" head={['Date', 'Visiteurs', 'Pages vues', 'Comptes créés']}
              rows={a.series.map((x: any) => [full(x.date), nf.format(x.visitors), nf.format(x.views), nf.format(x.signups)])} />
          </Panel>
          <Panel title="D'où viennent les visiteurs">
            <BarList format={(n) => nf.format(n)} rows={a.sources.map((s: any) => ({ key: s.key, label: s.label, value: s.visitors, hint: k.visitors.value ? `${Math.round((s.visitors / k.visitors.value) * 100)} %` : undefined }))} />
          </Panel>
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
          {finance ? (
            <Panel title={`Chiffre d'affaires par ${monthly ? 'mois' : 'jour'}`} action={<span className="text-[12.5px] text-muted">FCFA, commandes payées</span>}>
              <ColumnChart label="Chiffre d'affaires par période" labels={labels} fullLabels={fulls} values={col('revenue')} name="Chiffre d'affaires" format={(n) => `${nf.format(n)} F`} />
              <DataTable caption="Chiffre d'affaires par date" head={['Date', 'Chiffre d\u2019affaires (F)', 'Commandes']}
                rows={a.series.map((x: any) => [full(x.date), nf.format(x.revenue), nf.format(x.orders)])} />
            </Panel>
          ) : (
            <Panel title={`Pages vues par ${monthly ? 'mois' : 'jour'}`}>
              <ColumnChart label="Pages vues par période" labels={labels} fullLabels={fulls} values={col('views')} name="Pages vues" format={(n) => nf.format(n)} />
            </Panel>
          )}
          <Panel title="Appareils">
            <SegmentBar label="Visiteurs par appareil" parts={a.devices.map((x: any, i: number) => ({ key: x.key, label: x.label, value: x.visitors, color: ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)'][i] }))} />
            {finance && (
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-[13.5px]">
                <div><dt className="text-muted">Conversion</dt><dd className="text-[20px] font-bold">{String(k.conversion.value).replace('.', ',')} %</dd><dd><Delta now={k.conversion.value} prev={k.conversion.prev} /></dd></div>
                <div><dt className="text-muted">Pages par visite</dt><dd className="text-[20px] font-bold">{String(k.pages_per_visit.value).replace('.', ',')}</dd><dd><Delta now={k.pages_per_visit.value} prev={k.pages_per_visit.prev} /></dd></div>
              </dl>
            )}
          </Panel>
        </div>

        <div className={`grid gap-4 ${finance ? 'xl:grid-cols-3' : 'xl:grid-cols-2'}`}>
          <Panel title="Pages les plus vues">
            <BarList format={(n) => nf.format(n)} rows={a.top_pages.map((p: any) => ({ key: p.path, label: p.label, value: p.views, hint: p.entries ? `${nf.format(p.entries)} entrée${p.entries > 1 ? 's' : ''}` : undefined }))} />
          </Panel>
          <Panel title="Du visiteur à l'acheteur">
            <BarList format={(n) => nf.format(n)} color="var(--chart-3)" rows={a.funnel.map((f: any) => ({ key: f.key, label: f.label, value: f.value, hint: f.key === 'visitors' ? undefined : `${String(Math.round((f.value / funnelTop) * 1000) / 10).replace('.', ',')} %` }))} />
            <p className="mt-4 text-[12.5px] leading-relaxed text-muted">Part des visiteurs de la période qui ont créé un compte, puis payé une commande.</p>
          </Panel>
          {finance && (
            <Panel title="Meilleures ventes">
              <BarList format={(n) => `${nf.format(n)} F`} color="var(--chart-2)" empty="Aucune vente sur la période."
                rows={(a.top_products ?? []).map((p: any, i: number) => ({ key: String(i), label: p.label, value: p.revenue, hint: `${p.sold} vendu${p.sold > 1 ? 's' : ''}` }))} />
            </Panel>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Link to="/admin/blog?onglet=moderation"><Stat tone="orange" label="À modérer" value={moderation} sub={`${d.pending_comments} commentaire(s), ${d.pending_reviews} avis`} /></Link>
        <Stat label="Abonnés newsletter" value={nf.format(d.subscribers)} sub={`+${nf.format(k.subscribers.value)} sur la période`} />
        <Stat label="Inscriptions formations" value={nf.format(k.enrollments.value)} sub="confirmées sur la période" />
        <Stat label="Lecteurs actifs aujourd'hui" value={nf.format(d.active_readers_today)} sub={`${nf.format(d.accounts_total)} comptes lecteurs`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {finance ? (
          <Panel title="Dernières commandes" action={<Link to="/admin/commandes" className="text-[14px] font-semibold text-blue">Tout voir</Link>}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead><tr><th>N°</th><th>Client</th><th>Article</th><th>Montant</th><th>Statut</th></tr></thead>
                <tbody>
                  {d.latest_orders.map((o: any) => (
                    <tr key={o.id} className="cursor-pointer" onClick={() => nav(`/admin/commandes?q=${o.reference}`)}>
                      <td>{o.reference}</td><td>{o.customer.name}</td>
                      <td className="max-w-40 truncate">{o.items.map((i: any) => i.label).join(', ')}</td>
                      <td className="font-bold tabular-nums">{nf.format(o.total)}</td>
                      <td><StatusChip status={o.status} label={o.status_label} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        ) : (
          <Panel title="Commentaires récents">
            <ul className="grid gap-3 text-sm">{d.latest_comments.map((c: any) => <li key={c.id}><b>{c.author}</b> · {c.body}</li>)}</ul>
          </Panel>
        )}
        <div className="flex flex-col gap-4">
          {alert && (
            <section className="card border-[1.5px] border-[#FDBA9B] p-5">
              <div className="text-xs font-semibold tracking-[.08em] text-[#C2410C] uppercase">⚠ Alerte lecture</div>
              <b className="mt-2 block text-[15px]">{alert.user_email}</b>
              <div className="text-[14px] text-muted">{alert.kind_label} · {alert.detail}</div>
              <div className="mt-3 flex gap-2">
                <Link to={`/admin/utilisateurs/${alert.user_id}`} className="btn btn-blue btn-sm">Voir le journal</Link>
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  await post(`/api/backoffice/users/${alert.user_id}/block/`, { blocked: true }); toast('Compte bloqué et déconnecté.'); reload()
                }}>Bloquer</button>
              </div>
            </section>
          )}
          <Panel title="Prochaine session" className="flex-1">
            {session ? (
              <Link to={`/admin/formations/sessions/${session.id}`} className="flex items-center gap-3.5">
                <div className="flex h-[58px] w-[54px] flex-col items-center justify-center rounded-xl text-white" style={{ background: 'linear-gradient(135deg,#1560DC,#041C5C)' }}>
                  <b className="text-[22px] leading-none">{new Date(session.starts_at).getDate()}</b>
                  <span className="text-[9px] font-semibold text-[#FF8A5B] uppercase">{new Date(session.starts_at).toLocaleDateString('fr-FR', { month: 'short' })}</span>
                </div>
                <div className="flex-1">
                  <b className="text-sm">{session.training_title}</b>
                  <div className="mt-2 h-1.5 rounded-full bg-[#EFF0F2]">
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, (session.seats_taken / session.capacity) * 100)}%`, background: 'linear-gradient(90deg,#1560DC,#3FA2FF)' }} />
                  </div>
                  <div className="mt-1.5 text-xs text-muted">{session.seats_taken} / {session.capacity} inscrits</div>
                </div>
              </Link>
            ) : <p className="text-sm text-muted">Aucune session programmée.</p>}
          </Panel>
          <div className="grid gap-2 md:hidden">
            <p className="px-1 text-[17px] font-bold">Actions rapides</p>
            {[
              ['comment-alt', 'Modérer les commentaires', '/admin/blog?onglet=moderation', '#FFEDE4', '#FF6B29'],
              ['key', 'Octroyer un accès', '/admin/utilisateurs', '#E6F0FA', '#2F68B7'],
              ['envelope', 'Écrire aux inscrits', '/admin/formations', '#DCFCE7', '#16A34A'],
            ].map(([icon, label, to, bg, fg]) => (
              <Link key={label} to={to} className="flex items-center gap-3 rounded-[14px] bg-[var(--card)] p-3">
                <span className="grid h-10 w-10 place-items-center rounded-[11px]" style={{ background: bg, color: fg }}><Icon name={icon} /></span>
                <b className="flex-1 text-sm">{label}</b><Icon name="angle-small-right" className="text-faint" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </AdminPage>
  )
}
