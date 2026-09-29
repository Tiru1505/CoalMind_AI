import { useRef, useState, type DragEvent } from 'react'
import { AlertCircle, CheckCircle2, FileUp, Loader2, UploadCloud } from 'lucide-react'
import { api } from '../services/api'
import type { DocumentItem } from '../types'
import { cx } from '../utils/format'

const ALLOWED = ['pdf', 'docx', 'xlsx', 'jpg', 'jpeg', 'png']
const MAX_MB = 25

export default function DocumentUpload({ onUploaded, disabled }: { onUploaded: (d: DocumentItem) => void; disabled?: boolean }) {
  const input = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  const handle = async (file: File | undefined) => {
    if (!file || disabled) return
    setError(null)
    setDone(null)
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    if (!ALLOWED.includes(ext)) { setError(`“.${ext}” is not supported. Upload PDF, DOCX, XLSX, JPG or PNG files.`); return }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`File exceeds the ${MAX_MB} MB limit.`); return }
    setBusy(file.name)
    try {
      const doc = await api.upload(file)
      setDone(doc.filename)
      onUploaded(doc)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(null)
      if (input.current) input.current.value = ''
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    handle(e.dataTransfer.files?.[0])
  }

  return (
    <div>
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDrag(true) }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
        className={cx(
          'rounded-lg border-2 border-dashed px-6 py-7 flex flex-col sm:flex-row items-center gap-5 transition',
          drag ? 'border-brand-400 bg-brand-50/60' : 'border-slate-300 bg-slate-50/60',
          disabled && 'opacity-60',
        )}>
        <div className={cx('w-12 h-12 rounded-full grid place-items-center shrink-0', drag ? 'bg-brand-100 text-brand-700' : 'bg-white border border-slate-200 text-slate-500')}>
          {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
        </div>
        <div className="flex-1 text-center sm:text-left">
          <div className="text-[13.5px] font-semibold text-slate-800">{busy ? `Uploading ${busy}…` : 'Drag & drop a geological, mining or production record'}</div>
          <div className="text-[12.5px] text-slate-500 mt-0.5">PDF (digital or scanned), DOCX, XLSX, JPG, PNG · up to {MAX_MB} MB · Hindi & English supported</div>
          <div className="flex flex-wrap gap-1.5 mt-2 justify-center sm:justify-start">
            {['PDF', 'DOCX', 'XLSX', 'JPG', 'PNG'].map((t) => <span key={t} className="chip bg-white border border-slate-200 text-slate-600">{t}</span>)}
          </div>
        </div>
        <button className="btn-primary" disabled={!!busy || disabled} onClick={() => input.current?.click()}>
          <FileUp className="w-4 h-4" /> Upload Document
        </button>
        <input ref={input} type="file" className="hidden" accept=".pdf,.docx,.xlsx,.jpg,.jpeg,.png" onChange={(e) => handle(e.target.files?.[0])} />
      </div>
      {disabled && <p className="text-[12px] text-slate-500 mt-2">Your role has read-only access. Uploading requires Geological Officer or Administrator permissions.</p>}
      {error && (
        <div className="mt-3 flex gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-[12.5px] text-red-700" role="alert">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> <span><b>Upload rejected.</b> {error}</span>
        </div>
      )}
      {done && (
        <div className="mt-3 flex gap-2 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2.5 text-[12.5px] text-emerald-800">
          <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> <span><b>{done}</b> passed file validation (type, signature, size) and is ready for processing.</span>
        </div>
      )}
    </div>
  )
}
