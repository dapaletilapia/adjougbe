import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ErrorNote, Field, Icon, initials, Spinner } from '../components/ui'
import { api, del, patch, post } from '../lib/api'
import { dateTime } from '../lib/format'
import { useApi } from '../lib/hooks'
import { useToast } from '../lib/toast'
import { AdminPage, Confirm, FilterSelect, ListToolbar, Pager, Pills, StatusChip, TableWrap, Tabs, toFormData, useEditor, useList } from './kit'
import { RichEditor } from './RichEditor'

const KINDS: [string, string][] = [['punchline', 'Punchline du jour'], ['papo', 'Papo de Tiékar'], ['article', 'Article'], ['media', 'Vidéo / audio'], ['event', 'Annonce / événement']]

function postState(p: any) {
  if (p.status === 'draft') return { status: 'draft', label: 'Brouillon' }
  if (!p.is_live) return { status: 'upcoming', label: `Programmé ${dateTime(p.published_at)}` }
  return { status: 'published', label: 'Publié' }
}

export function BlogList() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('onglet') ?? 'articles'
  const setTab = (v: string) => { const p = new URLSearchParams(); if (v !== 'articles') p.set('onglet', v); setParams(p, { replace: true }) }
  return (
    <AdminPage title="Blog" search actions={<Link to="/admin/blog/nouveau" className="btn btn-primary !min-h-[42px]">+ Nouvel article</Link>}>
      <Tabs value={tab === 'moderation' ? 'articles' : tab} onChange={setTab} tabs={[
        { value: 'articles', label: 'Articles et modération' }, { value: 'calendar', label: 'Calendrier éditorial' },
        { value: 'reviews', label: 'Avis sur les livres' }, { value: 'categories', label: 'Catégories' },
      ]} />
      {(tab === 'articles' || tab === 'moderation') && (
        <div className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <PostTable />
          <CommentQueue />
        </div>
      )}
      {tab === 'calendar' && <Calendar />}
      {tab === 'reviews' && <ReviewsModeration />}
      {tab === 'categories' && <Categories />}
    </AdminPage>
  )
}

