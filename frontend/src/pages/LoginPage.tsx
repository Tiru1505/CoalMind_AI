import { useEffect, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import {
  AlertCircle, ArrowLeft, BarChart3, Eye, FileSearch, HardHat, KeyRound, Loader2, MessageSquareText, MessageSquareDot, Phone, ShieldCheck,
  ShieldHalf, UserPlus, Workflow,
} from 'lucide-react'
import Logo from '../components/Logo'
import ThemeToggle from '../components/ThemeToggle'
import { api } from '../services/api'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types'
import { cx, ROLE_LABEL } from '../utils/format'

const ROLES: { id: Role; title: string; desc: string; icon: typeof HardHat }[] = [
  { id: 'geological_officer', title: 'Geological Officer', desc: 'Upload, validate, query & report', icon: HardHat },
  { id: 'management', title: 'Management', desc: 'Executive dashboards & approvals', icon: BarChart3 },
  { id: 'admin', title: 'Administrator', desc: 'Users, system health & audit', icon: ShieldHalf },
  { id: 'viewer', title: 'Viewer', desc: 'Read-only dashboards & reports', icon: Eye },
]

type Step = 'details' | 'otp'

export default function LoginPage() {
  const { user, completeLogin, sessionExpired } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const [step, setStep] = useState<Step>('details')
  const [role, setRole] = useState<Role | null>(null)
  const [mobile, setMobile] = useState('')
  const [remember, setRemember] = useState(true)
  const [otp, setOtp] = useState<string[]>(Array(6).fill(''))
  const [name, setName] = useState('')
  const [dept, setDept] = useState('')
  const [info, setInfo] = useState<{ masked: string; isNew: boolean; demoOtp?: string; existingName: string | null } | null>(null)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [resendIn, setResendIn] = useState(0)
  const [expiresIn, setExpiresIn] = useState(0)
  const [demo, setDemo] = useState<{ mobile: string; name: string; role: string }[]>([])
  const boxes = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => { api.demoAccounts().then(setDemo).catch(() => {}) }, [])
  useEffect(() => {
    if (step !== 'otp') return
    const t = setInterval(() => { setResendIn((s) => Math.max(0, s - 1)); setExpiresIn((s) => Math.max(0, s - 1)) }, 1000)
    return () => clearInterval(t)
  }, [step])

  if (user) return <Navigate to={(loc.state as { from?: string })?.from || user.dashboard} replace />

  const digits = mobile.replace(/\D/g, '')
  const mobileValid = /^[6-9]\d{9}$/.test(digits)

  const sendOtp = async (e?: FormEvent) => {
    e?.preventDefault()
    setErr(null)
    if (!role) { setErr('Select your role to continue.'); return }
    if (!mobileValid) { setErr('Enter a valid 10-digit mobile number starting with 6, 7, 8 or 9.'); return }
    setBusy(true)
    try {
      const r = await api.requestOtp(digits, role)
      setInfo({ masked: r.mobile, isNew: r.is_new_user, demoOtp: r.demo_otp, existingName: r.name })
      setOtp(Array(6).fill(''))
      setResendIn(r.resend_in)
      setExpiresIn(r.expires_in)
      setStep('otp')
      setTimeout(() => boxes.current[0]?.focus(), 50)
    } catch (e2) {
      setErr((e2 as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const verify = async (e?: FormEvent, codeOverride?: string) => {
    e?.preventDefault()
    setErr(null)
    const code = codeOverride ?? otp.join('')
    if (code.length !== 6) { setErr('Enter the 6-digit OTP.'); return }
    if (info?.isNew && name.trim().length < 2) { setErr('Enter your full name to create your account.'); return }
    setBusy(true)
    try {
      const r = await api.verifyOtp({ mobile: digits, role: role!, otp: code, name: info?.isNew ? name.trim() : undefined, department: dept.trim() || undefined })
      completeLogin(r.token, r.user, remember)
      if (r.created) sessionStorage.setItem('cm.flash', `Welcome, ${r.user.name}! Your personal workspace has been created with the sample dataset.`)
      nav(r.redirect, { replace: true })
    } catch (e2) {
      setErr((e2 as Error).message)
      setOtp(Array(6).fill(''))
      boxes.current[0]?.focus()
    } finally {
      setBusy(false)
    }
  }

  const setDigit = (i: number, v: string) => {
    const d = v.replace(/\D/g, '').slice(-1)
    const next = [...otp]
    next[i] = d
    setOtp(next)
    if (d && i < 5) boxes.current[i + 1]?.focus()
    if (d && i === 5 && next.every(Boolean) && !info?.isNew) verify(undefined, next.join(''))
  }
  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[i] && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowLeft' && i > 0) boxes.current[i - 1]?.focus()
    if (e.key === 'ArrowRight' && i < 5) boxes.current[i + 1]?.focus()
  }
  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (d.length) {
      e.preventDefault()
      setOtp([...d.padEnd(6, ' ')].map((c) => c.trim()))
      boxes.current[Math.min(d.length, 5)]?.focus()
    }
  }
  const autofill = () => {
    if (!info?.demoOtp) return
    setOtp(info.demoOtp.split(''))
    if (!info.isNew) verify(undefined, info.demoOtp)
  }
  const mmss = `${Math.floor(expiresIn / 60)}:${String(expiresIn % 60).padStart(2, '0')}`

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-white">
      {/* brand panel */}
      <div className="light-scope relative hidden lg:flex flex-col justify-between bg-ink-900 text-white p-12 overflow-hidden">
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
            OCR extraction, human-in-the-loop validation, cross-source consistency checks, AI answers with citations and automated reporting — deployed on-premise.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 text-[13px]">
            {[
              { icon: FileSearch, t: 'Document Intelligence', d: 'Scanned PDFs, Excel MIS, Hindi & English' },
              { icon: ShieldCheck, t: 'Consistency Guard', d: 'Every figure cross-checked across sources' },
              { icon: MessageSquareText, t: 'Source-grounded AI', d: 'Every answer cites its source page' },
              { icon: Workflow, t: 'Full Traceability', d: 'Every figure traceable to a document' },
            ].map(({ icon: I, t, d }) => (
              <div key={t} className="rounded-lg bg-[rgba(255,255,255,.05)] border border-white/10 p-3.5">
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
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <ThemeToggle className="absolute top-4 right-4" />
        <div className="w-full max-w-[440px]">
          <div className="lg:hidden flex items-center gap-3 mb-8"><Logo size={38} /><div className="text-[19px] font-semibold text-slate-900">CoalMind <span className="text-coal-600">AI</span></div></div>
          <h2 className="text-[24px] font-semibold tracking-tight text-slate-900">Sign in to CoalMind AI</h2>
          <p className="text-[13.5px] text-slate-500 mt-1">Intelligent Geological & Mining Reporting Platform</p>

          <ol className="flex items-center gap-2 mt-5 text-[12px]" aria-label="Sign-in steps">
            {[['details', '1', 'Role & mobile'], ['otp', '2', 'Verify OTP']].map(([k, n, l], i) => (
              <li key={k} className="flex items-center gap-2">
                {i > 0 && <span className="w-8 h-px bg-slate-300" />}
                <span className={cx('w-5 h-5 rounded-full grid place-items-center text-[11px] font-semibold',
                  step === k ? 'bg-brand-600 text-white' : step === 'otp' && k === 'details' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500')}>{n}</span>
                <span className={cx(step === k ? 'text-slate-800 font-medium' : 'text-slate-500')}>{l}</span>
              </li>
            ))}
          </ol>

          {sessionExpired && (
            <div className="mt-5 flex gap-2 rounded-md bg-amber-50 border border-amber-200 px-3 py-2.5 text-[12.5px] text-amber-800">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> Your session has expired. Please sign in again.
            </div>
          )}

          {step === 'details' ? (
            <form onSubmit={sendOtp} className="mt-5 space-y-5" noValidate>
              <fieldset>
                <legend className="label">Select your role</legend>
                <div className="grid grid-cols-2 gap-2.5" role="radiogroup">
                  {ROLES.map(({ id, title, desc, icon: I }) => (
                    <button key={id} type="button" role="radio" aria-checked={role === id} onClick={() => { setRole(id); setErr(null) }}
                      className={cx('text-left rounded-lg border p-3 transition relative',
                        role === id ? 'border-brand-500 ring-2 ring-brand-200 bg-brand-50/60' : 'border-slate-200 hover:border-slate-300 bg-white')}>
                      <span className={cx('w-8 h-8 rounded-md grid place-items-center mb-2', role === id ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600')}><I className="w-4 h-4" /></span>
                      <span className="block text-[13px] font-semibold text-slate-800">{title}</span>
                      <span className="block text-[11.5px] text-slate-500 leading-snug mt-0.5">{desc}</span>
                    </button>
                  ))}
                </div>
              </fieldset>
              <div>
                <label className="label" htmlFor="mobile">Mobile number</label>
                <div className="flex">
                  <span className="inline-flex items-center gap-1.5 px-3 rounded-l-md border border-r-0 border-slate-300 bg-slate-50 text-[13px] text-slate-600"><Phone className="w-3.5 h-3.5" />+91</span>
                  <input id="mobile" inputMode="numeric" autoComplete="tel-national" className="input !h-10 !rounded-l-none tracking-wide text-[14px]"
                    placeholder="98765 43210" maxLength={11} value={mobile}
                    onChange={(e) => { const d = e.target.value.replace(/\D/g, '').slice(0, 10); setMobile(d.length > 5 ? `${d.slice(0, 5)} ${d.slice(5)}` : d); setErr(null) }} />
                </div>
                <p className="text-[11.5px] text-slate-500 mt-1.5">New number? An account with the selected role is created after OTP verification.</p>
              </div>
              <label className="flex items-center gap-2 text-[13px] text-slate-600 cursor-pointer select-none">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-brand-600" />
                Keep me signed in on this device
              </label>
              {err && <ErrorBox msg={err} />}
              <button type="submit" disabled={busy} className="btn-primary w-full !h-10 text-[14px]">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending OTP…</> : <><MessageSquareDot className="w-4 h-4" /> Send OTP</>}
              </button>
            </form>
          ) : (
            <form onSubmit={verify} className="mt-5 space-y-5" noValidate>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3 flex items-center gap-3 text-[13px]">
                <span className="w-8 h-8 rounded-md bg-brand-600 text-white grid place-items-center shrink-0">{(() => { const R = ROLES.find((r) => r.id === role)!; return <R.icon className="w-4 h-4" /> })()}</span>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-slate-800">{info?.existingName || 'New account'} · {ROLE_LABEL[role!]}</div>
                  <div className="text-slate-500 text-[12px]">OTP sent to {info?.masked}</div>
                </div>
                <button type="button" className="text-[12px] text-brand-600 hover:underline flex items-center gap-1" onClick={() => { setStep('details'); setErr(null) }}><ArrowLeft className="w-3 h-3" /> Change</button>
              </div>

              {info?.demoOtp && (
                <div className="rounded-lg border border-dashed border-coal-400 bg-coal-50 px-3.5 py-3 text-[12.5px] text-coal-800 flex items-center gap-3">
                  <KeyRound className="w-4 h-4 shrink-0" />
                  <div className="flex-1">
                    <div className="font-semibold">Demo SMS · OTP <span className="font-mono tracking-[.2em] text-[14px]">{info.demoOtp}</span></div>
                    <div className="opacity-80 text-[11.5px]">SMS gateway not connected in Demo Mode — in production this arrives by SMS.</div>
                  </div>
                  <button type="button" onClick={autofill} className="btn-secondary btn-sm">Autofill</button>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <label className="label !mb-0" htmlFor="otp-0">Enter 6-digit OTP</label>
                  <span className={cx('text-[11.5px] tabular-nums', expiresIn < 60 ? 'text-red-600' : 'text-slate-500')}>{expiresIn > 0 ? `Expires in ${mmss}` : 'OTP expired'}</span>
                </div>
                <div className="flex gap-2 mt-2" onPaste={(e) => onPaste(e as unknown as ClipboardEvent<HTMLInputElement>)}>
                  {otp.map((d, i) => (
                    <input key={i} id={`otp-${i}`} ref={(el) => { boxes.current[i] = el }} value={d} inputMode="numeric" maxLength={1} autoComplete={i === 0 ? 'one-time-code' : 'off'}
                      aria-label={`OTP digit ${i + 1}`} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKey(i, e)} onPaste={onPaste}
                      className="input !h-12 !w-full text-center text-[20px] font-semibold tabular-nums !px-0" />
                  ))}
                </div>
              </div>

              {info?.isNew && (
                <div className="rounded-lg border border-brand-200 bg-brand-50/50 p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-[12.5px] font-semibold text-brand-800"><UserPlus className="w-4 h-4" /> Create your {ROLE_LABEL[role!]} account</div>
                  <div>
                    <label className="label" htmlFor="name">Full name</label>
                    <input id="name" className="input" placeholder="e.g. Kavita Rao" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                  </div>
                  <div>
                    <label className="label" htmlFor="dept">Department / Area <span className="font-normal text-slate-400">(optional)</span></label>
                    <input id="dept" className="input" placeholder="e.g. SECL — Gevra Area" value={dept} onChange={(e) => setDept(e.target.value)} maxLength={120} />
                  </div>
                  <p className="text-[11.5px] text-slate-500">You'll get your own workspace — documents, records, reports and history — pre-loaded with the sample dataset.</p>
                </div>
              )}

              {err && <ErrorBox msg={err} />}
              <button type="submit" disabled={busy || expiresIn === 0} className="btn-primary w-full !h-10 text-[14px]">
                {busy ? <><Loader2 className="w-4 h-4 animate-spin" /> Verifying…</> : <><ShieldCheck className="w-4 h-4" /> Verify & sign in</>}
              </button>
              <div className="text-center text-[12.5px] text-slate-500">
                Didn't receive it?{' '}
                {resendIn > 0 ? <span className="tabular-nums">Resend in {resendIn}s</span>
                  : <button type="button" onClick={() => sendOtp()} className="text-brand-600 hover:underline font-medium">Resend OTP</button>}
              </div>
            </form>
          )}

          <div className="mt-5 flex items-center justify-center gap-2 text-[12px] text-slate-500">
            <ShieldCheck className="w-4 h-4 text-emerald-600" /> Secure enterprise environment · OTP-based sign-in · On-premise
          </div>

          {step === 'details' && demo.length > 0 && (
            <div className="mt-6 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-2">Demo accounts — tap to fill role & mobile</div>
              <div className="grid grid-cols-2 gap-2">
                {demo.map((d) => (
                  <button key={d.mobile} type="button" onClick={() => { setRole(d.role as Role); setMobile(`${d.mobile.slice(0, 5)} ${d.mobile.slice(5)}`); setErr(null) }}
                    className="text-left rounded-md bg-white border border-slate-200 px-3 py-2 hover:border-brand-300 transition">
                    <div className="text-[12.5px] font-medium text-slate-800">{ROLE_LABEL[d.role]}</div>
                    <div className="text-[11.5px] text-slate-500 font-mono">{d.mobile}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="flex gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5 text-[12.5px] text-red-700" role="alert">
      <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /> {msg}
    </div>
  )
}
