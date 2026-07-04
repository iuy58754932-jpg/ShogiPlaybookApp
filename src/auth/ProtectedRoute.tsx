import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './auth-context'

export function ProtectedRoute() {
  const { session, loading } = useAuth()

  if (loading) {
    return <p className="screen-message">読み込み中…</p>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <Outlet />
}
