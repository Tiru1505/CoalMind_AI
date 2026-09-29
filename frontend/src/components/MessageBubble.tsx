import { useState } from 'react'
import { CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { AlertTriangle, Check, ChevronDown, Copy, Cpu, ShieldCheck, ThumbsDown, ThumbsUp, UserRound } from 'lucide-react'
import SourceCitation from './SourceCitation'
import Logo from './Logo'
import { api } from '../services/api'
import type { AIAnswer, Source } from '../types'
import { cx, fmtTime } from '../utils/format'
import { tooltipStyle } from '../utils/chart'

export type ChatMessage = { role: 'user'; text: string; at: string } | { role: 'assistant'; answer: AIAnswer }

export default function MessageBubble({ msg, onViewSource }: { msg: ChatMessage; onViewSource: (s: Source) => void }) {
  if (msg.role === 'user') {
    return (
      <div className="flex justify-end gap-3 animate-fade-in">
        <div className="max-w-[80%] rounded-lg rounded-tr-sm bg-brand-600 text-white px-4 py-2.5 text-[13.5px] shadow-sm">{msg.text}</div>
        <span className="w-8 h-8 rounded-full bg-slate-200 text-slate-600 grid place-items-center shrink-0"><UserRound className="w-4 h-4" /></span>
      </div>
    )
  }
  return <AssistantBubble a={msg.answer} onViewSource={onViewSource} />
}

function AssistantBubble({ a, onViewSource }: { a: AIAnswer; onViewSource: (s: Source) => void }) {
  const [open, setOpen] = useState(false)
  const [fb, setFb] = useState<'up' | 'down' | null>(null)
  const [copied, setCopied] = useState(false)
  const give = async (v: 'up' | 'down') => { setFb(v); try { await api.aiFeedback(a.id, v) } catch { /* non-critical */ } }

  return (
    <div className="flex gap-3 animate-fade-in">
      <span className="shrink-0 mt-0.5"><Logo size={32} /></span>
      <div className="flex-1 min-w-0 card p-0 overflow-hidden">
        <div className={cx('flex flex-wrap items-center gap-2 px-4 py-2 border-b text-[12px]', a.grounded ? 'bg-emerald-50/70 border-emerald-100' : 'bg-amber-50/70 border-amber-100')}>
          {a.grounded
            ? <span className="flex items-center gap-1.5 font-medium text-emerald-800"><ShieldCheck className="w-4 h-4" /> Grounded in verified organizational data</span>
            : <span className="flex items-center gap-1.5 font-medium text-amber-800"><AlertTriangle className="w-4 h-4" /> No verified source found</span>}
          <span className="text-slate-500 ml-auto">Sources retrieved: <b className="text-slate-700">{a.sources_count}</b> · {fmtTime(a.created_at)}</span>
        </div>

        <div className="px-4 py-3.5">
          <p className="text-[14px] leading-relaxed text-slate-800 whitespace-pre-line">{a.answer}</p>
          {!a.grounded && (
            <p className="text-[12.5px] text-slate-500 mt-2">CoalMind AI answers only from validated documents to avoid unsupported figures. Try naming a mine and financial year, or upload and validate the relevant report.</p>
          )}

          {a.facts && a.facts.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
              {a.facts.map((f) => (
                <div key={f.label} className="rounded-md bg-slate-50 border border-slate-200 px-3 py-2">
                  <div className="text-[11px] text-slate-500">{f.label}</div>
                  <div className="text-[14px] font-semibold text-slate-900 tabular-nums">{f.value}</div>
                </div>
              ))}
            </div>
          )}

          {a.chart && (
            <div className="h-[220px] mt-3 -ml-4">
              <ResponsiveContainer>
                <ComposedChart data={a.chart.data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke="#eef2f6" vertical={false} />
                  <XAxis dataKey="fy" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={['auto', 'auto']} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v} ${a.chart!.unit}`} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11.5 }} />
                  <Line type="monotone" dataKey="value" name={a.chart.label} stroke="#1e4e79" strokeWidth={2.5} dot={{ r: 3.5 }} />
                  {a.chart.data.some((d) => d.target != null) && <Line type="monotone" dataKey="target" name="Target" stroke="#94a3b8" strokeDasharray="5 4" dot={false} />}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {a.table && (
            <div className="mt-3 overflow-x-auto rounded-md border border-slate-200">
              <table className="w-full text-[12.5px]">
                <thead className="bg-slate-50"><tr>{a.table.headers.map((h) => <th key={h} className="text-left font-medium text-slate-600 px-3 py-2 border-b border-slate-200">{h}</th>)}</tr></thead>
                <tbody>
                  {a.table.rows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-100 last:border-0">
                      {r.map((c, j) => <td key={j} className={cx('px-3 py-1.5 tabular-nums', c === 'Exceeded' && 'text-emerald-700 font-medium', c === 'Below target' && 'text-amber-700 font-medium', r[0] === 'Total' && 'font-semibold')}>{c}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {a.sources.length > 0 && (
          <div className="px-4 pb-4">
            <div className="text-[12px] font-semibold text-slate-600 mb-2">Sources · {a.sources.length} supporting source{a.sources.length > 1 ? 's' : ''} found</div>
            <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-2.5">
              {a.sources.map((s, i) => <SourceCitation key={s.chunk_id} source={s} index={i + 1} onView={() => onViewSource(s)} />)}
            </div>
          </div>
        )}

        <div className="border-t border-slate-100 px-4 py-2 flex flex-wrap items-center gap-2">
          <button onClick={() => setOpen((o) => !o)} className="text-[12px] text-slate-500 hover:text-slate-700 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> How this answer was produced <ChevronDown className={cx('w-3.5 h-3.5 transition', open && 'rotate-180')} />
          </button>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => { navigator.clipboard?.writeText(a.answer); setCopied(true); setTimeout(() => setCopied(false), 1500) }} className="btn-ghost btn-sm !px-2" aria-label="Copy answer">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => give('up')} className={cx('btn-ghost btn-sm !px-2', fb === 'up' && 'text-emerald-600 bg-emerald-50')} aria-label="Helpful"><ThumbsUp className="w-3.5 h-3.5" /></button>
            <button onClick={() => give('down')} className={cx('btn-ghost btn-sm !px-2', fb === 'down' && 'text-red-600 bg-red-50')} aria-label="Not helpful"><ThumbsDown className="w-3.5 h-3.5" /></button>
          </div>
          {open && (
            <ol className="w-full mt-1 mb-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-[11.5px]">
              {[
                ['1 · Query understanding', `Intent: ${a.understanding.intent}${a.understanding.mines.length ? ` · Mine: ${a.understanding.mines.join(', ')}` : ''} · ${a.understanding.financial_year}${a.understanding.metric ? ` · Metric: ${a.understanding.metric}` : ''}`],
                ['2 · Retrieval', `Hybrid vector + metadata search over ${a.trust.chunks_searched} verified chunks · ${a.trust.embedding_model}`],
                ['3 · Grounding', a.grounded ? `Figures taken from verified structured records and cross-checked against ${a.sources_count} source(s)` : 'No passage met the evidence threshold — answer withheld'],
                ['4 · Generation', `${a.trust.llm} · ${a.trust.latency_ms} ms`],
              ].map(([t, d]) => (
                <li key={t} className="rounded-md bg-slate-50 border border-slate-200 px-2.5 py-2"><div className="font-semibold text-slate-700">{t}</div><div className="text-slate-500 mt-0.5">{d}</div></li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  )
}
