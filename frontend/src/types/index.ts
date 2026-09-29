export type Role = 'admin' | 'geological_officer' | 'management' | 'viewer'

export interface User {
  id: number
  employee_id: string
  name: string
  role: Role
  designation: string
  department: string
  email: string
  mobile: string
  dashboard: string
  permissions: string[]
}

export interface Kpi {
  key: string
  label: string
  value: number
  suffix?: string
  delta: string | null
  note: string
  tone: 'up' | 'warn' | 'neutral' | 'good'
}

export interface AuditEntry {
  id: number
  timestamp: string
  user: string
  role: string
  action: string
  category: string
  document_id: number | null
  document: string
  status: string
  source: string
  details: Record<string, unknown>
  related?: AuditEntry[]
}

export interface DashboardData {
  kpis: Kpi[]
  production_trend: { fy: string; production: number; target: number; achievement: number; provisional: boolean }[]
  mine_wise: { mine: string; code: string; production: number; target: number; achievement: number; land: number; overburden: number; safety: number }[]
  mine_wise_fy: string
  document_status: { name: string; value: number }[]
  recent_activity: AuditEntry[]
  demo_document: { id: number; title: string; status: string } | null
  workspace: { documents: number; processed: number; pending_fields: number; reports: number; queries: number; uploaded: number; failed: number }
  consistency: {
    score: number; open_conflicts: number; high_severity: number; resolved_count: number; cross_checked: number; agree_count: number
    top: { key: string; label: string; mine: string; fy: string; severity: 'high' | 'low' | null; values: string[] }[]
  }
  reports: ReportItem[]
  headline: { fy: string; production: number; target: number; achievement: number; provisional: boolean } | null
}

export type DocStatus = 'Uploaded' | 'Processing' | 'Processed' | 'Validation Required' | 'Approved' | 'Failed'

export interface DocumentItem {
  id: number
  filename: string
  title: string
  file_type: string
  category: string
  mine_id: number | null
  mine: string
  financial_year: string
  language: string
  source_kind: string
  pages: number
  size_kb: number
  uploaded_by: string
  uploaded_at: string
  status: DocStatus
  confidence: number | null
  fields_extracted: number
  tables_detected: number
  topics: string[]
  error: string | null
  is_demo_target: boolean
}

export interface Stage {
  key: string
  name: string
  status: 'complete' | 'warning' | 'failed' | 'skipped' | 'pending' | 'running'
  detail: string
  duration_ms: number
}

export interface DocumentDetail extends DocumentItem {
  processing_log: Stage[]
  field_summary: { total: number; pending: number; approved: number; auto_accepted: number; rejected: number }
  page_count_indexed: number
}

export type Block =
  | { type: 'heading' | 'subheading' | 'para' | 'note'; text: string }
  | { type: 'kv'; items: [string, string][] }
  | { type: 'table'; caption?: string; headers: string[]; rows: string[][] }

export interface Page {
  page_number: number
  title: string
  blocks: Block[]
  ocr_confidence: number
}

export interface Field {
  id: number
  document_id: number
  key: string
  label: string
  original_text: string
  ai_value: string
  human_value: string | null
  value: string
  unit: string
  confidence: number
  band: 'high' | 'medium' | 'low'
  page: number
  anchor: string
  warning: string | null
  status: 'pending' | 'auto_accepted' | 'approved' | 'rejected'
  validated_by: string | null
  validated_at: string | null
  maps_to: string | null
}

export interface ExtractionData {
  document: DocumentItem
  fields: Field[]
  pages: Page[]
  normalization: { field: string; original: string; normalized: string; rule: string }[]
}

export interface Source {
  chunk_id: number
  document_id: number
  document_title: string
  filename: string
  page: number
  section: string
  snippet: string
  relevance: number
  similarity: number
  extraction_confidence: number
  verified: boolean
  validation_status: string
  financial_year: string
  doc_category: string
}

