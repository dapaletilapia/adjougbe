import { useState } from 'react'
import { ErrorNote, Field } from '../components/ui'
import { download, patch, post } from '../lib/api'
import { dateTime } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, Drawer, FilterSelect, ListToolbar, Pager, Stat, TableWrap, Tabs, useEditor, useList } from './kit'

export default function Newsletter() {
  const [tab, setTab] = useState('subscribers')
  return (
    <AdminPage title="Newsletter">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'subscribers', label: 'Abonnés et segments' }, { value: 'campaigns', label: 'Envois' }]} />
      {tab === 'subscribers' ? <Subscribers /> : <Campaigns />}
    </AdminPage>
  )
}

function Subscribers() {
  const list = useList('/api/backoffice/subscribers/')
  const segments = useApi<any[]>('/api/backoffice/subscribers/segments/')
  const qs = list.params.toString()
  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {segments.data?.map((s) => <Stat key={s.value} label={s.label} value={s.count} />)}
      </div>
      <ListToolbar list={list} placeholder="E-mail, source…">
        <FilterSelect list={list} name="is_active" label="Tous" options={[['true', 'Actifs'], ['false', 'Désinscrits']]} />
        <button className="btn btn-ghost btn-sm" onClick={() => download(`/api/backoffice/subscribers/export/?${qs}&format=xlsx`, 'abonnes.xlsx')}>Excel</button>
        <button className="btn btn-ghost btn-sm" onClick={() => download(`/api/backoffice/subscribers/export/?${qs}&format=csv`, 'abonnes.csv')}>CSV (Brevo, Mailchimp)</button>
      </ListToolbar>
      <TableWrap loading={list.loading} empty={!list.data?.results.length}>
        <table className="table">
          <thead><tr><th>E-mail</th><th>Source</th><th>Préférences</th><th>Consentement</th><th>Statut</th></tr></thead>
          <tbody>
            {list.data?.results.map((s: any) => (
              <tr key={s.id}>
                <td className="font-medium">{s.email}</td><td>{s.source}</td><td>{s.preferences.join(', ')}</td><td className="text-sm">{dateTime(s.consent_at)}</td>
                <td>{s.is_active ? <span className="chip chip-ok">Actif</span> : <span className="chip">Désinscrit</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Pager list={list} />
    </>
  )
}

function Campaigns() {
  const { data, loading, reload } = useApi('/api/backoffice/campaigns/')
  const segments = useApi<any[]>('/api/backoffice/subscribers/segments/')
  const [editing, setEditing] = useState<any>(null)
  return (
    <>
      <div><button className="btn btn-primary btn-sm" onClick={() => setEditing({ subject: '', body: '', segment: 'all' })}>Nouvel envoi</button></div>
      <TableWrap loading={loading} empty={!data?.results.length}>
        <table className="table">
          <thead><tr><th>Objet</th><th>Segment</th><th>Envoyé le</th><th>Destinataires</th></tr></thead>
          <tbody>
            {data?.results.map((c: any) => (
              <tr key={c.id} className="cursor-pointer" onClick={() => setEditing(c)}>
                <td className="font-semibold">{c.subject}</td><td>{c.segment_label}</td>
                <td>{c.sent_at ? dateTime(c.sent_at) : <span className="chip">Brouillon</span>}</td><td className="tabular-nums">{c.recipients_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? editing.subject : 'Nouvel envoi'} wide>
        {editing && <CampaignForm key={editing.id ?? 'new'} campaign={editing} segments={segments.data ?? []} onDone={() => { setEditing(null); reload() }} />}
      </Drawer>
    </>
  )
}

function CampaignForm({ campaign, segments, onDone }: { campaign: any; segments: any[]; onDone: () => void }) {
  const ed = useEditor({ ...campaign })
  const toast = useToast()
  const v = ed.v
  const sent = !!v.sent_at
  const save = async () => {
    const body = { subject: v.subject, body: v.body, segment: v.segment }
    return v.id ? patch(`/api/backoffice/campaigns/${v.id}/`, body) : post('/api/backoffice/campaigns/', body)
  }
  const count = segments.find((s) => s.value === v.segment)?.count ?? 0
  return (
    <div className="grid gap-4">
      <Field label="Objet" error={ed.fe('subject')}><input className="input" disabled={sent} value={v.subject} onChange={(e) => ed.set('subject', e.target.value)} /></Field>
      <Field label="Destinataires">
        <select className="input" disabled={sent} value={v.segment} onChange={(e) => ed.set('segment', e.target.value)}>
          {segments.map((s) => <option key={s.value} value={s.value}>{s.label} ({s.count})</option>)}
        </select>
      </Field>
      <Field label="Message" hint="Texte simple. Un lien de désinscription est ajouté automatiquement."><textarea className="input" rows={12} disabled={sent} value={v.body} onChange={(e) => ed.set('body', e.target.value)} /></Field>
      <ErrorNote error={ed.err} />
      {!sent && (
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-ghost" onClick={() => ed.run(async () => { await save(); toast('Brouillon enregistré.'); onDone() }).catch(() => {})}>Enregistrer</button>
          <Confirm text={`Envoyer à ${count} personne(s) ?`} onConfirm={() => ed.run(async () => {
            const c = await save()
            await post(`/api/backoffice/campaigns/${c.id}/send/`)
            toast('Envoi effectué.'); onDone()
          }).catch(() => {})}>
            <button className="btn btn-primary" disabled={!v.subject || !v.body}>Envoyer maintenant</button>
          </Confirm>
        </div>
      )}
    </div>
  )
}
