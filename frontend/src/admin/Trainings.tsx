import { useState } from 'react'
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorNote, Field, Spinner } from '../components/ui'
import { api, del, download, patch, post } from '../lib/api'
import { dateTime, fcfa } from '../lib/format'
import { useApi } from '../lib/hooks'
import { TrainingPoster } from '../components/TrainingPoster'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, Drawer, Panel, TableWrap, toFormData, useEditor } from './kit'

const STATUS_LABEL: Record<string, string> = { upcoming: 'À venir', open: 'Inscriptions ouvertes', full: 'Complet', done: 'Terminé', cancelled: 'Annulée' }

export function TrainingsList() {
  const { data, loading } = useApi('/api/backoffice/trainings/')
  return (
    <AdminPage title="Formations" search actions={<Link to="/admin/formations/nouvelle" className="btn btn-primary !min-h-[42px]">+ Nouvelle formation</Link>}>
      <TableWrap loading={loading} empty={!data?.results.length}>
        <table className="table">
          <thead><tr><th>Formation</th><th>Format</th><th>Prix</th><th>Sessions</th><th>Inscrits confirmés</th><th>En ligne</th></tr></thead>
          <tbody>
            {data?.results.map((t: any) => (
              <tr key={t.id}>
                <td>
                  <Link to={`/admin/formations/${t.id}`} className="font-semibold">{t.title}</Link>
                  {(t.organizer || t.registration_mode === 'external') && <span className="block text-xs text-muted">{t.organizer || 'Adjougbe'}{t.registration_mode === 'external' ? ' · inscriptions chez l\u2019organisateur' : ''}</span>}
                </td>
                <td>{{ online: 'En ligne', onsite: 'Présentiel', recorded: 'Enregistrée' }[t.format as string]}</td>
                <td>{t.price_xof ? fcfa(t.price_xof) : 'Gratuit'}</td>
                <td className="text-sm">{t.sessions.map((s: any) => (
                  <Link key={s.id} to={`/admin/formations/sessions/${s.id}`} className="block hover:underline">{dateTime(s.starts_at)} · {s.seats_taken}/{s.capacity}</Link>
                ))}</td>
                <td className="tabular-nums">{t.enrollments_count}</td>
                <td>{t.is_published ? <span className="chip chip-ok">Publiée</span> : <span className="chip">Brouillon</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </AdminPage>
  )
}

const EMPTY = { title: '', theme: '', format: 'online', summary: '', context: '', objectives: [], audience: '', program: [], duration_label: '', trainer: 'Adjougbe', price_xof: 0, faq: [], testimonials: [], registration_form_id: null, is_published: false, sessions: [], author_role: 'organizer', organizer: '', registration_mode: 'site', external_registration_url: '' }

export function TrainingEdit() {
  const { id } = useParams()
  const isNew = id === 'nouvelle'
  const { data, loading, reload } = useApi(isNew ? null : `/api/backoffice/trainings/${id}/`)
  const [params, setParams] = useSearchParams()
  const editing = isNew || params.get('fiche') === '1'
  if (!isNew && (loading || !data)) return <Spinner />
  const t = isNew ? EMPTY : data
  if (editing)
    return (
      <AdminPage crumb={<Link to={isNew ? '/admin/formations' : `/admin/formations/${t.id}`}>Formations /</Link>} title={isNew ? 'Nouvelle formation' : `Fiche — ${t.title}`}
        actions={!isNew && <a href={`/formations/${t.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Voir la page publique</a>}>
        <TrainingForm key={t.id ?? 'new'} training={t} />
      </AdminPage>
    )
  return <TrainingOverview training={t} onChanged={reload} selected={Number(params.get('session')) || null}
    onSelect={(sid) => setParams({ session: String(sid) }, { replace: true })} onEdit={() => setParams({ fiche: '1' })} />
}

function TrainingOverview({ training: t, onChanged, selected, onSelect, onEdit }: {
  training: any; onChanged: () => void; selected: number | null; onSelect: (id: number) => void; onEdit: () => void
}) {
  const [editingSession, setEditingSession] = useState<any>(null)
  const sessions: any[] = t.sessions
  const current = sessions.find((x) => x.id === selected) ?? sessions.find((x) => x.status === 'open') ?? sessions[0]
  const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return (
    <AdminPage crumb={<Link to="/admin/formations">Formations /</Link>} title={t.title}
      actions={<>
        {current && <button className="btn btn-ghost !min-h-[42px]" onClick={() => download(`/api/backoffice/sessions/${current.id}/enrollments/?format=csv`, 'inscrits.csv')}>Exporter CSV</button>}
        <button className="btn btn-blue !min-h-[42px]" onClick={onEdit}>Modifier la fiche</button>
      </>}>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sessions.map((x) => {
          const pct = Math.min(100, (x.seats_taken / x.capacity) * 100)
          const active = current?.id === x.id
          const stateColor = { open: active ? '#86EFAC' : '#16A34A', full: '#C2410C', done: '#9A9DA6', upcoming: '#2F68B7', cancelled: '#B4421B' }[x.status as string]
          return (
            <button key={x.id} onClick={() => onSelect(x.id)} className={`${active ? 'card-navy' : 'card'} p-5 text-left`} aria-pressed={active}>
              <div className="flex justify-between gap-2 text-[14px]">
                <b>{day(x.starts_at)} · {x.location ? x.location.split(',')[0] : 'En ligne'}</b>
                <span style={{ color: stateColor }}>● {STATUS_LABEL[x.status]}</span>
              </div>
              <div className="mt-2.5 text-[36px] font-bold">{x.seats_taken}<span className={`text-base ${active ? 'opacity-60' : 'text-faint'}`}> / {x.capacity}</span></div>
              <div className={`mt-2 h-1.5 rounded-full ${active ? 'bg-white/20' : 'bg-[#EFF0F2]'}`}><div className="h-full rounded-full bg-orange" style={{ width: `${pct}%` }} /></div>
              <div className={`mt-2 text-xs ${active ? 'opacity-75' : 'text-muted'}`}>
                {x.status === 'full' ? 'Inscriptions fermées automatiquement' : x.waitlist_count ? `${x.waitlist_count} en liste d'attente` : `Rappel auto la veille et 1 h avant`}
              </div>
            </button>
          )
        })}
        <button onClick={() => setEditingSession({ training: t.id, starts_at: '', ends_at: '', location: '', meeting_link: '', capacity: 30, price_xof: null, registrations_open: true, is_cancelled: false })}
          className="grid min-h-36 place-items-center rounded-2xl border-2 border-dashed border-[#C9D2E0] font-semibold text-blue">+ Nouvelle session</button>
      </div>
      {current && <SessionPanel key={current.id} session={current} onEditSession={() => setEditingSession(current)} onChanged={onChanged} />}
      <Drawer open={!!editingSession} onClose={() => setEditingSession(null)} title={editingSession?.id ? 'Modifier la session' : 'Nouvelle session'}>
        {editingSession && <SessionForm key={editingSession.id ?? 'new'} session={editingSession} onDone={() => { setEditingSession(null); onChanged() }} />}
      </Drawer>
    </AdminPage>
  )
}

function SessionPanel({ session: s, onEditSession, onChanged }: { session: any; onEditSession: () => void; onChanged: () => void }) {
  const enr = useApi<any[]>(`/api/backoffice/sessions/${s.id}/enrollments/`)
  const [mail, setMail] = useState({ subject: '', body: '' })
  const [answers, setAnswers] = useState<any>(null)
  const toast = useToast()
  const upd = async (eid: number, body: any) => { await patch(`/api/backoffice/enrollments/${eid}/`, body); enr.reload(); onChanged() }
  const setSession = async (body: any, msg: string) => { await patch(`/api/backoffice/sessions/${s.id}/`, body); toast(msg); onChanged() }
  const labels: Record<string, string> = { confirmed: 'Confirmée', pending_payment: 'En attente de paiement', waitlist: "Liste d'attente", cancelled: 'Annulée' }
  const confirmed = (enr.data ?? []).filter((e) => e.status === 'confirmed').length
  const day = new Date(s.starts_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
      <Panel title={`Inscrits — session du ${day}`} action={<button className="text-[14px] font-semibold text-blue" onClick={onEditSession}>Modifier la session</button>}>
        {enr.loading ? <Spinner /> : !enr.data?.length ? <p className="text-sm text-muted">Aucun inscrit pour le moment.</p> : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead><tr><th>Nom</th><th>E-mail</th><th>Téléphone</th><th>Paiement</th><th>Statut</th><th>Présent</th><th /></tr></thead>
              <tbody>
                {enr.data.map((e) => (
                  <tr key={e.id}>
                    <td className="font-bold">{e.name}</td>
                    <td>{e.email}</td>
                    <td className="whitespace-nowrap">{e.phone}</td>
                    <td className={e.payment.ok ? 'text-ok-dark' : 'text-warn'}>{e.payment.label}</td>
                    <td>
                      <select className="input !min-h-8 !w-auto !py-1 text-xs" value={e.status} onChange={(ev) => upd(e.id, { status: ev.target.value })} aria-label={`Statut de ${e.name}`}>
                        {Object.entries(labels).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </select>
                    </td>
                    <td><input type="checkbox" className="h-5 w-5 accent-orange" checked={e.attended} onChange={(ev) => upd(e.id, { attended: ev.target.checked })} aria-label={`${e.name} présent`} /></td>
                    <td className="whitespace-nowrap text-right text-xs">
                      {e.answers && <button className="font-semibold text-blue" onClick={() => setAnswers(e)}>Réponses</button>}
                      {e.attended && <button className="ml-3 font-semibold text-blue" onClick={() => download(`/api/backoffice/enrollments/${e.id}/certificate/`, `attestation-${e.name}.pdf`).then(() => enr.reload())}>Attestation</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <section className="card flex h-max flex-col gap-2.5 p-5 text-[14px]">
        <b className="text-[15px]">E-mail groupé</b>
        <div className="rounded-[10px] bg-paper px-3 py-2.5">À : {confirmed} inscrit(s) confirmé(s) · session du {day}</div>
        <input className="input !min-h-0 !py-2.5 font-semibold" placeholder="Objet" value={mail.subject} onChange={(e) => setMail({ ...mail, subject: e.target.value })} aria-label="Objet" />
        <textarea className="input min-h-[110px] leading-relaxed" placeholder="Bonjour, rendez-vous à 8h45 à l'accueil…" value={mail.body} onChange={(e) => setMail({ ...mail, body: e.target.value })} aria-label="Message" />
        <button className="btn btn-primary" disabled={!mail.subject || !mail.body || !confirmed} onClick={async () => {
          const r = await post(`/api/backoffice/sessions/${s.id}/email/`, mail)
          toast(`${r.sent} e-mail(s) envoyé(s).`); setMail({ subject: '', body: '' })
        }}>Envoyer</button>
        <div className="flex flex-wrap gap-1.5 pt-1">
          <button className={`chip ${s.registrations_open && !s.is_cancelled ? 'chip-blue' : ''}`} onClick={() => setSession({ registrations_open: true, is_cancelled: false }, 'Inscriptions ouvertes.')}>Ouvert</button>
          <button className="chip" onClick={() => setSession({ registrations_open: false }, 'Inscriptions fermées.')}>Fermer les inscriptions</button>
          <Confirm text="Annuler la session ?" danger onConfirm={() => setSession({ is_cancelled: true }, 'Session annulée.')}>
            <button className="chip chip-danger">Annuler la session</button>
          </Confirm>
        </div>
      </section>
      <Drawer open={!!answers} onClose={() => setAnswers(null)} title={`Réponses de ${answers?.name ?? ''}`}>
        <dl className="grid gap-3">{answers && Object.entries(answers.answers).map(([k, v]) => <div key={k}><dt className="text-sm text-muted">{k}</dt><dd>{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}</dl>
      </Drawer>
    </div>
  )
}

/** Édition d'une liste de lignes (objectifs) ou de paires (programme, FAQ, témoignages). */
function ListEditor({ label, items, onChange, keys }: { label: string; items: any[]; onChange: (v: any[]) => void; keys?: [string, string][] }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-medium">{label}</legend>
      {items.map((it, i) => (
        <div key={i} className="flex gap-2">
          {keys ? keys.map(([k, ph]) => (
            <input key={k} className="input" placeholder={ph} value={it[k] ?? ''} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
          )) : <input className="input" value={it} onChange={(e) => onChange(items.map((x, j) => (j === i ? e.target.value : x)))} />}
          <button type="button" className="px-2 text-muted" aria-label="Retirer" onClick={() => onChange(items.filter((_, j) => j !== i))}>×</button>
        </div>
      ))}
      <button type="button" className="link justify-self-start text-sm" onClick={() => onChange([...items, keys ? Object.fromEntries(keys.map(([k]) => [k, ''])) : ''])}>Ajouter une ligne</button>
    </fieldset>
  )
}

function TrainingForm({ training }: { training: any }) {
  const ed = useEditor({ ...training })
  const forms = useApi('/api/backoffice/forms/?purpose=training')
  const [cover, setCover] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const nav = useNavigate()
  const toast = useToast()
  const v = ed.v
  const save = () => ed.run(async () => {
    const { sessions: _s, cover: _c, enrollments_count: _e, created_at: _x, ...body } = v
    const saved = v.id ? await patch(`/api/backoffice/trainings/${v.id}/`, body) : await post('/api/backoffice/trainings/', body)
    if (cover) await api(`/api/backoffice/trainings/${saved.id}/`, { method: 'PATCH', body: toFormData({ cover }) })
    toast('Formation enregistrée.')
    if (!v.id) nav(`/admin/formations/${saved.id}`, { replace: true })
  }).catch(() => {})
  return (
    <div className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Titre" error={ed.fe('title')}><input className="input" value={v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
        <Field label="Thème"><input className="input" value={v.theme} onChange={(e) => ed.set('theme', e.target.value)} /></Field>
        <Field label="Format">
          <select className="input" value={v.format} onChange={(e) => ed.set('format', e.target.value)}>
            <option value="online">En ligne en direct</option><option value="onsite">Présentiel</option><option value="recorded">Enregistrée</option>
          </select>
        </Field>
        <Field label="Prix (FCFA, 0 = gratuit)"><input className="input" type="number" value={v.price_xof} onChange={(e) => ed.set('price_xof', Number(e.target.value))} /></Field>
        <Field label="Durée"><input className="input" placeholder="3 heures" value={v.duration_label} onChange={(e) => ed.set('duration_label', e.target.value)} /></Field>
        <Field label="Formateur"><input className="input" value={v.trainer} onChange={(e) => ed.set('trainer', e.target.value)} /></Field>
      </div>
      <fieldset className="grid gap-4 rounded-2xl bg-paper p-5">
        <legend className="sr-only">Organisation et inscription</legend>
        <b className="text-[15px]">Organisation et inscription</b>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Rôle d'Adjougbe">
            <select className="input !bg-[var(--card)]" value={v.author_role} onChange={(e) => ed.set('author_role', e.target.value)}>
              <option value="organizer">Organisateur (sa propre formation)</option><option value="speaker">Intervenant (formation d'une autre organisation)</option>
            </select>
          </Field>
          <Field label="Organisation" hint="Laisser vide si c'est une formation d'Adjougbe."><input className="input !bg-[var(--card)]" placeholder="Ex. Institut Leadership Abidjan" value={v.organizer} onChange={(e) => ed.set('organizer', e.target.value)} /></Field>
        </div>
        <div className="grid gap-2">
          <span className="text-sm font-medium">Où se font les inscriptions ?</span>
          {[['site', 'Sur le site', 'Formulaire, paiement Mobile Money, rappels et attestation gérés ici.'], ['external', "Chez l'organisateur", 'Le bouton « S\u2019inscrire » ouvre le formulaire de l\u2019organisateur.']].map(([k, l, d]) => (
            <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-xl border-[1.5px] bg-[var(--card)] p-3.5 ${v.registration_mode === k ? 'border-blue' : 'border-line'}`}>
              <input type="radio" name="registration_mode" className="mt-1 accent-blue" checked={v.registration_mode === k} onChange={() => ed.set('registration_mode', k)} />
              <span><b className="block text-sm">{l}</b><span className="text-[13.5px] text-muted">{d}</span></span>
            </label>
          ))}
        </div>
        {v.registration_mode === 'external' ? (
          <Field label="Lien du formulaire de l'organisateur" error={ed.fe('external_registration_url')} hint="Adresse complète, commençant par https://">
            <input className="input !bg-[var(--card)]" type="url" inputMode="url" placeholder="https://" value={v.external_registration_url} onChange={(e) => ed.set('external_registration_url', e.target.value.trim())} />
          </Field>
        ) : (
          <Field label="Formulaire d'inscription" hint="Questions posées avant le paiement (facultatif).">
            <select className="input !bg-[var(--card)]" value={v.registration_form_id ?? ''} onChange={(e) => ed.set('registration_form_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Aucun</option>{forms.data?.results.map((f: any) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </Field>
        )}
      </fieldset>
      <div className="grid items-start gap-4 md:grid-cols-[220px_1fr]">
        <div className="overflow-hidden rounded-xl ring-1 ring-line">
          <TrainingPoster t={{ ...v, cover: preview ?? v.cover }} className="aspect-[4/5]" />
        </div>
        <Field label="Affiche ou bannière de la formation" hint="Visible sur la miniature et en haut de la page. Portrait ou paysage, JPG ou PNG.">
          <input type="file" accept="image/*" className="input" onChange={(e) => { const f = e.target.files?.[0] ?? null; setCover(f); setPreview((old) => { if (old) URL.revokeObjectURL(old); return f ? URL.createObjectURL(f) : null }) }} />
        </Field>
      </div>
      <Field label="Présentation"><textarea className="input" value={v.summary} onChange={(e) => ed.set('summary', e.target.value)} /></Field>
      <Field label="Contexte" hint="Pourquoi cette formation existe, d'où elle vient, ce qu'elle change. Laissez une ligne vide entre deux paragraphes.">
        <textarea className="input" rows={6} value={v.context ?? ''} onChange={(e) => ed.set('context', e.target.value)} />
      </Field>
      <Field label="Public cible"><textarea className="input" rows={2} value={v.audience} onChange={(e) => ed.set('audience', e.target.value)} /></Field>
      <div className="grid gap-6 md:grid-cols-2">
        <ListEditor label="Objectifs" items={v.objectives} onChange={(x) => ed.set('objectives', x)} />
        <ListEditor label="Programme" items={v.program} onChange={(x) => ed.set('program', x)} keys={[['title', 'Module'], ['detail', 'Détail']]} />
        <ListEditor label="Questions fréquentes" items={v.faq} onChange={(x) => ed.set('faq', x)} keys={[['q', 'Question'], ['a', 'Réponse']]} />
        <ListEditor label="Témoignages" items={v.testimonials} onChange={(x) => ed.set('testimonials', x)} keys={[['text', 'Témoignage'], ['author', 'Auteur']]} />
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.is_published} onChange={(e) => ed.set('is_published', e.target.checked)} /> Publiée sur le site</label>
      <ErrorNote error={ed.err} />
      <button className="btn btn-primary justify-self-start" onClick={save} disabled={ed.busy}>Enregistrer</button>
    </div>
  )
}

const local = (iso?: string) => { if (!iso) return ''; const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

function SessionForm({ session, onDone }: { session: any; onDone: () => void }) {
  const ed = useEditor({ ...session })
  const v = ed.v
  const save = () => ed.run(async () => {
    const body = { training: v.training, starts_at: v.starts_at, ends_at: v.ends_at, location: v.location, meeting_link: v.meeting_link, capacity: v.capacity, price_xof: v.price_xof, registrations_open: v.registrations_open, is_cancelled: v.is_cancelled }
    if (v.id) await patch(`/api/backoffice/sessions/${v.id}/`, body); else await post('/api/backoffice/sessions/', body)
    onDone()
  }).catch(() => {})
  const dt = (k: string) => <input className="input" type="datetime-local" value={local(v[k])} onChange={(e) => ed.set(k, e.target.value ? new Date(e.target.value).toISOString() : '')} />
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-2 gap-3"><Field label="Début" error={ed.fe('starts_at')}>{dt('starts_at')}</Field><Field label="Fin" error={ed.fe('ends_at')}>{dt('ends_at')}</Field></div>
      <Field label="Adresse (présentiel)"><input className="input" value={v.location} onChange={(e) => ed.set('location', e.target.value)} /></Field>
      <Field label="Lien Zoom, Meet ou WhatsApp" hint="Envoyé uniquement aux inscrits confirmés." error={ed.fe('meeting_link')}><input className="input" type="url" value={v.meeting_link} onChange={(e) => ed.set('meeting_link', e.target.value)} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Nombre de places"><input className="input" type="number" value={v.capacity} onChange={(e) => ed.set('capacity', Number(e.target.value))} /></Field>
        <Field label="Prix spécifique (FCFA)" hint="Vide = prix de la formation."><input className="input" type="number" value={v.price_xof ?? ''} onChange={(e) => ed.set('price_xof', e.target.value === '' ? null : Number(e.target.value))} /></Field>
      </div>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.registrations_open} onChange={(e) => ed.set('registrations_open', e.target.checked)} /> Inscriptions ouvertes</label>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.is_cancelled} onChange={(e) => ed.set('is_cancelled', e.target.checked)} /> Session annulée</label>
      <ErrorNote error={ed.err} />
      <div className="flex gap-2">
        <button className="btn btn-primary" onClick={save} disabled={ed.busy}>Enregistrer</button>
        {v.id && <Confirm text="Supprimer la session ?" danger onConfirm={async () => { await del(`/api/backoffice/sessions/${v.id}/`); onDone() }}><button className="btn btn-ghost text-danger">Supprimer</button></Confirm>}
      </div>
    </div>
  )
}

export function SessionDetail() {
  const { id } = useParams()
  const { data } = useApi(`/api/backoffice/sessions/${id}/`)
  if (!data) return <Spinner />
  return <Navigate to={`/admin/formations/${data.training}?session=${id}`} replace />
}
