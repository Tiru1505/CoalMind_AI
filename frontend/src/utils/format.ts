export const fmtInt = (n: number) => n.toLocaleString('en-IN')
export const fmtNum = (n: number, d = 1) => n.toLocaleString('en-IN', { minimumFractionDigits: d, maximumFractionDigits: d })

export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}
export function fmtDateTime(iso: string) {
  return `${fmtDate(iso)}, ${fmtTime(iso)}`
}
export function timeAgo(iso: string) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000
  if (s < 45) return 'just now'
  if (s < 3600) return `${Math.round(s / 60)} min ago`
  if (s < 86400) return `${Math.round(s / 3600)} h ago`
  if (s < 86400 * 30) return `${Math.round(s / 86400)} d ago`
  return fmtDate(iso)
}
export const fileSize = (kb: number) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`)

export const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator', geological_officer: 'Geological Officer', management: 'Management', viewer: 'Viewer',
}

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

export function surname(name: string) {
  const parts = name.replace(/\./g, '. ').split(/\s+/).filter(Boolean)
  const title = parts[0]?.match(/^(Dr|Mr|Ms|Mrs|Prof)\.?$/i) ? parts[0].replace('.', '') + '. ' : ''
  return title + parts[parts.length - 1]
}
