import { Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from '../store';

export function RequireAdmin() {
  const isAdmin = useAppStore((s) => s.isAdmin);

  if (!isAdmin()) {
    return <Navigate to="/home" replace />;
  }

  return <Outlet />;
}
