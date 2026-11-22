import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'

/** Bandeau des pages intérieures (maquette « Adj Page Hero ») : dégradé bleu, sur-titre, titre + accent orange, base incurvée. */
export function PageHero({ crumbs, eyebrow, title, accent, text, base = 'var(--bg)', children }: {
  crumbs: [string, string?][]; eyebrow?: string; title: ReactNode; accent?: ReactNode; text?: ReactNode; base?: string; children?: ReactNode
}) {
  return (
    <section className="hero-grad relative mb-10 overflow-hidden text-white md:mb-14">
      <div className="pointer-events-none absolute inset-0" style={{ background: 'linear-gradient(105deg,transparent 40%,rgba(255,255,255,.09) 48%,transparent 58%)' }} />
      <div className="pointer-events-none absolute inset-0 opacity-[.045]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '92px 92px', maskImage: 'linear-gradient(100deg,#000,transparent 60%)', WebkitMaskImage: 'linear-gradient(100deg,#000,transparent 60%)' }} />
      <div className="pointer-events-none absolute inset-0" style={{ background: 'radial-gradient(480px 300px at 12% 100%,rgba(255,107,41,.22),transparent 70%)' }} />
      <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute top-8 right-6 hidden h-[300px] w-[300px] opacity-[.07] md:block lg:right-20" />
      <div className="container-x relative max-w-[1180px] pt-12 pb-16 md:pt-16 md:pb-20">
        <nav aria-label="Fil d'Ariane" className="text-[14px] text-white/70">
          {crumbs.map(([label, to], i) => (
            <span key={label}>{i > 0 && ' / '}{to ? <Link to={to} className="hover:text-white">{label}</Link> : <span aria-current="page">{label}</span>}</span>
          ))}
        </nav>
        <div className="max-w-[820px]">
          {eyebrow && (
            <span className="mt-5 inline-flex items-center gap-3 text-xs font-semibold tracking-[.22em] text-white/85">
              <span className="h-px w-[34px]" style={{ background: 'linear-gradient(90deg,#FF6B29,rgba(255,107,41,0))' }} />{eyebrow}
            </span>
          )}
          <h1 className="mt-4 text-[34px] leading-[1.12] font-bold tracking-[-0.02em] [text-shadow:0_10px_40px_rgba(4,28,92,.45)] md:text-[50px]">
            {title} {accent && <span className="text-orange">{accent}</span>}
          </h1>
          {text && <p className="mt-4 max-w-[620px] text-base leading-[1.65] text-white/88 md:text-[17px]">{text}</p>}
          {children}
        </div>
      </div>
      <svg viewBox="0 0 1440 40" preserveAspectRatio="none" className="absolute -bottom-px left-0 h-4 w-full md:h-7" aria-hidden="true">
        <path d="M0 0 Q720 80 1440 0 L1440 40 L0 40 Z" fill={base} />
      </svg>
    </section>
  )
}
