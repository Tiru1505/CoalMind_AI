import type {
  AIAnswer, AuditEntry, DashboardData, DocumentDetail, DocumentItem, ExtractionData, Field, Notification, Page,
  ReportItem, SearchResult, Stage, Topic, User,
} from '../types'

const TOKEN_KEY = 'coalmind.token'
const storage = () => (localStorage.getItem('coalmind.remember') === '1' ? localStorage : sessionStorage)

export const tokenStore = {
  get: () => sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY),
  set: (t: string, remember: boolean) => {
    localStorage.setItem('coalmind.remember', remember ? '1' : '0')
    storage().setItem(TOKEN_KEY, t)
  },
  clear: () => {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  },
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
  }
}

let onUnauthorized: () => void = () => {}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn }

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { ...(init.headers as Record<string, string>) }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  if (init.body && !(init.body instanceof FormData)) headers['Content-Type'] = 'application/json'
  let res: Response
  try {
    res = await fetch(`/api${path}`, { ...init, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the CoalMind AI server. Please make sure the backend is running on port 8000.')
  }
  if (res.status === 401 && !path.startsWith('/auth/login')) onUnauthorized()
  if (!res.ok) {
    let msg = `Request failed (${res.status})`
    try {
      const body = await res.json()
      if (typeof body.detail === 'string') msg = body.detail
      else if (Array.isArray(body.detail)) msg = body.detail.map((d: { msg: string }) => d.msg).join('; ')
    } catch { /* non-JSON error */ }
    throw new ApiError(res.status, msg)
  }
  const type = res.headers.get('content-type') || ''
  return (type.includes('application/json') ? res.json() : res.blob()) as Promise<T>
}

const get = <T,>(p: string) => request<T>(p)
const post = <T,>(p: string, body?: unknown) => request<T>(p, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) })

async function download(path: string, fallbackName: string) {
  const token = tokenStore.get()
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) throw new ApiError(res.status, 'Download failed')
  const blob = await res.blob()
  const cd = res.headers.get('content-disposition') || ''
  const name = /filename="?([^"]+)"?/.exec(cd)?.[1] || fallbackName
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export interface SystemInfo {
  deployment: string; ai: string; external_api_dependency: string; data: string; demo_mode: boolean; version: string; database: string
  ai_configuration: Record<string, string | number>
  roles: Record<string, string[]>
  users: { employee_id: string; name: string; role: string; designation: string; department: string; last_login: string | null }[]
}

