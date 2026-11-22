import { Icon } from './ui'

export type FilterOption = { value: string; label: string; count?: number }

/**
 * Barre de filtres commune (Œuvres, Formations, Blog, Recherche) : un seul rail, toujours sur une ligne.
 * Trop d'options pour la largeur : le rail défile horizontalement au lieu de passer à la ligne.
 * La recherche, quand il y en a une, est dans la même barre.
 */
export function FilterBar({ label, options, value, onChange, search }: {
  label: string
  options: FilterOption[]
  value: string
  onChange: (v: string) => void
  search?: { id: string; value: string; onChange: (v: string) => void; onSubmit?: () => void; placeholder: string }
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-2xl bg-[var(--card)] p-1.5 shadow-[0_14px_34px_-22px_rgba(4,28,92,.45)] ring-1 ring-ink/[.05] md:flex-row md:items-center">
      <div role="group" aria-label={label} className="scroll-rail flex min-w-0 flex-1 gap-1 overflow-x-auto">
        {options.map((o) => {
          const on = o.value === value
          return (
            <button key={o.value} type="button" onClick={() => onChange(o.value)} aria-pressed={on}
              className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors ${on ? 'bg-blue text-white shadow-[0_8px_18px_-10px_rgba(21,96,220,.9)]' : 'text-ink-soft hover:bg-paper hover:text-ink'}`}>
              {o.label}
              {o.count !== undefined && (
                <span className={`rounded-full px-1.5 text-[12px] leading-5 tabular-nums ${on ? 'bg-white/20' : 'bg-paper text-muted'}`}>{o.count}</span>
              )}
            </button>
          )
        })}
      </div>
      {search && (
        <form role="search" className="relative shrink-0 md:w-[260px]" onSubmit={(e) => { e.preventDefault(); search.onSubmit?.() }}>
          <label htmlFor={search.id} className="sr-only">{search.placeholder}</label>
          <Icon name="search" className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-faint" />
          <input id={search.id} type="search" value={search.value} onChange={(e) => search.onChange(e.target.value)} placeholder={search.placeholder}
            className="w-full rounded-xl bg-paper py-2.5 pr-4 pl-10 text-[14px] text-[var(--fg)] outline-none placeholder:text-faint focus:ring-2 focus:ring-blue/30" />
        </form>
      )}
    </div>
  )
}