function PostTable() {
  const list = useList('/api/backoffice/posts/')
  const counts = useApi<Record<string, number>>('/api/backoffice/posts/counts/')
  const c = counts.data ?? {}
  const state = list.params.get('state') ?? ''
  return (
    <section className="grid content-start gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Pills value={state} onChange={(v) => list.setParam('state', v)} options={[
          ['', `Tous · ${c.all ?? 0}`], ['live', 'Publiés'], ['scheduled', `Programmés · ${c.scheduled ?? 0}`], ['draft', `Brouillons · ${c.draft ?? 0}`],
        ]} />
        <FilterSelect list={list} name="kind" label="Toutes les rubriques" options={KINDS} />
      </div>
      {list.loading ? <Spinner /> : !list.data?.results.length ? <p className="card p-8 text-muted">Aucune publication.</p> : (
        <ul className="grid gap-2.5">
          {list.data.results.map((p: any) => {
            const st = postState(p)
            return (
              <li key={p.id}>
                <Link to={`/admin/blog/${p.id}`} className="card flex items-center gap-4 p-3.5 hover:ring-2 hover:ring-blue-tint">
                  {p.cover ? <img src={p.cover} alt="" className="h-14 w-20 shrink-0 rounded-lg object-cover" />
                    : <span className="grid h-14 w-20 shrink-0 place-items-center rounded-lg text-xl text-white" style={{ background: 'var(--grad-navy)' }}>{p.kind === 'punchline' ? '«' : <Icon name="document" />}</span>}
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-sm">{p.kind === 'punchline' ? `« ${p.quote} »` : p.title}</b>
                    <span className="text-xs text-muted">
                      {p.category?.name ?? KINDS.find((k) => k[0] === p.kind)?.[1]} · {st.status === 'upcoming' ? dateTime(p.published_at) : `${p.view_count} vues`}
                      {p.pending_comments > 0 && <> · <span className="text-orange">{p.pending_comments} à modérer</span></>}
                    </span>
                  </span>
                  <StatusChip status={st.status} label={st.status === 'upcoming' ? 'Programmé' : st.label} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
      <Pager list={list} />
    </section>
  )
}

const SPAM = /(gagne[rz]?|cliquez|bitcoin|crypto|whatsapp\s*\+|https?:\/\/|000\s?000)/i

/** File de modération des commentaires (colonne de droite de la maquette 15g). */
function CommentQueue() {
  const { data, reload } = useApi('/api/backoffice/comments/?status=pending&page_size=50')
  const [reply, setReply] = useState<Record<number, string>>({})
  const toast = useToast()
  const set = async (id: number, status: string) => { await patch(`/api/backoffice/comments/${id}/`, { status }); reload() }
  const items = data?.results ?? []
  return (
    <section className="card h-max p-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-[15px] font-semibold">Commentaires à modérer</h2>
        <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-orange px-1.5 text-xs font-bold text-white">{items.length}</span>
      </div>
      {items.length === 0 && <p className="text-sm text-muted">Tout est à jour.</p>}
      <ul className="grid gap-3">
        {items.map((c: any) => {
          const spam = SPAM.test(c.body)
          return (
            <li key={c.id} className={`rounded-xl p-3.5 text-[13px] ${spam ? 'bg-[#FFF4EF]' : 'bg-paper'}`}>
              <div className="flex gap-2.5">
                <span className="avatar h-8 w-8 text-[11px]">{initials(c.author)}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted"><b className="text-ink">{c.author}</b> · sur « {c.post_title} »</p>
                  <p className="mt-1 leading-relaxed">{c.body}</p>
                  {spam && <span className="chip chip-danger mt-1.5">Spam probable</span>}
                  <div className="mt-2.5 flex gap-1.5">
                    <button className="flex-1 rounded-lg bg-ok py-2 font-semibold text-white" onClick={() => set(c.id, 'approved')}>Valider</button>
                    <button className="flex-1 rounded-lg border border-line bg-[var(--card)] py-2" onClick={() => set(c.id, 'rejected')}>Refuser</button>
                  </div>
                  <div className="mt-2 flex gap-1.5">
                    <input className="input !min-h-9 !bg-[var(--card)] text-xs" placeholder="Répondre en tant qu'auteur…" value={reply[c.id] ?? ''} onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })} />
                    <button className="btn btn-blue btn-sm" disabled={!reply[c.id]} onClick={async () => {
                      await post(`/api/backoffice/comments/${c.id}/reply/`, { body: reply[c.id] }); setReply({ ...reply, [c.id]: '' }); reload(); toast('Réponse publiée.')
                    }}>Répondre</button>
                  </div>
                </div>
              </div>
            </li>
          )
        })}
      </ul>
      <Link to="/admin/moderation" className="mt-3 block text-[13px] font-semibold text-blue">Historique de modération</Link>
    </section>
  )
}

/** Vue mensuelle des publications ; glisser-déposer une publication sur un autre jour la reprogramme. */
function Calendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); d.setDate(1); return d })
  const from = new Date(month.getFullYear(), month.getMonth(), 1)
  const to = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const { data, reload } = useApi(`/api/backoffice/posts/?from=${iso(from)}&to=${iso(to)}&page_size=200&ordering=published_at`)
  const toast = useToast()
  const days = useMemo(() => {
    const out: (Date | null)[] = Array((from.getDay() + 6) % 7).fill(null)
    for (let i = 1; i <= to.getDate(); i++) out.push(new Date(month.getFullYear(), month.getMonth(), i))
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])
  const move = async (id: string, day: Date) => {
    const p = data?.results.find((x: any) => String(x.id) === id)
    if (!p) return
    const old = new Date(p.published_at)
    const nd = new Date(day.getFullYear(), day.getMonth(), day.getDate(), old.getHours(), old.getMinutes())
    await patch(`/api/backoffice/posts/${id}/`, { published_at: nd.toISOString() })
    toast('Publication reprogrammée.')
    reload()
  }
  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
        <h2 className="min-w-48 text-center text-lg capitalize">{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</h2>
        <button className="btn btn-ghost btn-sm" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-xs text-muted">{['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => <span key={d} className="px-2">{d}</span>)}</div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className={`min-h-28 rounded-lg p-1.5 ${d ? 'border border-line bg-[var(--card)]' : ''}`}
            onDragOver={(e) => d && e.preventDefault()} onDrop={(e) => d && move(e.dataTransfer.getData('text/plain'), d)}>
            {d && <span className="text-xs text-muted">{d.getDate()}</span>}
            {d && data?.results.filter((p: any) => new Date(p.published_at).toDateString() === d.toDateString()).map((p: any) => (
              <Link key={p.id} to={`/admin/blog/${p.id}`} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(p.id))}
                className={`mt-1 block truncate rounded px-1.5 py-1 text-[.72rem] ${p.kind === 'punchline' ? 'bg-blue text-white' : p.status === 'draft' ? 'bg-mist' : 'bg-orange/15'}`}>
                {p.kind === 'punchline' ? p.quote : p.title}
              </Link>
            ))}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted">Glissez une publication sur un autre jour pour la reprogrammer.</p>
    </div>
  )
}

