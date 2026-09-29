/** TopicCard, WordCloud and TopicChart for the Topic Intelligence layer. */
import { useState } from 'react'
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowUpRight, ChevronRight, FileStack } from 'lucide-react'
import type { Topic } from '../types'
import { cx, fmtInt } from '../utils/format'
import { tooltipStyle } from '../utils/chart'

export function TopicCard({ topic, onClick, selected }: { topic: Topic; onClick: () => void; selected?: boolean }) {
  const years = Object.entries(topic.yearly)
  const max = Math.max(...years.map(([, v]) => v))
  return (
    <button onClick={onClick} className={cx('card text-left p-4 hover:border-brand-300 hover:shadow-pop transition group', selected && 'ring-2 ring-brand-200 border-brand-300')}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: topic.color }} />
          <span className="text-[14px] font-semibold text-slate-800">{topic.name}</span>
        </div>
        <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-brand-500" />
      </div>
      <div className="flex items-end justify-between mt-3">
        <div>
          <div className="text-[11.5px] text-slate-500 flex items-center gap-1"><FileStack className="w-3.5 h-3.5" /> Documents</div>
          <div className="text-[22px] font-semibold tabular-nums leading-tight">{fmtInt(topic.document_count)}</div>
          <div className="text-[12px] font-medium text-emerald-700 flex items-center"><ArrowUpRight className="w-3.5 h-3.5" /> +{topic.trend_pct}% <span className="text-slate-400 font-normal ml-1">YoY</span></div>
        </div>
        <div className="flex items-end gap-1 h-12" aria-hidden="true">
          {years.map(([y, v]) => <span key={y} className="w-2.5 rounded-t-sm" style={{ height: `${(v / max) * 100}%`, background: topic.color, opacity: 0.35 + 0.65 * (v / max) }} />)}
        </div>
      </div>
      <div className="flex flex-wrap gap-1 mt-3">
        {topic.keywords.slice(0, 3).map((k) => <span key={k.term} className="chip bg-slate-100 text-slate-600 !text-[11px]">{k.term}</span>)}
      </div>
    </button>
  )
}

const CLOUD_COLORS = ['#1e4e79', '#b45309', '#0f766e', '#6d28d9', '#b91c1c', '#15803d', '#2f6aa5', '#92400e']

export function WordCloud({ words, onPick }: { words: { term: string; weight: number }[]; onPick?: (t: string) => void }) {
  const [hover, setHover] = useState<string | null>(null)
  const sorted = [...words].sort((a, b) => b.weight - a.weight)
  const max = sorted[0]?.weight || 1
  const min = sorted[sorted.length - 1]?.weight || 0
  // centre-weighted arrangement: largest terms in the middle
  const arranged: typeof sorted = []
  sorted.forEach((w, i) => (i % 2 ? arranged.push(w) : arranged.unshift(w)))
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 px-4 py-6 min-h-[240px]" role="list" aria-label="Keyword cloud">
      {arranged.map((w, i) => {
        const t = (w.weight - min) / Math.max(1, max - min)
        const color = CLOUD_COLORS[i % CLOUD_COLORS.length]
        return (
          <button key={w.term} role="listitem" onClick={() => onPick?.(w.term)} onMouseEnter={() => setHover(w.term)} onMouseLeave={() => setHover(null)}
            title={`${w.term} · weight ${w.weight}`}
            className={cx('leading-none transition-all duration-200 rounded px-1', hover && hover !== w.term && 'opacity-30')}
            style={{ fontSize: `${12 + t * 30}px`, fontWeight: t > 0.6 ? 700 : t > 0.3 ? 600 : 500, color, opacity: 0.55 + t * 0.45 }}>
            {w.term}
          </button>
        )
      })}
    </div>
  )
}

export function TopicChart({ data, topics, highlight }: { data: Record<string, number | string>[]; topics: Topic[]; highlight?: string | null }) {
  return (
    <div className="h-[300px]">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="#eef2f6" vertical={false} />
          <XAxis dataKey="year" tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11.5, fill: '#64748b' }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
          {topics.map((t) => (
            <Line key={t.slug} type="monotone" dataKey={t.name} stroke={t.color} strokeWidth={highlight === t.name ? 3.5 : 2}
              strokeOpacity={highlight && highlight !== t.name ? 0.25 : 1} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
