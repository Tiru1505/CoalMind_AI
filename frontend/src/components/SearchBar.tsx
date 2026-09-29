/** Global search in the top bar: documents, mines, reports, topics + "Ask AI". Ctrl/⌘+K focuses it. */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BookMarked, FileText, Mountain, Network, Search, Sparkles } from 'lucide-react'
import { api } from '../services/api'
import { useDebounce } from '../hooks/useDebounce'
import { cx } from '../utils/format'

type Item = { type: string; label: string; sub: string; link: string }
const ICONS: Record<string, typeof Search> = { Mine: Mountain, Document: FileText, Report: BookMarked, Topic: Network, 'Ask AI': Sparkles }

export default function SearchBar() {
  const [q, setQ] = useState('')
  const [items, setItems] = useState<Item[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const dq = useDebounce(q, 180)
  const nav = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    const onClick = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('mousedown', onClick) }
  }, [])

  useEffect(() => {
    if (!dq.trim()) { setItems([]); return }
    let alive = true
    api.globalSearch(dq.trim()).then((r) => { if (alive) { setItems(r); setActive(0) } }).catch(() => setItems([]))
    return () => { alive = false }
  }, [dq])

  const go = (it: Item) => {
    setOpen(false)
    setQ('')
    nav(it.link)
  }

  return (
    <div ref={boxRef} className="relative w-full max-w-[520px]">
      <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
      <input
        ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true) }} onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, items.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
          if (e.key === 'Enter' && items[active]) go(items[active])
          if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
        }}
        placeholder="Search documents, mines, reports or data..."
        aria-label="Global search"
        className="w-full h-9 pl-9 pr-16 rounded-md bg-slate-100 border border-transparent text-[13px] placeholder:text-slate-500 focus:bg-white focus:border-brand-300 focus:ring-2 focus:ring-brand-100 outline-none transition"
      />
      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden sm:flex gap-0.5"><span className="kbd">Ctrl</span><span className="kbd">K</span></span>
      {open && q.trim() && (
        <div className="absolute left-0 right-0 top-11 bg-white border border-slate-200 rounded-lg shadow-pop py-1.5 z-50 animate-fade-in max-h-[420px] overflow-y-auto">
          {items.length === 0 && <div className="px-4 py-3 text-[13px] text-slate-500">Searching…</div>}
          {items.map((it, i) => {
            const Icon = ICONS[it.type] || Search
            return (
              <button key={i} onMouseEnter={() => setActive(i)} onClick={() => go(it)}
                className={cx('w-full flex items-center gap-3 px-3.5 py-2 text-left', i === active && 'bg-brand-50')}>
                <span className={cx('w-7 h-7 rounded-md grid place-items-center shrink-0', it.type === 'Ask AI' ? 'bg-coal-50 text-coal-700' : 'bg-slate-100 text-slate-600')}>
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium text-slate-800 truncate">{it.label}</span>
                  <span className="block text-[11.5px] text-slate-500 truncate">{it.sub}</span>
                </span>
                <span className="text-[10.5px] uppercase tracking-wide text-slate-400">{it.type}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
