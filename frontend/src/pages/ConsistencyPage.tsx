/** Consistency Guard — CoalMind AI's star feature: cross-source reconciliation of official figures. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertOctagon, AlertTriangle, ArrowRight, CheckCircle2, ChevronDown, Eye, FileStack, GitCompareArrows, Layers, Loader2, Scale, ShieldCheck, Sparkles,
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import SourceViewer, { type SourceRef } from '../components/SourceViewer'
import { EmptyState, ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { useShellRefresh } from '../layouts/AppLayout'
import type { FigureCheck } from '../types'
import { cx, timeAgo } from '../utils/format'

export function ScoreRing({ score, size = 132 }: { score: number; size?: number }) {
  const r = size / 2 - 10
  const c = 2 * Math.PI * r
  const tone = score >= 95 ? '#15803d' : score >= 85 ? '#d97706' : '#dc2626'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Consistency score ${score}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-slate-200" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} style={{ transition: 'stroke-dasharray .6s ease' }} />
      <text x="50%" y="48%" textAnchor="middle" className="fill-slate-900" style={{ fontSize: size / 5, fontWeight: 700 }}>{score}%</text>
      <text x="50%" y="64%" textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10.5 }}>consistent</text>
    </svg>
  )
}

export default function ConsistencyPage() {
  const { data, error, loading, reload } = useApi(api.consistency)
  const [source, setSource] = useState<SourceRef | null>(null)
  const [showAgree, setShowAgree] = useState(false)

  if (loading && !data) return <LoadingState label="Cross-checking figures across documents…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  return (
    <div className="animate-fade-in">
      <PageHeader
        eyebrow={<span className="chip bg-coal-50 text-coal-700 ring-1 ring-inset ring-coal-600/25"><Sparkles className="w-3 h-3" /> Star feature</span>}
        title="Consistency Guard"
        subtitle="Before a figure reaches a Parliament reply or Ministry brief, CoalMind checks it against every document that reports it — and flags disagreements for an officer to resolve."
      />

      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-5 mb-5">
        <section className="card p-5 flex items-center gap-5">
          <ScoreRing score={data.score} />
          <div className="text-[12.5px] text-slate-600 space-y-1.5">
            <div className="text-[13.5px] font-semibold text-slate-800">Consistency score</div>
            <div><b className="text-slate-800">{data.agree_count + data.resolved_count}</b> of {data.cross_checked} cross-checked figures agree or are resolved</div>
            <div className={cx('font-medium', data.open_conflicts ? 'text-red-700' : 'text-emerald-700')}>
              {data.open_conflicts ? `${data.open_conflicts} open conflict${data.open_conflicts > 1 ? 's' : ''} need a decision` : 'No open conflicts'}
            </div>
          </div>
        </section>
        <section className="card p-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              { i: Layers, l: 'Figures tracked', v: data.figures_checked },
              { i: GitCompareArrows, l: 'Cross-checked', v: data.cross_checked },
              { i: FileStack, l: 'Statements compared', v: data.statements },
              { i: AlertOctagon, l: 'High severity', v: data.high_severity, tone: data.high_severity ? 'text-red-700' : '' },
              { i: ShieldCheck, l: 'Resolved by officers', v: data.resolved_count },
            ].map(({ i: I, l, v, tone }) => (
              <div key={l}>
                <div className="text-[11.5px] text-slate-500 flex items-center gap-1.5"><I className="w-3.5 h-3.5" /> {l}</div>
                <div className={cx('text-[22px] font-semibold tabular-nums mt-1 text-slate-900', tone)}>{v}</div>
              </div>
            ))}
          </div>
          <ol className="mt-5 grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11.5px]">
            {[
              ['1 · Register', 'Every processed document registers the figures it states'],
              ['2 · Group', 'Figures grouped by mine × financial year × metric'],
              ['3 · Detect', 'Values clustered; disagreements ranked by severity'],
              ['4 · Resolve', 'Officer confirms the authoritative value — answers & reports update'],
            ].map(([t, d]) => (
              <li key={t} className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2"><div className="font-semibold text-slate-700">{t}</div><div className="text-slate-500">{d}</div></li>
            ))}
          </ol>
        </section>
      </div>

      <h2 className="text-[15px] font-semibold text-slate-800 mb-3 flex items-center gap-2">
        Open conflicts <span className="chip bg-slate-100 text-slate-600">{data.conflicts.length}</span>
      </h2>
      {data.conflicts.length === 0 ? (
        <div className="card mb-5"><EmptyState icon={CheckCircle2} title="Every cross-checked figure agrees" body="No document in your workspace contradicts another. New documents are checked automatically when processed." /></div>
      ) : (
        <div className="space-y-4 mb-6">
          {data.conflicts.map((c) => <ConflictCard key={c.key} c={c} onView={setSource} onResolved={reload} />)}
        </div>
      )}

      {data.resolved.length > 0 && (
        <>
          <h2 className="text-[15px] font-semibold text-slate-800 mb-3">Resolved by officers</h2>
          <div className="card mb-6 divide-y divide-slate-100">
            {data.resolved.map((c) => (
              <div key={c.key} className="px-5 py-3 flex flex-wrap items-center gap-3 text-[13px]">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span className="font-medium text-slate-800">{c.label} · {c.mine} · FY {c.financial_year}</span>
                <span className="chip bg-emerald-50 text-emerald-700">{c.resolution?.display} confirmed</span>
                <span className="text-slate-500 flex-1 min-w-[200px] truncate" title={c.resolution?.reason}>“{c.resolution?.reason}”</span>
                <span className="text-[12px] text-slate-400">{c.resolution?.user} · {c.resolution && timeAgo(c.resolution.timestamp)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      <section className="card">
        <button onClick={() => setShowAgree((s) => !s)} className="card-header w-full text-left">
          <div>
            <h3 className="card-title">Figures where all sources agree ({data.agree_count})</h3>
            <p className="text-[12px] text-slate-500">Verified by at least two independent documents</p>
          </div>
          <ChevronDown className={cx('w-4 h-4 text-slate-400 transition', showAgree && 'rotate-180')} />
        </button>
        {showAgree && (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead><tr><th>Figure</th><th>Mine</th><th>FY</th><th className="text-right">Value</th><th className="text-right">Sources</th><th /></tr></thead>
              <tbody>
                {data.agreements.map((a) => (
                  <tr key={a.key}>
                    <td className="font-medium">{a.label}</td><td>{a.mine}</td><td className="tabular-nums">FY {a.financial_year}</td>
                    <td className="text-right tabular-nums font-semibold">{a.consensus_display}</td>
                    <td className="text-right tabular-nums">{a.source_count}</td>
                    <td className="text-right"><span className="chip bg-emerald-50 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Agree</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <SourceViewer source={source} onClose={() => setSource(null)} />
    </div>
  )
}

function ConflictCard({ c, onView, onResolved }: { c: FigureCheck; onView: (s: SourceRef) => void; onResolved: () => void }) {
  const { can } = useAuth()
  const toast = useToast()
  const refreshShell = useShellRefresh()
  const [choice, setChoice] = useState(0)
  const [reason, setReason] = useState(c.recommended.reason.replace(/\.$/, ''))
  const [busy, setBusy] = useState(false)
  const high = c.severity === 'high'

  const resolve = async () => {
    setBusy(true)
    try {
      const cl = c.clusters[choice]
      await api.resolveFigure({ key: c.key, value: cl.value, reason, document_id: cl.sources[0]?.document_id })
      toast('success', 'Conflict resolved', `${c.label} for ${c.mine} set to ${cl.display}. Verified records, AI answers and reports now use it.`)
      refreshShell()
      onResolved()
    } catch (e) {
      toast('error', 'Could not resolve', (e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={cx('card overflow-hidden', high ? 'border-red-200' : 'border-amber-200')}>
      <div className={cx('px-5 py-3 flex flex-wrap items-center gap-3 border-b', high ? 'bg-red-50/60 border-red-100' : 'bg-amber-50/60 border-amber-100')}>
        {high ? <AlertOctagon className="w-5 h-5 text-red-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
        <div className="flex-1 min-w-[220px]">
          <div className="text-[14px] font-semibold text-slate-900">{c.label} · {c.mine} · FY {c.financial_year}</div>
          <div className={cx('text-[12px]', high ? 'text-red-700' : 'text-amber-800')}>
            {high ? 'High severity — final (non-provisional) documents state different values' : 'Low severity — only a provisional return differs from final figures'}
          </div>
        </div>
        <span className="chip bg-white ring-1 ring-slate-200 text-slate-600">{c.source_count} documents · {c.clusters.length} different values</span>
      </div>

      <div className="p-5 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">
        <div className={cx('grid gap-3', c.clusters.length > 2 ? 'md:grid-cols-3' : 'md:grid-cols-2')}>
          {c.clusters.map((cl, i) => (
            <label key={i} className={cx('rounded-lg border p-3.5 cursor-pointer transition relative', choice === i ? 'border-brand-500 ring-2 ring-brand-100 bg-brand-50/40' : 'border-slate-200 hover:border-slate-300')}>
              <input type="radio" name={c.key} className="sr-only" checked={choice === i} onChange={() => setChoice(i)} />
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[22px] font-semibold tabular-nums text-slate-900 leading-tight">{cl.display}</div>
                  <div className="text-[11.5px] text-slate-500">stated by {cl.sources.length} document{cl.sources.length > 1 ? 's' : ''}</div>
                </div>
                {i === 0 && <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><Scale className="w-3 h-3" /> Recommended</span>}
              </div>
              <ul className="mt-3 space-y-2">
                {cl.sources.map((s) => (
                  <li key={s.fact_id} className="text-[12px] rounded-md bg-white border border-slate-200 px-2.5 py-2">
                    <div className="font-medium text-slate-800 leading-snug">{s.title}</div>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      <span className="text-slate-500">p.{s.page}</span>
                      {s.category === 'Production Report' && <span className="chip !py-0 bg-brand-50 text-brand-700">Primary source</span>}
                      {s.provisional && <span className="chip !py-0 bg-amber-50 text-amber-800">Provisional</span>}
                      {s.doc_status === 'Approved' && <span className="chip !py-0 bg-emerald-50 text-emerald-700">Human validated</span>}
                      <button type="button" onClick={(e) => { e.preventDefault(); onView({ document_id: s.document_id, page: s.page, snippet: s.snippet }) }}
                        className="ml-auto text-brand-600 hover:underline flex items-center gap-1"><Eye className="w-3 h-3" /> View</button>
                    </div>
                  </li>
                ))}
              </ul>
            </label>
          ))}
        </div>

        <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 flex flex-col gap-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">AI recommendation</div>
            <div className="text-[13px] text-slate-700 mt-1"><b>{c.recommended.display}</b> — {c.recommended.reason}</div>
          </div>
          <label className="block">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Reason for decision</span>
            <textarea className="input !h-auto py-2 mt-1 text-[12.5px]" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <button className="btn-primary" disabled={busy || !can('resolve_conflicts') || reason.trim().length < 5} onClick={resolve}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Confirm {c.clusters[choice].display} as authoritative
          </button>
          {!can('resolve_conflicts') && <p className="text-[11.5px] text-slate-500">Your role can review but not resolve conflicts.</p>}
          <Link to="/audit" className="text-[11.5px] text-slate-500 hover:text-brand-600 flex items-center gap-1">Decision is recorded in your audit trail <ArrowRight className="w-3 h-3" /></Link>
        </div>
      </div>
    </section>
  )
}
