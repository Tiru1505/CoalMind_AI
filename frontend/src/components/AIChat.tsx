import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUp, Check, Loader2, Sparkles } from 'lucide-react'
import MessageBubble, { type ChatMessage } from './MessageBubble'
import SourceViewer, { type SourceRef } from './SourceViewer'
import Logo from './Logo'
import { api } from '../services/api'
import { useToast } from '../context/ToastContext'
import { cx } from '../utils/format'
import type { AIAnswer } from '../types'

const STEPS = ['Understanding the question', 'Retrieving verified sources', 'Cross-checking figures', 'Composing grounded answer']
export default function AIChat({ suggestions, initialQuestion, disabled, onAnswered, replay, storeKey }: {
  suggestions: string[]; initialQuestion?: string | null; disabled?: boolean; onAnswered?: () => void
  replay?: AIAnswer | null; storeKey: string
}) {
  const toast = useToast()
  const STORE = storeKey
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { return JSON.parse(sessionStorage.getItem(STORE) || '[]') } catch { return [] }
  })
  useEffect(() => {
    if (!replay) return
    setMessages((m) => (m.some((x) => x.role === 'assistant' && x.answer.id === replay.id) ? m
      : [...m, { role: 'user', text: replay.question, at: replay.created_at }, { role: 'assistant', answer: replay }]))
  }, [replay])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [step, setStep] = useState(0)
  const [source, setSource] = useState<SourceRef | null>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const asked = useRef(false)

  useEffect(() => { sessionStorage.setItem(STORE, JSON.stringify(messages.slice(-20))) }, [messages])
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [messages, busy])
  useEffect(() => {
    if (initialQuestion && !asked.current) { asked.current = true; ask(initialQuestion) }
  }, [initialQuestion]) // eslint-disable-line react-hooks/exhaustive-deps

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || busy || disabled) return
    if (question.length > 500) { toast('warning', 'Question too long', 'Please keep questions under 500 characters.'); return }
    setInput('')
    setMessages((m) => [...m, { role: 'user', text: question, at: new Date().toISOString() }])
    setBusy(true)
    setStep(0)
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 420)
    try {
      const [answer] = await Promise.all([api.aiQuery(question), new Promise((r) => setTimeout(r, 1700))])
      setMessages((m) => [...m, { role: 'assistant', answer }])
      onAnswered?.()
    } catch (e) {
      toast('error', 'AI query failed', (e as Error).message)
      setMessages((m) => m.slice(0, -1))
      setInput(question)
    } finally {
      clearInterval(timer)
      setBusy(false)
    }
  }

  const submit = (e: FormEvent) => { e.preventDefault(); ask(input) }

  return (
    <div className="card flex flex-col h-[calc(100vh-200px)] min-h-[560px] min-w-0">
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 sm:px-6 py-5 space-y-5">
        {messages.length === 0 && !busy && (
          <div className="max-w-3xl mx-auto pt-6">
            <div className="flex flex-col items-center text-center">
              <Logo size={46} />
              <h2 className="mt-3 text-[17px] font-semibold text-slate-900">Ask about verified mining data</h2>
              <p className="text-[13px] text-slate-500 mt-1 max-w-lg">Answers are generated only from validated documents and structured records. Every answer cites the document and page it came from.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-6">
              {suggestions.map((s) => (
                <button key={s} onClick={() => ask(s)} disabled={disabled}
                  className="text-left rounded-lg border border-slate-200 bg-white px-4 py-3 text-[13px] text-slate-700 hover:border-brand-300 hover:bg-brand-50/40 transition flex gap-2.5 disabled:opacity-50">
                  <Sparkles className="w-4 h-4 text-coal-600 shrink-0 mt-0.5" />{s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => <MessageBubble key={i} msg={m} onViewSource={(s) => setSource(s)} />)}
        {busy && (
          <div className="flex gap-3 animate-fade-in">
            <span className="shrink-0"><Logo size={32} /></span>
            <div className="card px-4 py-3 space-y-1.5 min-w-[280px]">
              {STEPS.map((s, i) => (
                <div key={s} className={cx('flex items-center gap-2 text-[12.5px] transition', i <= step ? 'text-slate-700' : 'text-slate-300')}>
                  {i < step ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : i === step ? <Loader2 className="w-3.5 h-3.5 animate-spin text-brand-600" /> : <span className="w-3.5 h-3.5 rounded-full border border-slate-300" />}
                  {s}…
                </div>
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="border-t border-slate-200 p-3 sm:p-4 bg-slate-50/50 rounded-b-lg">
        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-2.5 -mt-0.5">
            {suggestions.slice(0, 5).map((s) => (
              <button key={s} onClick={() => ask(s)} disabled={busy || disabled} className="chip bg-white ring-1 ring-slate-200 text-slate-600 hover:ring-brand-300 whitespace-nowrap disabled:opacity-50">{s}</button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-end gap-2">
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)} rows={1} disabled={disabled}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input) } }}
            placeholder={disabled ? 'Your role does not permit AI queries' : 'Ask about production, targets, reclamation, geology… (English or हिंदी)'}
            className="input !h-auto min-h-[44px] max-h-32 py-2.5 resize-none text-[13.5px]" aria-label="Ask a question"
          />
          <button className="btn-primary !h-11 !w-11 !px-0 shrink-0" disabled={busy || !input.trim() || disabled} aria-label="Send">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUp className="w-4 h-4" />}
          </button>
        </form>
        <div className="flex justify-between text-[11px] text-slate-400 mt-2 px-1">
          <span>AI can make mistakes — verify cited sources before official use.</span>
          {messages.length > 0 && <button onClick={() => setMessages([])} className="hover:text-slate-600">Clear conversation</button>}
        </div>
      </div>
      <SourceViewer source={source} onClose={() => setSource(null)} />
    </div>
  )
}
