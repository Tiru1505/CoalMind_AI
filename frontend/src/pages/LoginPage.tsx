import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, FileSearch, Loader2, Lock, MessageSquareText, ShieldCheck, UserRound, Workflow } from 'lucide-react'
import Logo from '../components/Logo'
import { useAuth } from '../context/AuthContext'

const DEMO = [
  { id: 'CMPDI001', pw: 'demo123', label: 'Geological Officer' },
  { id: 'ADMIN001', pw: 'admin123', label: 'Administrator' },
  { id: 'MGMT001', pw: 'demo123', label: 'Management' },
  { id: 'VIEW001', pw: 'demo123', label: 'Viewer' },
]

export default function LoginPage() {
  const { user, login, sessionExpired } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [emp, setEmp] = useState('')
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [remember, setRemember] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (user) return <Navigate to={(loc.state as { from?: string })?.from || '/dashboard'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!emp.trim() || !pw) { setErr('Please enter your Employee ID and password.'); return }
    setBusy(true)
    try {
      await login(emp.trim(), pw, remember)
      nav((loc.state as { from?: string })?.from || '/dashboard', { replace: true })
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.1fr_1fr] bg-white">
      {/* brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between bg-ink-900 text-white p-12 overflow-hidden">
        <svg className="absolute inset-x-0 bottom-0 w-full opacity-[.16]" viewBox="0 0 800 300" preserveAspectRatio="none" aria-hidden="true">
          <path d="M0 180 L140 140 L260 170 L420 110 L560 150 L800 90 L800 300 L0 300 Z" fill="#f59e0b" />
          <path d="M0 220 L160 190 L300 215 L450 170 L620 200 L800 160 L800 300 L0 300 Z" fill="#b45309" />
          <path d="M0 260 L180 240 L340 255 L500 225 L660 245 L800 220 L800 300 L0 300 Z" fill="#7c2d12" />
        </svg>
        <div className="relative flex items-center gap-3">
          <Logo size={42} />
          <div>
            <div className="text-[20px] font-semibold tracking-tight">CoalMind <span className="text-coal-400">AI</span></div>
            <div className="text-[12px] text-slate-400">CMPDI · Coal India Limited</div>
          </div>
        </div>
        <div className="relative max-w-lg">
          <h1 className="text-[34px] leading-tight font-semibold tracking-tight">From scattered mining records to verified, source-grounded intelligence.</h1>
          <p className="mt-4 text-slate-300 text-[14.5px] leading-relaxed">
            OCR extraction, human-in-the-loop validation, knowledge search, AI answers with citations and automated reporting — deployed on-premise.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-[13px]">
            {[
              { icon: FileSearch, t: 'Document Intelligence', d: 'Scanned PDFs, Excel MIS, Hindi & English' },
              { icon: ShieldCheck, t: 'Human-in-the-Loop', d: 'Officers validate low-confidence values' },
              { icon: MessageSquareText, t: 'Source-grounded AI', d: 'Every answer cites its source page' },
              { icon: Workflow, t: 'Full Traceability', d: 'Every figure traceable to a document' },
            ].map(({ icon: I, t, d }) => (
              <div key={t} className="rounded-lg bg-white/[.05] border border-white/10 p-3.5">
                <I className="w-4 h-4 text-coal-400 mb-2" />
                <div className="font-medium">{t}</div>
                <div className="text-slate-400 text-[12px] mt-0.5">{d}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative text-[11.5px] text-slate-500">Smart India Hackathon 2026 · Problem Statement 26023 · Smart Automation · Team Tubelights</div>
      </div>

      {/* form */}
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex items-center gap-3 mb-8"><Logo size={38} /><div className="text-[19px] font-semibold">CoalMind <span className="text-coal-600">AI</span></div></div>
          <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">CoalMind AI</h2>
          <p className="text-[13.5px] text-slate-500 mt-1">Intelligent Geological & Mining Reporting Platform</p>

          {sessionExpired && (
            <div className="mt-5 flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12.5px] text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> Your session has expired. Please sign in again.
            </div>
          )}

          <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
            <div>
              <label className="label" htmlFor="emp">Employee ID</label>
              <div className="relative">
                <UserRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input id="emp" className="input !h-10 pl-9 uppercase placeholder:normal-case" placeholder="e.g. CMPDI001" autoComplete="username"
                  value={emp} onChange={(e) => setEmp(e.target.value)} autoFocus />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="pw">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input id="pw" type={show ? 'text' : 'password'} className="input !h-10 pl-9 pr-10" placeholder="Enter password" autoComplete="current-password"
                  value={pw} onChange={(e) => setPw(e.target.value)} />
                <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600" aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                Remember me
              </label>
              <span className="text-[12.5px] text-slate-400" title="Contact your system administrator">Forgot password?</span>
            </div>
            {err && (
              <div className="flex gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-[12.5px] text-red-700" role="alert">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {err}
              </div>
            )}
            <button type="submit" disabled={busy} className="btn-primary w-full !h-10 text-[14px]">
              {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : 'Sign In'}
            </button>
          </form>

          <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure enterprise environment · On-premise deployment
          </div>

          <div className="mt-8 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Demo credentials</div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO.map((d) => (
                <button key={d.id} type="button" onClick={() => { setEmp(d.id); setPw(d.pw); setErr(null) }}
                  className="text-left rounded-md bg-white border border-slate-200 px-3 py-2 hover:border-brand-300 hover:bg-brand-50/40 transition">
                  <div className="text-[12.5px] font-medium text-slate-800">{d.label}</div>
                  <div className="text-[11.5px] text-slate-500 font-mono">{d.id} / {d.pw}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