function Categories() {
  const { data, reload } = useApi<any[]>('/api/backoffice/categories/')
  const [name, setName] = useState('')
  return (
    <div className="grid max-w-lg gap-3">
      <div className="flex gap-2">
        <input className="input" placeholder="Nouvelle catégorie" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn btn-dark" disabled={!name} onClick={async () => {
          await post('/api/backoffice/categories/', { name, slug: name.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') })
          setName(''); reload()
        }}>Ajouter</button>
      </div>
      <ul className="divide-y divide-line">
        {data?.map((c) => (
          <li key={c.id} className="flex items-center py-2"><span className="flex-1">{c.name}</span>
            <Confirm text="Supprimer ?" danger onConfirm={async () => { await del(`/api/backoffice/categories/${c.id}/`); reload() }}><button className="text-sm text-danger">Supprimer</button></Confirm>
          </li>
        ))}
      </ul>
    </div>
  )
}

const local = (iso: string) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

export function PostEdit() {
  const { id } = useParams()
  const isNew = id === 'nouveau'
  const { data, loading } = useApi(isNew ? null : `/api/backoffice/posts/${id}/`)
  if (!isNew && (loading || !data)) return <Spinner />
  const p = isNew ? { title: '', kind: 'punchline', excerpt: '', body: '', quote: '', media_url: '', category: null, tags: [], status: 'draft', published_at: new Date().toISOString(), members_only: false, allow_comments: true, seo_description: '' } : data
  return <PostForm key={p.id ?? 'new'} post={p} />
}

