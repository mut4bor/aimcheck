import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '@/config'
import { signOut, useSession } from '@/services/authClient'
import { UserGameResult } from '@/types'

const Profile = () => {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const [results, setResults] = useState<UserGameResult[]>([])
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
      .then((res) => setResults(res.data.results))
      .catch((err) =>
        setError(err.response?.data?.error || 'Не удалось загрузить результаты'),
      )
      .finally(() => setLoading(false))
  }, [session, isPending, navigate])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login', { replace: true })
  }

  if (isPending || loading) {
    return <div className="p-6">Загрузка…</div>
  }

  const displayName =
    (session?.user as { username?: string })?.username || session?.user?.name

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-5xl mx-auto bg-white rounded-lg shadow-lg p-6 flex flex-col gap-6">
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
        {results.length === 0 ? (
          <p className="text-gray-500">Пока нет завершённых тестов.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-3 py-2 border-b">#</th>
                  <th className="px-3 py-2 border-b">Дата</th>
                  <th className="px-3 py-2 border-b">Раундов</th>
                  <th className="px-3 py-2 border-b">Ср. точность</th>
                  <th className="px-3 py-2 border-b">Ср. попадание</th>
                  <th className="px-3 py-2 border-b">Ср. время (мс)</th>
                  <th className="px-3 py-2 border-b">Ср. оценка времени</th>
                  <th className="px-3 py-2 border-b">Суммарно</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.game_id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 border-b">{r.game_id}</td>
                    <td className="px-3 py-2 border-b">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-3 py-2 border-b">{r.rounds_count}</td>
                    <td className="px-3 py-2 border-b">{r.avg_accuracy}</td>
                    <td className="px-3 py-2 border-b">
                      {r.avg_distance_from_center}
                    </td>
                    <td className="px-3 py-2 border-b">{r.avg_time_value_ms}</td>
                    <td className="px-3 py-2 border-b">{r.avg_time_score}</td>
                    <td className="px-3 py-2 border-b font-semibold">
                      {r.combined_score}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default Profile
