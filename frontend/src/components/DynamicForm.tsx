import { useMemo, useState, type FormEvent } from 'react'
import { ApiError, post } from '../lib/api'
import { ErrorNote } from './ui'

export type FormField = {
  key: string; label: string; type: string; required: boolean; options: string[]
  help_text: string; placeholder: string; condition: { field: string; equals: string } | null
}
export type PublicForm = {
  slug: string; title: string; description: string; consent_text: string; newsletter_optin: boolean
  success_message: string; fields: FormField[]
}

/** Rend un formulaire créé dans le back-office (champs, logique conditionnelle, consentement). */
export function DynamicForm({ form, query = '', submitLabel = 'Envoyer', onDone }: {
  form: PublicForm; query?: string; submitLabel?: string; onDone?: (r: any) => void
}) {
  const [values, setValues] = useState<Record<string, any>>({})
  const [files, setFiles] = useState<Record<string, File>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState('')
  const hasFile = form.fields.some((f) => f.type === 'file')

  const visible = useMemo(() => form.fields.filter((f) => {
    if (!f.condition?.field) return true
    const v = values[f.condition.field]
    return Array.isArray(v) ? v.includes(f.condition.equals) : String(v ?? '') === String(f.condition.equals)
  }), [form.fields, values])

  const set = (k: string, v: any) => setValues((s) => ({ ...s, [k]: v }))

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErrors({}); setError(null)
    try {
      let body: any = { ...values }
      if (hasFile) {
        const fd = new FormData()
        Object.entries(values).forEach(([k, v]) => (Array.isArray(v) ? v.forEach((x) => fd.append(k, x)) : fd.append(k, String(v))))
        Object.entries(files).forEach(([k, f]) => fd.append(k, f))
        body = fd
      }
      const r = await post(`/api/forms/${form.slug}/submit/${query}`, body)
      setDone(r.message)
      onDone?.(r)
    } catch (err) {
      if (err instanceof ApiError) {
        const fields = (err.data.fields || {}) as Record<string, string>
        setErrors({ ...fields, _consent: (err.data._consent as string) || '' })
        if (!Object.keys(fields).length && !err.data._consent) setError(err)
      } else setError(err)
    } finally {
      setBusy(false)
    }
  }

  if (done) return <p className="rounded-xl bg-ok/10 px-5 py-4 font-medium text-ok" role="status">{done}</p>

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      {/* Champ piège anti-robot : masqué aux humains et aux lecteurs d'écran. */}
      <input type="text" name="_website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 opacity-0"
        value={values._website ?? ''} onChange={(e) => set('_website', e.target.value)} />
      {visible.map((f) => (
        <div key={f.key} className="field">
          <span id={`l-${f.key}`}>{f.label}{f.required && <span className="text-orange"> *</span>}</span>
          <FieldInput field={f} value={values[f.key]} onChange={(v) => set(f.key, v)} onFile={(file) => setFiles((s) => ({ ...s, [f.key]: file }))} />
          {f.help_text && <small>{f.help_text}</small>}
          {errors[f.key] && <span className="err">{errors[f.key]}</span>}
        </div>
      ))}
      <label className="flex items-start gap-3 rounded-[10px] bg-paper p-3.5 text-[13px] leading-relaxed">
        <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] accent-blue" checked={!!values._consent} onChange={(e) => set('_consent', e.target.checked)} />
        <span>{form.consent_text} <a href="/confidentialite" className="link" target="_blank">Politique de confidentialité</a></span>
      </label>
      {errors._consent && <span className="err -mt-3">{errors._consent}</span>}
      {form.newsletter_optin && (
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-orange" checked={!!values._newsletter} onChange={(e) => set('_newsletter', e.target.checked)} />
          <span>Recevoir la punchline du jour et les nouveautés par e-mail.</span>
        </label>
      )}
      <ErrorNote error={error} />
      <button className="btn btn-primary !py-4 shadow-orange" disabled={busy}>{busy ? 'Envoi…' : submitLabel}</button>
    </form>
  )
}

function FieldInput({ field: f, value, onChange, onFile }: { field: FormField; value: any; onChange: (v: any) => void; onFile: (f: File) => void }) {
  const common = { 'aria-labelledby': `l-${f.key}`, required: f.required, placeholder: f.placeholder || undefined }
  switch (f.type) {
    case 'textarea':
      return <textarea className="input" {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    case 'select':
      if (f.options.length <= 5 && f.options.every((o) => o.length <= 22))
        return (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={`l-${f.key}`}>
            {f.options.map((o) => (
              <button type="button" role="radio" aria-checked={value === o} key={o} onClick={() => onChange(o)}
                className={`rounded-full px-3.5 py-2 text-[13px] ${value === o ? 'bg-blue text-white' : 'bg-[#F2F3F5]'}`}>{o}</button>
            ))}
          </div>
        )
      return (
        <select className="input" {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Choisir…</option>
          {f.options.map((o) => <option key={o}>{o}</option>)}
        </select>
      )
    case 'multi':
      return (
        <div className="flex flex-wrap gap-2" role="group" aria-labelledby={`l-${f.key}`}>
          {f.options.map((o) => {
            const on = (value ?? []).includes(o)
            return (
              <button type="button" key={o} aria-pressed={on} onClick={() => onChange(on ? value.filter((x: string) => x !== o) : [...(value ?? []), o])}
                className={`rounded-full px-3.5 py-2 text-[13px] ${on ? 'bg-blue text-white' : 'bg-[#F2F3F5]'}`}>
                {on && '✓ '}{o}
              </button>
            )
          })}
        </div>
      )
    case 'checkbox':
      return <input type="checkbox" className="h-5 w-5 accent-orange" checked={!!value} onChange={(e) => onChange(e.target.checked)} aria-labelledby={`l-${f.key}`} />
    case 'rating':
      return (
        <div className="flex gap-1" role="radiogroup" aria-labelledby={`l-${f.key}`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button type="button" key={n} role="radio" aria-checked={value === n} aria-label={`${n} sur 5`} onClick={() => onChange(n)}
              className={`text-2xl ${n <= (value ?? 0) ? 'text-orange' : 'text-line'}`}>★</button>
          ))}
        </div>
      )
    case 'file':
      return <input type="file" className="input" aria-labelledby={`l-${f.key}`} accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
    default: {
      const t = { email: 'email', phone: 'tel', date: 'date', number: 'number' }[f.type] ?? 'text'
      return <input type={t} className="input" {...common} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />
    }
  }
}
