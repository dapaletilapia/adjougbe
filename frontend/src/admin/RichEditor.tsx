import { useEffect, useRef } from 'react'
import { post } from '../lib/api'

/** Éditeur riche léger : le HTML produit est nettoyé côté serveur (liste blanche de balises). */
export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) ref.current.innerHTML = value
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, arg)
    onChange(ref.current?.innerHTML ?? '')
  }
  const addImage = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await post('/api/backoffice/media/', fd)
    exec('insertImage', r.url)
  }
  const tools: [string, string, () => void][] = [
    ['Gras', 'B', () => exec('bold')],
    ['Italique', 'I', () => exec('italic')],
    ['Intertitre', 'H2', () => exec('formatBlock', 'h2')],
    ['Sous-titre', 'H3', () => exec('formatBlock', 'h3')],
    ['Paragraphe', '¶', () => exec('formatBlock', 'p')],
    ['Citation', '❝', () => exec('formatBlock', 'blockquote')],
    ['Liste', '•', () => exec('insertUnorderedList')],
    ['Liste numérotée', '1.', () => exec('insertOrderedList')],
    ['Lien', '🔗', () => { const u = prompt('Adresse du lien'); if (u) exec('createLink', u) }],
  ]
  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-line bg-mist/50 p-2" role="toolbar" aria-label="Mise en forme">
        {tools.map(([label, icon, fn]) => (
          <button key={label} type="button" title={label} aria-label={label} onMouseDown={(e) => { e.preventDefault(); fn() }}
            className="min-w-9 rounded-md px-2 py-1 text-sm font-semibold hover:bg-white">{icon}</button>
        ))}
        <label className="cursor-pointer rounded-md px-2 py-1 text-sm font-semibold hover:bg-white" title="Image">
          Image<input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && addImage(e.target.files[0])} />
        </label>
      </div>
      <div ref={ref} contentEditable suppressContentEditableWarning role="textbox" aria-multiline="true" aria-label="Contenu de l'article"
        className="prose-adj min-h-[360px] max-w-none p-5 outline-none" onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)} />
    </div>
  )
}
