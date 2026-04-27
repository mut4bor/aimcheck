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
import { generateTargetPosition } from '@/utils'

type UseGameEngineReturn = {
  gameState: GameState
  currentRound: number
  targetPosition: Point
  mousePosition: Point
  canvasSize: number
  result: SessionSubmitResponse | null
  startGame: (e?: MouseEvent<HTMLElement>) => void
  handleMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void
  handleMouseClick: (e: MouseEvent<HTMLCanvasElement>) => void
  handleTargetPainted: (round: number, paintedAt: number) => void
  containerRef: RefObject<HTMLDivElement | null>
}

const getEventTime = (eventTimeStamp: number): number => {
  const now = performance.now()
  const timeOrigin = performance.timeOrigin ?? Date.now() - now

  if (eventTimeStamp > now + 10000) {
    return eventTimeStamp - timeOrigin
  }

  return eventTimeStamp
}

export const useGameEngine = (
  config: SessionConfig,
  submitResults: (data: RawSessionRequest) => Promise<SessionSubmitResponse>,
): UseGameEngineReturn => {
  const [gameState, setGameState] = useState<GameState>('waiting')
  const [currentRound, setCurrentRound] = useState(0)
  const [targetPosition, setTargetPosition] = useState<Point>({ x: 0, y: 0 })
  const [mousePosition, setMousePosition] = useState<Point>({ x: 0, y: 0 })
  const [canvasSize, setCanvasSize] = useState(400)
  const [result, setResult] = useState<SessionSubmitResponse | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const mousePositionRef = useRef<Point>({ x: 0, y: 0 })

  // raw capture buffers (refs to avoid re-renders per mousemove)
  const trialsRef = useRef<RawTrial[]>([])
  const trajectoryRef = useRef<{ x: number; y: number; t: number }[]>([])
  const betweenRef = useRef<{ x: number; y: number; t: number }[]>([])
  const trialMetaRef = useRef<{
    appeared_at_ms: number | null
    round_number: number
    start_cursor_x: number
    start_cursor_y: number
    target_x: number
    target_y: number
    between_samples: { x: number; y: number; t: number }[]
  } | null>(null)
  const gameStateRef = useRef<GameState>('waiting')
  const submittedRef = useRef(false)

  useEffect(() => {
    gameStateRef.current = gameState
  }, [gameState])

  const updateMousePosition = useCallback((point: Point) => {
    mousePositionRef.current = point
    setMousePosition(point)
  }, [])

  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const CIRCLE_RADIUS = (canvasSize - config.targetRadius * 2) / 2 - 20

  useEffect(() => {
    const updateSize = () => {
      if (!containerRef.current) return
      const { width, height } = containerRef.current.getBoundingClientRect()
      const size = Math.floor(Math.min(width, height))
      if (size > 0) {
        setCanvasSize(size)
      }
    }

    updateSize()

    const observer =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(updateSize)
        : null
    if (observer && containerRef.current) {
      observer.observe(containerRef.current)
    }

    window.addEventListener('resize', updateSize)
    return () => {
      observer?.disconnect()
      window.removeEventListener('resize', updateSize)
    }
  }, [])

  const finishRound = useCallback(
    (clickX: number, clickY: number, clickedAt: number) => {
      const meta = trialMetaRef.current
      if (!meta || meta.appeared_at_ms === null) return
      updateMousePosition({ x: clickX, y: clickY })

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
        between_samples: meta.between_samples,
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
    [config.roundsCount, updateMousePosition],
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const t = performance.now()

      updateMousePosition({ x, y })

      const state = gameStateRef.current
      if (state === 'playing') {
        trajectoryRef.current.push({ x, y, t })
      } else if (state === 'preparing') {
        betweenRef.current.push({ x, y, t })
      }
    },
    [updateMousePosition],
  )

  const handleMouseClick = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (gameStateRef.current !== 'playing') return
      const clickedAt = getEventTime(e.timeStamp)
      const rect = e.currentTarget.getBoundingClientRect()
      finishRound(e.clientX - rect.left, e.clientY - rect.top, clickedAt)
    },
    [finishRound],
  )

  const handleTargetPainted = useCallback((round: number, paintedAt: number) => {
    const meta = trialMetaRef.current
    if (!meta || meta.round_number !== round || meta.appeared_at_ms !== null) {
      return
    }

    meta.appeared_at_ms = paintedAt
    meta.start_cursor_x = mousePositionRef.current.x
    meta.start_cursor_y = mousePositionRef.current.y
  }, [])

  const startNewRound = useCallback(() => {
    const betweenSamples = betweenRef.current
    betweenRef.current = []

    const newTarget = generateTargetPosition(centerX, centerY, CIRCLE_RADIUS)
    const cursor = mousePositionRef.current
    setTargetPosition(newTarget)
    trialMetaRef.current = {
      appeared_at_ms: null,
      round_number: trialsRef.current.length,
      start_cursor_x: cursor.x,
      start_cursor_y: cursor.y,
      target_x: newTarget.x,
      target_y: newTarget.y,
      between_samples: betweenSamples,
    }
    trajectoryRef.current = []
    setGameState('playing')
  }, [centerX, centerY, CIRCLE_RADIUS])

  const startGame = useCallback((e?: MouseEvent<HTMLElement>) => {
    if (e && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect()
      updateMousePosition({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      })
    }

    trialsRef.current = []
    trajectoryRef.current = []
    betweenRef.current = []
    trialMetaRef.current = null
    submittedRef.current = false
    setResult(null)
    setCurrentRound(0)
    setGameState('preparing')
  }, [updateMousePosition])

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
    canvasSize,
    result,
    startGame,
    handleMouseMove,
    handleMouseClick,
    handleTargetPainted,
  }
}
