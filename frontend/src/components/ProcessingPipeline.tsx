import { AlertTriangle, Check, Circle, Database, FileUp, Loader2, ScanLine, ScanText, Sparkles, Table2, X, ShieldCheck } from 'lucide-react'
import type { Stage } from '../types'
import { cx } from '../utils/format'

export const STAGE_DEFS = [
  { key: 'upload', name: 'Document Uploaded', icon: FileUp, hint: 'Checksum, file signature and size validation' },
  { key: 'preprocess', name: 'Image Pre-processing', icon: ScanLine, hint: 'Deskew, denoise, binarisation' },
  { key: 'ocr', name: 'OCR Extraction', icon: ScanText, hint: 'PaddleOCR (Hindi + English), Tesseract fallback' },
  { key: 'tables', name: 'Table Detection', icon: Table2, hint: 'Layout analysis & table structure recognition' },
  { key: 'entities', name: 'Entity Extraction', icon: Sparkles, hint: 'Mines, FY, production, OB, land, manpower…' },
  { key: 'validation', name: 'Data Validation', icon: ShieldCheck, hint: 'Confidence scoring & business-rule checks' },
  { key: 'indexing', name: 'Knowledge Indexing', icon: Database, hint: 'Chunking, embeddings, vector index' },
]

function StatusIcon({ status }: { status: Stage['status'] }) {
  const base = 'w-8 h-8 rounded-full grid place-items-center shrink-0 transition-all'
  switch (status) {
    case 'complete': return <span className={cx(base, 'bg-emerald-600 text-white')}><Check className="w-4 h-4" strokeWidth={3} /></span>
    case 'warning': return <span className={cx(base, 'bg-amber-500 text-white')}><AlertTriangle className="w-4 h-4" /></span>
    case 'failed': return <span className={cx(base, 'bg-red-600 text-white')}><X className="w-4 h-4" strokeWidth={3} /></span>
    case 'running': return <span className={cx(base, 'bg-brand-600 text-white animate-pulse-ring')}><Loader2 className="w-4 h-4 animate-spin" /></span>
    case 'skipped': return <span className={cx(base, 'bg-slate-100 text-slate-400 border border-slate-200')}><Circle className="w-3 h-3" /></span>
    default: return <span className={cx(base, 'bg-white text-slate-300 border-2 border-slate-200')}><Circle className="w-2.5 h-2.5" /></span>
  }
}

const LABEL: Record<string, string> = { complete: '✓ Complete', warning: '⚠ Review needed', failed: '✕ Failed', running: 'Running…', skipped: 'Skipped', pending: 'Queued' }

export default function ProcessingPipeline({ stages }: { stages: Stage[] }) {
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]))
  const doneCount = stages.filter((s) => ['complete', 'warning', 'failed'].includes(s.status)).length
  const pct = Math.round((doneCount / STAGE_DEFS.length) * 100)
  const failed = stages.some((s) => s.status === 'failed')
  return (
    <div>
      <div className="flex items-center justify-between text-[12px] text-slate-500 mb-1.5">
        <span>Pipeline progress</span><span className="tabular-nums font-medium text-slate-700">{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden mb-5">
        <div className={cx('h-full rounded-full transition-all duration-700', failed ? 'bg-red-500' : 'bg-brand-600')} style={{ width: `${pct}%` }} />
      </div>
      <ol className="relative">
        {STAGE_DEFS.map((def, i) => {
          const s = byKey[def.key] || { status: 'pending', detail: '', duration_ms: 0 }
          const Icon = def.icon
          const last = i === STAGE_DEFS.length - 1
          return (
            <li key={def.key} className="relative flex gap-4 pb-5 last:pb-0">
              {!last && <span className={cx('absolute left-4 top-8 bottom-0 w-px -translate-x-1/2', ['complete', 'warning'].includes(s.status) ? 'bg-emerald-300' : 'bg-slate-200')} />}
              <StatusIcon status={s.status as Stage['status']} />
              <div className={cx('flex-1 min-w-0 rounded-md px-3.5 py-2.5 -mt-1 transition-colors',
                s.status === 'running' && 'bg-brand-50 ring-1 ring-brand-100',
                s.status === 'warning' && 'bg-amber-50 ring-1 ring-amber-200',
                s.status === 'failed' && 'bg-red-50 ring-1 ring-red-200')}>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-[11px] font-semibold text-slate-400 tabular-nums">STAGE {i + 1}</span>
                  <span className="flex items-center gap-1.5 text-[13.5px] font-semibold text-slate-800"><Icon className="w-4 h-4 text-slate-500" />{def.name}</span>
                  <span className={cx('text-[12px] font-medium ml-auto',
                    s.status === 'complete' && 'text-emerald-700', s.status === 'warning' && 'text-amber-700', s.status === 'failed' && 'text-red-700',
                    s.status === 'running' && 'text-brand-700', ['pending', 'skipped'].includes(s.status) && 'text-slate-400')}>
                    {LABEL[s.status]}{s.duration_ms > 0 && ['complete', 'warning', 'failed'].includes(s.status) && <span className="text-slate-400 font-normal"> · {(s.duration_ms / 1000).toFixed(1)}s</span>}
                  </span>
                </div>
                <div className="text-[12.5px] text-slate-600 mt-0.5">{s.detail && s.status !== 'pending' && s.status !== 'running' ? s.detail : def.hint}</div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
