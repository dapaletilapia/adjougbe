import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorNote, Field, Icon, WorkCover } from '../components/ui'
import { ApiError, post } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi, useTitle } from '../lib/hooks'

/** Fond dégradé + motif du logo (maquettes 12a, 12b). */
function GradientBg({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`relative overflow-hidden ${className}`}
      style={{ background: 'radial-gradient(600px 460px at 55% 40%,#3FA2FF 0%,rgba(31,120,240,.55) 38%,transparent 72%),linear-gradient(125deg,#041C5C 0%,#0A3A9E 38%,#1560DC 70%,#2A86F2 100%)' }}>
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px' }} />
      {/* Fondu vers le pied de page sombre : aucune rupture de couleur en bas de page. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: 'linear-gradient(180deg,transparent,#0E0F13)' }} />
      {children}
    </div>
  )
}

/** Carte centrée sur fond dégradé (connexion, mot de passe…). */
function Shell({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <GradientBg className="grid min-h-[calc(100vh-120px)] place-items-center px-4 py-14">
      <div className="relative flex w-full max-w-[440px] flex-col gap-4 rounded-[20px] bg-[var(--card)] p-8 shadow-[0_50px_90px_-30px_rgba(4,28,92,.8)] sm:p-10">
        <div className="text-center"><h1 className="text-[26px]">{title}</h1>{sub && <p className="mt-1 text-sm text-muted">{sub}</p>}</div>
        {children}
      </div>
    </GradientBg>
  )
}

function strength(pw: string) {
  let n = 0
  if (pw.length >= 8) n++
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) n++
  if (/\d/.test(pw)) n++
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 14) n++
  return n
}

function PasswordInput({ value, onChange, autoComplete }: { value: string; onChange: (v: string) => void; autoComplete: string }) {
  const [show, setShow] = useState(false)
  return (
    <div className="input-icon">
      <Icon name="lock" />
      <input className="input pr-20" type={show ? 'text' : 'password'} autoComplete={autoComplete} required value={value} onChange={(e) => onChange(e.target.value)} />
      <button type="button" onClick={() => setShow(!show)} className="absolute top-1/2 right-3 -translate-y-1/2 text-[14px] text-faint hover:text-ink">{show ? 'Masquer' : 'Afficher'}</button>
    </div>
  )
}

export function Login() {
  useTitle('Connexion')
  const { login } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const next = params.get('suivant') || ''
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<unknown>(null)
  const [busy, setBusy] = useState(false)
  const [closed, setClosed] = useState<{ label: string; last_seen_at: string }[] | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      const r = await login(email, password)
      if (r.otp_required) nav(`/admin/verification?suivant=${encodeURIComponent(next || '/admin')}`)
      else if (r.closed_devices.length) setClosed(r.closed_devices)
      else nav(next || '/bibliotheque')
    } catch (err) {
      setError(err)
    } finally {
      setBusy(false)
    }
  }
  if (closed) return <DeviceNotice closed={closed} onContinue={() => nav(next || '/bibliotheque')} />
  return (
    <Shell title="Bon retour" sub="Connectez-vous pour reprendre votre lecture">
      <form onSubmit={submit} className="grid gap-4">
        {params.get('nouveau') && !error && <p className="rounded-[10px] bg-[#DCFCE7] px-3.5 py-3 text-[14px] text-ok-dark" role="status">Mot de passe modifié. Connectez-vous avec le nouveau.</p>}
        {error ? <p className="rounded-[10px] bg-[#FFEDE4] px-3.5 py-3 text-[14px] text-danger" role="alert">{(error as Error).message}</p> : null}
        <Field label="E-mail"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <label className="field">
          <span className="flex justify-between">Mot de passe<Link to="/mot-de-passe" className="font-medium text-blue">Oublié ?</Link></span>
          <PasswordInput value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <button className="btn btn-blue !py-3.5 shadow-[0_14px_28px_-12px_rgba(47,104,183,.8)]" disabled={busy}>{busy ? 'Connexion…' : 'Se connecter'}</button>
      </form>
      <p className="text-center text-sm">Nouveau ici ? <Link to={`/inscription${next ? `?suivant=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-orange">Créer un compte</Link></p>
    </Shell>
  )
}

