import {
  useState,
  useEffect,
  useCallback,
  MouseEvent,
  useRef,
  RefObject,
} from 'react'
import {
  GameState,
  Point,
  RoundResult,
  MousePath,
  GameResultResponse,
  GameResultRequest,
} from '@/types'
import { BASE_GAME_CONFIG } from '@/constants'
import {
  generateTargetPosition,
  checkInCenter,
  calculateAccuracyScore,
  calculateDistanceFromCenter,
  calculateTimeScore,
} from '@/utils'

type UseGameEngineReturn = {
  gameState: GameState
  currentRound: number
  targetPosition: Point
  mousePosition: Point
  roundResults: RoundResult[]
  isInCenter: boolean
  holdProgress: number
  canvasSize: number
  handleMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void
  handleMouseClick: () => void
  containerRef: RefObject<HTMLDivElement | null>
}

/**
 * Хук управления всей логикой игры:
 * - трекает состояние (игра, подготовка, ожидание, завершение)
 * - управляет раундами
 * - считает метрики (точность, время, расстояние)
 * - при завершении отправляет результаты
 */
export const useGameEngine = (
  submitResults: (data: GameResultRequest) => Promise<GameResultResponse>,
): UseGameEngineReturn => {
  const [gameState, setGameState] = useState<GameState>('waiting')
  const [currentRound, setCurrentRound] = useState(0)
  const [targetPosition, setTargetPosition] = useState<Point>({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [mousePath, setMousePath] = useState<MousePath>({
    points: [],
    startTime: 0,
  })
  const [roundResults, setRoundResults] = useState<RoundResult[]>([])
  const [isInCenter, setIsInCenter] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [canvasSize, setCanvasSize] = useState(400)
  const [holdProgress, setHoldProgress] = useState(0)

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const CIRCLE_RADIUS = (canvasSize - BASE_GAME_CONFIG.TARGET_SIZE * 2) / 2 - 20

  // обновление размера canvas при изменении окна
  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) {
        return
      }

      setCanvasSize(containerRef.current.clientHeight)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  // завершение раунда
  const finishRound = useCallback(() => {
    const endTime = Date.now()
    const duration = endTime - mousePath.startTime

    const accuracyScore = Math.round(
      calculateAccuracyScore(
        mousePath.points,
        targetPosition,
        centerX,
        centerY,
      ),
    )
    const distanceFromCenter = Math.round(
      calculateDistanceFromCenter(mousePosition, targetPosition),
    )
    const timeMs = Math.round(duration)
    const timeScore = Math.round(calculateTimeScore(timeMs))

    const result: RoundResult = {
      accuracyScore,
      distanceFromCenter,
      time: { valueMs: timeMs, score: timeScore },
    }

    setRoundResults((prev) => [...prev, result])

    if (currentRound + 1 >= BASE_GAME_CONFIG.ROUNDS_COUNT) {
      setGameState('finished')
    } else {
      setCurrentRound((prev) => prev + 1)
      setGameState('preparing')
    }
  }, [mousePath, mousePosition, targetPosition, currentRound, centerX, centerY])

  // обработка движения мыши
  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const canvas = e.currentTarget
      const rect = canvas.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setMousePosition({ x, y })
      setIsInCenter(checkInCenter({ x, y }, centerX, centerY))

      if (gameState === 'playing') {
        setMousePath((prev) => ({
          ...prev,
          points: [...prev.points, { x, y }],
        }))
      }
    },
    [gameState, centerX, centerY],
  )

  // обработка клика мыши
  const handleMouseClick = useCallback(() => {
    if (gameState === 'playing') {
      finishRound()
    }
  }, [gameState, finishRound])

  // запуск нового раунда
  const startNewRound = useCallback(() => {
    const newTarget = generateTargetPosition(centerX, centerY, CIRCLE_RADIUS)
    setTargetPosition(newTarget)
    setMousePath({ points: [], startTime: Date.now() })
    setGameState('playing')
  }, [centerX, centerY, CIRCLE_RADIUS])

  // старт игры
  const startGame = useCallback(() => {
    setGameState('preparing')
    setCurrentRound(0)
    setRoundResults([])
  }, [])

  // удержание курсора в центре → прогресс → старт/ресет
  useEffect(() => {
    let frame: number
    let startTime: number | null = null

    function updateProgress(currentTime: number) {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(
        elapsed / (BASE_GAME_CONFIG.PREPARATION_TIME / 2),
        1,
      )
      setHoldProgress(progress)

      if (progress < 1 && isInCenter) {
        frame = requestAnimationFrame(updateProgress)
      } else if (progress >= 1) {
        if (gameState === 'waiting') {
          startGame()
        }
        if (gameState === 'finished') {
          setCurrentRound(0)
          setRoundResults([])
          setMousePath({ points: [], startTime: 0 })
          startGame()
        }
        setHoldProgress(0)
      }
    }

    if (isInCenter && (gameState === 'waiting' || gameState === 'finished')) {
      frame = requestAnimationFrame(updateProgress)
    } else {
      setHoldProgress(0)
    }

    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [isInCenter, gameState, startGame])

  // подготовка к новому раунду
  useEffect(() => {
    if (gameState === 'preparing') {
      const timer = setTimeout(
        () => startNewRound(),
        BASE_GAME_CONFIG.PREPARATION_TIME,
      )
      return () => clearTimeout(timer)
    }
  }, [gameState, startNewRound])

  // отправка результатов
  useEffect(() => {
    if (gameState === 'finished') {
      submitResults({
        rounds: roundResults.map((result) => ({
          accuracy_score: result.accuracyScore,
          distance_from_center: result.distanceFromCenter,
          time: {
            value_ms: result.time.valueMs,
            score: result.time.score,
          },
        })),
      })
    }
  }, [gameState, roundResults, submitResults])

  return {
    containerRef,
    gameState,
    currentRound,
    targetPosition,
    mousePosition,
    roundResults,
    isInCenter,
    holdProgress,
    canvasSize,
    handleMouseMove,
    handleMouseClick,
  }
}
