import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '@/config'
import { signOut, useSession } from '@/services/authClient'
import { UserSessionSummary } from '@/types'

const fmt = (n: number | string) =>
  typeof n === 'number' ? n.toFixed(1) : Number(n).toFixed(1)

const Profile = () => {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<UserSessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    axios
      .get(`${API_URL}/api/my-results`, { withCredentials: true })
      .then((res) => setSessions(res.data.sessions))
      .catch((err) =>
        setError(err.response?.data?.error || 'Не удалось загрузить результаты'),
      )
      .finally(() => setLoading(false))
  }, [session, isPending, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (isPending || loading) return <div className="p-6">Загрузка…</div>

  const displayName =
    (session?.user as { username?: string })?.username || session?.user?.name

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Профиль: {displayName}</h1>
          <div className="flex gap-2">
            <Link
              to="/"
              className="bg-blue-600 text-white rounded px-4 py-2 font-semibold"
            >
              К тесту
            </Link>
            <button
              onClick={handleSignOut}
              className="bg-gray-600 text-white rounded px-4 py-2 font-semibold"
            >
              Выход
            </button>
          </div>
        </div>

        <h2 className="text-xl font-semibold">Предыдущие тесты</h2>
        {error && <p className="text-red-500">{error}</p>}
        {sessions.length === 0 ? (
          <p className="text-gray-500">Пока нет завершённых тестов.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border-b">#</th>
                  <th className="px-3 py-2 border-b">Дата</th>
                  <th className="px-3 py-2 border-b">Раундов</th>
                  <th className="px-3 py-2 border-b">Попадание</th>
                  <th className="px-3 py-2 border-b">Позиц.</th>
                  <th className="px-3 py-2 border-b">Реакция</th>
                  <th className="px-3 py-2 border-b">Движения</th>
                  <th className="px-3 py-2 border-b">Параз.</th>
                  <th className="px-3 py-2 border-b">Устойч.</th>
                  <th className="px-3 py-2 border-b">ИБ</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const to = `/profile/sessions/${s.id}`
                  const cell = 'block px-3 py-2'
                  return (
                    <tr key={s.id} className="hover:bg-gray-50 [&>td]:border-b">
                      <td className="text-blue-600 underline">
                        <Link to={to} className={cell}>
                          {s.id}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {new Date(s.created_at).toLocaleString()}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {s.rounds_count}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_hit)}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_positioning)}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_reaction)}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_movement)}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_parasitic)}
                        </Link>
                      </td>
                      <td>
                        <Link to={to} className={cell}>
                          {fmt(s.f_stability)}
                        </Link>
                      </td>
                      <td className="font-semibold">
                        <Link to={to} className={cell}>
                          {fmt(s.integral_score)}
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
