// Affiche d'une formation et règles partagées entre le site et le Studio.

/** Formation d'une autre organisation : l'inscription se fait sur son formulaire. */
export const isExternal = (t: any) => t.registration_mode === 'external'
export const hostLabel = (t: any) => t.organizer || 'Adjougbe'

/** Affiche de la formation, quel que soit son format (portrait ou bannière) : fond flouté + image entière. */
export function TrainingPoster({ t, className = '', eager = false }: { t: any; className?: string; eager?: boolean }) {
  if (t.cover) {
    return (
      <div className={`relative overflow-hidden bg-[#041C5C] ${className}`}>
        <img src={t.cover} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-60 blur-xl" />
        <img src={t.cover} alt={`Affiche : ${t.title}`} className="relative h-full w-full object-contain" loading={eager ? 'eager' : 'lazy'} />
      </div>
    )
  }
  // Sans affiche : un visuel aux couleurs de la marque, avec le titre (jamais de carte vide).
  return (
    <div className={`hero-grad relative flex flex-col justify-end overflow-hidden p-5 text-white ${className}`}>
      <span className="pointer-events-none absolute inset-0 opacity-[.06]" style={{ backgroundImage: 'url(/mark-mono.svg)', backgroundSize: '64px 64px' }} />
      <img src="/mark-mono.svg" alt="" className="pointer-events-none absolute -top-6 -right-6 h-36 w-36 opacity-[.12]" />
      {t.theme && <span className="relative mb-1.5 text-[13px] font-semibold text-peach">{t.theme}</span>}
      <b className="relative line-clamp-3 text-[20px] leading-snug">{t.title}</b>
    </div>
  )
}