/** Limite de deux appareils : la session la plus ancienne vient d'être fermée (maquette 14d). */
function DeviceNotice({ closed, onContinue }: { closed: { label: string; last_seen_at: string }[]; onContinue: () => void }) {
  const d = closed[0]
  const days = Math.floor((Date.now() - new Date(d.last_seen_at).getTime()) / 864e5)
  const when = days <= 0 ? "aujourd'hui" : days === 1 ? 'hier' : `il y a ${days} jours`
  return (
    <div className="grid min-h-[calc(100vh-120px)] place-items-center bg-paper px-4 py-14">
      <div className="flex w-full max-w-[440px] flex-col gap-3.5 rounded-[20px] bg-[var(--card)] p-9 shadow-[0_40px_80px_-30px_rgba(4,28,92,.45)]">
        <div className="flex items-end gap-2.5" aria-hidden="true">
          <span className="h-[76px] w-11 rounded-[10px] border-[2.5px] border-ok" />
          <span className="h-16 w-24 rounded-lg border-[2.5px] border-ok" />
          <span className="grid h-16 w-24 place-items-center rounded-lg border-[2.5px] border-dashed border-[#D9DBE0] text-2xl text-orange"><Icon name="cross-small" /></span>
        </div>
        <h1 className="mt-2 text-2xl">Nouvel appareil connecté</h1>
        <p className="text-sm leading-relaxed text-muted">Votre compte est limité à deux appareils. La session <b className="text-ink">{d.label}</b> ({when}) a été fermée.</p>
        <button className="btn btn-blue !py-3.5" onClick={onContinue}>Continuer ma lecture</button>
        <Link to="/mot-de-passe" className="btn btn-ghost !py-3.5 text-[#C2410C]">Ce n'était pas moi</Link>
      </div>
    </div>
  )
}

