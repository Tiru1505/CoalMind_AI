/** One extracted value with confidence, provenance and the human-in-the-loop validation controls. */
import { useState } from 'react'
import { AlertTriangle, Check, CheckCircle2, FileText, Loader2, Pencil, ShieldCheck, X, XCircle } from 'lucide-react'
import ConfidenceBadge from './ConfidenceBadge'
import type { Field } from '../types'
import { cx, fmtTime } from '../utils/format'

interface Props {
  field: Field
  active: boolean
  canValidate: boolean
  onSelect: () => void
  onApprove: () => Promise<void>
  onEdit: (value: string, reason: string) => Promise<void>
  onReject: (reason: string) => Promise<void>
}

const REASONS = ['OCR misread digit', 'Value verified against original register', 'Unit / scale error', 'Typographical correction']

export default function ExtractionField({ field: f, active, canValidate, onSelect, onApprove, onEdit, onReject }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(f.value)
  const [reason, setReason] = useState(REASONS[0])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const pending = f.status === 'pending'
  const corrected = f.human_value != null && f.human_value !== f.ai_value

  const act = async (kind: string, fn: () => Promise<void>) => {
    setBusy(kind)
    setErr(null)
    try { await fn(); if (kind === 'edit') setEditing(false) } catch (e) { setErr((e as Error).message) } finally { setBusy(null) }
  }

  return (
    <div id={`field-${f.id}`} onClick={onSelect}
      className={cx('rounded-lg border transition cursor-pointer scroll-mt-24',
        active ? 'border-brand-400 ring-2 ring-brand-100' : 'border-slate-200 hover:border-slate-300',
        pending ? 'bg-amber-50/40' : f.status === 'approved' ? 'bg-emerald-50/30' : f.status === 'rejected' ? 'bg-slate-50 opacity-80' : 'bg-white')}>
      <div className="flex items-start gap-3 px-3.5 py-2.5">
        <div className="flex-1 min-w-0">
          <div className="text-[11.5px] font-medium text-slate-500 flex items-center gap-1.5">
            {f.label}
            {pending && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
          </div>
          <div className={cx('text-[14.5px] font-semibold text-slate-900 mt-0.5 break-words', f.status === 'rejected' && 'line-through text-slate-500')}>
            {f.value} {f.unit && <span className="text-[12.5px] font-medium text-slate-500">{f.unit}</span>}
            {corrected && <span className="ml-2 text-[11.5px] font-medium text-violet-700 bg-violet-50 rounded px-1.5 py-0.5">corrected · AI read {f.ai_value}</span>}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ConfidenceBadge value={f.confidence} />
          <button onClick={(e) => { e.stopPropagation(); onSelect() }} className="text-[11px] text-brand-600 hover:underline flex items-center gap-1"><FileText className="w-3 h-3" /> p.{f.page}</button>
        </div>
      </div>

      {!pending && (
        <div className="px-3.5 pb-2.5 -mt-1 text-[11.5px] flex items-center gap-1.5">
          {f.status === 'approved' && <span className="text-emerald-700 font-medium flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" /> Validated ✓ <span className="text-slate-500 font-normal">by {f.validated_by}{f.validated_at && ` · ${fmtTime(f.validated_at)}`}</span></span>}
          {f.status === 'auto_accepted' && <span className="text-slate-500 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5 text-brand-500" /> Auto-accepted (confidence ≥ 80%)</span>}
          {f.status === 'rejected' && <span className="text-red-700 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" /> Rejected by {f.validated_by} — excluded from knowledge base</span>}
        </div>
      )}

      {pending && (
        <div className="border-t border-amber-200/70 px-3.5 py-3 space-y-2.5" onClick={(e) => e.stopPropagation()}>
          {f.warning && (
            <div className="flex gap-2 text-[12px] text-amber-900 bg-amber-100/60 rounded-md px-2.5 py-2">
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /><span><b>Warning:</b> {f.warning}</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 text-[12px]">
            <div className="rounded-md bg-white border border-slate-200 px-2.5 py-1.5"><div className="text-slate-500 text-[10.5px] uppercase tracking-wide">OCR original</div><div className="font-mono text-slate-800">{f.original_text}</div></div>
            <div className="rounded-md bg-white border border-slate-200 px-2.5 py-1.5"><div className="text-slate-500 text-[10.5px] uppercase tracking-wide">AI extracted</div><div className="font-mono text-slate-800">{f.ai_value} {f.unit}</div></div>
          </div>
          {editing ? (
            <div className="space-y-2">
              <div className="flex gap-2">
                <input autoFocus className="input !h-8" value={value} onChange={(e) => setValue(e.target.value)} aria-label={`Corrected ${f.label}`}
                  onKeyDown={(e) => e.key === 'Enter' && act('edit', () => onEdit(value, reason))} />
                {f.unit && <span className="text-[12px] text-slate-500 self-center">{f.unit}</span>}
              </div>
              <select className="input !h-8 text-[12px]" value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Reason for correction">
                {REASONS.map((r) => <option key={r}>{r}</option>)}
              </select>
              <div className="flex gap-2">
                <button className="btn-primary btn-sm" disabled={!!busy} onClick={() => act('edit', () => onEdit(value, reason))}>
                  {busy === 'edit' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Save correction
                </button>
                <button className="btn-ghost btn-sm" onClick={() => { setEditing(false); setValue(f.value) }}>Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button className="btn-success btn-sm" disabled={!canValidate || !!busy} onClick={() => act('approve', onApprove)}>
                {busy === 'approve' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Approve{corrected ? ' correction' : ''}
              </button>
              <button className="btn-secondary btn-sm" disabled={!canValidate || !!busy} onClick={() => { setValue(f.value); setEditing(true) }}><Pencil className="w-3.5 h-3.5" /> Edit</button>
              <button className="btn-danger btn-sm" disabled={!canValidate || !!busy} onClick={() => act('reject', () => onReject('Value could not be verified'))}>
                {busy === 'reject' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />} Reject
              </button>
            </div>
          )}
          {!canValidate && <div className="text-[11.5px] text-slate-500">Validation requires Geological Officer or Administrator role.</div>}
          {err && <div className="text-[12px] text-red-700">{err}</div>}
        </div>
      )}
    </div>
  )
}
