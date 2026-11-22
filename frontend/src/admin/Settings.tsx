import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ErrorNote, Field, Icon, PayLogo, Spinner } from '../components/ui'
import { api, del, patch, post } from '../lib/api'
import { dateTime, PAYMENT_METHODS } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, Drawer, Pager, Panel, Pills, TableWrap, Tabs, toFormData, useEditor, useList } from './kit'
import { Promos } from './Orders'
import { RichEditor } from './RichEditor'

/** Paramètres (maquette 15l) : Général, Paiements, Codes promo, E-mails, Pages et bannières, Sécurité. */
export function Settings() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') ?? 'general'
  const { data, loading, reload } = useApi('/api/backoffice/settings/')
  return (
    <AdminPage title="Paramètres">
      <Tabs value={tab} onChange={(v) => setParams({ onglet: v }, { replace: true })} tabs={[
        { value: 'general', label: 'Général' }, { value: 'paiements', label: 'Paiements' }, { value: 'promos', label: 'Codes promo' },
        { value: 'emails', label: 'E-mails' }, { value: 'pages', label: 'Pages et bannières' }, { value: 'securite', label: 'Sécurité' },
      ]} />
      {loading || !data ? <Spinner /> : (
        <>
          {tab === 'general' && <GeneralForm settings={data} onSaved={reload} />}
          {tab === 'paiements' && <Payments settings={data} onSaved={reload} />}
          {tab === 'promos' && <Promos />}
          {tab === 'emails' && <Emails />}
          {tab === 'pages' && <PagesTab />}
          {tab === 'securite' && <Security settings={data} onSaved={reload} />}
        </>
      )}
    </AdminPage>
  )
}

function useSave(onSaved: () => void) {
  const toast = useToast()
  return async (body: Record<string, unknown>, msg = 'Paramètres enregistrés.') => {
    await patch('/api/backoffice/settings/', body)
    toast(msg)
    onSaved()
  }
}

