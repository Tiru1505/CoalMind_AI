/** Renders OCR'd pages as a paper-style preview and highlights extracted field anchors. */
import { Fragment, type ReactNode } from 'react'
import type { Block, Field, Page } from '../types'
import { cx } from '../utils/format'

export interface Highlight { text: string; fieldId?: number; tone: 'pending' | 'ok' | 'auto' | 'rejected' | 'source' }

const TONE: Record<Highlight['tone'], string> = {
  pending: 'bg-red-100/90 ring-1 ring-red-400 text-red-900',
  ok: 'bg-emerald-100 ring-1 ring-emerald-400 text-emerald-900',
  auto: 'bg-brand-100/80 ring-1 ring-brand-300 text-brand-900',
  rejected: 'bg-slate-200 line-through ring-1 ring-slate-400',
  source: 'bg-yellow-200/90 ring-1 ring-yellow-500 text-slate-900',
}

export function fieldTone(f: Field): Highlight['tone'] {
  if (f.status === 'pending') return 'pending'
  if (f.status === 'approved') return 'ok'
  if (f.status === 'rejected') return 'rejected'
  return 'auto'
}

function mark(text: string, hl: Highlight[], active: number | null | undefined, onPick?: (id: number) => void): ReactNode {
  const list = hl.filter((h) => h.text && text.includes(h.text)).sort((a, b) => b.text.length - a.text.length)
  if (!list.length) return text
  const h = list[0]
  const idx = text.indexOf(h.text)
  const before = text.slice(0, idx)
  const after = text.slice(idx + h.text.length)
  const rest = hl.filter((x) => x !== h)
  return (
    <>
      {mark(before, rest, active, onPick)}
      <mark
        data-field={h.fieldId}
        onClick={(e) => { if (h.fieldId && onPick) { e.stopPropagation(); onPick(h.fieldId) } }}
        className={cx('rounded-[3px] px-0.5 -mx-0.5 transition', TONE[h.tone], !!h.fieldId && !!onPick && 'cursor-pointer',
          active != null && h.fieldId === active && 'ring-2 !ring-brand-600 animate-flash', h.tone === 'source' && 'animate-flash')}>
        {h.text}
      </mark>
      {mark(after, rest, active, onPick)}
    </>
  )
}

function BlockView({ b, hl, active, onPick, highlightLine }: { b: Block; hl: Highlight[]; active?: number | null; onPick?: (id: number) => void; highlightLine?: string }) {
  const m = (t: string) => mark(t, hl, active, onPick)
  const lineHit = (t: string) => !!highlightLine && t.trim() === highlightLine.trim()
  switch (b.type) {
    case 'heading': return <h2 className={cx('font-serif text-[16px] font-bold text-slate-900 tracking-wide mb-3', lineHit(b.text) && 'bg-yellow-100')}>{m(b.text)}</h2>
    case 'subheading': return <h3 className="font-serif text-[14px] font-semibold mb-2">{m(b.text)}</h3>
    case 'note': return <p className={cx('font-serif text-[11.5px] italic text-slate-500 mt-2', lineHit(b.text) && 'bg-yellow-100')}>{m(b.text)}</p>
    case 'para': return <p className={cx('font-serif text-[13px] leading-relaxed text-slate-800 mb-3 rounded', lineHit(b.text) && 'bg-yellow-100 ring-1 ring-yellow-400 animate-flash')}>{m(b.text)}</p>
    case 'kv':
      return (
        <table className="w-full font-serif text-[12.5px] mb-3 border border-slate-400">
          <tbody>
            {b.items.map(([k, v]) => (
              <tr key={k} className={cx(lineHit(`${k}: ${v}`) && 'bg-yellow-100 animate-flash')}>
                <td className="border border-slate-400 px-2 py-1 w-[55%] text-slate-700">{k}</td>
                <td className="border border-slate-400 px-2 py-1 font-semibold">{m(v)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )
    case 'table':
      return (
        <div className="mb-3 overflow-x-auto">
          {b.caption && <div className={cx('font-serif text-[12px] font-semibold text-slate-700 mb-1', lineHit(b.caption) && 'bg-yellow-100')}>{b.caption}</div>}
          <table className="w-full font-serif text-[12px] border border-slate-500">
            <thead>
              <tr>{b.headers.map((h) => <th key={h} className="border border-slate-500 bg-slate-100/80 px-2 py-1 text-left font-semibold">{h}</th>)}</tr>
            </thead>
            <tbody>
              {b.rows.map((r, i) => (
                <tr key={i} className={cx(lineHit(r.join(' | ')) && 'bg-yellow-100 outline outline-2 outline-yellow-400 animate-flash')}>
                  {r.map((c, j) => <td key={j} className="border border-slate-400 px-2 py-1 tabular-nums">{m(String(c))}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
  }
}

export default function DocumentPreview({ pages, fields = [], totalPages, scanned, active, onPick, highlightLine, extraHighlights = [], docTitle }: {
  pages: Page[]; fields?: Field[]; totalPages: number; scanned?: boolean; active?: number | null; onPick?: (id: number) => void
  highlightLine?: string; extraHighlights?: Highlight[]; docTitle?: string
}) {
  return (
    <div className="space-y-6">
      {pages.map((p) => {
        const hl: Highlight[] = [
          ...fields.filter((f) => f.page === p.page_number).map((f) => ({ text: f.anchor, fieldId: f.id, tone: fieldTone(f) })),
          ...extraHighlights,
        ]
        return (
          <Fragment key={p.page_number}>
            <div id={`page-${p.page_number}`} className={cx('paper rounded-sm px-8 sm:px-10 py-9 relative scroll-mt-4', scanned && 'paper-scan')} style={scanned ? { transform: `rotate(${(p.page_number % 3 - 1) * 0.15}deg)` } : undefined}>
              <div className="flex items-center justify-between gap-3 text-[10px] font-sans uppercase tracking-wider text-slate-400 mb-5 border-b border-slate-200 pb-2">
                <span className="truncate">{docTitle}</span>
                <span className="shrink-0 flex items-center gap-2">
                  <span className={cx('chip normal-case tracking-normal !text-[10.5px] ring-1 ring-inset', p.ocr_confidence >= 90 ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : p.ocr_confidence >= 85 ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-red-50 text-red-700 ring-red-200')}>
                    OCR {p.ocr_confidence.toFixed(1)}%
                  </span>
                  Page {p.page_number} of {totalPages}
                </span>
              </div>
              {p.blocks.map((b, i) => <BlockView key={i} b={b} hl={hl} active={active} onPick={onPick} highlightLine={highlightLine} />)}
            </div>
          </Fragment>
        )
      })}
      {pages.length > 1 && (
        <div className="text-center text-[11px] text-slate-400">Showing {pages.length} of {totalPages} pages · pages without extracted entities are omitted from the preview</div>
      )}
    </div>
  )
}
