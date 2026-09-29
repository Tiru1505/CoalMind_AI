import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, XAxis, YAxis } from 'recharts'
import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react'
import Logo from './Logo'
import type { ReportItem } from '../types'
import { cx, fmtDateTime } from '../utils/format'

export default function ReportPreview({ report, onCite }: { report: ReportItem; onCite?: (ref: number) => void }) {
  const c = report.content!
  const h = c.header
  const approved = report.status === 'Approved'
  return (
    <article id="print-area" className="paper rounded-sm px-8 sm:px-12 py-10 text-slate-800 max-w-[900px] mx-auto">
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink-900 pb-4">
        <div className="flex items-center gap-3">
          <Logo size={40} />
          <div>
            <div className="text-[17px] font-semibold tracking-tight text-ink-900">CoalMind AI</div>
            <div className="text-[12px] text-slate-500">{h.title}</div>
          </div>
        </div>
        <div className="text-right text-[11px] text-slate-500 leading-relaxed">
          <div className="font-mono">{h.report_no}</div>
          <div>{fmtDateTime(h.generated_on)}</div>
          <div className="uppercase tracking-wider">{h.classification}</div>
        </div>
      </header>

      <div className="mt-6">
        <div className="text-[11px] uppercase tracking-[.14em] text-coal-700 font-semibold">{h.report_type}</div>
        <h1 className="font-serif text-[26px] leading-tight font-bold text-ink-900 mt-1">{h.subject}</h1>
        <div className="font-serif text-[16px] text-slate-600">{h.period}</div>
        <div className="text-[12px] text-slate-500 mt-2">Prepared by {h.prepared_by} · Generated with CoalMind AI Report Studio</div>
      </div>

      <div className={cx('mt-5 rounded-md border px-4 py-2.5 text-[12.5px] flex items-start gap-2', approved ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : 'border-amber-300 bg-amber-50 text-amber-900')}>
        {approved ? <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />}
        <div><b>{approved ? `Approved for official use by ${report.approved_by}.` : c.disclaimer}</b><div className="text-[11.5px] opacity-80 mt-0.5">{h.sample_data_note}</div></div>
      </div>

      {c.sections.map((s, idx) => (
        <section key={s.id} className="mt-7 break-inside-avoid">
          <h2 className="font-serif text-[17px] font-bold text-ink-900 border-b border-slate-300 pb-1 mb-3 flex items-baseline gap-2">
            <span className="text-slate-400 text-[14px]">{idx + 1}.</span> {s.title}
            {s.cites.map((r) => (
              <button key={r} onClick={() => onCite?.(r)} className="text-[11px] font-sans font-semibold text-brand-600 hover:underline align-super" title="View source">[{r}]</button>
            ))}
          </h2>
          {s.paragraphs?.map((p, i) => <p key={i} className="font-serif text-[14px] leading-relaxed mb-2.5">{p}</p>)}
          {s.bullets && <ul className="list-disc pl-5 font-serif text-[14px] leading-relaxed space-y-1.5">{s.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>}
          {s.facts && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
              {s.facts.map((f) => <div key={f.label} className="border border-slate-300 rounded px-3 py-2"><div className="text-[11px] text-slate-500">{f.label}</div><div className="font-semibold text-[14px]">{f.value}</div></div>)}
            </div>
          )}
          {s.table && (
            <div className="mt-2 overflow-x-auto">
              {s.table.caption && <div className="text-[12px] font-semibold text-slate-600 mb-1">{s.table.caption}</div>}
              <table className="w-full text-[12.5px] border border-slate-400">
                <thead><tr>{s.table.headers.map((x) => <th key={x} className="border border-slate-400 bg-slate-100 px-2 py-1.5 text-left font-semibold">{x}</th>)}</tr></thead>
                <tbody>{s.table.rows.map((r, i) => <tr key={i} className={cx(r[0] === 'Total' && 'font-semibold bg-slate-50')}>{r.map((x, j) => <td key={j} className="border border-slate-300 px-2 py-1.5 tabular-nums">{x}</td>)}</tr>)}</tbody>
              </table>
            </div>
          )}
          {s.chart && (
            <div className="h-[200px] mt-4">
              <ResponsiveContainer>
                <BarChart data={s.chart.data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="fy" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="production" name="Production (MT)" fill="#1e4e79" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                  <Bar dataKey="target" name="Target (MT)" fill="#cbd5e1" radius={[3, 3, 0, 0]} maxBarSize={28} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      ))}

      <section className="mt-7 break-inside-avoid">
        <h2 className="font-serif text-[17px] font-bold text-ink-900 border-b border-slate-300 pb-1 mb-3">Key Statistics</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {c.key_statistics.map((k) => (
            <div key={k.label} className="border-l-4 border-coal-500 bg-slate-50 px-3 py-2">
              <div className="text-[11px] text-slate-500 uppercase tracking-wide">{k.label}</div><div className="text-[18px] font-semibold text-ink-900">{k.value}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 break-inside-avoid">
        <h2 className="font-serif text-[17px] font-bold text-ink-900 border-b border-slate-300 pb-1 mb-3">Validation Checks</h2>
        <ul className="space-y-1 text-[12.5px]">
          {c.validation_checks.map((v) => (
            <li key={v.check} className="flex items-start gap-2">
              {v.status === 'pass' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />}{v.check}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-7 break-inside-avoid">
        <h2 className="font-serif text-[17px] font-bold text-ink-900 border-b border-slate-300 pb-1 mb-3">Source References</h2>
        <ol className="text-[12.5px] space-y-1.5">
          {c.references.map((r) => (
            <li key={r.ref} className="flex gap-2">
              <button onClick={() => onCite?.(r.ref)} className="font-semibold text-brand-600 hover:underline shrink-0">[{r.ref}]</button>
              <span>{r.document_title}, page {r.page} — {r.section} <span className="text-slate-500">({r.status})</span><span className="block font-mono text-[11px] text-slate-400">{r.filename}</span></span>
            </li>
          ))}
        </ol>
      </section>

      <footer className="mt-10 grid grid-cols-2 gap-8 text-[12px] text-slate-600">
        <div><div className="border-t border-slate-400 pt-1.5">Prepared by: {h.prepared_by}</div></div>
        <div><div className="border-t border-slate-400 pt-1.5">Reviewed & approved by: {approved ? report.approved_by : '______________________'}</div></div>
      </footer>
    </article>
  )
}
