import { Link } from 'react-router-dom'
import { Icon } from './ui'

export type Banner = { position: 'debut' | 'milieu' | 'fin'; image: string; title: string; text: string; cta: string; link: string }

export const BANNER_POSITIONS: [Banner['position'], string][] = [['debut', "En haut de l'article"], ['milieu', 'Au milieu du texte'], ['fin', "À la fin de l'article"]]

/** Bannière insérée dans un article : image seule, ou bloc bleu à motifs avec titre, texte et bouton. */
export function ArticleBanner({ b }: { b: Banner }) {
  const external = b.link.startsWith('https://')
  const Wrap = ({ children, className }: { children: React.ReactNode; className: string }) => !b.link ? <div className={className}>{children}</div>
    : external ? <a href={b.link} target="_blank" rel="noopener noreferrer" className={className}>{children}</a>
      : <Link to={b.link} className={className}>{children}</Link>

  if (b.image && !b.title && !b.text) {
    return (
      <Wrap className="my-8 block overflow-hidden rounded-2xl shadow-[0_24px_50px_-28px_rgba(4,28,92,.55)]">
        <img src={b.image} alt="" className="w-full" loading="lazy" />
      </Wrap>
    )
  }
  return (
    <Wrap className="hero-grad not-prose relative my-8 flex flex-col overflow-hidden rounded-2xl text-white shadow-[0_24px_50px_-28px_rgba(4,28,92,.7)] sm:flex-row sm:items-stretch">
      <span className="pointer-events-none absolute inset-0 opacity-[.05]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '80px 80px' }} />
      {b.image && <img src={b.image} alt="" className="relative h-44 w-full object-cover sm:h-auto sm:w-[38%]" loading="lazy" />}
      <span className="relative flex flex-1 flex-col justify-center gap-2 p-6 sm:p-7">
        {b.title && <b className="text-[20px] leading-snug sm:text-[22px]">{b.title}</b>}
        {b.text && <span className="text-[15px] leading-relaxed text-white/85">{b.text}</span>}
        {b.cta && b.link && <span className="btn btn-primary btn-sm mt-2 self-start shadow-orange">{b.cta}</span>}
      </span>
    </Wrap>
  )
}

/** Insère les bannières « milieu » après le paragraphe central de l'article.
 *  Découpe sur les blocs de premier niveau (via le DOM, pas une regex) : chaque moitié reste du HTML bien formé. */
export function splitForMiddle(html: string): [string, string] {
  const tpl = document.createElement('template')
  tpl.innerHTML = html
  const nodes = [...tpl.content.childNodes]
  const paras = nodes.filter((n) => n.nodeName === 'P')
  if (paras.length < 2) return [html, '']
  const cut = nodes.indexOf(paras[Math.floor((paras.length - 1) / 2)]) + 1
  const ser = (ns: ChildNode[]) => { const d = document.createElement('div'); d.append(...ns.map((n) => n.cloneNode(true))); return d.innerHTML }
  return [ser(nodes.slice(0, cut)), ser(nodes.slice(cut))]
}

const KIND_STYLE: Record<string, [string, string]> = {
  punchline: ['linear-gradient(125deg,#041C5C 0%,#0A3A9E 45%,#1560DC 100%)', 'quote-right'],
  papo: ['linear-gradient(125deg,#C2410C 0%,#FF6B29 60%,#FF9A5C 100%)', 'comment-alt'],
  event: ['linear-gradient(125deg,#0E0F13 0%,#1E2A52 60%,#2F68B7 100%)', 'calendar'],
  media: ['linear-gradient(125deg,#041C5C 0%,#2F68B7 60%,#3FA2FF 100%)', 'play'],
  article: ['linear-gradient(125deg,#0A3A9E 0%,#1560DC 55%,#3FA2FF 100%)', 'book-open-reader'],
}

/** Bannière d'un article : son image, ou un visuel généré aux couleurs de la rubrique (jamais de carte sans visuel). */
export function PostBanner({ p, size = 'card', className = '' }: { p: any; size?: 'card' | 'lead' | 'hero'; className?: string }) {
  const [bg, icon] = KIND_STYLE[p.kind] ?? KIND_STYLE.article
  if (p.cover) return <img src={p.cover} alt="" className={`h-full w-full object-cover ${className}`} loading={size === 'hero' ? 'eager' : 'lazy'} />
  const quote = p.kind === 'punchline' && p.quote
  return (
    <div className={`relative flex h-full w-full flex-col justify-end overflow-hidden text-white ${className}`} style={{ background: bg }}>
      <span className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: size === 'card' ? '64px 64px' : '92px 92px' }} />
      <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -top-8 -right-8 h-40 w-40 opacity-[.1] md:h-56 md:w-56" />
      {quote ? (
        <p className={`relative p-6 leading-snug font-semibold ${size === 'card' ? 'line-clamp-4 text-[19px]' : 'text-[24px] md:p-10 md:text-[28px]'}`}>« {p.quote} »</p>
      ) : (
        <span className={`relative m-6 grid place-items-center rounded-2xl bg-white/15 backdrop-blur-sm ${size === 'card' ? 'h-12 w-12 text-xl' : 'h-16 w-16 text-2xl md:m-10'}`}><Icon name={icon} /></span>
      )}
    </div>
  )
}
