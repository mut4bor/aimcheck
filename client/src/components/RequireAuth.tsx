import { Navigate } from 'react-router-dom'
import { ReactNode } from 'react'
import { useSession } from '@/services/authClient'

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { data: session, isPending } = useSession()

  if (isPending) {
    return <div className="p-6">Загрузка…</div>
  }
  if (!session) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

export default RequireAuth