export const api = {
  login: (employee_id: string, password: string) => post<{ token: string; user: User }>('/auth/login', { employee_id, password }),
  me: () => get<User>('/auth/me'),
  logout: () => post('/auth/logout'),
  demoAccounts: () => get<{ employee_id: string; password: string; name: string; role: string; designation: string }[]>('/auth/demo-accounts'),

  dashboard: () => get<DashboardData>('/dashboard'),
  notifications: () => get<{ items: Notification[]; pending_validation: number }>('/notifications'),
  globalSearch: (q: string) => get<{ type: string; label: string; sub: string; link: string }[]>(`/search?q=${encodeURIComponent(q)}`),
  resetDemo: () => post<{ ok: boolean }>('/demo/reset'),
  systemInfo: () => get<SystemInfo>('/system/info'),

  documents: (params: { q?: string; status?: string } = {}) =>
    get<DocumentItem[]>(`/documents?${new URLSearchParams(params as Record<string, string>)}`),
  document: (id: number) => get<DocumentDetail>(`/documents/${id}`),
  upload: (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return request<DocumentItem>('/documents/upload', { method: 'POST', body: fd })
  },
  process: (id: number) => post<{ status: string; stages: Stage[]; summary: Record<string, number | string> }>(`/documents/${id}/process`),
  extraction: (id: number) => get<ExtractionData>(`/documents/${id}/extraction`),
  page: (id: number, page: number) => get<{ document: DocumentItem; page: Page; fields: Field[] }>(`/documents/${id}/pages/${page}`),

  validationQueue: () => get<{
    pending: (Field & { document: DocumentItem })[]
    stats: { pending: number; approved: number; auto_accepted: number; rejected: number; total: number; threshold: number }
    recent: { id: number; action: string; field: string; document_id: number | null; previous_value: string; new_value: string; user: string; timestamp: string }[]
  }>('/validation/queue'),
  approveField: (id: number, comment = '') => post<Field>(`/validation/${id}/approve`, { comment }),
  editField: (id: number, value: string, reason = '') => post<Field>(`/validation/${id}/edit`, { value, reason }),
  rejectField: (id: number, reason = '') => post<Field>(`/validation/${id}/reject`, { reason }),

  knowledgeStats: () => get<{
    documents_indexed: number; knowledge_chunks: number; entities: number; tables: number; verified_records: number
    demo_library: { documents: number; chunks: number; verified_chunks: number; verified_fields: number }
    by_category: { name: string; value: number }[]; by_year: { fy: string; value: number }[]
    embedding_model: string; vector_store: string
    recent_additions: { id: number; title: string; status: string; uploaded_at: string; chunks: number; verified_chunks: number }[]
  }>('/knowledge/stats'),
  knowledgeSearch: (q: string, verifiedOnly = false) =>
    get<{ query: string; interpreted: { mines: string[]; financial_year: string | null }; results: SearchResult[]; count: number }>(
      `/knowledge/search?q=${encodeURIComponent(q)}&verified_only=${verifiedOnly}`),

  aiSuggestions: () => get<string[]>('/ai/suggestions'),
  aiQuery: (question: string) => post<AIAnswer>('/ai/query', { question }),
  aiFeedback: (id: number, feedback: 'up' | 'down') => post(`/ai/${id}/feedback`, { feedback }),

  topics: () => get<{ topics: Topic[]; trend: Record<string, number | string>[]; keywords: { term: string; weight: number }[]; model: string }>('/topics'),
  topic: (id: string) => get<Topic>(`/topics/${id}`),

  reportOptions: () => get<{ report_types: string[]; scopes: { code: string; name: string }[]; financial_years: string[]; months: string[]; sections: { id: string; name: string }[] }>('/reports/options'),
  reports: () => get<ReportItem[]>('/reports'),
  report: (id: number) => get<ReportItem>(`/reports/${id}`),
  generateReport: (body: Record<string, unknown>) => post<ReportItem>('/reports/generate', body),
  approveReport: (id: number) => post<ReportItem>(`/reports/${id}/approve`),
  downloadReport: (id: number, name: string) => download(`/reports/${id}/download`, `${name}.html`),

  analytics: (params: { subsidiary?: string; mine?: string; fy?: string }) =>
    get<AnalyticsData>(`/analytics?${new URLSearchParams(params as Record<string, string>)}`),
  exportAnalytics: (format: 'csv' | 'xlsx', params: Record<string, string>) =>
    download(`/analytics/export?${new URLSearchParams({ format, ...params })}`, `coalmind_analytics.${format}`),

  auditLogs: (params: { category?: string; q?: string } = {}) => get<AuditEntry[]>(`/audit-logs?${new URLSearchParams(params as Record<string, string>)}`),
  auditLog: (id: number) => get<AuditEntry>(`/audit-logs/${id}`),
}

export interface AnalyticsData {
  filters: { subsidiary: string; mine: string; fy: string }
  options: { subsidiaries: string[]; mines: { code: string; name: string; subsidiary: string }[]; financial_years: string[] }
  summary: null | { production: number; target: number; achievement: number; overburden: number; land: number; manpower: number; safety: number; oms: number; deltas: Record<string, number | null> }
  yearly: { fy: string; production: number; target: number; achievement: number; overburden: number; stripping_ratio: number; land: number; manpower: number; oms: number; safety: number; dispatch: number; provisional: boolean }[]
  by_mine: { mine: string; code: string; subsidiary: string; production: number; target: number; achievement: number; overburden: number; stripping_ratio: number; land: number; manpower: number; oms: number; safety: number; dispatch: number; status: string }[]
  forecast: { fy: string; actual: number | null; forecast: number | null }[]
  note: string
}
