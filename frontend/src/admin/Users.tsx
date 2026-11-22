import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorNote, initials, Spinner } from '../components/ui'
import { download, patch, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { dateTime, fcfa, shortDate } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, FilterSelect, ListToolbar, Pager, Panel, StatusChip, TableWrap, Tabs, useList } from './kit'

const ROLES: [string, string][] = [['reader', 'Lecteur'], ['admin', 'Administrateur'], ['editor', 'Éditeur / community manager'], ['accountant', 'Comptable'], ['assistant', 'Assistant']]

function userStatus(u: any): [string, string] {
  if (u.is_blocked) return ['Bloqué', 'chip-danger']
  if (u.open_alerts) return ['⚠ Alerte', 'chip-orange']
  if (!u.email_verified) return ['E-mail non vérifié', 'chip-warn']
  return ['Actif', 'chip-ok']
}

export function UsersList() {
  const list = useList('/api/backoffice/users/')
  const qs = list.params.toString()
  return (
    <AdminPage title={<>Utilisateurs <span className="font-medium text-faint">{list.data?.count?.toLocaleString('fr-FR') ?? ''}</span></>}
      actions={<>
        <ListToolbar list={list} placeholder="Nom, e-mail, téléphone…" />
        <button className="btn btn-ghost !min-h-[42px]" onClick={() => download(`/api/backoffice/users/export/?${qs}&format=csv`, 'utilisateurs.csv')}>Exporter</button>
      </>}>
      <div className="flex flex-wrap gap-2">
        <FilterSelect list={list} name="role" label="Tous les rôles" options={ROLES} />
        <FilterSelect list={list} name="is_blocked" label="Tous les comptes" options={[['true', 'Bloqués'], ['false', 'Actifs']]} />
        <FilterSelect list={list} name="newsletter_consent" label="Newsletter" options={[['true', 'Abonnés'], ['false', 'Non abonnés']]} />
      </div>
      <TableWrap loading={list.loading} error={list.error} empty={!list.data?.results.length}>
        <table className="table">
          <thead><tr><th>Utilisateur</th><th>Ville</th><th>Œuvres</th><th>Appareils</th><th>Inscrit</th><th>Statut</th></tr></thead>
          <tbody>
            {list.data?.results.map((u: any) => {
              const [label, tone] = userStatus(u)
              return (
                <tr key={u.id}>
                  <td>
                    <Link to={`/admin/utilisateurs/${u.id}`} className="flex items-center gap-3">
                      <span className="avatar h-9 w-9">{initials(u.full_name)}</span>
                      <span><b className="block">{u.full_name}</b><span className="text-xs text-muted">{u.email}</span></span>
                    </Link>
                  </td>
                  <td>{u.city}</td>
                  <td className="tabular-nums">{u.works_count}</td>
                  <td className="tabular-nums">{u.devices_count} / 2</td>
                  <td>{shortDate(u.date_joined)}</td>
                  <td><span className={`chip ${tone}`}>{label}</span>{u.role !== 'reader' && <span className="chip chip-blue ml-1">{u.role_label}</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </TableWrap>
      <Pager list={list} />
    </AdminPage>
  )
}

/** Pages lues par heure sur les 12 dernières heures (journal de lecture). */
function PagesPerHour({ reading }: { reading: any[] }) {
  const now = Date.now()
  const buckets = Array.from({ length: 12 }, (_, i) => reading.filter((r) => {
    const age = (now - new Date(r.at).getTime()) / 36e5
    return age >= 11 - i && age < 12 - i
  }).length)
  const max = Math.max(1, ...buckets)
  return (
    <div className="flex h-28 items-end gap-1.5" role="img" aria-label="Pages lues par heure sur 12 heures">
      {buckets.map((n, i) => (
        <span key={i} title={`${n} page(s)`} className="flex-1 rounded-t-md" style={{ height: `${Math.max(4, (n / max) * 100)}%`, background: n === max && n > 0 ? '#FF6B29' : 'linear-gradient(180deg,#3FA2FF,#1560DC)' }} />
      ))}
    </div>
  )
}

function exportReading(u: any) {
  const rows = [['Horodatage', 'Œuvre', 'Section', 'Page', 'Appareil', 'IP'], ...u.reading.map((r: any) => [new Date(r.at).toLocaleString('fr-FR'), r.work, r.section, r.page, r.device, r.ip])]
  const csv = '\ufeff' + rows.map((r) => r.map((x: any) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(';')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = `lecture-${u.email}.csv`
  a.click()
}

export function UserDetail() {
  const { id } = useParams()
  const { user: me } = useAuth()
  const { data: u, loading, reload } = useApi(`/api/backoffice/users/${id}/`)
  const works = useApi('/api/backoffice/works/')
  const [tab, setTab] = useState('lecture')
  const [grant, setGrant] = useState('')
  const [error, setError] = useState<unknown>(null)
  const toast = useToast()
  if (loading || !u) return <Spinner />
  const isAdmin = me?.role === 'admin'
  const act = async (fn: () => Promise<unknown>, msg: string) => { try { await fn(); toast(msg); reload() } catch (e) { setError(e) } }
  const [label, tone] = userStatus(u)
  return (
    <AdminPage crumb={<Link to="/admin/utilisateurs">Utilisateurs /</Link>}
      title={<span className="flex items-center gap-3"><span className="avatar h-12 w-12 text-base">{initials(u.full_name)}</span>{u.full_name}</span>}
      intro={<>{u.email} · {u.city || u.country} · inscrit le {shortDate(u.date_joined)} <span className={`chip ${tone} ml-1`}>{label}</span></>}
      actions={isAdmin && <>
        <button className="btn btn-blue !min-h-[42px]" onClick={() => setTab('acces')}>Octroyer un accès</button>
        {u.is_blocked
          ? <button className="btn btn-ghost !min-h-[42px]" onClick={() => act(() => post(`/api/backoffice/users/${u.id}/block/`, { blocked: false }), 'Compte débloqué.')}>Débloquer</button>
          : <Confirm text="Bloquer ce compte ?" danger onConfirm={() => act(() => post(`/api/backoffice/users/${u.id}/block/`, { blocked: true }), 'Compte bloqué et déconnecté.')}><button className="btn btn-danger !min-h-[42px]">Bloquer</button></Confirm>}
      </>}>
      <ErrorNote error={error} />
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Achats">
          {u.accesses.length === 0 ? <p className="text-sm text-muted">Aucune œuvre.</p> : (
            <ul className="grid gap-2 text-[14px]">{u.accesses.map((a: any) => (
              <li key={a.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2"><b className="flex-1">{a.work}</b><span className="text-muted">{shortDate(a.granted_at)} · {a.source}</span></li>
            ))}</ul>
          )}
        </Panel>
        <Panel title={`Appareils (${u.devices.length}/2)`}>
          {u.devices.length === 0 ? <p className="text-sm text-muted">Aucune session ouverte.</p> : (
            <ul className="grid gap-2 text-[14px]">{u.devices.map((d: any, i: number) => (
              <li key={d.id} className="flex items-center gap-2 rounded-lg bg-paper px-3 py-2">
                <span className="flex-1"><b>{d.label}</b>{i === 0 && <span className="ml-2 text-ok">● actif</span>}<span className="block text-xs text-muted">{d.ip_address} · {dateTime(d.last_seen_at)}</span></span>
                <button className="text-xs font-semibold text-danger" onClick={() => act(() => post(`/api/backoffice/users/${u.id}/devices/${d.id}/close/`), 'Session fermée.')}>Déconnecter</button>
              </li>
            ))}</ul>
          )}
        </Panel>
        <Panel title="Pages / heure"><PagesPerHour reading={u.reading} /></Panel>
      </div>
      {isAdmin && me?.id !== u.id && (
        <label className="flex items-center gap-3 text-sm">Rôle
          <select className="input !w-auto !bg-[var(--card)]" value={u.role} onChange={(e) => act(() => patch(`/api/backoffice/users/${u.id}/`, { role: e.target.value }), 'Rôle modifié.')}>
            {ROLES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
      )}
      <Tabs value={tab} onChange={setTab} tabs={[
        { value: 'lecture', label: 'Journal de lecture' },
        { value: 'achats', label: `Achats (${u.orders.length})` }, { value: 'acces', label: `Bibliothèque (${u.accesses.length})` },
        { value: 'appareils', label: `Appareils (${u.devices.length})` }, 
        { value: 'formations', label: `Formations (${u.enrollments.length})` }, { value: 'alertes', label: `Alertes (${u.alerts.length})` },
      ]} />
      {tab === 'achats' && (
        <TableWrap loading={false} empty={!u.orders.length}>
          <table className="table"><tbody>
            {u.orders.map((o: any) => (
              <tr key={o.id}><td className="font-semibold">{o.reference}</td><td>{o.items.map((i: any) => i.label).join(', ')}</td><td>{dateTime(o.created_at)}</td>
                <td><StatusChip status={o.status} label={o.status_label} /></td><td className="text-right tabular-nums">{fcfa(o.total)}</td></tr>
            ))}
          </tbody></table>
        </TableWrap>
      )}
      {tab === 'acces' && (
        <div className="grid gap-4">
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <select className="input !w-auto" value={grant} onChange={(e) => setGrant(e.target.value)} aria-label="Œuvre à offrir">
                <option value="">Offrir l'accès à une œuvre…</option>
                {works.data?.results.map((w: any) => <option key={w.id} value={w.id}>{w.title}</option>)}
              </select>
              <button className="btn btn-dark btn-sm" disabled={!grant} onClick={() => act(() => post(`/api/backoffice/users/${u.id}/grant_access/`, { work: Number(grant) }), 'Accès offert.')}>Offrir</button>
            </div>
          )}
          <TableWrap loading={false} empty={!u.accesses.length}>
            <table className="table"><tbody>
              {u.accesses.map((a: any) => (
                <tr key={a.id}><td className="font-semibold">{a.work}</td><td>{a.source}</td><td>{dateTime(a.granted_at)}</td>
                  <td>{a.revoked_at ? <span className="chip chip-danger">Retiré</span> : <span className="chip chip-ok">Actif</span>}</td>
                  <td className="text-right">{isAdmin && !a.revoked_at && (
                    <Confirm text="Retirer l'accès ?" danger onConfirm={() => act(() => post(`/api/backoffice/users/${u.id}/revoke_access/`, { work: a.work_id }), 'Accès retiré.')}>
                      <button className="text-sm text-danger">Retirer</button>
                    </Confirm>)}</td></tr>
              ))}
            </tbody></table>
          </TableWrap>
        </div>
      )}
      {tab === 'appareils' && (
        <TableWrap loading={false} empty={!u.devices.length}>
          <table className="table"><tbody>
            {u.devices.map((d: any) => (
              <tr key={d.id}><td className="font-semibold">{d.label}</td><td>{d.ip_address}</td><td>Connecté le {dateTime(d.created_at)}</td><td>Vu le {dateTime(d.last_seen_at)}</td>
                <td className="text-right"><button className="text-sm text-danger" onClick={() => act(() => post(`/api/backoffice/users/${u.id}/devices/${d.id}/close/`), 'Session fermée.')}>Déconnecter</button></td></tr>
            ))}
          </tbody></table>
        </TableWrap>
      )}
      {tab === 'lecture' && (
        <>
        <button className="btn btn-ghost btn-sm justify-self-start" onClick={() => exportReading(u)} disabled={!u.reading.length}>Exporter le journal (CSV)</button>
        <TableWrap loading={false} empty={!u.reading.length}>
          <table className="table"><thead><tr><th>Date</th><th>Œuvre</th><th>Section</th><th>Page</th><th>Appareil</th><th>IP</th></tr></thead><tbody>
            {u.reading.map((r: any, i: number) => <tr key={i}><td>{new Date(r.at).toLocaleString('fr-FR')}</td><td>{r.work}</td><td>{r.section}</td><td>{r.page}</td><td>{r.device}</td><td>{r.ip}</td></tr>)}
          </tbody></table>
        </TableWrap>
        </>
      )}
      {tab === 'formations' && (
        <TableWrap loading={false} empty={!u.enrollments.length}>
          <table className="table"><tbody>{u.enrollments.map((e: any) => <tr key={e.id}><td>{e.training}</td><td>{dateTime(e.date)}</td><td>{e.status}</td></tr>)}</tbody></table>
        </TableWrap>
      )}
      {tab === 'alertes' && (
        <TableWrap loading={false} empty={!u.alerts.length}>
          <table className="table"><tbody>{u.alerts.map((a: any) => (
            <tr key={a.id}><td>{dateTime(a.created_at)}</td><td className="font-semibold">{a.kind_label}</td><td>{a.detail}</td>
              <td>{a.resolved ? <span className="chip chip-ok">Traitée</span> : <button className="link text-sm" onClick={() => act(() => patch(`/api/backoffice/alerts/${a.id}/`, { resolved: true }), 'Alerte traitée.')}>Marquer traitée</button>}</td></tr>
          ))}</tbody></table>
        </TableWrap>
      )}
    </AdminPage>
  )
}
