import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import axios from 'axios'
import { API_URL } from '@/config'
import { useSession } from '@/services/authClient'
import {
  SessionDetailResponse,
  SessionTrialRow,
  TrajectoryPoint,
} from '@/types'

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

type ReplayPoint = TrajectoryPoint & {
  x: number
  y: number
  t: number
}

const toReplayPoints = (trial: SessionTrialRow): ReplayPoint[] => {
  const startT = trial.appeared_at_ms
  const points: ReplayPoint[] = [
    {
      x: trial.start_cursor_x,
      y: trial.start_cursor_y,
      t: startT,
    },
    ...(trial.trajectory ?? []),
    {
      x: trial.click_x,
      y: trial.click_y,
      t: trial.clicked_at_ms,
    },
  ]

  return points
    .filter(
      (p) =>
        Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t),
    )
    .sort((a, b) => a.t - b.t)
}

const pointAtProgress = (points: ReplayPoint[], progress: number) => {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]

  const start = points[0].t
  const end = points[points.length - 1].t
  const targetT = start + Math.max(1, end - start) * progress

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const next = points[i]
    if (next.t < targetT) continue

    const span = Math.max(1, next.t - prev.t)
    const ratio = Math.max(0, Math.min(1, (targetT - prev.t) / span))
    return {
      x: prev.x + (next.x - prev.x) * ratio,
      y: prev.y + (next.y - prev.y) * ratio,
    }
  }

  return points[points.length - 1]
}

const AimReplay = ({
  session,
  trials,
}: {
  session: SessionDetailResponse['session']
  trials: SessionTrialRow[]
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [progress, setProgress] = useState(0)

  const selectedTrial = trials[selectedIndex] ?? trials[0]
  const selectedPoints = useMemo(
    () => (selectedTrial ? toReplayPoints(selectedTrial) : []),
    [selectedTrial],
  )
  const allPaths = useMemo(() => trials.map(toReplayPoints), [trials])
  const cursor = pointAtProgress(selectedPoints, progress)
  const fieldWidth = Number(session.field_width)
  const fieldHeight = Number(session.field_height)
  const targetRadius = Number(session.target_radius)
  const centerX = fieldWidth / 2
  const centerY = fieldHeight / 2
  const guideRadius = Math.max(
    0,
    (Math.min(fieldWidth, fieldHeight) - targetRadius * 2) / 2 - 20,
  )
  const durationMs = Math.max(
    700,
    Math.min(2200, Number(selectedTrial?.rt_ms ?? 900) + 500),
  )

  useEffect(() => {
    setProgress(0)
  }, [selectedIndex])

  useEffect(() => {
    let frame = 0
    let startedAt: number | null = null

    const tick = (now: number) => {
      if (startedAt === null) startedAt = now
      const elapsed = (now - startedAt) % durationMs
      setProgress(elapsed / durationMs)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [durationMs])

  if (!selectedTrial || fieldWidth <= 0 || fieldHeight <= 0) return null

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold">Aim replay</h2>
        <div className="flex gap-2 flex-wrap">
          {trials.map((trial, index) => (
            <button
              key={trial.round_number}
              type="button"
              onClick={() => setSelectedIndex(index)}
              className={`h-9 min-w-9 rounded border px-3 text-sm font-semibold ${
                index === selectedIndex
                  ? 'border-blue-600 bg-blue-600 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {trial.round_number}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
        <div className="overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3">
          <svg
            viewBox={`0 0 ${fieldWidth} ${fieldHeight}`}
            width={fieldWidth}
            height={fieldHeight}
            className="block h-auto max-w-full"
            role="img"
            aria-label="Animated aiming path replay"
          >
            <rect width={fieldWidth} height={fieldHeight} fill="#ffffff" />
            <circle
              cx={centerX}
              cy={centerY}
              r={guideRadius}
              fill="none"
              stroke="#111827"
              strokeWidth={2}
            />
            <circle
              cx={centerX}
              cy={centerY}
              r={targetRadius}
              fill="none"
              stroke="#9ca3af"
              strokeWidth={1}
            />
            {allPaths.map((points, index) =>
              points.length > 1 ? (
                <polyline
                  key={trials[index].round_number}
                  points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill="none"
                  stroke={index === selectedIndex ? '#2563eb' : '#94a3b8'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={index === selectedIndex ? 4 : 2}
                  opacity={index === selectedIndex ? 0.9 : 0.28}
                />
              ) : null,
            )}
            <line
              x1={centerX}
              y1={centerY}
              x2={selectedTrial.target_x}
              y2={selectedTrial.target_y}
              stroke="#cbd5e1"
              strokeWidth={1}
              strokeDasharray="6 6"
            />
            <circle
              cx={selectedTrial.target_x}
              cy={selectedTrial.target_y}
              r={targetRadius}
              fill="#ef4444"
              stroke="#111827"
              strokeWidth={2}
            />
            <circle
              cx={selectedTrial.click_x}
              cy={selectedTrial.click_y}
              r={Math.max(4, targetRadius * 0.3)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth={3}
            />
            <circle
              cx={selectedTrial.start_cursor_x}
              cy={selectedTrial.start_cursor_y}
              r={Math.max(4, targetRadius * 0.25)}
              fill="#10b981"
            />
            <circle
              cx={cursor.x}
              cy={cursor.y}
              r={Math.max(5, targetRadius * 0.32)}
              fill="#2563eb"
              stroke="#eff6ff"
              strokeWidth={3}
            />
          </svg>
        </div>

        <div className="rounded-lg border border-gray-200 p-4 text-sm">
          <div className="font-semibold text-gray-900">
            Round {selectedTrial.round_number}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2">
            <dt className="text-gray-500">RT</dt>
            <dd className="text-right font-semibold">
              {fmt(selectedTrial.rt_ms, 0)} ms
            </dd>
            <dt className="text-gray-500">Miss</dt>
            <dd className="text-right font-semibold">
              {fmt(selectedTrial.hit_distance)} px
            </dd>
            <dt className="text-gray-500">Path delta</dt>
            <dd className="text-right font-semibold">
              {fmt(selectedTrial.movement_delta_pct)}%
            </dd>
            <dt className="text-gray-500">Loops</dt>
            <dd className="text-right font-semibold">
              {selectedTrial.loops_count}
            </dd>
            <dt className="text-gray-500">Samples</dt>
            <dd className="text-right font-semibold">
              {Math.max(0, selectedPoints.length - 2)}
            </dd>
          </dl>
          <div className="mt-4 flex flex-col gap-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-emerald-500" />
              Start cursor
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full bg-red-500" />
              Target
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3 w-3 rounded-full border-2 border-amber-500" />
              Click
            </div>
          </div>
        </div>
      </div>
    </section>
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

        <AimReplay session={s} trials={trials} />

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
