import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { dateFr } from '../lib/format'
import { ShareButton } from './Share'
import markWhite from '../assets/mark-white.svg'

const KEY = 'adj-punchline-vue'
const today = () => new Date().toISOString().slice(0, 10)

/** Popup « livre ouvert » : la punchline du jour, à la première visite de l'accueil de la journée. */
export function PunchlinePopup({ p }: { p: { slug: string; quote: string; excerpt?: string; published_at: string } }) {
  const [open, setOpen] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let seen = ''
    try { seen = localStorage.getItem(KEY) ?? '' } catch { /* stockage indisponible : on affiche */ }
    if (seen === today()) return
    const t = setTimeout(() => setOpen(true), 900)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (!open) return
    try { localStorage.setItem(KEY, today()) } catch { /* rien */ }
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open])
  if (!open) return null

  const quote = p.quote || p.excerpt || ''
  return (
    <div className="fixed inset-0 z-[60] grid place-items-center overflow-y-auto bg-[#041C5C]/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="pdj-titre"
      onClick={(e) => e.target === e.currentTarget && setOpen(false)}>
      <div className="pdj-in relative w-full max-w-[860px]">
        <button ref={closeRef} onClick={() => setOpen(false)} aria-label="Fermer"
          className="absolute -top-3 -right-1 z-10 grid h-11 w-11 place-items-center rounded-full bg-white text-ink shadow-lg hover:text-orange sm:-right-3">
          <i className="fi fi-rr-cross-small text-xl" aria-hidden="true" />
        </button>

        {/* Le livre */}
        <div className="pdj-book grid overflow-hidden rounded-[14px] shadow-[0_50px_100px_-30px_rgba(0,0,0,.6)] md:grid-cols-[.8fr_1.2fr]">
          <div className="pdj-cover hero-grad relative flex flex-col justify-between gap-8 p-7 text-white md:p-9">
            <span className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '72px 72px' }} />
            <span className="relative text-[13px] font-semibold text-peach">Punchline du jour</span>
            <img src={markWhite} alt="" className="relative mx-auto hidden h-24 w-24 md:block" />
            <span className="relative">
              <b id="pdj-titre" className="block text-[22px] leading-tight md:text-[26px]">Votre phrase<br className="hidden md:block" /> pour aujourd'hui</b>
              <span className="mt-1.5 block text-[14px] text-white/75">{dateFr(p.published_at)}</span>
            </span>
          </div>
          <div className="relative flex flex-col justify-center bg-[#FFFDF8] px-7 py-9 text-ink md:px-12 md:py-14">
            {/* Pli de la reliure */}
            <span className="pointer-events-none absolute inset-y-0 left-0 hidden w-10 md:block" style={{ background: 'linear-gradient(90deg,rgba(4,28,92,.16),transparent)' }} />
            <span className="font-serif text-[64px] leading-none text-orange" aria-hidden="true">«</span>
            <blockquote className="-mt-4 font-serif text-[24px] leading-[1.4] md:text-[30px]">{quote}</blockquote>
            <span className="mt-6 flex items-center gap-3 text-[15px] font-semibold">
              <img src="/auteur-hero.webp" alt="" className="h-10 w-10 rounded-full bg-blue-tint object-cover object-top" /> Adjougbe
            </span>
          </div>
        </div>

        {/* Partage */}
        <div className="mt-4 flex flex-col items-start gap-4 rounded-[14px] bg-white p-5 shadow-xl md:flex-row md:items-center md:justify-between md:px-7">
          <div>
            <b className="block text-[16px]">Elle peut aider quelqu'un aujourd'hui.</b>
            <span className="text-[14px] text-muted">Envoyez-la à quelqu'un, ou publiez-la en story.</span>
          </div>
          <ShareButton up align="right" url={`/blog/${p.slug}`} text={`« ${quote} » — Adjougbe`} slug={p.slug} cardUrl={`/api/blog/posts/${p.slug}/card.png`} />
        </div>
        <p className="mt-4 text-center">
          <Link to="/blog?kind=punchline" onClick={() => setOpen(false)} className="text-[14px] font-semibold text-white underline underline-offset-4">Voir toutes les punchlines</Link>
        </p>
      </div>
    </div>
  )
}