function GeneralForm({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const ed = useEditor({ ...settings })
  const toast = useToast()
  const v = ed.v
  const save = () => ed.run(async () => {
    const { site_name, tagline, whatsapp_number, contact_email, eur_rate, maintenance_mode, maintenance_message } = v
    await patch('/api/backoffice/settings/', { site_name, tagline, whatsapp_number, contact_email, eur_rate, maintenance_mode, maintenance_message })
    toast('Paramètres enregistrés.')
    onSaved()
  }).catch(() => {})
  return (
    <div className="card grid max-w-3xl gap-5 p-6">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Nom du site"><input className="input" value={v.site_name} onChange={(e) => ed.set('site_name', e.target.value)} /></Field>
        <Field label="Devise"><input className="input" value={v.tagline} onChange={(e) => ed.set('tagline', e.target.value)} /></Field>
        <Field label="Numéro WhatsApp du support" hint="Format international sans + : 2250700000000"><input className="input" value={v.whatsapp_number} onChange={(e) => ed.set('whatsapp_number', e.target.value)} /></Field>
        <Field label="E-mail de contact"><input className="input" type="email" value={v.contact_email} onChange={(e) => ed.set('contact_email', e.target.value)} /></Field>
        <Field label="Taux de conversion (FCFA pour 1 €)"><input className="input" type="number" step="0.001" value={v.eur_rate} onChange={(e) => ed.set('eur_rate', e.target.value)} /></Field>
      </div>
      <div className="grid gap-3 rounded-xl bg-paper p-4">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold">
          Mode maintenance : afficher la page de maintenance aux visiteurs
          <button type="button" role="switch" aria-checked={!!v.maintenance_mode} className="toggle" onClick={() => ed.set('maintenance_mode', !v.maintenance_mode)} aria-label="Mode maintenance" />
        </label>
        <Field label="Message"><input className="input !bg-[var(--card)]" value={v.maintenance_message} onChange={(e) => ed.set('maintenance_message', e.target.value)} /></Field>
      </div>
      <ErrorNote error={ed.err} />
      <button className="btn btn-blue justify-self-start" onClick={save} disabled={ed.busy}>Enregistrer</button>
    </div>
  )
}

function Payments({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const save = useSave(onSaved)
  const methods: string[] = settings.enabled_payment_methods
  const toggle = (m: string) => save({ enabled_payment_methods: methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m] }, 'Moyen de paiement mis à jour.')
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Moyens de paiement">
        <ul className="grid gap-2.5 text-[14px]">
          {PAYMENT_METHODS.map((m) => (
            <li key={m.value} className="flex items-center gap-3 rounded-[10px] bg-paper p-3">
              <PayLogo method={m.value} />
              <span className="flex-1">{m.label}</span>
              <button role="switch" aria-checked={methods.includes(m.value)} aria-label={m.label} className="toggle" onClick={() => toggle(m.value)} />
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Passerelle">
        <dl className="grid gap-2.5 text-[14px]">
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><dt>Opérateur</dt><dd className="font-semibold">CinetPay (Mobile Money + carte)</dd></div>
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><dt>Devise</dt><dd className="font-semibold">FCFA (XOF)</dd></div>
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><dt>Taux affiché pour la diaspora</dt><dd className="font-semibold">1 € = {Number(settings.eur_rate).toLocaleString('fr-FR')} F</dd></div>
        </dl>
        <p className="mt-3 text-xs text-muted">Les clés de la passerelle sont stockées sur le serveur (variables d'environnement) et ne s'affichent jamais ici.</p>
      </Panel>
    </div>
  )
}

const AUTO_EMAILS = [
  ['Vérification de l’adresse', 'À l’inscription, lien valable 3 jours'],
  ['Bienvenue', 'À la création du compte'],
  ['Reçu de commande', 'À la confirmation du paiement · aucun fichier joint, lien vers la bibliothèque'],
  ['Code cadeau', 'Au destinataire d’un livre offert'],
  ['Relance du panier', '24 h après un paiement non terminé'],
  ['Confirmation d’inscription', 'Formation gratuite ou payée'],
  ['Rappels de formation', 'La veille et 1 h avant la session'],
  ['Place libérée', 'Au premier de la liste d’attente'],
  ['Mot de passe oublié', 'Lien valable 1 heure'],
]

function Emails() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
      <Panel title="E-mails automatiques">
        <ul className="grid gap-2 text-[14px]">
          {AUTO_EMAILS.map(([t, d]) => (
            <li key={t} className="flex items-center gap-3 rounded-[10px] bg-paper p-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-tint text-blue"><Icon name="envelope" /></span>
              <span className="flex-1"><b className="block">{t}</b><span className="text-muted">{d}</span></span>
              <span className="text-ok">● Actif</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Envoi">
        <p className="text-[14px] text-muted">Les e-mails partent par le service transactionnel configuré sur le serveur (Brevo, Postmark…). Les newsletters se gèrent dans le module <Link to="/admin/newsletter" className="font-semibold text-blue">Newsletter</Link>.</p>
      </Panel>
    </div>
  )
}

function PagesTab() {
  const [page, setPage] = useState('banners')
  return (
    <div className="grid gap-4">
      <Pills value={page} onChange={setPage} options={[['banners', 'Bannières'], ['about_html', 'À propos'], ['terms_html', 'CGU'], ['privacy_html', 'Confidentialité'], ['legal_html', 'Mentions légales']]} />
      {page === 'banners' ? <Banners /> : <PageText key={page} field={page} />}
    </div>
  )
}

function PageText({ field }: { field: string }) {
  const { data, loading } = useApi('/api/backoffice/settings/')
  const [html, setHtml] = useState<string | null>(null)
  const toast = useToast()
  if (loading || !data) return <Spinner />
  return (
    <div className="grid gap-4">
      <RichEditor value={data[field]} onChange={setHtml} />
      <button className="btn btn-blue justify-self-start" disabled={html === null} onClick={async () => { await patch('/api/backoffice/settings/', { [field]: html }); toast('Page enregistrée.') }}>Enregistrer</button>
    </div>
  )
}

function Banners() {
  const { data, reload } = useApi<any[]>('/api/backoffice/banners/')
  const [editing, setEditing] = useState<any>(null)
  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted">Bandeau affiché sous la punchline du jour sur l'accueil. Programmez une date de début et de fin pour vos campagnes.</p>
      <div><button className="btn btn-primary btn-sm" onClick={() => setEditing({ title: '', subtitle: '', link_url: '', link_label: '', placement: 'home_hero', starts_at: null, ends_at: null, is_active: true, position: 0 })}>+ Nouvelle bannière</button></div>
      <TableWrap loading={!data} empty={!data?.length}>
        <table className="table"><tbody>
          {data?.map((b) => (
            <tr key={b.id} className="cursor-pointer" onClick={() => setEditing(b)}>
              <td className="font-semibold">{b.title}</td><td>{b.subtitle}</td>
              <td>{b.starts_at ? dateTime(b.starts_at) : 'Immédiat'} → {b.ends_at ? dateTime(b.ends_at) : 'sans fin'}</td>
              <td>{b.is_active ? <span className="chip chip-ok">Active</span> : <span className="chip">Inactive</span>}</td>
            </tr>
          ))}
        </tbody></table>
      </TableWrap>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier la bannière' : 'Nouvelle bannière'}>
        {editing && <BannerForm key={editing.id ?? 'new'} banner={editing} onDone={() => { setEditing(null); reload() }} />}
      </Drawer>
    </div>
  )
}

const local = (iso?: string | null) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

function BannerForm({ banner, onDone }: { banner: any; onDone: () => void }) {
  const ed = useEditor({ ...banner })
  const [image, setImage] = useState<File | null>(null)
  const v = ed.v
  const save = () => ed.run(async () => {
    const { image: _i, id: _id, ...body } = v
    const saved = v.id ? await patch(`/api/backoffice/banners/${v.id}/`, body) : await post('/api/backoffice/banners/', body)
    if (image) await api(`/api/backoffice/banners/${saved.id}/`, { method: 'PATCH', body: toFormData({ image }) })
    onDone()
  }).catch(() => {})
  const dt = (k: string) => <input className="input" type="datetime-local" value={local(v[k])} onChange={(e) => ed.set(k, e.target.value ? new Date(e.target.value).toISOString() : null)} />
  return (
    <div className="grid gap-4">
      <Field label="Titre" error={ed.fe('title')}><input className="input" value={v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
      <Field label="Texte"><input className="input" value={v.subtitle} onChange={(e) => ed.set('subtitle', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lien"><input className="input" value={v.link_url} onChange={(e) => ed.set('link_url', e.target.value)} placeholder="/livres/les-punchlines-tome-2" /></Field>
        <Field label="Texte du lien"><input className="input" value={v.link_label} onChange={(e) => ed.set('link_label', e.target.value)} /></Field>
      </div>
      <div className="grid grid-cols-2 gap-3"><Field label="Début">{dt('starts_at')}</Field><Field label="Fin">{dt('ends_at')}</Field></div>
      <Field label="Image (facultatif)"><input type="file" accept="image/*" className="input" onChange={(e) => setImage(e.target.files?.[0] ?? null)} /></Field>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.is_active} onChange={(e) => ed.set('is_active', e.target.checked)} /> Active</label>
      <ErrorNote error={ed.err} />
      <div className="flex gap-2">
        <button className="btn btn-blue" onClick={save} disabled={ed.busy}>Enregistrer</button>
        {v.id && <Confirm text="Supprimer ?" danger onConfirm={async () => { await del(`/api/backoffice/banners/${v.id}/`); onDone() }}><button className="btn btn-ghost text-danger">Supprimer</button></Confirm>}
      </div>
    </div>
  )
}

function Security({ settings, onSaved }: { settings: any; onSaved: () => void }) {
  const save = useSave(onSaved)
  const [devices, setDevices] = useState(settings.max_devices_per_account)
  const [threshold, setThreshold] = useState(settings.reader_alert_threshold)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Lecture et sécurité">
        <div className="grid gap-2.5 text-[14px]">
          <label className="flex items-center justify-between gap-3 rounded-[10px] bg-paper p-3">Appareils max par compte
            <input type="number" min={1} max={5} className="input !min-h-9 !w-20 !bg-[var(--card)] text-right font-bold" value={devices} onChange={(e) => setDevices(Number(e.target.value))} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-[10px] bg-paper p-3">Seuil d'alerte (pages / heure)
            <input type="number" min={20} className="input !min-h-9 !w-24 !bg-[var(--card)] text-right font-bold" value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} />
          </label>
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><span>Filigrane nominatif</span><b className="text-ok">Activé</b></div>
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><span>Adresses de page signées</span><b className="text-ok">2 minutes</b></div>
          <div className="flex justify-between rounded-[10px] bg-paper p-3"><span>Double authentification du Studio</span><b className="text-ok">Obligatoire</b></div>
          <button className="btn btn-blue justify-self-start" onClick={() => save({ max_devices_per_account: devices, reader_alert_threshold: threshold })}>Enregistrer</button>
        </div>
      </Panel>
      <div className="grid content-start gap-4">
        <Panel title="Alertes anti-fraude"><Alerts /></Panel>
        <Panel title="Versions livrées"><Releases /></Panel>
      </div>
    </div>
  )
}

function Alerts() {
  const list = useList('/api/backoffice/alerts/')
  if (list.loading) return <Spinner />
  if (!list.data?.results.length) return <p className="text-sm text-muted">Aucune alerte.</p>
  return (
    <ul className="grid gap-2 text-[14px]">
      {list.data.results.map((a: any) => (
        <li key={a.id} className="flex items-center gap-3 rounded-[10px] bg-paper p-3">
          <span className="min-w-0 flex-1"><b className="block">{a.kind_label} · {a.user_email}</b><span className="text-muted">{a.detail} · {dateTime(a.created_at)}</span></span>
          {a.resolved ? <span className="chip chip-ok">Traitée</span> : (
            <button className="text-xs font-semibold text-blue" onClick={async () => { await patch(`/api/backoffice/alerts/${a.id}/`, { resolved: true }); list.reload() }}>Marquer traitée</button>
          )}
        </li>
      ))}
    </ul>
  )
}

function Releases() {
  const { data, reload } = useApi<any[]>('/api/backoffice/releases/')
  const [f, setF] = useState({ version: '', released_at: new Date().toISOString().slice(0, 10), content: '', delivered_by: "All'Digit" })
  return (
    <div className="grid gap-4 text-[14px]">
      <ol className="grid gap-3">
        {data?.map((r) => (
          <li key={r.id} className="border-l-4 border-orange pl-3"><b>v{r.version} · {r.released_at} · {r.delivered_by}</b><p className="whitespace-pre-line text-muted">{r.content}</p></li>
        ))}
      </ol>
      <div className="grid gap-2 rounded-xl bg-paper p-3">
        <div className="grid grid-cols-2 gap-2">
          <input className="input !bg-[var(--card)]" value={f.version} onChange={(e) => setF({ ...f, version: e.target.value })} placeholder="Version (1.1.0)" aria-label="Version" />
          <input className="input !bg-[var(--card)]" type="date" value={f.released_at} onChange={(e) => setF({ ...f, released_at: e.target.value })} aria-label="Date" />
        </div>
        <textarea className="input !min-h-16 !bg-[var(--card)]" value={f.content} onChange={(e) => setF({ ...f, content: e.target.value })} placeholder="Contenu de la version" aria-label="Contenu" />
        <button className="btn btn-dark btn-sm justify-self-start" disabled={!f.version || !f.content} onClick={async () => { await post('/api/backoffice/releases/', f); setF({ ...f, version: '', content: '' }); reload() }}>Ajouter la note de version</button>
      </div>
    </div>
  )
}

const DOTS: Record<string, [string, string]> = {
  otp_login: ['#9A9DA6', '#EFF0F2'], block: ['#FF6B29', '#FFEDE4'], revoke_access: ['#FF6B29', '#FFEDE4'], delete: ['#FF6B29', '#FFEDE4'],
  refund: ['#16A34A', '#DCFCE7'], mark_paid: ['#16A34A', '#DCFCE7'], resend_receipt: ['#16A34A', '#DCFCE7'],
}
const ACTION_LABEL: Record<string, string> = {
  otp_login: 'Connexion au Studio réussie (2FA)', block: 'Compte bloqué', unblock: 'Compte débloqué', grant_access: 'Accès octroyé',
  revoke_access: 'Accès retiré', close_device: 'Session d’appareil fermée', update_user: 'Utilisateur modifié', refund: 'Remboursement',
  mark_paid: 'Paiement validé manuellement', resend_receipt: 'Reçu renvoyé', create: 'Création', update: 'Modification', delete: 'Suppression',
  import_sections: 'Import de contenu', new_edition: 'Nouvelle édition', moderate_comments: 'Modération de commentaires',
  send_campaign: 'Newsletter envoyée', update_settings: 'Paramètres modifiés', email_participants: 'E-mail aux inscrits', update_enrollment: 'Inscription modifiée',
}
const TYPE_LABEL: Record<string, string> = {
  Work: 'œuvre', Section: 'section', Post: 'article', Order: 'commande', User: '', Training: 'formation', TrainingSession: 'session',
  Form: 'formulaire', PromoCode: 'code promo', Banner: 'bannière', Bundle: 'pack', Campaign: 'newsletter', Category: 'catégorie',
}

function dayLabel(iso: string) {
  const d = new Date(iso), now = new Date()
  const y = new Date(now); y.setDate(now.getDate() - 1)
  const t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `Aujourd'hui ${t}`
  if (d.toDateString() === y.toDateString()) return `Hier ${t}`
  return `${d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })} ${t}`
}

/** Journal des actions en frise chronologique (maquette 15m). */
export function Journal() {
  const list = useList('/api/backoffice/audit/')
  const cat = list.params.get('category') ?? ''
  return (
    <AdminPage title="Journal des actions" actions={
      <Pills value={cat} onChange={(v) => list.setParam('category', v)} options={[['', 'Tout'], ['connexions', 'Connexions'], ['contenu', 'Contenu'], ['acces', 'Accès'], ['paiements', 'Paiements']]} />}>
      <section className="card p-6">
        {list.loading ? <Spinner /> : !list.data?.results.length ? <p className="text-muted">Aucune action enregistrée.</p> : (
          <ol className="relative flex flex-col gap-[18px] pl-7">
            <span className="absolute top-1.5 bottom-1.5 left-[9px] w-0.5" style={{ background: 'linear-gradient(180deg,#1560DC,#E6F0FA)' }} />
            {list.data.results.map((a: any) => {
              const [dot, ring] = DOTS[a.action] ?? ['#1560DC', '#E6F0FA']
              const what = ACTION_LABEL[a.action] ?? a.action
              const type = TYPE_LABEL[a.target_type] ?? a.target_type
              const isLogin = a.action === 'otp_login'
              return (
                <li key={a.id} className="relative flex items-start gap-4">
                  <span className="absolute top-[3px] -left-[26px] h-4 w-4 rounded-full" style={{ background: dot, boxShadow: `0 0 0 4px ${ring}` }} />
                  <div className="min-w-0 flex-1">
                    <b className="text-sm">{what}{type && ['create', 'update', 'delete'].includes(a.action) ? ` · ${type}` : ''}{a.summary && !isLogin ? ` : ${a.summary}` : ''}</b>
                    <div className="text-[14px] text-muted">{isLogin && a.summary ? `${a.summary} · ` : ''}par {a.actor}{a.ip_address ? ` · ${a.ip_address}` : ''}</div>
                  </div>
                  <span className="shrink-0 text-xs text-faint">{dayLabel(a.created_at)}</span>
                </li>
              )
            })}
          </ol>
        )}
      </section>
      <Pager list={list} />
    </AdminPage>
  )
}
