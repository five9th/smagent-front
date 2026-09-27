import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import { Spinner } from './components/ui'
import { AuthProvider } from './hooks/AuthProvider'
import { useAuth } from './hooks/useAuth'
import { ToastProvider } from './hooks/ToastProvider'
import AccountsView from './views/AccountsView'
import AiView from './views/AiView'
import DashboardView from './views/DashboardView'
import InboxView from './views/InboxView'
import LoginView from './views/LoginView'
import PostEditorView from './views/PostEditorView'
import PostsView from './views/PostsView'

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user, ready } = useAuth()
  if (!ready) {
    return (
      <div className="boot">
        <Spinner lg />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  return children
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginView />} />
            <Route
              element={
                <RequireAuth>
                  <AppShell />
                </RequireAuth>
              }
            >
              <Route path="/" element={<DashboardView />} />
              <Route path="/posts" element={<PostsView />} />
              <Route path="/posts/new" element={<PostEditorView />} />
              <Route path="/posts/:id" element={<PostEditorView />} />
              <Route path="/accounts" element={<AccountsView />} />
              <Route path="/ai" element={<AiView />} />
              <Route path="/inbox" element={<InboxView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
