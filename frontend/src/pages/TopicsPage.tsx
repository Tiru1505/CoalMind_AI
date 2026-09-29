import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Info } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import ChartCard from '../components/ChartCard'
import { TopicCard, TopicChart, WordCloud } from '../components/TopicComponents'
import { ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { cx } from '../utils/format'

export default function TopicsPage() {
  const nav = useNavigate()
  const { data, error, loading, reload } = useApi(api.topics)
  const [focus, setFocus] = useState<string | null>(null)

  if (loading && !data) return <LoadingState label="Analysing topics…" />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />

  const trendTopics = data.topics.filter((t) => ['production-output', 'environment', 'safety-compliance', 'geological-exploration', 'land-reclamation'].includes(t.slug))

  return (
    <div className="animate-fade-in">
      <PageHeader title="Topic Intelligence" subtitle="Discover emerging themes, keywords and trends across organizational documents." />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-5">
        {data.topics.map((t) => <TopicCard key={t.slug} topic={t} onClick={() => nav(`/topics/${t.slug}`)} />)}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1fr] gap-5">
        <ChartCard title="Keyword Landscape" subtitle="Term prominence across indexed documents · click a term to search the Knowledge Base">
          <div className="rounded-lg bg-gradient-to-b from-slate-50 to-transparent border border-slate-100">
            <WordCloud words={data.keywords} onPick={(t) => nav(`/knowledge?q=${encodeURIComponent(t)}`)} />
          </div>
        </ChartCard>
        <ChartCard title="Topic Frequency Over Time" subtitle="Documents per topic by calendar year · click a topic to focus">
          <div className="flex flex-wrap gap-1.5 mb-2">
            {trendTopics.map((t) => (
              <button key={t.slug} onClick={() => setFocus((f) => (f === t.name ? null : t.name))}
                className={cx('chip ring-1 ring-inset !text-[11px]', focus === t.name ? 'text-white ring-transparent' : 'bg-white text-slate-600 ring-slate-200 hover:ring-slate-300')}
                style={focus === t.name ? { background: t.color } : undefined}>
                <span className="w-2 h-2 rounded-full" style={{ background: focus === t.name ? '#fff' : t.color }} />{t.name}
              </button>
            ))}
          </div>
          <TopicChart data={data.trend} topics={trendTopics} highlight={focus} />
        </ChartCard>
      </div>
      <p className="mt-4 text-[11.5px] text-slate-400 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> {data.model}. Production deployment: BERTopic over Sentence-BERT embeddings, refreshed nightly.</p>
    </div>
  )
}