export interface AIAnswer {
  id: number
  question: string
  answer: string
  intent: string
  grounded: boolean
  sources: Source[]
  sources_count: number
  facts?: { label: string; value: string }[]
  table?: { headers: string[]; rows: string[][] }
  chart?: { type: string; unit: string; label: string; data: { fy: string; value: number; target: number | null; provisional: boolean }[] }
  consistency?: CrossCheck | null
  understanding: { intent: string; mines: string[]; financial_year: string; metric: string | null }
  trust: { label: string; verified_only: boolean; llm: string; embedding_model: string; chunks_searched: number; latency_ms: number }
  created_at: string
}

export interface SearchResult {
  chunk_id: number
  document_id: number
  document_title: string
  filename: string
  page: number
  section: string
  snippet: string
  content: string
  financial_year: string
  mine: string
  relevance: number
  verified: boolean
  doc_status: string
  topic: string
  extraction_confidence: number
}

export interface Topic {
  id: number
  slug: string
  name: string
  description: string
  color: string
  document_count: number
  trend_pct: number
  keywords: { term: string; weight: number }[]
  yearly: Record<string, number>
  related_mines?: { code: string; name: string; subsidiary: string }[]
  recent_documents?: { id: number; title: string; filename: string; financial_year: string; status: string; uploaded_at: string; mine: string }[]
  statistics?: { label: string; value: string }[]
  indexed_chunks?: number
  model?: string
}

export interface ReportSection {
  id: string
  title: string
  paragraphs?: string[]
  bullets?: string[]
  facts?: { label: string; value: string }[]
  table?: { caption?: string; headers: string[]; rows: string[][] }
  chart?: { data: { fy: string; production: number; target: number }[] }
  cites: number[]
}

export interface ReportItem {
  id: number
  report_no: string
  title: string
  report_type: string
  scope: string
  financial_year: string
  date_range: string
  sections: string[]
  status: 'Draft' | 'Approved'
  generated_by: string
  approved_by: string | null
  created_at: string
  content?: {
    header: { org: string; title: string; report_type: string; subject: string; period: string; report_no: string; generated_on: string; prepared_by: string; classification: string; sample_data_note: string }
    disclaimer: string
    sections: ReportSection[]
    key_statistics: { label: string; value: string }[]
    references: { ref: number; document_id: number; document_title: string; filename: string; page: number; section: string; status: string }[]
    validation_checks: { check: string; status: 'pass' | 'warn' }[]
  }
}

export interface Notification {
  id: string
  type: 'warning' | 'info' | 'success' | 'error'
  title: string
  body: string
  link: string
  time: string
}

export interface CrossCheck {
  key: string
  status: 'agree' | 'conflict' | 'resolved'
  severity: 'high' | 'low' | null
  label: string
  source_count: number
  agreeing: number
  consensus: string
  differing: { value: string; sources: string[]; provisional: boolean }[]
  resolution: { value: number; display: string; reason: string; user: string; timestamp: string } | null
}

export interface FigureSource {
  fact_id: number; document_id: number; title: string; filename: string; page: number; snippet: string
  provisional: boolean; doc_status: string; category: string
}

export interface FigureCheck {
  key: string
  mine: string
  mine_code: string
  financial_year: string
  metric: string
  label: string
  unit: string
  status: 'single' | 'agree' | 'conflict' | 'resolved'
  severity: 'high' | 'low' | null
  source_count: number
  agreeing: number
  consensus_value: number
  consensus_display: string
  recommended: { value: number; display: string; reason: string }
  clusters: { value: number; display: string; sources: FigureSource[] }[]
  resolution: { value: number; display: string; reason: string; user: string; timestamp: string } | null
}

export interface ConsistencyScan {
  score: number
  figures_checked: number
  cross_checked: number
  statements: number
  documents: number
  open_conflicts: number
  high_severity: number
  resolved_count: number
  agree_count: number
  conflicts: FigureCheck[]
  resolved: FigureCheck[]
  agreements: FigureCheck[]
}
