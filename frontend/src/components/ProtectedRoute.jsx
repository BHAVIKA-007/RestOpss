import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function ProtectedRoute({ role }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="routeLoading">Checking your account...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (user.mustChangePassword && location.pathname !== '/change-password-required') {
    return <Navigate to="/change-password-required" replace />
  }

  if (role && user.role !== role) {
    return <Navigate to={`/${user.role}`} replace />
  }

  return <Outlet />
}

export function PasswordChangeGate() {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (!isLoading && user?.mustChangePassword && location.pathname !== '/change-password-required') {
    return <Navigate to="/change-password-required" replace />
  }

  return null
}

export default ProtectedRoute
