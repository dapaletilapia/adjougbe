import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorNote, Field, Icon, Spinner } from '../components/ui'
import { del, download, patch, post } from '../lib/api'
import { dateTime } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, Pager, Panel, TableWrap, useEditor, useList } from './kit'

const PURPOSES: [string, string][] = [['work_access', 'Accès à un ouvrage gratuit'], ['training', 'Inscription à une formation'], ['newsletter', 'Newsletter'], ['contact', 'Contact et dédicaces'], ['survey', 'Sondage lecteurs'], ['other', 'Autre']]
const TYPES: [string, string][] = [['text', 'Texte court'], ['textarea', 'Texte long'], ['email', 'E-mail'], ['phone', 'Téléphone'], ['select', 'Liste déroulante'], ['multi', 'Choix multiple'], ['checkbox', 'Case à cocher'], ['date', 'Date'], ['number', 'Nombre'], ['file', 'Fichier'], ['rating', 'Note (1 à 5)']]
const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 50)

export function FormsList() {
  const { data, loading } = useApi('/api/backoffice/forms/')
  return (
    <AdminPage title="Formulaires" intro="Créez vos formulaires et rattachez-les à une œuvre, une formation ou une page." search
      actions={<Link to="/admin/formulaires/nouveau" className="btn btn-primary !min-h-[42px]">+ Nouveau formulaire</Link>}>
      <TableWrap loading={loading} empty={!data?.results.length}>
        <table className="table">
          <thead><tr><th>Formulaire</th><th>Usage</th><th>Champs</th><th>Réponses</th><th>Statut</th></tr></thead>
          <tbody>
            {data?.results.map((f: any) => (
              <tr key={f.id}>
                <td><Link to={`/admin/formulaires/${f.id}`} className="font-semibold">{f.title}</Link></td>
                <td>{PURPOSES.find((p) => p[0] === f.purpose)?.[1]}</td>
                <td className="tabular-nums">{f.fields.length}</td>
                <td><Link to={`/admin/formulaires/${f.id}?onglet=reponses`} className="link tabular-nums">{f.response_count}</Link></td>
                <td>{f.is_active ? <span className="chip chip-ok">Actif</span> : <span className="chip">Fermé</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </AdminPage>
  )
}

export function FormEdit() {
  const { id } = useParams()
  const isNew = id === 'nouveau'
  const { data, loading } = useApi(isNew ? null : `/api/backoffice/forms/${id}/`)
  const [tab, setTab] = useState(() => new URLSearchParams(location.search).get('onglet') === 'reponses' ? 'responses' : 'builder')
  if (!isNew && (loading || !data)) return <Spinner />
  const f = isNew ? { title: 'Nouveau formulaire', purpose: 'other', description: '', consent_text: "J'accepte que mes réponses soient utilisées par Adjougbe pour me proposer du contenu adapté.", newsletter_optin: true, success_message: 'Merci ! Vos réponses ont bien été enregistrées.', requires_login: false, is_active: true, fields: [] } : data
  const switcher = !isNew && (
    <div className="seg" role="tablist">
      <button role="tab" aria-selected={tab === 'builder'} onClick={() => setTab('builder')}>Construire</button>
      <button role="tab" aria-selected={tab === 'responses'} onClick={() => setTab('responses')}>Réponses · {f.response_count.toLocaleString('fr-FR')}</button>
    </div>
  )
  return tab === 'builder' ? <Builder key={f.id ?? 'new'} form={f} switcher={switcher} /> : <Responses form={f} switcher={switcher} />
}

const PALETTE: [string, string, string][] = [
  ['text', 'Texte', 'text'], ['textarea', 'Texte long', 'align-left'], ['email', 'E-mail', 'at'], ['phone', 'Téléphone', 'phone-call'],
  ['select', 'Liste', 'list'], ['multi', 'Choix multiple', 'checkbox'], ['checkbox', 'Case à cocher', 'square'],
  ['date', 'Date', 'calendar'], ['number', 'Nombre', 'hastag'], ['rating', 'Note', 'star'], ['file', 'Fichier', 'clip'],
]
const typeLabel = (t: string) => TYPES.find((x) => x[0] === t)?.[1] ?? t

function Builder({ form, switcher }: { form: any; switcher: React.ReactNode }) {
  const ed = useEditor({ ...form })
  const nav = useNavigate()
  const toast = useToast()
  const [sel, setSel] = useState<number | null>(form.fields.length ? 0 : null)
  const [drag, setDrag] = useState<number | null>(null)
  const [overDrop, setOverDrop] = useState(false)
  const v = ed.v
  const fields: any[] = v.fields
  const setField = (i: number, patchObj: any) => ed.set('fields', fields.map((f, j) => (j === i ? { ...f, ...patchObj } : f)))
  const add = (type: string, at = fields.length) => {
    const nf = { key: `champ_${Date.now().toString(36)}`, label: '', type, required: false, options: ['select', 'multi'].includes(type) ? ['Option 1'] : [], help_text: '', placeholder: '', condition: null }
    const a = [...fields]; a.splice(at, 0, nf); ed.set('fields', a); setSel(at)
  }
  const moveTo = (from: number, to: number) => { const a = [...fields]; const [x] = a.splice(from, 1); a.splice(to, 0, x); ed.set('fields', a); setSel(to) }
  const save = (publish: boolean) => ed.run(async () => {
    const body = { ...v, is_active: publish ? true : v.is_active, fields: fields.map(({ id: _i, position: _p, ...f }) => ({ ...f, key: f.key.startsWith('champ_') && f.label ? slugify(f.label) : f.key || slugify(f.label) })) }
    delete body.response_count; delete body.created_at; delete body.slug
    const saved = v.id ? await patch(`/api/backoffice/forms/${v.id}/`, body) : await post('/api/backoffice/forms/', body)
    toast(publish ? 'Formulaire publié.' : 'Formulaire enregistré.')
    if (!v.id) nav(`/admin/formulaires/${saved.id}`, { replace: true }); else ed.setV(saved)
  }).catch(() => {})
  const f = sel !== null ? fields[sel] : null

  return (
    <div className="-mx-4 -my-5 grid min-h-[calc(100vh-0px)] md:-mx-9 md:-my-8 lg:grid-cols-[200px_1fr_300px]">
      <aside className="border-r border-line px-4 py-6 text-[13px]">
        <Link to="/admin/formulaires" className="text-xs text-muted">← Formulaires</Link>
        <div className="mt-4 mb-2 text-[11px] font-semibold tracking-[.1em] text-faint">CHAMPS</div>
        <div className="flex flex-wrap gap-2 lg:flex-col">
          {PALETTE.map(([type, label, icon]) => (
            <button key={type} draggable onDragStart={(e) => e.dataTransfer.setData('text/x-type', type)} onClick={() => add(type)}
              className="flex items-center gap-2.5 rounded-[10px] bg-[var(--card)] px-3 py-2.5 text-left hover:ring-2 hover:ring-blue-tint">
              <Icon name={icon} className="text-base text-blue" />{label}
            </button>
          ))}
        </div>
      </aside>

      <div className="px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-blue">FORMULAIRE</div>
            <input className="w-full bg-transparent text-[22px] font-bold outline-none" value={v.title} onChange={(e) => ed.set('title', e.target.value)} aria-label="Titre du formulaire" />
          </div>
          {switcher}
        </div>
        <ol className="mt-5 flex flex-col gap-2.5">
          {fields.map((fl, i) => (
            <li key={fl.key} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); const t = e.dataTransfer.getData('text/x-type'); if (t) add(t, i); else if (drag !== null) moveTo(drag, i); setDrag(null) }}
              onClick={() => setSel(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl bg-[var(--card)] p-4 ${sel === i ? 'border-2 border-blue shadow-[0_0_0_5px_rgba(47,104,183,.1)]' : 'border-2 border-transparent'}`}>
              <Icon name="menu-dots-vertical" className="cursor-grab text-[#C9D2E0]" />
              <div className="min-w-0 flex-1">
                <b className="block truncate text-sm">{fl.label || <span className="text-faint">Question sans titre</span>}</b>
                <div className="text-xs text-muted">{typeLabel(fl.type)}{fl.options?.length ? ` · ${fl.options.length} options` : ''}{fl.condition?.field ? ' · conditionnelle' : ''}</div>
              </div>
              {fl.required && <span className="chip">Obligatoire</span>}
            </li>
          ))}
          <li className="flex items-center gap-3 rounded-xl p-4 text-white" style={{ background: 'linear-gradient(125deg,#041C5C,#1560DC)' }}>
            <Icon name="lock" className="opacity-60" />
            <div className="flex-1"><b className="text-sm">Consentement</b><div className="text-xs opacity-75">Décoché par défaut · lien confidentialité · horodaté</div></div>
            <span className="chip !bg-white/15 !text-white">Verrouillé</span>
          </li>
          <li onDragOver={(e) => { e.preventDefault(); setOverDrop(true) }} onDragLeave={() => setOverDrop(false)}
            onDrop={(e) => { e.preventDefault(); setOverDrop(false); const t = e.dataTransfer.getData('text/x-type'); if (t) add(t) }}
            className={`rounded-xl border-2 border-dashed p-4 text-center text-[13px] text-muted ${overDrop ? 'border-blue bg-blue-tint' : 'border-[#C9D2E0]'}`}>
            + Glisser un champ ici
          </li>
          <li className="flex items-center gap-2.5 rounded-xl bg-[var(--card)] px-4 py-3.5 text-[13px]">
            <span className="grid h-[18px] w-[18px] place-items-center rounded-[5px] bg-ok text-[11px] text-white"><Icon name="check" /></span>Protection anti-robot activée
          </li>
        </ol>
      </div>

      <aside className="flex flex-col gap-3 bg-[var(--card)] px-5 py-6 text-[13px]">
        {f ? (
          <>
            <div className="flex items-center"><b className="flex-1 text-base">Propriétés</b><button className="text-xs text-muted" onClick={() => setSel(null)}>Réglages du formulaire</button></div>
            <Field label="Libellé"><input className="input" value={f.label} onChange={(e) => setField(sel!, { label: e.target.value })} autoFocus /></Field>
            <Field label="Type"><select className="input" value={f.type} onChange={(e) => setField(sel!, { type: e.target.value })}>{TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            {['select', 'multi'].includes(f.type) && (
              <div>
                <div className="mb-1 text-muted">Options</div>
                <div className="flex flex-col gap-1.5">
                  {f.options.map((o: string, k: number) => (
                    <div key={k} className="flex gap-1">
                      <input className="input !min-h-9" value={o} onChange={(e) => setField(sel!, { options: f.options.map((x: string, j: number) => (j === k ? e.target.value : x)) })} aria-label={`Option ${k + 1}`} />
                      <button className="px-1 text-faint" onClick={() => setField(sel!, { options: f.options.filter((_: string, j: number) => j !== k) })} aria-label="Retirer l'option">×</button>
                    </div>
                  ))}
                  <button className="rounded-lg border border-dashed border-[#C9D2E0] py-2 text-muted" onClick={() => setField(sel!, { options: [...f.options, `Option ${f.options.length + 1}`] })}>+ Option</button>
                </div>
              </div>
            )}
            <label className="flex items-center justify-between rounded-[10px] bg-paper p-3">Obligatoire
              <button type="button" role="switch" aria-checked={f.required} className="toggle aria-checked:!bg-blue" onClick={() => setField(sel!, { required: !f.required })} aria-label="Obligatoire" />
            </label>
            <Field label="Aide (facultatif)"><input className="input" value={f.help_text} onChange={(e) => setField(sel!, { help_text: e.target.value })} /></Field>
            <Field label="Afficher seulement si…">
              <select className="input" value={f.condition?.field ?? ''} onChange={(e) => setField(sel!, { condition: e.target.value ? { field: e.target.value, equals: f.condition?.equals ?? '' } : null })}>
                <option value="">Toujours</option>
                {fields.slice(0, sel!).map((o) => <option key={o.key} value={o.key}>{o.label || o.key}</option>)}
              </select>
            </Field>
            {f.condition && <input className="input" placeholder="…vaut" value={f.condition.equals} onChange={(e) => setField(sel!, { condition: { ...f.condition, equals: e.target.value } })} aria-label="Valeur attendue" />}
            <button className="text-left text-xs font-semibold text-danger" onClick={() => { ed.set('fields', fields.filter((_, j) => j !== sel)); setSel(null) }}>Supprimer ce champ</button>
          </>
        ) : (
          <>
            <b className="text-base">Réglages</b>
            <Field label="Usage"><select className="input" value={v.purpose} onChange={(e) => ed.set('purpose', e.target.value)}>{PURPOSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></Field>
            <p className="rounded-[10px] bg-paper p-3 text-muted">Rattachement : choisissez ce formulaire dans la fiche d'une œuvre (mode « gratuit avec formulaire ») ou d'une formation.</p>
            <Field label="Introduction"><textarea className="input" rows={3} value={v.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
            <Field label="Texte du consentement"><textarea className="input" rows={3} value={v.consent_text} onChange={(e) => ed.set('consent_text', e.target.value)} /></Field>
            <Field label="Message après envoi"><input className="input" value={v.success_message} onChange={(e) => ed.set('success_message', e.target.value)} /></Field>
            {[['newsletter_optin', 'Proposer la newsletter'], ['requires_login', 'Compte requis'], ['is_active', 'Formulaire ouvert']].map(([k, l]) => (
              <label key={k} className="flex items-center justify-between rounded-[10px] bg-paper p-3">{l}
                <button type="button" role="switch" aria-checked={!!v[k]} className="toggle aria-checked:!bg-blue" onClick={() => ed.set(k, !v[k])} aria-label={l} />
              </label>
            ))}
            {v.id && <Confirm text="Supprimer le formulaire et ses réponses ?" danger onConfirm={async () => { await del(`/api/backoffice/forms/${v.id}/`); nav('/admin/formulaires') }}><button className="text-left text-xs font-semibold text-danger">Supprimer le formulaire</button></Confirm>}
          </>
        )}
        <ErrorNote error={ed.err} />
        <div className="mt-auto grid gap-2 pt-3">
          <button className="btn btn-ghost" onClick={() => save(false)} disabled={ed.busy}>Enregistrer le brouillon</button>
          <button className="btn btn-blue" onClick={() => save(true)} disabled={ed.busy}>Publier le formulaire</button>
        </div>
      </aside>
    </div>
  )
}

function Responses({ form, switcher }: { form: any; switcher: React.ReactNode }) {
  const list = useList(`/api/backoffice/forms/${form.id}/responses/`)
  const stats = useApi(`/api/backoffice/forms/${form.id}/stats/`)
  const cols = form.fields.slice(0, 4)
  const charts = (stats.data?.fields ?? []).slice(0, 2)
  const blues = ['#1560DC', '#3FA2FF', '#FF6B29', '#E6F0FA']
  return (
    <AdminPage crumb={<><Link to="/admin/formulaires">Formulaires</Link> / {form.title}</>}
      title={<>Réponses <span className="font-medium text-faint">{form.response_count.toLocaleString('fr-FR')}</span></>}
      actions={<>
        {switcher}
        <input type="date" className="input !min-h-[42px] !w-auto !bg-[var(--card)]" aria-label="Depuis le" value={list.params.get('from') ?? ''} onChange={(e) => list.setParam('from', e.target.value)} />
        <button className="btn btn-ghost !min-h-[42px]" onClick={() => download(`/api/backoffice/forms/${form.id}/responses/?format=xlsx`, `reponses-${form.slug}.xlsx`)}>Excel</button>
        <button className="btn btn-primary !min-h-[42px]" onClick={() => download(`/api/backoffice/forms/${form.id}/responses/?format=csv`, `reponses-${form.slug}.csv`)}>Exporter CSV</button>
      </>}>
      <div className="grid gap-4 md:grid-cols-3">
        {charts.map((f: any, ci: number) => {
          const entries = Object.entries(f.counts as Record<string, number>).sort((a, b) => b[1] - a[1])
          const total = entries.reduce((a, [, n]) => a + n, 0) || 1
          return (
            <Panel key={f.key} title={f.label}>
              {ci === 0 ? (
                <ul className="grid gap-2 text-xs">
                  {entries.map(([k, n]) => (
                    <li key={k} className="flex items-center gap-2">
                      <span className="w-24 truncate">{k}</span>
                      <span className="h-2 flex-1 rounded bg-[#EFF0F2]"><span className="block h-full rounded" style={{ width: `${(n / total) * 100}%`, background: n === entries[0][1] ? '#1560DC' : '#3FA2FF' }} /></span>
                      <b>{Math.round((n / total) * 100)} %</b>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {entries.map(([k, n], i) => <span key={k} className="rounded-md px-2.5 py-1.5" style={{ background: blues[i % 4], color: i % 4 === 3 ? '#2F68B7' : '#fff' }}>{k} {n}</span>)}
                </div>
              )}
            </Panel>
          )
        })}
        <div className="card-navy p-5">
          <b className="text-sm">Conversion</b>
          <div className="mt-2 text-[36px] font-bold">{stats.data?.conversion ?? 0} %</div>
          <div className="text-xs opacity-80">des répondants inscrits ont ensuite acheté</div>
        </div>
      </div>
      <TableWrap loading={list.loading} empty={!list.data?.results.length}>
        <table className="table">
          <thead><tr><th>Date</th><th>E-mail</th>{cols.map((f: any) => <th key={f.key}>{f.label}</th>)}<th>Consent.</th></tr></thead>
          <tbody>
            {list.data?.results.map((r: any) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{dateTime(r.created_at)}</td>
                <td>{r.user_email ?? r.data.email ?? '—'}</td>
                {cols.map((f: any) => {
                  const val = r.data[f.key]
                  return <td key={f.key} className="max-w-44 truncate">{Array.isArray(val) ? val.join(', ') : typeof val === 'object' && val ? val.name : String(val ?? '')}</td>
                })}
                <td className={r.consent ? 'text-ok' : 'text-faint'}>{r.consent ? `✓ ${new Date(r.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Pager list={list} />
    </AdminPage>
  )
}
