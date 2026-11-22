import { useState } from 'react'
import { post } from '../lib/api'

/** Réseaux proposés au partage, avec leur couleur officielle. */
const NETWORKS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: 'whatsapp', color: '#25D366', href: (u: string, m: string) => `https://wa.me/?text=${encodeURIComponent(`${m}\n${u}`)}` },
  { key: 'facebook', label: 'Facebook', icon: 'facebook', color: '#1877F2', href: (u: string) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(u)}` },
  { key: 'x', label: 'X', icon: 'twitter-alt', color: '#0E0F13', href: (u: string, m: string) => `https://x.com/intent/tweet?text=${encodeURIComponent(m)}&url=${encodeURIComponent(u)}` },
  { key: 'telegram', label: 'Telegram', icon: 'telegram', color: '#229ED9', href: (u: string, m: string) => `https://t.me/share/url?url=${encodeURIComponent(u)}&text=${encodeURIComponent(m)}` },
  { key: 'linkedin', label: 'LinkedIn', icon: 'linkedin', color: '#0A66C2', href: (u: string) => `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(u)}` },
]

/**
 * Partage en un clic. Le texte partagé est préparé ici (citation ou titre + invitation) ; l'aperçu
 * (titre, image, description) affiché par WhatsApp, Facebook, X… est servi par le site aux robots de partage.
 * Instagram et TikTok ne partagent pas de lien : on propose l'image de la punchline, à publier en story.
 */
export function ShareButtons({ url, text, slug, cardUrl, dark = false, label = true, vertical = false }: {
  url: string; text: string; slug?: string; cardUrl?: string; dark?: boolean; label?: boolean; vertical?: boolean
}) {
  const [copied, setCopied] = useState(false)
  const full = url.startsWith('http') ? url : window.location.origin + url
  const message = `${text}\n— à lire sur Adjougbe`
  const track = () => { if (slug) post(`/api/blog/posts/${slug}/share/`).catch(() => {}) }
  const canNative = typeof navigator !== 'undefined' && 'share' in navigator

  const nativeShare = async () => {
    track()
    try {
      if (cardUrl) {
        const blob = await (await fetch(`${cardUrl}?format=story`)).blob()
        const file = new File([blob], 'punchline-adjougbe.png', { type: 'image/png' })
        if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], text: `${message}\n${full}` }); return }
      }
      await navigator.share({ title: 'Adjougbe', text: message, url: full })
    } catch { /* partage annulé */ }
  }
  const copy = () => { navigator.clipboard?.writeText(full); setCopied(true); track(); setTimeout(() => setCopied(false), 2000) }

  const round = 'grid h-11 w-11 shrink-0 place-items-center rounded-full text-[18px] transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2'
  const ghost = dark ? 'border border-white/25 bg-white/10 text-white hover:bg-white/20' : 'border-[1.5px] border-line bg-[var(--card)] text-ink hover:border-blue hover:text-blue'
  return (
    <div className={`flex gap-3 ${vertical ? 'flex-col' : 'flex-col sm:flex-row sm:flex-wrap sm:items-center'}`}>
      {label && <span className={`text-[14px] font-semibold ${dark ? 'text-white' : 'text-ink'}`}>Partagez-la autour de vous</span>}
      <div className={`flex flex-wrap items-center gap-2.5 ${vertical ? 'max-w-[120px]' : ''}`}>
        {NETWORKS.map((n) => (
          <a key={n.key} href={n.href(full, message)} target="_blank" rel="noopener noreferrer" onClick={track}
            aria-label={`Partager sur ${n.label}`} title={`Partager sur ${n.label}`} className={`${round} text-white`} style={{ background: n.color }}>
            <i className={`fi fi-brands-${n.icon}`} aria-hidden="true" />
          </a>
        ))}
        {cardUrl && (
          <a href={`${cardUrl}?format=story&download=1`} onClick={track} download aria-label="Télécharger l'image pour Instagram ou TikTok"
            title="Image pour Instagram / TikTok" className={`${round} text-white`} style={{ background: 'linear-gradient(45deg,#F58529,#DD2A7B 50%,#8134AF)' }}>
            <i className="fi fi-brands-instagram" aria-hidden="true" />
          </a>
        )}
        <button type="button" onClick={copy} aria-label="Copier le lien" title="Copier le lien" className={`${round} ${ghost}`}>
          <i className={`fi fi-rr-${copied ? 'check' : 'link-alt'}`} aria-hidden="true" />
        </button>
        {canNative && (
          <button type="button" onClick={nativeShare} className={`btn btn-sm !rounded-full sm:hidden ${ghost}`}>
            <i className="fi fi-rr-share" aria-hidden="true" /> Plus d'options
          </button>
        )}
      </div>
      {copied && <span role="status" className={`text-[13px] ${dark ? 'text-white/80' : 'text-ok'}`}>Lien copié</span>}
    </div>
  )
}
