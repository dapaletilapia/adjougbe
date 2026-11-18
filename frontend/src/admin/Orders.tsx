import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ErrorNote, Field, initials, PayLogo } from '../components/ui'
import { download, patch, post } from '../lib/api'
import { dateTime, fcfa, PAYMENT_METHODS } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Drawer, FilterSelect, Pager, StatusChip, TableWrap, Tabs, useEditor, useList } from './kit'


export default function Orders() {
  const list = useList('/api/backoffice/orders/')
  const counts = useApi<Record<string, number>>('/api/backoffice/orders/counts/', [list.data])
  const [open, setOpen] = useState<any>(null)
  const status = list.params.get('status') ?? ''
  const exportQs = list.params.toString()
  const c = counts.data ?? {}
  return (
    <AdminPage title="Commandes" search actions={<>
      <button className="btn btn-ghost !min-h-[42px]" onClick={() => download(`/api/backoffice/orders/export/?${exportQs}&format=csv`, 'commandes.csv')}>Exporter CSV</button>
      <button className="btn btn-ghost !min-h-[42px]" onClick={() => download(`/api/backoffice/orders/export/?${exportQs}&format=xlsx`, 'commandes.xlsx')}>Excel</button>
    </>}>
      <div className="flex flex-wrap items-center gap-3">
        <Tabs value={status} onChange={(v) => list.setParam('status', v)} tabs={[
          { value: '', label: `Toutes · ${c.all ?? 0}` }, { value: 'paid', label: 'Payées' },
          { value: 'pending', label: `En attente${c.pending ? ` · ${c.pending}` : ''}` }, { value: 'failed', label: 'Échouées' }, { value: 'refunded', label: 'Remboursées' },
        ]} />
        <FilterSelect list={list} name="payment_method" label="Tous les moyens" options={PAYMENT_METHODS.map((p) => [p.value, p.label])} />
        <input type="date" className="input !min-h-10 !w-auto !bg-[var(--card)]" aria-label="Du" value={list.params.get('from') ?? ''} onChange={(e) => list.setParam('from', e.target.value)} />
        <input type="date" className="input !min-h-10 !w-auto !bg-[var(--card)]" aria-label="Au" value={list.params.get('to') ?? ''} onChange={(e) => list.setParam('to', e.target.value)} />
      </div>
      <div className={`grid gap-4 ${open ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <div className="grid content-start gap-3">
          <TableWrap loading={list.loading} error={list.error} empty={!list.data?.results.length}>
            <table className="table">
              <thead><tr><th>N°</th><th>Client</th><th>Article</th><th>Montant</th><th>Moyen</th><th>Statut</th></tr></thead>
              <tbody>
                {list.data?.results.map((o: any) => (
                  <tr key={o.id} className={`cursor-pointer ${open?.id === o.id ? 'bg-blue-tint' : ''}`} onClick={() => setOpen(o)}>
                    <td className="whitespace-nowrap">{o.reference}<div className="text-[11px] text-faint">{dateTime(o.created_at)}</div></td>
                    <td>{o.customer.name}</td>
                    <td className="max-w-44 truncate">{o.items.map((i: any) => i.label).join(', ')}</td>
                    <td className="font-bold tabular-nums">{o.total.toLocaleString('fr-FR')}</td>
                    <td>{o.payment_method && !['free', 'manual'].includes(o.payment_method) ? <span className="flex items-center gap-2"><PayLogo method={o.payment_method} size={24} />{o.payment_method_label.split(' ')[0]}</span> : o.payment_method_label}</td>
                    <td><StatusChip status={o.status} label={o.status_label} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
          <Pager list={list} />
        </div>
        {open && (
          <aside className="card h-max min-w-0 overflow-hidden p-5 xl:sticky xl:top-6">
            <OrderDetail key={open.id} order={open} onClose={() => setOpen(null)} onChanged={(o) => { setOpen(o); list.reload() }} />
          </aside>
        )}
      </div>
    </AdminPage>
  )
}

function OrderDetail({ order: o, onChanged, onClose }: { order: any; onChanged: (o: any) => void; onClose: () => void }) {
  const [reason, setReason] = useState('')
  const [refunding, setRefunding] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()
  const act = async (path: string, body = {}, msg = 'Commande mise à jour.') => {
    try { const r = await post(`/api/backoffice/orders/${o.id}/${path}/`, body); if (r?.reference) onChanged(r); toast(msg) } catch (e) { setError(e) }
  }
  return (
    <div className="grid gap-4 text-[13px]">
      <div className="flex items-center gap-2">
        <b className="flex-1 text-[15px]">{o.reference}</b>
        <StatusChip status={o.status} label={o.status_label} />
        <button onClick={onClose} className="ml-1 rounded-full px-2 text-lg text-faint hover:bg-paper" aria-label="Fermer le détail">×</button>
      </div>
      <Link to={`/admin/utilisateurs/${o.customer.id}`} className="flex items-center gap-3 rounded-xl bg-paper p-3">
        <span className="avatar h-10 w-10">{initials(o.customer.name)}</span>
        <span className="min-w-0"><b className="block truncate text-sm">{o.customer.name}</b><span className="block truncate text-muted">{o.customer.email} {o.customer.phone}</span></span>
      </Link>
      <dl className="grid grid-cols-[110px_1fr] gap-y-2">
        <dt className="text-muted">Article</dt><dd className="font-medium">{o.items.map((i: any) => i.label).join(', ')}</dd>
        <dt className="text-muted">Montant</dt><dd className="font-bold">{fcfa(o.total)}{o.discount > 0 && <span className="ml-2 font-normal text-muted">(remise {fcfa(o.discount)}{o.promo && ` · ${o.promo}`})</span>}</dd>
        <dt className="text-muted">Moyen</dt><dd className="flex items-center gap-2">{PAYMENT_METHODS.some((p) => p.value === o.payment_method) && <PayLogo method={o.payment_method} size={22} />}{o.payment_method_label}</dd>
        {o.provider_reference && <><dt className="text-muted">Réf. opérateur</dt><dd className="break-all">{o.provider_reference}</dd></>}
        {o.is_gift && <><dt className="text-muted">Cadeau pour</dt><dd>{o.gift_recipient_email}</dd></>}
      </dl>
      <div>
        <p className="mb-2 font-semibold">Historique</p>
        <ol className="relative grid gap-3 border-l-2 border-blue-tint pl-4">
          {o.history.map((h: any, i: number) => (
            <li key={i} className="relative">
              <span className={`absolute top-1 -left-[23px] h-3 w-3 rounded-full ${i === 0 ? 'bg-orange' : 'bg-bright'} ring-4 ring-[var(--card)]`} />
              <span className="mr-2 text-faint tabular-nums">{new Date(h.at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>{h.label}
              <div className="text-[11px] text-faint">{dateTime(h.at)}</div>
            </li>
          ))}
        </ol>
      </div>
      <ErrorNote error={error} />
      {o.status === 'paid' && !refunding && (
        <div className="flex gap-2">
          <button className="btn btn-ghost btn-sm flex-1" onClick={() => act('resend_receipt', {}, 'Reçu renvoyé au client.')}>Renvoyer le reçu</button>
          <button className="btn btn-danger btn-sm flex-1" onClick={() => setRefunding(true)}>Rembourser</button>
        </div>
      )}
      {refunding && (
        <div className="grid gap-3 rounded-xl bg-paper p-4">
          <p className="text-muted">Le remboursement de l'opérateur se fait depuis le compte marchand. Ici, on l'enregistre et on retire l'accès aux livres de cette commande.</p>
          <Field label="Motif"><input className="input !bg-[var(--card)]" value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <div className="flex gap-2">
            <button className="btn btn-danger btn-sm" disabled={!reason} onClick={() => act('refund', { reason }, 'Remboursement enregistré, accès retiré.').then(() => setRefunding(false))}>Confirmer le remboursement</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setRefunding(false)}>Annuler</button>
          </div>
        </div>
      )}
      {['pending', 'failed'].includes(o.status) && (
        <div className="grid gap-2 rounded-xl bg-paper p-4">
          <p className="text-muted">À n'utiliser que si le paiement est confirmé sur le compte marchand (litige résolu, paiement hors ligne).</p>
          <button className="btn btn-blue btn-sm justify-self-start" onClick={() => act('mark_paid')}>Valider le paiement et débloquer l'accès</button>
        </div>
      )}
    </div>
  )
}

export function Promos() {
  const { data, loading, reload } = useApi('/api/backoffice/promos/')
  const works = useApi('/api/backoffice/works/')
  const [editing, setEditing] = useState<any>(null)
  return (
    <>
      <div><button className="btn btn-primary btn-sm" onClick={() => setEditing({ code: '', description: '', percent_off: 10, amount_off_xof: null, starts_at: null, ends_at: null, max_uses: null, min_total_xof: 0, work_ids: [], is_active: true })}>Nouveau code</button></div>
      <TableWrap loading={loading} empty={!data?.results.length}>
        <table className="table">
          <thead><tr><th>Code</th><th>Remise</th><th>Validité</th><th>Utilisations</th><th>Statut</th></tr></thead>
          <tbody>
            {data?.results.map((p: any) => (
              <tr key={p.id} className="cursor-pointer" onClick={() => setEditing(p)}>
                <td className="font-semibold">{p.code}<br /><span className="text-xs font-normal text-muted">{p.description}</span></td>
                <td>{p.percent_off ? `${p.percent_off} %` : fcfa(p.amount_off_xof)}</td>
                <td className="text-sm">{p.ends_at ? `jusqu'au ${dateTime(p.ends_at)}` : 'Sans limite'}</td>
                <td className="tabular-nums">{p.used_count}{p.max_uses ? ` / ${p.max_uses}` : ''}</td>
                <td>{p.is_active ? <span className="chip chip-ok">Actif</span> : <span className="chip">Inactif</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Code ${editing.code}` : 'Nouveau code promo'}>
        {editing && <PromoForm key={editing.id ?? 'new'} promo={editing} works={works.data?.results ?? []} onDone={() => { setEditing(null); reload() }} />}
      </Drawer>
    </>
  )
}

function PromoForm({ promo, works, onDone }: { promo: any; works: any[]; onDone: () => void }) {
  const ed = useEditor({ ...promo, kind: promo.amount_off_xof ? 'amount' : 'percent' })
  const v = ed.v
  const save = () => ed.run(async () => {
    const { kind, used_count: _u, created_at: _c, ...body } = v
    if (kind === 'percent') body.amount_off_xof = null; else body.percent_off = null
    if (v.id) await patch(`/api/backoffice/promos/${v.id}/`, body); else await post('/api/backoffice/promos/', body)
    onDone()
  }).catch(() => {})
  const dt = (k: string) => (
    <input className="input" type="datetime-local" value={v[k] ? v[k].slice(0, 16) : ''} onChange={(e) => ed.set(k, e.target.value ? new Date(e.target.value).toISOString() : null)} />
  )
  return (
    <div className="grid gap-4">
      <Field label="Code" error={ed.fe('code')}><input className="input uppercase" value={v.code} onChange={(e) => ed.set('code', e.target.value.toUpperCase())} /></Field>
      <Field label="Description interne"><input className="input" value={v.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
      <div className="flex gap-4">
        <label className="flex items-center gap-2"><input type="radio" className="accent-orange" checked={v.kind === 'percent'} onChange={() => ed.set('kind', 'percent')} /> Pourcentage</label>
        <label className="flex items-center gap-2"><input type="radio" className="accent-orange" checked={v.kind === 'amount'} onChange={() => ed.set('kind', 'amount')} /> Montant fixe</label>
      </div>
      {v.kind === 'percent'
        ? <Field label="Remise (%)" error={ed.fe('percent_off')}><input className="input" type="number" min={1} max={100} value={v.percent_off ?? ''} onChange={(e) => ed.set('percent_off', Number(e.target.value))} /></Field>
        : <Field label="Remise (FCFA)"><input className="input" type="number" value={v.amount_off_xof ?? ''} onChange={(e) => ed.set('amount_off_xof', Number(e.target.value))} /></Field>}
      <div className="grid grid-cols-2 gap-3"><Field label="Début">{dt('starts_at')}</Field><Field label="Fin">{dt('ends_at')}</Field></div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Utilisations max."><input className="input" type="number" value={v.max_uses ?? ''} onChange={(e) => ed.set('max_uses', e.target.value ? Number(e.target.value) : null)} /></Field>
        <Field label="Panier minimum (FCFA)"><input className="input" type="number" value={v.min_total_xof} onChange={(e) => ed.set('min_total_xof', Number(e.target.value))} /></Field>
      </div>
      <fieldset><legend className="mb-1 text-sm font-medium">Limité aux œuvres (aucune = toute la boutique)</legend>
        {works.map((w) => (
          <label key={w.id} className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.work_ids.includes(w.id)}
            onChange={(e) => ed.set('work_ids', e.target.checked ? [...v.work_ids, w.id] : v.work_ids.filter((x: number) => x !== w.id))} /> {w.title}</label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.is_active} onChange={(e) => ed.set('is_active', e.target.checked)} /> Actif</label>
      <ErrorNote error={ed.err} />
      <button className="btn btn-primary justify-self-start" onClick={save} disabled={ed.busy}>Enregistrer</button>
    </div>
  )
}