function PostForm({ post: p }: { post: any }) {
  const ed = useEditor({ ...p, category_id: p.category?.id ?? null, tag_names: p.tags.map((t: any) => t.name).join(', ') })
  const cats = useApi<any[]>('/api/backoffice/categories/')
  const [cover, setCover] = useState<File | null>(null)
  const nav = useNavigate()
  const toast = useToast()
  const v = ed.v
  const save = (status?: string) => ed.run(async () => {
    const body: any = {
      title: v.kind === 'punchline' && !v.title ? `Punchline du ${new Date(v.published_at).toLocaleDateString('fr-FR')}` : v.title,
      kind: v.kind, excerpt: v.excerpt || (v.kind === 'punchline' ? v.quote.slice(0, 300) : ''), body: v.body, quote: v.quote,
      media_url: v.media_url, category_id: v.category_id, status: status ?? v.status, published_at: v.published_at,
      members_only: v.members_only, allow_comments: v.allow_comments, seo_description: v.seo_description,
      tag_names: v.tag_names.split(',').map((t: string) => t.trim()).filter(Boolean),
    }
    const saved = v.id ? await patch(`/api/backoffice/posts/${v.id}/`, body) : await post('/api/backoffice/posts/', body)
    if (cover) await api(`/api/backoffice/posts/${saved.id}/`, { method: 'PATCH', body: toFormData({ cover }) })
    toast(body.status === 'draft' ? 'Brouillon enregistré.' : new Date(body.published_at) > new Date() ? 'Publication programmée.' : 'Publié.')
    if (!v.id) nav(`/admin/blog/${saved.id}`, { replace: true }); else ed.setV({ ...v, ...saved, category_id: saved.category?.id ?? null, tag_names: saved.tags.map((t: any) => t.name).join(', ') })
  }).catch(() => {})
  const future = new Date(v.published_at) > new Date()
  return (
    <AdminPage crumb={<Link to="/admin/blog">Blog /</Link>} title={v.id ? 'Modifier la publication' : 'Nouvelle publication'}
      intro={v.id && v.is_live && <Link to={`/blog/${v.slug}`} target="_blank" className="link">Voir en ligne</Link>}
      actions={<>
        {v.id && <Confirm text="Supprimer ?" danger onConfirm={async () => { await del(`/api/backoffice/posts/${v.id}/`); nav('/admin/blog') }}><button className="btn btn-ghost btn-sm text-danger">Supprimer</button></Confirm>}
        <button className="btn btn-ghost btn-sm" onClick={() => save('draft')} disabled={ed.busy}>Enregistrer le brouillon</button>
        <button className="btn btn-primary btn-sm" onClick={() => save('published')} disabled={ed.busy}>{future ? 'Programmer' : 'Publier'}</button>
      </>}>
      <div className="grid gap-8 lg:grid-cols-[1fr_300px]">
        <div className="grid content-start gap-5">
          <Field label="Rubrique">
            <select className="input" value={v.kind} onChange={(e) => ed.set('kind', e.target.value)}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
          {v.kind === 'punchline' ? (
            <Field label="La punchline" error={ed.fe('quote')}>
              <textarea className="input font-serif text-xl" rows={4} value={v.quote} onChange={(e) => ed.set('quote', e.target.value)} />
            </Field>
          ) : (
            <>
              <Field label="Titre" error={ed.fe('title')}><input className="input text-lg" value={v.title} onChange={(e) => ed.set('title', e.target.value)} /></Field>
              <Field label="Chapeau (affiché dans les listes)"><textarea className="input" rows={2} maxLength={300} value={v.excerpt} onChange={(e) => ed.set('excerpt', e.target.value)} /></Field>
              {v.kind === 'media' && <Field label="Lien de la vidéo ou du fichier audio"><input className="input" type="url" value={v.media_url} onChange={(e) => ed.set('media_url', e.target.value)} /></Field>}
              <RichEditor value={v.body} onChange={(html) => ed.set('body', html)} />
            </>
          )}
          <ErrorNote error={ed.err} />
        </div>
        <aside className="grid content-start gap-4">
          <Field label="Date de publication" hint="Une date future programme la publication.">
            <input className="input" type="datetime-local" value={local(v.published_at)} onChange={(e) => e.target.value && ed.set('published_at', new Date(e.target.value).toISOString())} />
          </Field>
          <Field label="Catégorie">
            <select className="input" value={v.category_id ?? ''} onChange={(e) => ed.set('category_id', e.target.value ? Number(e.target.value) : null)}>
              <option value="">Aucune</option>{cats.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Étiquettes" hint="Séparées par des virgules."><input className="input" value={v.tag_names} onChange={(e) => ed.set('tag_names', e.target.value)} /></Field>
          {v.kind !== 'punchline' && <Field label="Image de couverture"><input type="file" accept="image/*" className="input" onChange={(e) => setCover(e.target.files?.[0] ?? null)} /></Field>}
          {v.cover && !cover && <img src={v.cover} alt="" className="rounded-lg" />}
          <label className="flex items-center gap-2"><input type="checkbox" className="accent-orange" checked={v.members_only} onChange={(e) => ed.set('members_only', e.target.checked)} /> Réservé aux membres</label>
          <Field label="Description pour Google"><input className="input" maxLength={160} value={v.seo_description} onChange={(e) => ed.set('seo_description', e.target.value)} /></Field>
          <div className="card p-4">
            <p className="mb-2 text-sm font-semibold">Aperçu partage WhatsApp</p>
            <div className="overflow-hidden rounded-xl bg-[#DCF8C6] p-1.5">
              <div className="overflow-hidden rounded-lg bg-white">
                {(cover || v.cover) && <img src={cover ? URL.createObjectURL(cover) : v.cover} alt="" className="h-24 w-full object-cover" />}
                {v.kind === 'punchline' && !v.cover && <div className="p-3 text-xs text-white" style={{ background: 'var(--grad-navy)' }}>« {v.quote.slice(0, 90)} »</div>}
                <div className="p-2.5 text-xs"><b className="line-clamp-2 block text-ink">{v.kind === 'punchline' ? 'Punchline du jour — Adjougbe' : v.title || 'Titre de l\u2019article'}</b><span className="text-muted">{window.location.host}</span></div>
              </div>
            </div>
          </div>
          <div className="text-sm"><span className="text-muted">Adresse (SEO)</span><div className="mt-1 truncate rounded-lg bg-paper px-3 py-2">/blog/{v.slug || '…'}</div></div>
          <label className="flex items-center justify-between rounded-lg bg-paper px-3 py-2.5 text-sm">
            Commentaires activés
            <button type="button" role="switch" aria-checked={v.allow_comments} className="toggle" onClick={() => ed.set('allow_comments', !v.allow_comments)} aria-label="Commentaires activés" />
          </label>
          {v.id && v.kind === 'punchline' && (
            <div className="grid gap-2">
              <p className="text-sm font-medium">Visuel de partage</p>
              <img src={`/api/blog/posts/${v.slug}/card.png`} alt="Visuel de la punchline" className="rounded-lg" />
              <a href={`/api/blog/posts/${v.slug}/card.png?format=story&download=1`} className="link text-sm">Format story (TikTok, Instagram)</a>
            </div>
          )}
        </aside>
      </div>
    </AdminPage>
  )
}

export function Moderation() {
  const [tab, setTab] = useState('comments')
  return (
    <AdminPage crumb={<Link to="/admin/blog">Blog /</Link>} title="Historique de modération">
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'comments', label: 'Commentaires du blog' }, { value: 'reviews', label: 'Avis sur les livres' }]} />
      {tab === 'comments' ? <CommentsModeration /> : <ReviewsModeration />}
    </AdminPage>
  )
}

