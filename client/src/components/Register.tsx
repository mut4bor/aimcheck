import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { signUp } from '@/services/authClient'

const Register = () => {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await signUp.email({
      email: `${username.toLowerCase()}@local.user`,
      password,
      name: username,
      username,
    })
    setLoading(false)
    if (error) {
      setError(error.message || 'Sign-up failed')
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
        <h1 className="text-2xl font-bold text-center">Регистрация</h1>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <input
          type="text"
          className="border rounded px-3 py-2 border-gray-300"
          placeholder="Никнейм"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          minLength={3}
          maxLength={30}
        />
        <input
          type="password"
          className="border rounded px-3 py-2 border-gray-300"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
        <button
          type="submit"
          disabled={loading}
          className="bg-blue-600 text-white rounded py-2 font-semibold disabled:opacity-50"
        >
          {loading ? 'Создаём…' : 'Создать аккаунт'}
        </button>
        <p className="text-sm text-center">
          Уже есть аккаунт?{' '}
          <Link to="/login" className="text-blue-600 underline">
            Вход
          </Link>
        </p>
      </form>
    </div>
  )
}

export default Register
