import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpenCheck, CheckCircle2, Cpu, FileSearch, GitCompareArrows, History, Lock, MessageSquareText, Quote, ShieldCheck, XCircle } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import AIChat from '../components/AIChat'
import { LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import type { AIAnswer } from '../types'
import { timeAgo } from '../utils/format'

export default function AIQueryPage() {
  const [params] = useSearchParams()
  const { can, user } = useAuth()
  const toast = useToast()
  const { data: suggestions } = useApi(api.aiSuggestions)
  const { data: history, reload: reloadHistory } = useApi(api.aiHistory)
  const [replay, setReplay] = useState<AIAnswer | null>(null)

  const open = async (id: number) => {
    try { setReplay(await api.aiHistoryItem(id)) } catch (e) { toast('error', 'Could not load query', (e as Error).message) }
  }

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="CoalMind AI Assistant"
        subtitle="Ask questions about verified geological, mining and production data."
        actions={<span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-600/20"><ShieldCheck className="w-3.5 h-3.5" /> Verified sources only</span>}
      />
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5 items-start">
        {suggestions ? <AIChat suggestions={suggestions} initialQuestion={params.get('q')} disabled={!can('query_ai')} onAnswered={() => reloadHistory(true)}
          replay={replay} storeKey={`cm.chat.${user!.id}`} />
          : <div className="card"><LoadingState /></div>}

        <aside className="space-y-5">
          <section className="card">
            <div className="card-header"><h3 className="card-title flex items-center gap-2"><History className="w-4 h-4 text-slate-500" /> Your query history</h3></div>
            {!history || history.length === 0 ? (
              <p className="px-4 py-5 text-[12.5px] text-slate-500">Questions you ask are saved to your own history — visible only to you.</p>
            ) : (
              <ul className="divide-y divide-slate-100 max-h-[320px] overflow-y-auto scrollbar-thin">
                {history.map((h) => (
                  <li key={h.id}>
                    <button onClick={() => open(h.id)} className="w-full text-left px-4 py-2.5 hover:bg-slate-50 flex gap-2">
                      {h.grounded ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />}
                      <span className="min-w-0">
                        <span className="block text-[12.5px] text-slate-700 line-clamp-2">{h.question}</span>
                        <span className="block text-[11px] text-slate-400 mt-0.5">{h.sources} source{h.sources !== 1 && 's'} · {timeAgo(h.created_at)}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section className="card p-4">
            <h3 className="card-title mb-3">How CoalMind answers</h3>
            <ol className="space-y-3 text-[12.5px]">
              {[
                { i: MessageSquareText, t: 'Understand', d: 'Detects mine, financial year, metric and intent.' },
                { i: FileSearch, t: 'Retrieve', d: 'Hybrid semantic search over your verified knowledge chunks.' },
                { i: BookOpenCheck, t: 'Ground', d: 'Uses validated structured records — never guesses figures.' },
                { i: GitCompareArrows, t: 'Cross-check', d: 'Consistency Guard compares every document that states the figure.' },
                { i: Quote, t: 'Cite', d: 'Links every answer to document, page and confidence.' },
              ].map(({ i: I, t, d }, n) => (
                <li key={t} className="flex gap-2.5">
                  <span className="light-scope w-7 h-7 rounded-md bg-ink-900 text-coal-400 grid place-items-center shrink-0"><I className="w-3.5 h-3.5" /></span>
                  <span><span className="font-semibold text-slate-800">{n + 1}. {t}</span><span className="block text-slate-500">{d}</span></span>
                </li>
              ))}
            </ol>
          </section>
          <section className="card p-4 text-[12px] space-y-2">
            <h3 className="card-title mb-1">Model & data boundary</h3>
            <div className="flex items-center gap-2 text-slate-600"><Cpu className="w-3.5 h-3.5 text-slate-400" /> Open-weight LLM (demo: deterministic composer)</div>
            <div className="flex items-center gap-2 text-slate-600"><Lock className="w-3.5 h-3.5 text-slate-400" /> No external API calls · on-premise</div>
            <div className="flex items-center gap-2 text-slate-600"><ShieldCheck className="w-3.5 h-3.5 text-slate-400" /> Unverified values are excluded</div>
          </section>
        </aside>
      </div>
    </div>
  )
}
