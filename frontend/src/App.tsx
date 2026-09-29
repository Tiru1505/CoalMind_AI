import type { ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import { EmptyState, LoadingState } from './components/States'
import type { Role } from './types'
import { ACCESS } from './utils/access'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import ManagementDashboard from './pages/ManagementDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ViewerDashboard from './pages/ViewerDashboard'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import ExtractionPage from './pages/ExtractionPage'
import ValidationPage from './pages/ValidationPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import AIQueryPage from './pages/AIQueryPage'
import ConsistencyPage from './pages/ConsistencyPage'
import TopicsPage from './pages/TopicsPage'
import TopicDetailPage from './pages/TopicDetailPage'
import ReportsPage from './pages/ReportsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

const DASHBOARDS: Record<string, { role: Role; el: ReactNode }> = {
  officer: { role: 'geological_officer', el: <DashboardPage /> },
  management: { role: 'management', el: <ManagementDashboard /> },
  admin: { role: 'admin', el: <AdminDashboard /> },
  viewer: { role: 'viewer', el: <ViewerDashboard /> },
}

function Protected() {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <LoadingState label="Restoring secure session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <AppLayout />
}

function RoleDashboard() {
  const { slug = '' } = useParams()
  const { user } = useAuth()
  const d = DASHBOARDS[slug]
  // every user lands on — and may only open — the dashboard of their own role
  if (!d || d.role !== user!.role) return <Navigate to={user!.dashboard} replace />
  return <>{d.el}</>
}

function Guard({ area, children }: { area: string; children: ReactNode }) {
  const { user } = useAuth()
  if (!ACCESS[area].includes(user!.role)) {
    return (
      <div className="card mt-6 max-w-xl mx-auto">
        <EmptyState icon={Lock} title="Not available for your role"
          body="This area is not part of your role's workspace. Sign in with a different role to access it." />
      </div>
    )
  }
  return <>{children}</>
}

function HomeRedirect() {
  const { user } = useAuth()
  return <Navigate to={user!.dashboard} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="/dashboard" element={<HomeRedirect />} />
        <Route path="/dashboard/:slug" element={<RoleDashboard />} />
        <Route path="/documents" element={<Guard area="documents"><DocumentsPage /></Guard>} />
        <Route path="/documents/:id" element={<Guard area="documents"><DocumentDetailPage /></Guard>} />
        <Route path="/documents/:id/extraction" element={<Guard area="documents"><ExtractionPage /></Guard>} />
        <Route path="/validation" element={<Guard area="validation"><ValidationPage /></Guard>} />
        <Route path="/knowledge" element={<Guard area="knowledge"><KnowledgeBasePage /></Guard>} />
        <Route path="/ai-query" element={<Guard area="ai"><AIQueryPage /></Guard>} />
        <Route path="/consistency" element={<Guard area="consistency"><ConsistencyPage /></Guard>} />
        <Route path="/topics" element={<Guard area="topics"><TopicsPage /></Guard>} />
        <Route path="/topics/:id" element={<Guard area="topics"><TopicDetailPage /></Guard>} />
        <Route path="/reports" element={<Guard area="reports"><ReportsPage /></Guard>} />
        <Route path="/analytics" element={<Guard area="analytics"><AnalyticsPage /></Guard>} />
        <Route path="/audit" element={<Guard area="audit"><AuditLogsPage /></Guard>} />
        <Route path="/settings" element={<Guard area="settings"><SettingsPage /></Guard>} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
