import { post } from '../lib/api'

/** Partage en un clic : WhatsApp, Facebook, X, + copie du lien (Instagram/TikTok via le visuel). */
export function ShareButtons({ url, text, slug, cardUrl, dark = false }: { url: string; text: string; slug?: string; cardUrl?: string; dark?: boolean }) {
  const cls = dark ? 'btn btn-sm border border-white/25 bg-white/10 text-white hover:bg-white/20' : 'btn btn-ghost btn-sm'
  const full = url.startsWith('http') ? url : window.location.origin + url
  const msg = encodeURIComponent(`${text}\n${full}`)
  const track = () => slug && post(`/api/blog/posts/${slug}/share/`).catch(() => {})
  const links = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${msg}` },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(full)}` },
    { label: 'X', href: `https://x.com/intent/tweet?text=${msg}` },
  ]
  return (
    <div className="flex flex-wrap items-center gap-2">
      {links.map((l) => (
        <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" onClick={track} className={cls}>
          {l.label}
        </a>
      ))}
      {cardUrl && (
        <a href={`${cardUrl}?download=1`} onClick={track} className={cls} download>
          Image pour Instagram / TikTok
        </a>
      )}
      <button type="button" className={cls}
        onClick={() => { navigator.clipboard?.writeText(full); track() }}>
        Copier le lien
      </button>
    </div>
  )
}