function CommentsModeration() {
  const list = useList('/api/backoffice/comments/', {})
  const [sel, setSel] = useState<number[]>([])
  const [reply, setReply] = useState<Record<number, string>>({})
  const toast = useToast()
  const bulk = async (status: string) => { await post('/api/backoffice/comments/bulk/', { ids: sel, status }); setSel([]); list.reload(); toast('Commentaires mis à jour.') }
  const labels: Record<string, string> = { pending: 'En attente', approved: 'Publié', rejected: 'Refusé' }
  return (
    <>
      <ListToolbar list={list}>
        <FilterSelect list={list} name="status" label="Tous" options={[['pending', 'En attente'], ['approved', 'Publiés'], ['rejected', 'Refusés']]} />
        {sel.length > 0 && <>
          <button className="btn btn-dark btn-sm" onClick={() => bulk('approved')}>Publier ({sel.length})</button>
          <button className="btn btn-ghost btn-sm" onClick={() => bulk('rejected')}>Refuser ({sel.length})</button>
        </>}
      </ListToolbar>
      <TableWrap loading={list.loading} empty={!list.data?.results.length}>
        <ul className="divide-y divide-line">
          {list.data?.results.map((c: any) => (
            <li key={c.id} className="grid gap-2 p-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <input type="checkbox" className="accent-orange" aria-label="Sélectionner" checked={sel.includes(c.id)} onChange={(e) => setSel(e.target.checked ? [...sel, c.id] : sel.filter((x) => x !== c.id))} />
                <strong>{c.author}</strong><span className="text-muted">{c.author_email}</span>
                <span className="text-muted">sur <Link to={`/blog/${c.post_slug}`} target="_blank" className="link">{c.post_title}</Link> · {dateTime(c.created_at)}</span>
                <StatusChip status={c.status} label={labels[c.status]} />
              </div>
              <p className="whitespace-pre-line">{c.body}</p>
              <div className="flex flex-wrap items-center gap-2">
                {c.status !== 'approved' && <button className="btn btn-dark btn-sm" onClick={async () => { await patch(`/api/backoffice/comments/${c.id}/`, { status: 'approved' }); list.reload() }}>Publier</button>}
                {c.status !== 'rejected' && <button className="btn btn-ghost btn-sm" onClick={async () => { await patch(`/api/backoffice/comments/${c.id}/`, { status: 'rejected' }); list.reload() }}>Refuser</button>}
                {!c.is_author_reply && (
                  <span className="flex min-w-64 flex-1 gap-2">
                    <input className="input !min-h-9" placeholder="Répondre en tant qu'auteur…" value={reply[c.id] ?? ''} onChange={(e) => setReply({ ...reply, [c.id]: e.target.value })} />
                    <button className="btn btn-blue btn-sm" disabled={!reply[c.id]} onClick={async () => { await post(`/api/backoffice/comments/${c.id}/reply/`, { body: reply[c.id] }); setReply({ ...reply, [c.id]: '' }); list.reload(); toast('Réponse publiée.') }}>Répondre</button>
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </TableWrap>
      <Pager list={list} />
    </>
  )
}

function ReviewsModeration() {
  const list = useList('/api/backoffice/reviews/')
  const labels: Record<string, string> = { pending: 'En attente', approved: 'Publié', rejected: 'Refusé' }
  const set = async (id: number, status: string) => { await patch(`/api/backoffice/reviews/${id}/`, { status }); list.reload() }
  return (
    <>
      <ListToolbar list={list}><FilterSelect list={list} name="status" label="Tous" options={[['pending', 'En attente'], ['approved', 'Publiés'], ['rejected', 'Refusés']]} /></ListToolbar>
      <TableWrap loading={list.loading} empty={!list.data?.results.length}>
        <table className="table">
          <tbody>
            {list.data?.results.map((r: any) => (
              <tr key={r.id}>
                <td><strong>{r.author}</strong><br /><span className="text-xs text-muted">{r.work_title} · {dateTime(r.created_at)}</span></td>
                <td className="text-orange">{'★'.repeat(r.rating)}</td>
                <td className="max-w-md">{r.body}</td>
                <td><StatusChip status={r.status} label={labels[r.status]} /></td>
                <td className="whitespace-nowrap text-right">
                  {r.status !== 'approved' && <button className="link text-sm" onClick={() => set(r.id, 'approved')}>Publier</button>}
                  {r.status !== 'rejected' && <button className="ml-3 text-sm text-danger" onClick={() => set(r.id, 'rejected')}>Refuser</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </>
  )
}