export function Register() {
  useTitle('Créer un compte')
  const { setUser } = useAuth()
  const nav = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ full_name: '', email: '', password: '', phone: '', country: "Côte d'Ivoire", city: '', accept_terms: false, newsletter_consent: false })
  const [err, setErr] = useState<ApiError | null>(null)
  const [busy, setBusy] = useState(false)
  const works = useApi<any[]>('/api/catalog/works/')
  const set = (k: string, v: unknown) => setF((s) => ({ ...s, [k]: v }))
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setErr(null)
    try {
      const r = await post('/api/auth/register/', f)
      setUser(r.user)
      nav(`/verification-envoyee?email=${encodeURIComponent(f.email)}${params.get('suivant') ? `&suivant=${encodeURIComponent(params.get('suivant')!)}` : ''}`)
    } catch (ex) {
      setErr(ex as ApiError)
    } finally {
      setBusy(false)
    }
  }
  const fe = (k: string) => err?.field?.(k)
  const level = strength(f.password)
  return (
    <div className="grid min-h-[calc(100vh-120px)] lg:grid-cols-2">
      <GradientBg className="hidden flex-col p-12 text-white lg:flex">
        <div className="relative my-auto flex justify-center">
          {(works.data ?? []).slice(0, 3).map((w: any, i: number) => (
            <div key={w.id} className={i === 1 ? 'relative z-[1] w-[170px] -translate-y-3.5' : 'w-[150px]'}
              style={{ transform: i === 0 ? 'perspective(900px) rotateY(18deg) translateX(30px)' : i === 2 ? 'perspective(900px) rotateY(-18deg) translateX(-30px)' : undefined }}>
              <WorkCover work={w} />
            </div>
          ))}
        </div>
        <div className="relative">
          <p className="text-[32px] leading-tight font-bold">Votre bibliothèque<br /><span className="text-orange">vous attend.</span></p>
          <div className="mt-5 flex gap-6 text-[14px] opacity-90"><span>✓ Reprise de lecture</span><span>✓ Reçus en ligne</span><span>✓ 2 appareils</span></div>
        </div>
      </GradientBg>
      <div className="grid place-items-center bg-paper px-4 py-10 sm:px-8 lg:py-14">
        <div className="w-full max-w-[540px] rounded-[24px] bg-[var(--card)] p-6 shadow-[0_30px_70px_-35px_rgba(4,28,92,.35)] sm:p-10">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
            <span className="chip chip-orange">Inscription gratuite</span>
            <span className="text-muted">Déjà inscrit ? <Link to="/connexion" className="font-semibold text-blue">Se connecter</Link></span>
          </div>
          <h1 className="mt-5 text-[30px] sm:text-[34px]">Créer un compte</h1>
          <p className="mt-1.5 text-muted">Lisez vos œuvres partout, retrouvez vos reçus et vos formations.</p>
          <form onSubmit={submit} className="mt-7 grid gap-5" noValidate>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Nom complet" error={fe('full_name')}><span className="input-icon"><Icon name="user" /><input className="input" autoComplete="name" value={f.full_name} onChange={(e) => set('full_name', e.target.value)} placeholder="Awa Koné" /></span></Field>
              <Field label="Ville"><span className="input-icon"><Icon name="marker" /><input className="input" autoComplete="address-level2" value={f.city} onChange={(e) => set('city', e.target.value)} placeholder="Abidjan" /></span></Field>
            </div>
            <Field label="E-mail" error={fe('email')}><span className="input-icon"><Icon name="envelope" /><input className="input" type="email" autoComplete="email" value={f.email} onChange={(e) => set('email', e.target.value)} placeholder="vous@exemple.com" /></span></Field>
            <label className="field">
              <span className="flex justify-between">Téléphone <span className="text-[13px] font-normal text-faint">facultatif</span></span>
              <div className="flex gap-2">
                <select className="input !w-[110px] shrink-0" aria-label="Pays" value={f.country} onChange={(e) => set('country', e.target.value)}>
                  {[["Côte d'Ivoire", '+225'], ['France', '+33'], ['Sénégal', '+221'], ['Burkina Faso', '+226'], ['Mali', '+223'], ['Bénin', '+229'], ['Togo', '+228'], ['Cameroun', '+237'], ['Canada', '+1'], ['Autre', '…']].map(([c, d]) => (
                    <option key={c} value={c}>{d} {c === 'Autre' ? 'Autre pays' : ''}</option>
                  ))}
                </select>
                <span className="input-icon min-w-0 flex-1"><Icon name="phone-call" /><input className="input" type="tel" autoComplete="tel" placeholder="07 00 00 00 00" value={f.phone} onChange={(e) => set('phone', e.target.value)} /></span>
              </div>
              {fe('phone') && <span className="err">{fe('phone')}</span>}
            </label>
            <label className="field">
              <span>Mot de passe</span>
              <PasswordInput value={f.password} onChange={(v) => set('password', v)} autoComplete="new-password" />
              <span className="mt-1 flex gap-1.5" aria-label={`Robustesse : ${level} sur 4`}>
                {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i < level ? (level >= 3 ? 'bg-ok' : 'bg-orange') : 'bg-[#EFF0F2]'}`} />)}
              </span>
              {(fe('password') || (Array.isArray(err?.data.non_field_errors) && String(err!.data.non_field_errors[0]))) ? <span className="err">{fe('password') || String((err!.data.non_field_errors as string[])[0])}</span> : <small>8 caractères minimum, évitez les mots trop simples.</small>}
            </label>
            <div className="grid gap-3 rounded-2xl bg-paper p-4">
              <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-relaxed">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-orange" checked={f.accept_terms} onChange={(e) => set('accept_terms', e.target.checked)} />
                <span>J'accepte les <Link to="/cgu" className="font-semibold text-blue" target="_blank">CGU</Link> et la <Link to="/confidentialite" className="font-semibold text-blue" target="_blank">politique de confidentialité</Link>.</span>
              </label>
              {fe('accept_terms') && <span className="err">{fe('accept_terms')}</span>}
              <label className="flex cursor-pointer items-start gap-3 text-[14.5px] leading-relaxed text-ink-soft">
                <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-orange" checked={f.newsletter_consent} onChange={(e) => set('newsletter_consent', e.target.checked)} />
                Recevoir la punchline du jour par e-mail.
              </label>
            </div>
            {err && !Object.keys(err.data).some((k) => ['full_name', 'email', 'password', 'phone', 'accept_terms', 'non_field_errors'].includes(k)) && <ErrorNote error={err} />}
            <button className="btn btn-primary !py-4 text-[16px] shadow-orange" disabled={busy}>{busy ? 'Création…' : 'Créer mon compte'}</button>
          </form>
        </div>
      </div>
    </div>
  )
}

/** Après l'inscription (maquette 13a). */
export function VerifySent() {
  useTitle('Vérifiez votre boîte mail')
  const [params] = useSearchParams()
  const email = params.get('email') ?? ''
  const [wait, setWait] = useState(60)
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait(wait - 1), 1000); return () => clearTimeout(t) }, [wait])
  const domain = email.split('@')[1] ?? ''
  const webmail: Record<string, string> = { 'gmail.com': 'https://mail.google.com', 'yahoo.fr': 'https://mail.yahoo.com', 'yahoo.com': 'https://mail.yahoo.com', 'outlook.com': 'https://outlook.live.com', 'hotmail.com': 'https://outlook.live.com', 'hotmail.fr': 'https://outlook.live.com' }
  return (
    <GradientBg className="grid min-h-[calc(100vh-120px)] place-items-center px-4 py-14">
      <div className="relative w-full max-w-[460px] rounded-[20px] bg-[var(--card)] px-8 py-11 text-center shadow-[0_50px_90px_-30px_rgba(4,28,92,.8)] sm:px-10">
        <div className="relative mx-auto grid h-24 w-24 place-items-center rounded-[26px] text-[42px] text-white shadow-[0_18px_36px_-12px_rgba(21,96,220,.8)]" style={{ background: 'linear-gradient(135deg,#3386C9,#1560DC)' }}>
          <Icon name="envelope" />
          <span className="absolute -top-2 -right-2 grid h-[30px] w-[30px] place-items-center rounded-full border-[3px] border-white bg-orange text-[14px] font-bold">1</span>
        </div>
        <h1 className="mt-7 text-[28px]">Vérifiez votre boîte mail</h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">Un lien de confirmation a été envoyé à <b className="text-ink">{email || 'votre adresse'}</b>. Il est valable 3 jours.</p>
        {webmail[domain] ? <a href={webmail[domain]} target="_blank" rel="noopener noreferrer" className="btn btn-blue mt-6 w-full !py-3.5">Ouvrir ma messagerie</a>
          : <Link to={params.get('suivant') || '/boutique'} className="btn btn-blue mt-6 w-full !py-3.5">Continuer sur le site</Link>}
        <p className="mt-4 text-sm text-muted">Rien reçu ?{' '}
          {wait > 0 ? <b className="text-orange">Renvoyer dans 0:{String(wait).padStart(2, '0')}</b>
            : <button className="font-bold text-orange" onClick={async () => { await post('/api/auth/resend-verification/'); setWait(60) }}>Renvoyer le lien</button>}
        </p>
        <p className="mt-6 rounded-[10px] bg-paper p-3.5 text-left text-[14px] text-muted">Tant que l'e-mail n'est pas vérifié, les achats sont désactivés. Vous pouvez déjà lire les extraits gratuits.</p>
      </div>
    </GradientBg>
  )
}

export function ForgotPassword() {
  useTitle('Mot de passe oublié')
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  return (
    <Shell title="Mot de passe oublié" sub="Saisissez votre e-mail, nous vous envoyons un lien valable 1 heure.">
      <Link to="/connexion" className="-mt-2 text-center text-[14px] text-muted">← Retour à la connexion</Link>
      <div className="kicker text-center">Étape 1</div>
      <form onSubmit={async (e) => { e.preventDefault(); await post('/api/auth/password-reset/', { email }); setSent(true) }} className="grid gap-4">
        <Field label="E-mail"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <button className="btn btn-primary !py-3.5">Envoyer le lien</button>
        {sent && <p className="rounded-[10px] bg-[#DCFCE7] px-3.5 py-3 text-[14px] text-ok-dark" role="status">✓ Si un compte existe, un e-mail vient d'être envoyé.</p>}
      </form>
    </Shell>
  )
}

export function ResetPassword() {
  useTitle('Nouveau mot de passe')
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<unknown>(null)
  const level = strength(password)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return setError(new Error('Les deux mots de passe ne correspondent pas.'))
    try {
      await post('/api/auth/password-reset/confirm/', { uid: params.get('uid'), token: params.get('token'), password })
      nav('/connexion?nouveau=1')
    } catch (err) { setError(err) }
  }
  return (
    <Shell title="Nouveau mot de passe">
      <div className="kicker -mt-2 text-center">Étape 2 · lien à usage unique</div>
      <form onSubmit={submit} className="grid gap-4">
        <label className="field">
          <span>Nouveau mot de passe</span>
          <PasswordInput value={password} onChange={setPassword} autoComplete="new-password" />
          <span className="mt-1 flex gap-1" aria-label={`Robustesse : ${level} sur 4`}>
            {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1 flex-1 rounded-full ${i < level ? (level >= 3 ? 'bg-ok' : 'bg-orange') : 'bg-[#EFF0F2]'}`} />)}
          </span>
        </label>
        <label className="field"><span>Confirmer</span><PasswordInput value={confirm} onChange={setConfirm} autoComplete="new-password" /></label>
        <ErrorNote error={error} />
        <button className="btn btn-blue !py-3.5">Enregistrer</button>
        <p className="text-xs text-muted">Toutes vos autres sessions seront déconnectées.</p>
      </form>
    </Shell>
  )
}

export function VerifyEmail() {
  useTitle('Vérification')
  const [params] = useSearchParams()
  const { refresh } = useAuth()
  const [state, setState] = useState<'idle' | 'ok' | 'error'>('idle')
  useEffect(() => {
    post('/api/auth/verify-email/', { token: params.get('token') })
      .then(() => { setState('ok'); refresh() })
      .catch(() => setState('error'))
  }, [params, refresh])
  return (
    <Shell title="Vérification de l'adresse">
      {state === 'idle' && <p>Vérification…</p>}
      {state === 'ok' && <><p>Adresse confirmée. Vous pouvez acheter et lire.</p><Link to="/boutique" className="btn btn-primary justify-self-start">Voir les livres</Link></>}
      {state === 'error' && <p>Ce lien est invalide ou a expiré. Demandez-en un nouveau depuis <Link to="/compte" className="link">votre compte</Link>.</p>}
    </Shell>
  )
}
