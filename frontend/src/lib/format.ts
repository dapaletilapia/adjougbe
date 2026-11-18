const nf = new Intl.NumberFormat('fr-FR')
export const fcfa = (n: number | null | undefined) => `${nf.format(n ?? 0)} FCFA`
export const dateFr = (d?: string | null, withTime = false) =>
  d
    ? new Date(d).toLocaleString('fr-FR', {
        day: 'numeric', month: 'long', year: 'numeric',
        ...(withTime ? { hour: '2-digit', minute: '2-digit' } : {}),
      })
    : ''
export const shortDate = (d?: string | null) =>
  d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''
export const dateTime = (d?: string | null) =>
  d ? new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

export const PAYMENT_METHODS: { value: string; label: string; hint: string; color: string }[] = [
  { value: 'orange_money', label: 'Orange Money', hint: 'Code de confirmation par SMS', color: '#FF7900' },
  { value: 'mtn_momo', label: 'MTN MoMo', hint: 'Validation sur votre téléphone', color: '#FFCC00' },
  { value: 'moov_money', label: 'Moov Money', hint: 'Validation sur votre téléphone', color: '#0066B3' },
  { value: 'wave', label: 'Wave', hint: 'Paiement via l’application Wave', color: '#1DC8F2' },
  { value: 'card', label: 'Carte bancaire', hint: 'Visa ou Mastercard', color: '#1D1D1B' },
]

/** Fichier agenda (.ics) pour une session de formation. */
export function downloadIcs({ title, start, end, location, description }: { title: string; start: string; end: string; location?: string; description?: string }) {
  const f = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const esc = (s = '') => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Adjougbe//Formations//FR', 'BEGIN:VEVENT',
    `UID:${f(start)}-${Math.random().toString(36).slice(2)}@adjougbe`, `DTSTAMP:${f(new Date().toISOString())}`,
    `DTSTART:${f(start)}`, `DTEND:${f(end)}`, `SUMMARY:${esc(title)}`, `LOCATION:${esc(location)}`, `DESCRIPTION:${esc(description)}`,
    'BEGIN:VALARM', 'TRIGGER:-PT1H', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }))
  a.download = 'formation-adjougbe.ics'
  a.click()
}
