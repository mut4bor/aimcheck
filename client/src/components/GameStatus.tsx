import { GameState } from '@/types'

interface Props {
  gameState: GameState
  currentRound: number
  roundsCount: number
}

const GameStatus = ({ gameState, currentRound, roundsCount }: Props) => {
  return (
    <div className="rounded-lg bg-white p-4 shadow-lg flex-shrink-0">
      <h3 className="font-semibold mb-2">Состояние</h3>
      {gameState === 'waiting' && (
        <p className="text-gray-600">Нажмите «Начать тест», чтобы запустить игру.</p>
      )}
      {gameState === 'preparing' && (
        <p className="text-orange-600">
          Подготовка... ожидайте следующую цель.
        </p>
      )}
      {gameState === 'playing' && (
        <p className="text-green-600">
          Раунд {currentRound + 1}/{roundsCount} - ведите курсор к цели и
          кликните.
        </p>
      )}
      {gameState === 'finished' && (
        <p className="text-blue-600">
          Тест завершен. Можно запустить новый тест кнопкой на поле.
        </p>
      )}
    </div>
  )
}

export default GameStatus
