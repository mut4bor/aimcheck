import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '@/config'
import { useSession } from '@/services/authClient'
import { SessionDetailResponse } from '@/types'

const fmt = (n: number | string | null, d = 1) =>
  n == null ? '—' : (typeof n === 'number' ? n : Number(n)).toFixed(d)

const CRITERIA: {
  key: keyof SessionDetailResponse['session']
  label: string
}[] = [
  { key: 'f_reaction', label: 'Скорость наведения' },
  { key: 'f_hit', label: 'Точность попадания' },
  { key: 'f_movement', label: 'Точность движений' },
  { key: 'f_parasitic', label: 'Паразитические движения' },
  { key: 'f_positioning', label: 'Позиционирование курсора' },
  { key: 'f_stability', label: 'Устойчивость траектории' },
]

const RadarChart = ({
  values,
  labels,
  radius = 100,
  max = 100,
}: {
  values: number[]
  labels: string[]
  radius?: number
  max?: number
}) => {
  const r = radius
  const n = values.length
  const angle = (i: number) => (Math.PI * 2 * i) / n - Math.PI / 2

  const point = (v: number, i: number) => {
    const ratio = Math.max(0, Math.min(1, v / max))
    return [Math.cos(angle(i)) * r * ratio, Math.sin(angle(i)) * r * ratio]
  }

  const axisPoint = (i: number, ratio = 1) => [
    Math.cos(angle(i)) * r * ratio,
    Math.sin(angle(i)) * r * ratio,
  ]

  const polygon = values.map((v, i) => point(v, i).join(',')).join(' ')
  const gridLevels = [0.25, 0.5, 0.75, 1]

  const labelRatio = 1.25
  const labelFontSize = 12
  const labelCharWidth = 8
  const labelLineHeight = labelFontSize

  let left = r
  let right = r
  let top = r
  let bottom = r
  labels.forEach((l, i) => {
    const [x, y] = axisPoint(i, labelRatio)
    const w = l.length * labelCharWidth
    const h = labelLineHeight
    if (x > 0) right = Math.max(right, x + w)
    else if (x < 0) left = Math.max(left, -x + w)
    else {
      right = Math.max(right, w / 2)
      left = Math.max(left, w / 2)
    }
    if (y > 0) bottom = Math.max(bottom, y + h)
    else if (y < 0) top = Math.max(top, -y + h)
    else {
      bottom = Math.max(bottom, h / 2)
      top = Math.max(top, h / 2)
    }
  })

  const width = left + right
  const height = top + bottom
  const minX = -left
  const minY = -top

  return (
    <svg
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
      className="block"
    >
      {gridLevels.map((lvl) => (
        <polygon
          key={lvl}
          points={labels.map((_, i) => axisPoint(i, lvl).join(',')).join(' ')}
          fill="none"
          stroke="#d1d5db"
          strokeWidth={1}
        />
      ))}
      {labels.map((_, i) => {
        const [x, y] = axisPoint(i)
        return (
          <line
            key={i}
            x1={0}
            y1={0}
            x2={x}
            y2={y}
            stroke="#d1d5db"
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={polygon}
        fill="rgba(37, 99, 235, 0.25)"
        stroke="#2563eb"
        strokeWidth={2}
      />
      {values.map((v, i) => {
        const [x, y] = point(v, i)
        return <circle key={i} cx={x} cy={y} r={3} fill="#2563eb" />
      })}
      {labels.map((l, i) => {
        const [x, y] = axisPoint(i, 1.25)
        const anchor = Math.abs(x) < 1 ? 'middle' : x > 0 ? 'start' : 'end'
        const baseline = Math.abs(y) < 1 ? 'middle' : y > 0 ? 'hanging' : 'auto'
        return (
          <text
            key={l}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline={baseline}
            className="fill-gray-700"
            fontSize={12}
          >
            {l}
          </text>
        )
      })}
      {values.map((v, i) => {
        const [x, y] = point(v, i)
        const offset = 12
        const tx = x + Math.cos(angle(i)) * offset
        const ty = y + Math.sin(angle(i)) * offset
        return (
          <text
            key={`v-${i}`}
            x={tx}
            y={ty}
            textAnchor="middle"
            dominantBaseline="middle"
            className="fill-blue-700"
            fontSize={11}
            fontWeight={600}
          >
            {v.toFixed(0)}
          </text>
        )
      })}
    </svg>
  )
}

const SessionDetail = () => {
  const { id } = useParams<{ id: string }>()
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()
  const [data, setData] = useState<SessionDetailResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isPending) return
    if (!session) {
      navigate('/login', { replace: true })
      return
    }
    axios
      .get(`${API_URL}/api/my-results/${id}`, { withCredentials: true })
      .then((res) => setData(res.data))
      .catch((err) =>
        setError(err.response?.data?.error || 'Не удалось загрузить тест'),
      )
      .finally(() => setLoading(false))
  }, [id, session, isPending, navigate])

  if (isPending || loading) return <div className="p-6">Загрузка…</div>
  if (error) return <div className="p-6 text-red-500">{error}</div>
  if (!data) return null

  const { session: s, trials } = data
  const radarValues = CRITERIA.map((c) => Number(s[c.key] ?? 0))

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto bg-white rounded-lg shadow-lg p-6 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">
            Тест #{s.id} — {new Date(s.created_at).toLocaleString()}
          </h1>
          <Link
            to="/profile"
            className="bg-gray-600 text-white rounded px-4 py-2 font-semibold"
          >
            Назад
          </Link>
        </div>

        <div className="flex flex-row gap-6 flex-wrap items-center">
          <div className="flex justify-center">
            <RadarChart
              values={radarValues}
              labels={CRITERIA.map((c) => c.label)}
            />
          </div>
          <div className="flex flex-col gap-2 flex-1">
            <div className="text-lg">
              Интегральный балл:{' '}
              <span className="font-bold text-blue-700">
                {fmt(s.integral_score)}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Раундов: {s.rounds_count}
            </div>
            <table className="w-full text-left text-sm mt-2">
              <tbody>
                {CRITERIA.map((c) => (
                  <tr key={c.key} className="border-b">
                    <td className="py-1 pr-4">{c.label}</td>
                    <td className="py-1 font-semibold">
                      {fmt(s[c.key] as number)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <h2 className="text-xl font-semibold">Статистика по попыткам</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-3 py-2 border-b">Раунд</th>
                <th className="px-3 py-2 border-b">RT, мс</th>
                <th className="px-3 py-2 border-b">Промах, px</th>
                <th className="px-3 py-2 border-b">Попадание</th>
                <th className="px-3 py-2 border-b">Δ движ, %</th>
                <th className="px-3 py-2 border-b">Движения</th>
                <th className="px-3 py-2 border-b">Over</th>
                <th className="px-3 py-2 border-b">Under</th>
                <th className="px-3 py-2 border-b">Параз.</th>
                <th className="px-3 py-2 border-b">ρ, %</th>
                <th className="px-3 py-2 border-b">Позиц.</th>
                <th className="px-3 py-2 border-b">Петли</th>
                <th className="px-3 py-2 border-b">Устойч.</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t) => (
                <tr key={t.round_number} className="hover:bg-gray-50">
                  <td className="px-3 py-2 border-b">{t.round_number}</td>
                  <td className="px-3 py-2 border-b">{fmt(t.rt_ms, 0)}</td>
                  <td className="px-3 py-2 border-b">{fmt(t.hit_distance)}</td>
                  <td className="px-3 py-2 border-b">{fmt(t.hit_score)}</td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.movement_delta_pct)}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.movement_score)}
                  </td>
                  <td className="px-3 py-2 border-b">{t.overshoots}</td>
                  <td className="px-3 py-2 border-b">{t.undershoots}</td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.parasitic_score)}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.positioning_rho_pct)}
                  </td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.positioning_score)}
                  </td>
                  <td className="px-3 py-2 border-b">{t.loops_count}</td>
                  <td className="px-3 py-2 border-b">
                    {fmt(t.stability_score)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SessionDetail
