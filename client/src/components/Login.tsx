import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signIn } from '@/services/authClient'

const Login = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signIn.username({ username, password })
    setLoading(false)
    if (error) {
      setError(error.message || 'Sign-in failed')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Вход</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="text"
          className="border rounded px-3 py-2 border-gray-300"
          placeholder="Никнейм"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          className="border rounded px-3 py-2 border-gray-300"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 font-semibold disabled:opacity-50"
        >
          {loading ? 'Вход…' : 'Войти'}
        </button>
        <p className="text-sm text-center">
          Нет аккаунта?{' '}
          <Link to="/register" className="text-blue-600 underline">
            Регистрация
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Login
