import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import AppLayout from './layouts/AppLayout'
import { LoadingState } from './components/States'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import DocumentsPage from './pages/DocumentsPage'
import DocumentDetailPage from './pages/DocumentDetailPage'
import ExtractionPage from './pages/ExtractionPage'
import ValidationPage from './pages/ValidationPage'
import KnowledgeBasePage from './pages/KnowledgeBasePage'
import AIQueryPage from './pages/AIQueryPage'
import TopicsPage from './pages/TopicsPage'
import TopicDetailPage from './pages/TopicDetailPage'
import ReportsPage from './pages/ReportsPage'
import AnalyticsPage from './pages/AnalyticsPage'
import AuditLogsPage from './pages/AuditLogsPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

function Protected() {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <LoadingState label="Restoring secure session…" />
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname + loc.search }} />
  return <AppLayout />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/documents/:id" element={<DocumentDetailPage />} />
        <Route path="/documents/:id/extraction" element={<ExtractionPage />} />
        <Route path="/validation" element={<ValidationPage />} />
        <Route path="/knowledge" element={<KnowledgeBasePage />} />
        <Route path="/ai-query" element={<AIQueryPage />} />
        <Route path="/topics" element={<TopicsPage />} />
        <Route path="/topics/:id" element={<TopicDetailPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/audit" element={<AuditLogsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
