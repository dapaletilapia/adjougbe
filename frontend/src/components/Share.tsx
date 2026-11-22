import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { post } from '../lib/api'

/** Réseaux proposés dans le menu de partage, avec leur couleur officielle. */
const NETWORKS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', href: (u: string, m: string) => `https://wa.me/?text=${encodeURIComponent(`${m}\n${u}`)}` },
  { key: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877F2', href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'x', label: 'X', icon: 'twitter-alt', color: '#0E0F13', href: (u: string, m: string) => `https://x.com/intent/tweet?text=${encodeURIComponent(m)}&url=${encodeURIComponent(u)}` },
  { key: 'telegram', label: 'Telegram', icon: 'telegram', color: '#229ED9', href: (u: string, m: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(m)}` },
  { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
]

/**
 * Un seul bouton « Partager ». Sur téléphone, il ouvre le partage du système (toutes les applications installées) ;
 * ailleurs, un menu propose les réseaux, l'image pour Instagram / TikTok (punchlines) et la copie du lien.
 * L'aperçu (titre, image, description) affiché par WhatsApp, Facebook, X… est servi par le site aux robots de partage.
 */
export function ShareButton({ url, text, slug, cardUrl, dark = false, label = 'Partager', align = 'left', up = false }: {
  url: string; text: string; slug?: string; cardUrl?: string; dark?: boolean; label?: string | false; align?: 'left' | 'right'; up?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  // Le menu est rendu à la racine de la page, en position fixe : un bloc parent « overflow: hidden »
  // (carte de la punchline, popup) ne peut plus le couper. Il s'ouvre là où il y a la place.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [tick, setTick] = useState(0)  // défilement / redimensionnement : on replace le menu contre le bouton
  useLayoutEffect(() => {
    if (!open || !ref.current || !menu.current) return
    const b = ref.current.getBoundingClientRect()
    const w = menu.current.offsetWidth, h = menu.current.offsetHeight, gap = 8, vw = window.innerWidth, vh = window.innerHeight
    const below = b.bottom + gap + h <= vh, above = b.top - gap - h >= 0
    const top = (up ? (above || !below) : (!below && above)) ? b.top - gap - h : Math.min(b.bottom + gap, Math.max(gap, vh - h - gap))
    const left = Math.min(Math.max(gap, align === 'right' ? b.right - w : b.left), vw - w - gap)
    setPos({ top, left })
  }, [open, up, align, tick])
  const full = url.startsWith('http') ? url : window.location.origin + url
  const message = `${text}\n— à lire sur Adjougbe`
  const track = () => { if (slug) post(`/api/blog/posts/${slug}/share/`).catch(() => {}) }

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { const t = e.target as Node; if (!ref.current?.contains(t) && !menu.current?.contains(t)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); ref.current?.querySelector('button')?.focus() } }
    // Défilement ou redimensionnement : le menu suit le bouton ; il se ferme si le bouton sort de l'écran.
    const close = () => {
      const r = ref.current?.getBoundingClientRect()
      if (!r || r.bottom < 0 || r.top > window.innerHeight) setOpen(false)
      else setTick((n) => n + 1)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close)
    }
  }, [open])

  const nativeShare = async () => {
    // Punchline : on tente l'image (pour les stories) ; si elle ne se charge pas, on partage le lien.
    let file: File | null = null
    if (cardUrl) {
      try {
        const res = await fetch(`${cardUrl}?format=story`)
        if (res.ok) file = new File([await res.blob()], 'punchline-adjougbe.png', { type: 'image/png' })
      } catch { /* image indisponible */ }
    }
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text: `${message}\n${full}` })
      else await navigator.share({ title: 'Adjougbe', text: message, url: full })
      track()
    } catch { /* partage annulé */ }
  }
  const onClick = () => {
    setPos(null)
    // Téléphone et tablette : la feuille de partage du système connaît déjà les applications de la personne.
    const touch = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches
    if (touch && 'share' in navigator) nativeShare()
    else setOpen(!open)
  }
  const copy = () => { navigator.clipboard?.writeText(full); setCopied(true); track(); setTimeout(() => setCopied(false), 2000) }

  const btn = dark
    ? 'border border-white/30 bg-white/10 text-white hover:bg-white/20'
    : 'border-[1.5px] border-line bg-[var(--card)] text-[var(--fg)] hover:border-blue hover:text-blue'
  const item = 'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14.5px] font-medium text-[var(--fg)] hover:bg-paper focus-visible:bg-paper'
  const dot = 'grid h-8 w-8 shrink-0 place-items-center rounded-full text-[15px] text-white'
  return (
    <div ref={ref} className="relative inline-flex">
      <button type="button" onClick={onClick} aria-expanded={open} aria-haspopup="menu" aria-label={label ? undefined : 'Partager'} title="Partager"
        className={`inline-flex h-11 items-center gap-2 rounded-full text-[14.5px] font-semibold transition-colors ${label ? 'px-5' : 'w-11 justify-center'} ${btn}`}>
        <i className="fi fi-rr-share text-[16px] leading-none" aria-hidden="true" />{label}
      </button>
      {open && createPortal(
        <div ref={menu} role="menu" aria-label="Partager sur" style={{ top: pos?.top ?? 0, left: pos?.left ?? 0, visibility: pos ? 'visible' : 'hidden' }}
          className="fixed z-[70] w-[250px] rounded-2xl bg-[var(--card)] p-2 shadow-[0_24px_50px_-20px_rgba(4,28,92,.45)] ring-1 ring-ink/[.06]">
          {NETWORKS.map((n) => (
            <a key={n.key} role="menuitem" href={n.href(full, message)} target="_blank" rel="noopener noreferrer" onClick={() => { track(); setOpen(false) }} className={item}>
              <span className={dot} style={{ background: n.color }}><i className={`fi fi-brands-${n.icon} leading-none`} aria-hidden="true" /></span>{n.label}
            </a>
          ))}
          {cardUrl && (
            <a role="menuitem" href={`${cardUrl}?format=story&download=1`} download onClick={() => { track(); setOpen(false) }} className={item}>
              <span className={dot} style={{ background: 'linear-gradient(45deg,#F58529,#DD2A7B 50%,#8134AF)' }}><i className="fi fi-brands-instagram leading-none" aria-hidden="true" /></span>
              <span className="leading-tight">Image pour Instagram<span className="block text-[12.5px] font-normal text-muted">ou TikTok, en story</span></span>
            </a>
          )}
          <div className="my-1 h-px bg-line" />
          <button type="button" role="menuitem" onClick={copy} className={item}>
            <span className={`${dot} bg-paper !text-[var(--fg)]`}><i className={`fi fi-rr-${copied ? 'check' : 'link-alt'} leading-none`} aria-hidden="true" /></span>
            {copied ? <span role="status" className="text-ok">Lien copié</span> : 'Copier le lien'}
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
