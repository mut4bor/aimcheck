import { GameState, SessionSubmitResponse } from '@/types'

interface Props {
  gameState: GameState
  result: SessionSubmitResponse | null
  isSubmitting: boolean
  error: string | null
}

const fmt = (n: number) => n.toFixed(1)

const CRITERIA: {
  key: keyof SessionSubmitResponse['session']
  label: string
  weight: number
}[] = [
  { key: 'f_hit', label: 'Точность попадания', weight: 1.5 },
  { key: 'f_positioning', label: 'Позиционирование курсора', weight: 1.5 },
  { key: 'f_reaction', label: 'Скорость наведения', weight: 1.0 },
  { key: 'f_movement', label: 'Точность движений', weight: 0.75 },
  { key: 'f_parasitic', label: 'Паразитические движения', weight: 0.5 },
  { key: 'f_stability', label: 'Устойчивость траектории', weight: 0.5 },
]

const GameResults = ({ gameState, result, isSubmitting, error }: Props) => {
  if (gameState !== 'finished' && !result) {
    return (
      <div className="w-full bg-white p-4 rounded-lg shadow-lg flex-shrink-0">
        <p>Здесь появятся результаты!</p>
      </div>
    )
  }

  if (isSubmitting) {
    return (
      <div className="w-full bg-white p-4 rounded-lg shadow-lg flex-shrink-0">
        <p>Обработка результатов...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="w-full bg-white p-4 rounded-lg shadow-lg flex-shrink-0">
        <p className="text-red-600">Ошибка: {error}</p>
      </div>
    )
  }

  if (!result) return null

  const { session, trials } = result

  return (
    <div className="w-full bg-white p-4 rounded-lg shadow-lg flex-shrink-0 flex flex-col gap-4">
      <h3 className="font-semibold text-lg">Результаты сессии</h3>

      <div className="flex flex-col gap-2">
        {CRITERIA.map((c) => {
          const value = session[c.key]
          return (
            <div key={c.key} className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <div className="text-sm font-medium">{c.label}</div>
                <div className="text-xs text-gray-500">вес {c.weight}</div>
              </div>
              <div className="w-40 bg-gray-200 rounded h-3 overflow-hidden">
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${Math.min(100, value)}%` }}
                />
              </div>
              <div className="w-16 text-right text-sm font-mono">
                {fmt(value)}
              </div>
            </div>
          )
        })}
      </div>

      <div className="p-4 bg-blue-50 rounded border-2 border-blue-200">
        <div className="font-bold text-xl">
          Интегральный балл: {fmt(session.integral_score)} / 100
        </div>
      </div>

      <details className="text-sm">
        <summary className="cursor-pointer font-medium">
          По раундам ({trials.length})
        </summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-2 py-1 border">#</th>
                <th className="px-2 py-1 border">RT, мс</th>
                <th className="px-2 py-1 border">Hit</th>
                <th className="px-2 py-1 border">Move</th>
                <th className="px-2 py-1 border">Par</th>
                <th className="px-2 py-1 border">Pos</th>
                <th className="px-2 py-1 border">Stab</th>
              </tr>
            </thead>
            <tbody>
              {trials.map((t, i) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-2 py-1 border">{i + 1}</td>
                  <td className="px-2 py-1 border">{Math.round(t.rt_ms)}</td>
                  <td className="px-2 py-1 border">{t.hit_score}</td>
                  <td className="px-2 py-1 border">{t.movement_score}</td>
                  <td className="px-2 py-1 border">{t.parasitic_score}</td>
                  <td className="px-2 py-1 border">
                    {t.positioning_score === null ? '—' : t.positioning_score}
                  </td>
                  <td className="px-2 py-1 border">{t.stability_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  )
}

export default GameResults
