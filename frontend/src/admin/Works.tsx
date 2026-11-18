import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ErrorNote, Field, Icon, Spinner, WorkCover } from '../components/ui'
import { api, del, patch, post } from '../lib/api'
import { fcfa } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, Drawer, TableWrap, Tabs, toFormData, useEditor } from './kit'

const ACCESS = [['paid', 'Payant'], ['free_form', 'Gratuit avec formulaire'], ['free_account', 'Gratuit avec compte'], ['public', 'Extrait public (sans compte)']]
const STATUS = [['draft', 'Brouillon'], ['published', 'Publié'], ['preorder', 'Précommande'], ['archived', 'Archivé']]

export function WorksList() {
  const { data, loading, error } = useApi('/api/backoffice/works/')
  const statusLabel: Record<string, [string, string]> = { published: ['En vente', 'chip-ok'], draft: ['Brouillon', ''], preorder: ['Précommande', 'chip-blue'], archived: ['Archivé', ''] }
  return (
    <AdminPage title="Œuvres" search actions={<Link to="/admin/oeuvres/nouvelle" className="btn btn-primary !min-h-[42px]">+ Nouvelle œuvre</Link>}>
      {loading ? <Spinner /> : error ? <ErrorNote error={error} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data?.results.map((w: any) => {
            const free = w.access_mode !== 'paid'
            const [lbl, tone] = free && w.status === 'published' ? ['Offerte', 'chip-orange'] : statusLabel[w.status] ?? [w.status, '']
            return (
              <article key={w.id} className="card flex gap-4 p-4">
                <Link to={`/admin/oeuvres/${w.id}`} className="block w-[110px] shrink-0"><WorkCover work={w} size="sm" /></Link>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className={`chip ${tone} self-start`}>{lbl}</span>
                  <Link to={`/admin/oeuvres/${w.id}`} className="mt-2 text-[15px] leading-snug font-bold">{w.title}</Link>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-paper py-2"><dd className="text-sm font-bold">{free ? '0 F' : `${(w.promo_price_xof ?? w.price_xof).toLocaleString('fr-FR')} F`}</dd><dt className="text-[11px] text-muted">Prix</dt></div>
                    <div className="rounded-lg bg-paper py-2"><dd className="text-sm font-bold">{free ? w.readers_count : w.sales_count}</dd><dt className="text-[11px] text-muted">{free ? 'Lecteurs' : 'Ventes'}</dt></div>
                    <div className="rounded-lg bg-paper py-2"><dd className="text-sm font-bold">{w.sections_count}</dd><dt className="text-[11px] text-muted">{w.kind === 'punchlines' ? 'Séries' : 'Histoires'}</dt></div>
                  </dl>
                  <div className="mt-auto flex gap-2 pt-3 text-[13px]">
                    <Link to={`/admin/oeuvres/${w.id}`} className="btn btn-blue btn-sm flex-1">Modifier</Link>
                    <a href={`/livres/${w.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm flex-1">Aperçu</a>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
      <BundlesAndPromos />
    </AdminPage>
  )
}

function BundlesAndPromos() {
  const bundles = useApi('/api/backoffice/bundles/')
  const works = useApi('/api/backoffice/works/')
  const [editing, setEditing] = useState<any>(null)
  return (
    <section className="grid gap-3">
      {bundles.data?.map((b: any) => (
        <div key={b.id} className="card-navy flex flex-wrap items-center gap-4 p-5">
          <span className="grid h-12 w-12 place-items-center rounded-xl bg-orange text-xl font-bold">%</span>
          <div className="flex-1">
            <b className="text-[15px]">{b.title} {!b.is_active && <span className="chip ml-2">Inactif</span>}</b>
            <div className="text-[13px] opacity-80">{fcfa(b.price_xof)} au lieu de {b.full_price_xof.toLocaleString('fr-FR')}</div>
          </div>
          <button className="btn btn-sm bg-white text-blue-dark" onClick={() => setEditing(b)}>Gérer le pack</button>
        </div>
      ))}
      <button className="justify-self-start text-sm font-semibold text-blue" onClick={() => setEditing({ title: '', slug: '', description: '', work_ids: [], price_xof: 0, is_active: true })}>+ Créer un pack</button>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? 'Modifier le pack' : 'Nouveau pack'}>
        {editing && <BundleForm key={editing.id ?? 'new'} bundle={editing} works={works.data?.results ?? []} onDone={() => { setEditing(null); bundles.reload() }} />}
      </Drawer>
    </section>
  )
}

function BundleForm({ bundle, works, onDone }: { bundle: any; works: any[]; onDone: () => void }) {
  const ed = useEditor(bundle)
  const save = () => ed.run(async () => {
    const body = { ...ed.v, slug: ed.v.slug || ed.v.title.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') }
    if (ed.v.id) await patch(`/api/backoffice/bundles/${ed.v.id}/`, body); else await post('/api/backoffice/bundles/', body)
    onDone()
  })
  return (
    <div className="grid gap-4">
      <Field label="Titre" error={ed.fe('title')}><input className="input" value={ed.v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
      <Field label="Description"><textarea className="input" value={ed.v.description} onChange={(e) => ed.set('description', e.target.value)} /></Field>
      <Field label="Prix du pack (FCFA)" error={ed.fe('price_xof')}><input className="input" type="number" value={ed.v.price_xof} onChange={(e) => ed.set('price_xof', Number(e.target.value))} /></Field>
      <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Œuvres incluses</legend>
        {works.map((w) => (
          <label key={w.id} className="flex items-center gap-2">
            <input type="checkbox" className="accent-orange" checked={ed.v.work_ids.includes(w.id)}
              onChange={(e) => ed.set('work_ids', e.target.checked ? [...ed.v.work_ids, w.id] : ed.v.work_ids.filter((x: number) => x !== w.id))} />
            {w.title}
          </label>
        ))}
      </fieldset>
      <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={ed.v.is_active} onChange={(e) => ed.set('is_active', e.target.checked)} /> Visible en boutique</label>
      <ErrorNote error={ed.err} />
      <button className="btn btn-primary justify-self-start" onClick={save} disabled={ed.busy}>Enregistrer</button>
    </div>
  )
}

const EMPTY_WORK = {
  title: '', subtitle: '', kind: 'punchlines', cover_color: '#ec681c', summary: '', format_label: 'Livre numérique — lecture en ligne',
  price_xof: 0, price_eur: null, promo_price_xof: null, promo_ends_at: null, access_mode: 'paid', access_form_id: null,
  free_extract_count: 2, status: 'draft', release_date: null, is_featured: false, position: 0, related_ids: [],
  seo_description: '', buyers_group_link: '',
}

export function WorkEdit() {
  const { id } = useParams()
  const isNew = id === 'nouvelle'
  const { data, loading, reload } = useApi(isNew ? null : `/api/backoffice/works/${id}/`)
  const [tab, setTab] = useState('fiche')
  if (!isNew && (loading || !data)) return <Spinner />
  const work = isNew ? EMPTY_WORK : data
  return (
    <AdminPage crumb={<Link to="/admin/oeuvres">Œuvres /</Link>} title={isNew ? 'Nouvelle œuvre' : work.title}
      actions={!isNew && <a href={`/lire/${work.slug}`} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">Aperçu lecteur</a>}>
      {!isNew && <Tabs value={tab} onChange={setTab} tabs={[{ value: 'fiche', label: 'Fiche et accès' }, { value: 'contenu', label: `Contenu (${work.sections_count})` }]} />}
      {tab === 'fiche' ? <WorkForm key={work.id ?? 'new'} work={work} onSaved={reload} /> : <Sections work={work} onChanged={reload} />}
    </AdminPage>
  )
}

function WorkForm({ work, onSaved }: { work: any; onSaved: () => void }) {
  const ed = useEditor({ ...work })
  const forms = useApi('/api/backoffice/forms/?page_size=100')
  const works = useApi('/api/backoffice/works/')
  const [cover, setCover] = useState<File | null>(null)
  const nav = useNavigate()
  const toast = useToast()
  const v = ed.v
  const save = () => ed.run(async () => {
    const { cover: _c, sections_count: _s, sales_count: _a, readers_count: _r, created_at: _x, updated_at: _y, ...body } = v
    const saved = v.id ? await patch(`/api/backoffice/works/${v.id}/`, body) : await post('/api/backoffice/works/', body)
    if (cover) await api(`/api/backoffice/works/${saved.id}/`, { method: 'PATCH', body: toFormData({ cover }) })
    toast('Œuvre enregistrée.')
    if (!v.id) nav(`/admin/oeuvres/${saved.id}`, { replace: true }); else onSaved()
  }).catch(() => {})
  const num = (k: string, val: string) => ed.set(k, val === '' ? null : Number(val))
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_260px]">
      <div className="grid gap-5">
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Titre" error={ed.fe('title')}><input className="input" value={v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
          <Field label="Sous-titre"><input className="input" value={v.subtitle} onChange={(e) => ed.set('subtitle', e.target.value)} /></Field>
          <Field label="Type">
            <select className="input" value={v.kind} onChange={(e) => ed.set('kind', e.target.value)}>
              <option value="punchlines">Punchlines (séries)</option><option value="stories">Histoires</option><option value="other">Autre</option>
            </select>
          </Field>
          <Field label="Statut">
            <select className="input" value={v.status} onChange={(e) => ed.set('status', e.target.value)}>
              {STATUS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Résumé"><textarea className="input" rows={5} value={v.summary} onChange={(e) => ed.set('summary', e.target.value)} /></Field>

        <fieldset className="card grid gap-4 p-5">
          <legend className="sr-only">Mode d'accès</legend>
          <p className="font-semibold">Accès et prix</p>
          <div className="seg !bg-paper flex-wrap" role="radiogroup" aria-label="Mode d'accès">
            {ACCESS.map(([k, l]) => (
              <button type="button" key={k} role="radio" aria-checked={v.access_mode === k} aria-pressed={v.access_mode === k} onClick={() => ed.set('access_mode', k)}>{l}</button>
            ))}
          </div>
          {v.access_mode === 'free_form' && (
            <Field label="Formulaire à remplir avant la lecture" error={ed.fe('access_form_id')}>
              <select className="input" value={v.access_form_id ?? ''} onChange={(e) => ed.set('access_form_id', e.target.value ? Number(e.target.value) : null)}>
                <option value="">Choisir un formulaire…</option>
                {forms.data?.results.map((f: any) => <option key={f.id} value={f.id}>{f.title}</option>)}
              </select>
            </Field>
          )}
          <Field label="Nombre de séries / histoires en extrait gratuit"><input className="input max-w-32" type="number" min={0} value={v.free_extract_count} onChange={(e) => num('free_extract_count', e.target.value)} /></Field>
        </fieldset>

        {v.access_mode === 'paid' && (
          <fieldset className="card grid gap-4 p-5 md:grid-cols-2">
            <legend className="sr-only">Prix</legend>
            <Field label="Prix (FCFA)" error={ed.fe('price_xof')}><input className="input" type="number" value={v.price_xof} onChange={(e) => num('price_xof', e.target.value)} /></Field>
            <Field label="Prix diaspora (€, facultatif)"><input className="input" type="number" step="0.01" value={v.price_eur ?? ''} onChange={(e) => ed.set('price_eur', e.target.value || null)} /></Field>
            <Field label="Prix promotionnel (FCFA)" hint="Laisser vide s'il n'y a pas de promotion."><input className="input" type="number" value={v.promo_price_xof ?? ''} onChange={(e) => num('promo_price_xof', e.target.value)} /></Field>
            <Field label="Fin de la promotion" hint="Un compte à rebours s'affiche sur la fiche.">
              <input className="input" type="datetime-local" value={v.promo_ends_at ? v.promo_ends_at.slice(0, 16) : ''} onChange={(e) => ed.set('promo_ends_at', e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </Field>
          </fieldset>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Field label="Format affiché"><input className="input" value={v.format_label} onChange={(e) => ed.set('format_label', e.target.value)} /></Field>
          <Field label="Date de sortie"><input className="input" type="date" value={v.release_date ?? ''} onChange={(e) => ed.set('release_date', e.target.value || null)} /></Field>
          <Field label="Description pour Google (160 caractères)"><input className="input" maxLength={160} value={v.seo_description} onChange={(e) => ed.set('seo_description', e.target.value)} /></Field>
          <Field label="Lien du groupe WhatsApp des acheteurs"><input className="input" type="url" value={v.buyers_group_link} onChange={(e) => ed.set('buyers_group_link', e.target.value)} /></Field>
        </div>
        <fieldset className="grid gap-2"><legend className="mb-1 text-sm font-medium">Produits liés</legend>
          <div className="flex flex-wrap gap-3">
            {works.data?.results.filter((w: any) => w.id !== v.id).map((w: any) => (
              <label key={w.id} className="flex items-center gap-2">
                <input type="checkbox" className="accent-orange" checked={v.related_ids.includes(w.id)}
                  onChange={(e) => ed.set('related_ids', e.target.checked ? [...v.related_ids, w.id] : v.related_ids.filter((x: number) => x !== w.id))} />
                {w.title}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.is_featured} onChange={(e) => ed.set('is_featured', e.target.checked)} /> Mettre en avant sur l'accueil</label>
        <ErrorNote error={ed.err} />
        <button className="btn btn-primary justify-self-start" onClick={save} disabled={ed.busy}>{ed.busy ? 'Enregistrement…' : 'Enregistrer'}</button>
      </div>
      <aside className="grid content-start gap-4">
        <WorkCover size="md" work={{ ...v, cover: cover ? URL.createObjectURL(cover) : v.cover }} />
        <Field label="Couverture (image)"><input type="file" accept="image/*" className="input" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></Field>
        <Field label="Couleur d'accent"><input type="color" className="h-11 w-full rounded-lg" value={v.cover_color} onChange={(e) => ed.set('cover_color', e.target.value)} /></Field>
      </aside>
    </div>
  )
}

function Sections({ work, onChanged }: { work: any; onChanged: () => void }) {
  const { data, loading, reload } = useApi<any[]>(`/api/backoffice/sections/?work=${work.id}`)
  const [editing, setEditing] = useState<any>(null)
  const [importing, setImporting] = useState(false)
  const [dropped, setDropped] = useState<File | null>(null)
  const [over, setOver] = useState(false)
  const unit = work.kind === 'punchlines' ? 'Série' : 'Histoire'
  const next = (data?.reduce((m, s) => Math.max(m, s.number), 0) ?? 0) + 1
  const open = async (s: any) => setEditing(s.id ? await api(`/api/backoffice/sections/${s.id}/`) : s)
  return (
    <div className="grid gap-4">
      <label onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); const f = e.dataTransfer.files[0]; if (f) { setDropped(f); setImporting(true) } }}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${over ? 'border-blue bg-blue-tint' : 'border-[#C9D2E0] bg-[var(--card)]'}`}>
        <Icon name="cloud-upload-alt" className="text-3xl text-blue" />
        <span className="font-semibold">Glissez un fichier structuré <span className="text-muted">.docx, .xlsx, .md ou .txt</span></span>
        <span className="text-[13px] text-muted">Découpage automatique par {unit.toLowerCase()} · aperçu avant l'import</span>
        <input type="file" accept=".docx,.xlsx,.txt,.md" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; if (f) { setDropped(f); setImporting(true) } }} />
      </label>
      <div><button className="text-sm font-semibold text-blue" onClick={() => open({ work: work.id, number: next, title: '', preview: '' })}>+ Ajouter une {unit.toLowerCase()} à la main</button></div>
      <p className="text-sm text-muted">Le texte est chiffré sur le serveur et n'est jamais envoyé tel quel aux lecteurs : il est affiché en images filigranées. Corriger un texte crée une nouvelle édition, sans que les acheteurs perdent leur progression.</p>
      <TableWrap loading={loading} empty={!data?.length}>
        <table className="table">
          <thead><tr><th>N°</th><th>Titre</th><th>Début du texte</th><th>Mots</th><th>Éd.</th><th /></tr></thead>
          <tbody>
            {data?.map((s) => (
              <tr key={s.id}>
                <td className="tabular-nums">{s.number}{s.number <= work.free_extract_count && <span className="chip chip-ok ml-2">Extrait</span>}</td>
                <td>{s.title || `${unit} ${s.number}`}</td>
                <td className="max-w-md truncate text-muted">{s.preview}</td>
                <td className="tabular-nums">{s.word_count}</td>
                <td className="tabular-nums">{s.edition}</td>
                <td className="whitespace-nowrap text-right">
                  <button className="link text-sm" onClick={() => open(s)}>Modifier</button>{' '}
                  <Confirm text="Supprimer ?" danger onConfirm={async () => { await del(`/api/backoffice/sections/${s.id}/`); reload(); onChanged() }}>
                    <button className="ml-3 text-sm text-danger">Supprimer</button>
                  </Confirm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `${unit} ${editing.number}` : `Nouvelle ${unit.toLowerCase()}`} wide>
        {editing && <SectionForm key={editing.id ?? 'new'} section={editing} onDone={() => { setEditing(null); reload(); onChanged() }} />}
      </Drawer>
      <Drawer open={importing} onClose={() => setImporting(false)} title="Import en masse" wide>
        <Importer key={dropped?.name ?? 'none'} work={work} initialFile={dropped} onDone={() => { setImporting(false); setDropped(null); reload(); onChanged() }} />
      </Drawer>
    </div>
  )
}

function SectionForm({ section, onDone }: { section: any; onDone: () => void }) {
  const ed = useEditor({ work: section.work, number: section.number, title: section.title, content: section.preview ?? '' })
  const save = () => ed.run(async () => {
    if (section.id) await patch(`/api/backoffice/sections/${section.id}/`, ed.v); else await post('/api/backoffice/sections/', ed.v)
    onDone()
  }).catch(() => {})
  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-[120px_1fr] gap-3">
        <Field label="Numéro" error={ed.fe('number') || ed.fe('non_field_errors')}><input className="input" type="number" value={ed.v.number} onChange={(e) => ed.set('number', Number(e.target.value))} /></Field>
        <Field label="Titre (facultatif)"><input className="input" value={ed.v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
      </div>
      <Field label="Texte" hint="Un paragraphe par bloc séparé d'une ligne vide. « # Titre » pour un intertitre, « > texte » pour une punchline mise en avant.">
        <textarea className="input font-serif text-base" rows={22} value={ed.v.content} onChange={(e) => ed.set('content', e.target.value)} />
      </Field>
      <ErrorNote error={ed.err} />
      <button className="btn btn-primary justify-self-start" onClick={save} disabled={ed.busy}>Enregistrer</button>
    </div>
  )
}

function Importer({ work, onDone, initialFile }: { work: any; onDone: () => void; initialFile?: File | null }) {
  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [preview, setPreview] = useState<any>(null)
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const send = async (dry: boolean) => {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      if (dry) fd.append('dry_run', '1')
      const r = await post(`/api/backoffice/works/${work.id}/import_sections/`, fd)
      if (dry) setPreview(r); else onDone()
    } catch (e) { setError(e) } finally { setBusy(false) }
  }
  return (
    <div className="grid gap-4">
      <p>Le fichier est découpé automatiquement à chaque intertitre « Série 1 », « Série 2 : Titre », « Histoire 3 — Titre »… Dans Excel : une ligne par section, colonnes numéro, titre, texte.</p>
      {file && <p className="rounded-lg bg-paper px-4 py-3 text-sm"><Icon name="document" className="mr-2 text-blue" />{file.name}</p>}
      <input type="file" accept=".docx,.xlsx,.txt,.md" className="input" aria-label="Choisir un autre fichier" onChange={(e) => { setFile(e.target.files?.[0] ?? null); setPreview(null) }} />
      <ErrorNote error={error} />
      {!preview ? (
        <button className="btn btn-dark justify-self-start" disabled={!file || busy} onClick={() => send(true)}>Prévisualiser le découpage</button>
      ) : (
        <>
          <p className="font-semibold">{preview.count} section(s) détectée(s). Les sections existantes portant le même numéro seront remplacées.</p>
          <ol className="max-h-96 overflow-y-auto rounded-xl border border-line">
            {preview.sections.map((s: any) => (
              <li key={s.number} className="border-b border-line px-4 py-2 text-sm"><strong>{s.number}. {s.title}</strong><br /><span className="text-muted">{s.content}…</span></li>
            ))}
          </ol>
          <button className="btn btn-primary justify-self-start" disabled={busy} onClick={() => send(false)}>Importer {preview.count} section(s)</button>
        </>
      )}
    </div>
  )
}
