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
  RawTrial,
  RawSessionRequest,
  SessionSubmitResponse,
  SessionConfig,
} from '@/types'
import {
  generateTargetPosition,
  checkInCenter,
} from '@/utils'

type UseGameEngineReturn = {
  gameState: GameState
  currentRound: number
  targetPosition: Point
  mousePosition: Point
  isInCenter: boolean
  holdProgress: number
  canvasSize: number
  result: SessionSubmitResponse | null
  handleMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void
  handleMouseClick: (e: MouseEvent<HTMLCanvasElement>) => void
  containerRef: RefObject<HTMLDivElement | null>
}

export const useGameEngine = (
  config: SessionConfig,
  submitResults: (data: RawSessionRequest) => Promise<SessionSubmitResponse>,
): UseGameEngineReturn => {
  const [gameState, setGameState] = useState<GameState>('waiting')
  const [currentRound, setCurrentRound] = useState(0)
  const [targetPosition, setTargetPosition] = useState<Point>({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [isInCenter, setIsInCenter] = useState(false)
  const [canvasSize, setCanvasSize] = useState(400)
  const [holdProgress, setHoldProgress] = useState(0)
  const [result, setResult] = useState<SessionSubmitResponse | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)

  // raw capture buffers (refs to avoid re-renders per mousemove)
  const trialsRef = useRef<RawTrial[]>([])
  const trajectoryRef = useRef<{ x: number; y: number; t: number }[]>([])
  const betweenRef = useRef<{ x: number; y: number; t: number }[]>([])
  const trialMetaRef = useRef<{
    appeared_at_ms: number
    start_cursor_x: number
    start_cursor_y: number
    target_x: number
    target_y: number
  } | null>(null)
  const gameStateRef = useRef<GameState>('waiting')
  const submittedRef = useRef(false)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const CIRCLE_RADIUS = (canvasSize - config.targetRadius * 2) / 2 - 20

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      setCanvasSize(containerRef.current.clientHeight)
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const finishRound = useCallback(
    (clickX: number, clickY: number) => {
      const meta = trialMetaRef.current
      if (!meta) return
      const clickedAt = performance.now()

      const trial: RawTrial = {
        round_number: trialsRef.current.length + 1,
        appeared_at_ms: meta.appeared_at_ms,
        clicked_at_ms: clickedAt,
        target_x: meta.target_x,
        target_y: meta.target_y,
        start_cursor_x: meta.start_cursor_x,
        start_cursor_y: meta.start_cursor_y,
        click_x: clickX,
        click_y: clickY,
        trajectory: trajectoryRef.current,
        between_samples: [],
      }
      trialsRef.current.push(trial)
      trajectoryRef.current = []
      trialMetaRef.current = null

      if (trialsRef.current.length >= config.roundsCount) {
        setGameState('finished')
      } else {
        setCurrentRound((r) => r + 1)
        setGameState('preparing')
      }
    },
    [config.roundsCount],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const t = performance.now()

      setMousePosition({ x, y })
      setIsInCenter(checkInCenter({ x, y }, centerX, centerY, config.centerTolerance))

      const state = gameStateRef.current
      if (state === 'playing') {
        trajectoryRef.current.push({ x, y, t })
      } else if (state === 'preparing' && trialsRef.current.length > 0) {
        betweenRef.current.push({ x, y, t })
      }
    },
    [centerX, centerY, config.centerTolerance],
  )

  const handleMouseClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'playing') return
      const rect = e.currentTarget.getBoundingClientRect()
      finishRound(e.clientX - rect.left, e.clientY - rect.top)
    },
    [finishRound],
  )

  const startNewRound = useCallback(() => {
    // attach between_samples to previous trial
    if (trialsRef.current.length > 0) {
      trialsRef.current[trialsRef.current.length - 1].between_samples =
        betweenRef.current
    }
    betweenRef.current = []

    const newTarget = generateTargetPosition(centerX, centerY, CIRCLE_RADIUS)
    setTargetPosition(newTarget)
    trialMetaRef.current = {
      appeared_at_ms: performance.now(),
      start_cursor_x: mousePosition.x,
      start_cursor_y: mousePosition.y,
      target_x: newTarget.x,
      target_y: newTarget.y,
    }
    trajectoryRef.current = []
    setGameState('playing')
  }, [centerX, centerY, CIRCLE_RADIUS, mousePosition.x, mousePosition.y])

  const startGame = useCallback(() => {
    trialsRef.current = []
    trajectoryRef.current = []
    betweenRef.current = []
    trialMetaRef.current = null
    submittedRef.current = false
    setResult(null)
    setCurrentRound(0)
    setGameState('preparing')
  }, [])

  // hold cursor in center → begin or restart
  useEffect(() => {
    let frame: number
    let startTime: number | null = null

    function updateProgress(currentTime: number) {
      if (!startTime) startTime = currentTime
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / (config.preparationTimeMs / 2), 1)
      setHoldProgress(progress)

      if (progress < 1 && isInCenter) {
        frame = requestAnimationFrame(updateProgress)
      } else if (progress >= 1) {
        if (gameState === 'waiting' || gameState === 'finished') startGame()
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
  }, [isInCenter, gameState, startGame, config.preparationTimeMs])

  // preparing → start new round after delay
  useEffect(() => {
    if (gameState === 'preparing') {
      const timer = setTimeout(() => startNewRound(), config.preparationTimeMs)
      return () => clearTimeout(timer)
    }
  }, [gameState, startNewRound, config.preparationTimeMs])

  // finished → submit raw capture
  useEffect(() => {
    if (gameState !== 'finished' || submittedRef.current) return
    submittedRef.current = true

    const payload: RawSessionRequest = {
      field_width: canvasSize,
      field_height: canvasSize,
      target_radius: config.targetRadius,
      trials: trialsRef.current,
    }
    submitResults(payload)
      .then(setResult)
      .catch(() => {})
  }, [gameState, canvasSize, config.targetRadius, submitResults])

  return {
    containerRef,
    gameState,
    currentRound,
    targetPosition,
    mousePosition,
    isInCenter,
    holdProgress,
    canvasSize,
    result,
    handleMouseMove,
    handleMouseClick,
  }
}
