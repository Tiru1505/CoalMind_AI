import { useState } from 'react'
import { Building2, Cpu, Database, KeyRound, Lock, Server, SlidersHorizontal, UserRound, Users } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import { ErrorState, LoadingState } from '../components/States'
import { api } from '../services/api'
import { useApi } from '../hooks/useApi'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../context/ToastContext'
import { cx, fmtDateTime, ROLE_LABEL } from '../utils/format'

const TABS = [
  { k: 'profile', l: 'Profile', i: UserRound }, { k: 'org', l: 'Organization', i: Building2 }, { k: 'security', l: 'Security', i: Lock },
  { k: 'ai', l: 'AI Configuration', i: Cpu }, { k: 'sources', l: 'Data Sources', i: Database }, { k: 'prefs', l: 'System Preferences', i: SlidersHorizontal },
]

function Row({ k, v, hint }: { k: string; v: React.ReactNode; hint?: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-1 sm:gap-6 py-3 border-b border-slate-100 last:border-0">
      <div><div className="text-[13px] font-medium text-slate-700">{k}</div>{hint && <div className="text-[11.5px] text-slate-400">{hint}</div>}</div>
      <div className="text-[13px] text-slate-800">{v}</div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, can } = useAuth()
  const toast = useToast()
  const [tab, setTab] = useState('profile')
  const [threshold, setThreshold] = useState(80)
  const [lang, setLang] = useState('English + Hindi')
  const { data, error, loading, reload } = useApi(api.systemInfo)

  if (loading && !data) return <LoadingState />
  if (error || !data) return <ErrorState message={error || 'No data'} onRetry={reload} />
  const ai = data.ai_configuration

  return (
    <div className="animate-fade-in">
      <PageHeader title="Settings" subtitle="Profile, organization, security and AI configuration for this CoalMind AI deployment." />
      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-5 items-start">
        <nav className="card p-2 flex lg:flex-col overflow-x-auto" aria-label="Settings sections">
          {TABS.map(({ k, l, i: I }) => (
            <button key={k} onClick={() => setTab(k)} className={cx('flex items-center gap-2.5 px-3 h-9 rounded-md text-[13px] font-medium whitespace-nowrap', tab === k ? 'bg-brand-50 text-brand-700' : 'text-slate-600 hover:bg-slate-50')}>
              <I className="w-4 h-4" /> {l}
            </button>
          ))}
        </nav>

        <div className="space-y-5">
          {tab === 'profile' && user && (
            <section className="card p-5">
              <h3 className="card-title mb-2">Profile</h3>
              <Row k="Name" v={user.name} /><Row k="Mobile (sign-in)" v={<span className="font-mono">{user.mobile}</span>} hint="Verified by OTP" />
              <Row k="Employee ID" v={<span className="font-mono">{user.employee_id}</span>} />
              <Row k="Designation" v={user.designation} /><Row k="Department" v={user.department} /><Row k="Email" v={user.email} />
              <Row k="Role" v={<span className="chip bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/20">{ROLE_LABEL[user.role]}</span>} />
              <Row k="Permissions" v={<div className="flex flex-wrap gap-1.5">{user.permissions.length ? user.permissions.map((p) => <span key={p} className="chip bg-slate-100 text-slate-600 font-mono !text-[11px]">{p}</span>) : <span className="text-slate-500">Read-only: search, dashboards, reports</span>}</div>} />
            </section>
          )}

          {tab === 'org' && (
            <section className="card p-5">
              <h3 className="card-title mb-2">Organization</h3>
              <Row k="Organization" v="Central Mine Planning & Design Institute Ltd. (CMPDI)" />
              <Row k="Parent company" v="Coal India Limited (CIL)" />
              <Row k="Subsidiaries in scope" v="SECL, MCL, NCL (demo selection)" />
              <Row k="Primary coalfield (demo)" v="Korba Coalfield, Chhattisgarh" />
              <Row k="Financial year convention" v="April – March (FY YYYY-YY)" />
              <Row k="Units standard" v="MT (million tonnes), Mm³, hectares, m, %" />
            </section>
          )}

          {tab === 'security' && (
            <>
              <section className="card p-5">
                <h3 className="card-title mb-2">Security controls</h3>
                <Row k="Authentication" v="Mobile number + 6-digit OTP (HMAC-hashed, 5-minute expiry, 5 attempts, 30 s resend cooldown) · role selected at sign-in and fixed for the session" />
                <Row k="Data isolation" v="Every user has a separate workspace — documents, records, reports, AI history and audit history are scoped to the owner" />
                <Row k="Session handling" v="Signed session token, 8-hour expiry, automatic sign-out on expiry" />
                <Row k="Role-based access" v="4 roles enforced on the API and in the UI" />
                <Row k="File validation" v="Extension allow-list, magic-byte signature check, 25 MB limit, filename sanitisation" />
                <Row k="Input validation" v="Schema validation on every API request (Pydantic)" />
                <Row k="Audit logging" v="All uploads, AI actions, validations, queries, exports and sign-ins" />
                <Row k="Data transmission" v={<span className="text-emerald-700 font-medium">No external data transmission in Demo Mode</span>} />
                <p className="text-[11.5px] text-slate-400 mt-3">These are prototype-level controls. Production hardening (TLS, HSM-backed keys, VAPT, CERT-In compliance) is part of the deployment plan.</p>
              </section>
              {data.users.length > 0 && <section className="card">
                <div className="card-header"><h3 className="card-title flex items-center gap-2"><Users className="w-4 h-4 text-slate-500" /> Users & roles</h3>{can('manage_users') ? <span className="chip bg-emerald-50 text-emerald-700">You can manage users</span> : <span className="chip bg-slate-100 text-slate-500">View only</span>}</div>
                <table className="table-base">
                  <thead><tr><th>User</th><th>Employee ID</th><th>Role</th><th>Department</th><th>Last sign-in</th></tr></thead>
                  <tbody>{data.users.map((u) => (
                    <tr key={u.employee_id}><td className="font-medium">{u.name}<div className="text-[11px] text-slate-400">{u.designation}</div></td><td className="font-mono text-[12px]">{u.employee_id}</td><td>{ROLE_LABEL[u.role]}</td><td className="text-slate-600">{u.department}</td><td className="text-slate-500 text-[12px]">{u.last_login ? fmtDateTime(u.last_login) : '—'}</td></tr>
                  ))}</tbody>
                </table>
                <div className="p-5 border-t border-slate-100">
                  <div className="text-[12px] font-semibold text-slate-600 mb-2">Role permissions</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(data.roles).map(([r, perms]) => (
                      <div key={r} className="rounded-md border border-slate-200 p-3">
                        <div className="text-[12.5px] font-semibold mb-1.5">{ROLE_LABEL[r]}</div>
                        <div className="flex flex-wrap gap-1">{perms.length ? perms.map((p) => <span key={p} className="chip bg-slate-100 text-slate-600 font-mono !text-[10.5px]">{p}</span>) : <span className="text-[12px] text-slate-500">search · view reports · view dashboards</span>}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </section>}
            </>
          )}

          {tab === 'ai' && (
            <>
              <section className="card p-5">
                <h3 className="card-title mb-1">AI Configuration</h3>
                <p className="text-[12px] text-slate-500 mb-2">Target architecture for production deployment, with the component active in this demo shown beneath each item.</p>
                <Row k="OCR Engine" v={<><b>{ai.ocr_engine}</b><div className="text-[11.5px] text-slate-500">{ai.ocr_runtime}</div></>} />
                <Row k="Layout / Table models" v={<><b>LayoutLMv3 · Table Transformer</b><div className="text-[11.5px] text-slate-500">Simulated in demo</div></>} />
                <Row k="Embedding Model" v={<><b>{ai.embedding_model}</b><div className="text-[11.5px] text-slate-500">{ai.embedding_runtime}</div></>} />
                <Row k="Vector Database" v={<><b>{ai.vector_database}</b><div className="text-[11.5px] text-slate-500">{ai.vector_runtime}</div></>} />
                <Row k="LLM" v={<><b>{ai.llm}</b><div className="text-[11.5px] text-slate-500">{ai.llm_runtime}</div></>} />
                <Row k="Topic model" v={<><b>{ai.topic_model}</b><div className="text-[11.5px] text-slate-500">{ai.topic_runtime}</div></>} />
                <Row k="Deployment" v={<b>{ai.deployment}</b>} />
                <Row k="Auto-accept threshold" hint="Fields below this confidence require officer validation (display only in demo; server threshold is 80%)" v={
                  <div className="flex items-center gap-3 max-w-sm">
                    <input type="range" min={60} max={95} value={threshold} onChange={(e) => setThreshold(Number(e.target.value))} className="flex-1 accent-brand-600" aria-label="Auto-accept threshold" />
                    <span className="font-semibold tabular-nums w-10">{threshold}%</span>
                  </div>} />
              </section>
              <section className="light-scope card p-5 flex items-start gap-3 !bg-ink-900 text-slate-200 border-ink-800">
                <Server className="w-5 h-5 text-coal-400 shrink-0 mt-0.5" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-10 gap-y-2 text-[13px] flex-1">
                  <div><span className="text-slate-400">Deployment:</span> {data.deployment}</div>
                  <div><span className="text-slate-400">AI:</span> {data.ai}</div>
                  <div><span className="text-slate-400">External API Dependency:</span> {data.external_api_dependency}</div>
                  <div><span className="text-slate-400">Data:</span> {data.data}</div>
                  <div><span className="text-slate-400">Database:</span> {data.database}</div>
                  <div><span className="text-slate-400">Version:</span> {data.version}</div>
                </div>
              </section>
            </>
          )}

          {tab === 'sources' && (
            <section className="card p-5">
              <h3 className="card-title mb-2">Data Sources</h3>
              {[
                ['Document uploads', 'PDF, DOCX, XLSX, JPG, PNG via Document Intelligence', 'Active'],
                ['Historical archive (scanned)', 'Bulk ingestion from records room scans', 'Planned'],
                ['Production MIS', 'Monthly MIS spreadsheets from subsidiary HQs', 'Active (upload)'],
                ['Coal Mine Surveillance & Management System', 'API integration', 'Planned'],
                ['GIS / survey data', 'Lease boundaries, borehole locations', 'Planned'],
              ].map(([n, d, s]) => (
                <div key={n} className="flex items-center justify-between gap-4 py-3 border-b border-slate-100 last:border-0">
                  <div><div className="text-[13px] font-medium">{n}</div><div className="text-[12px] text-slate-500">{d}</div></div>
                  <span className={cx('chip', s.startsWith('Active') ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500')}>{s}</span>
                </div>
              ))}
            </section>
          )}

          {tab === 'prefs' && (
            <section className="card p-5">
              <h3 className="card-title mb-2">System Preferences</h3>
              <Row k="Document languages" v={<select className="input max-w-xs" value={lang} onChange={(e) => setLang(e.target.value)}><option>English + Hindi</option><option>English only</option></select>} />
              <Row k="Default financial year" v="FY 2024-25 (latest verified)" />
              <Row k="Number format" v="Indian (1,00,000) for counts · MT for tonnage" />
              <Row k="Report watermark" v="AI-generated draft — requires officer review" />
              <div className="pt-4"><button className="btn-primary" onClick={() => toast('success', 'Preferences saved', 'Applied to this session (demo).')}><KeyRound className="w-4 h-4" /> Save preferences</button></div>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}
