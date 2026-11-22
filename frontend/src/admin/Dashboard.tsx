import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon, Spinner } from '../components/ui'
import { download, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { PAYMENT_METHODS } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, AreaChart, Panel, Stat, StatusChip } from './kit'

const nf = new Intl.NumberFormat('fr-FR')
const PM_COLORS: Record<string, string> = { orange_money: '#FF7900', mtn_momo: '#FFCB05', wave: '#1DC8F2', moov_money: '#0067B1', card: '#1A1F71' }

export default function Dashboard() {
  const [range, setRange] = useState('30')
  const { data: d, loading, reload } = useApi(`/api/backoffice/dashboard/?range=${range}`)
  const { user } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  if (loading && !d) return <Spinner />
  if (!d) return null
  const finance = 'sales_month' in d
  const evo = d.sales_prev_month ? Math.round(((d.sales_month - d.sales_prev_month) / d.sales_prev_month) * 100) : null
  const prevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1).toLocaleDateString('fr-FR', { month: 'long' })
  const totalPm = (d.by_method ?? []).reduce((a: number, m: any) => a + m.total, 0) || 1
  const alert = d.alerts?.[0]
  const session = d.upcoming_sessions?.[0]
  const moderation = d.pending_comments + d.pending_reviews
  const labelOf = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', range === '365' ? { month: 'short', year: '2-digit' } : { day: 'numeric', month: 'short' })

  return (
    <AdminPage
      crumb={<span className="capitalize">{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}</span>}
      title={`Bonjour, ${user?.full_name.split(' ')[0] ?? ''}`}
      search
      actions={<>
        {finance && <button className="btn btn-ghost btn-sm !min-h-[42px]" onClick={() => download('/api/backoffice/finance/export/?format=xlsx', 'ventes.xlsx')}>Export comptable</button>}
        <button className="btn btn-primary !min-h-[42px]" onClick={() => nav('/admin/blog/nouveau')}>+ Nouveau</button>
      </>}>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        {finance && (
          <div className="col-span-2 lg:col-span-1">
            <Stat tone="navy" label="Ventes du mois" value={<>{nf.format(d.sales_month)} <span className="text-sm">FCFA</span></>}
              sub={evo !== null && <span className="mt-1.5 inline-block rounded-md bg-white/18 px-2 py-0.5 text-xs">{evo >= 0 ? '▲' : '▼'} {Math.abs(evo)} % vs {prevMonth}</span>} />
          </div>
        )}
        {finance && <Stat label="Aujourd'hui" value={nf.format(d.sales_today)} sub={`FCFA · ${d.orders_today} commande(s)`} />}
        <Stat label="Nouveaux comptes" value={d.new_accounts_month} sub={`▲ ${d.new_accounts_week} cette semaine`} subTone="ok" />
        <Link to="/admin/blog?onglet=moderation"><Stat tone="orange" label="À modérer" value={moderation} sub={`${d.pending_comments} commentaire(s), ${d.pending_reviews} avis`} /></Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        {finance && (
          <Panel title="Ventes" action={
            <div className="seg !bg-paper text-xs" role="tablist">
              {[['7', '7 j'], ['30', '30 j'], ['365', '12 m']].map(([v, l]) => (
                <button key={v} role="tab" aria-selected={range === v} onClick={() => setRange(v)} className="!px-2.5 !py-1.5">{l}</button>
              ))}
            </div>}>
            <AreaChart data={d.series.map((x: any) => ({ label: labelOf(x.date), value: x.total }))} format={(n) => `${nf.format(n)} F`} />
          </Panel>
        )}
        {finance && (
          <Panel title="Moyens de paiement">
            {d.by_method.length === 0 ? <p className="text-sm text-muted">Aucun paiement ce mois-ci.</p> : (
              <>
                <div className="flex h-3.5 overflow-hidden rounded-full">
                  {d.by_method.map((m: any) => <span key={m.payment_method} style={{ width: `${(m.total / totalPm) * 100}%`, background: PM_COLORS[m.payment_method] ?? '#9A9DA6' }} />)}
                </div>
                <ul className="mt-3 grid gap-2.5 text-[14px]">
                  {d.by_method.map((m: any) => (
                    <li key={m.payment_method} className="flex items-center gap-2.5">
                      <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: PM_COLORS[m.payment_method] ?? '#9A9DA6' }} />
                      {PAYMENT_METHODS.find((p) => p.value === m.payment_method)?.label ?? m.payment_method}
                      <b className="ml-auto">{Math.round((m.total / totalPm) * 100)} %</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>
        )}
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
