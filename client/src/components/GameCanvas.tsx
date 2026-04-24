import { useRef, useEffect, MouseEvent, RefObject } from 'react'
import { Point, GameState } from '@/types'

interface Props {
  canvasSize: number
  targetRadius: number
  centerTolerance: number
  gameState: GameState
  currentRound: number
  targetPosition: Point
  mousePosition: Point
  onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void
  onMouseClick: (e: MouseEvent<HTMLCanvasElement>) => void
  onTargetPainted: (round: number, paintedAt: number) => void
  onStartGame: (e?: MouseEvent<HTMLElement>) => void
  containerRef: RefObject<HTMLDivElement | null>
}

const GameCanvas = ({
  canvasSize,
  targetRadius,
  centerTolerance,
  gameState,
  currentRound,
  targetPosition,
  mousePosition,
  onMouseMove,
  onMouseClick,
  onTargetPainted,
  onStartGame,
  containerRef,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const CIRCLE_RADIUS = (canvasSize - targetRadius * 2) / 2 - 20
  const centerX = canvasSize / 2
  const centerY = canvasSize / 2
  const showStartOverlay = gameState === 'waiting' || gameState === 'finished'

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvasSize, canvasSize)

    ctx.beginPath()
    ctx.arc(centerX, centerY, CIRCLE_RADIUS, 0, 2 * Math.PI)
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2
    ctx.stroke()

    ctx.beginPath()
    ctx.arc(centerX, centerY, centerTolerance, 0, 2 * Math.PI)
    ctx.strokeStyle = '#9ca3af'
    ctx.lineWidth = 1
    ctx.stroke()

    if (gameState === 'playing') {
      ctx.beginPath()
      ctx.arc(
        targetPosition.x,
        targetPosition.y,
        targetRadius,
        0,
        2 * Math.PI,
      )
      ctx.fillStyle = '#ff0000'
      ctx.fill()
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 2
      ctx.stroke()

      ctx.beginPath()
      ctx.moveTo(centerX, centerY)
      ctx.lineTo(targetPosition.x, targetPosition.y)
      ctx.strokeStyle = '#cccccc'
      ctx.setLineDash([5, 5])
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.setLineDash([])
    }

    ctx.beginPath()
    ctx.arc(mousePosition.x, mousePosition.y, 5, 0, 2 * Math.PI)
    ctx.fillStyle = '#0066cc'
    ctx.fill()
  }, [
    gameState,
    targetPosition,
    mousePosition,
    canvasSize,
    CIRCLE_RADIUS,
    centerX,
    centerY,
    centerTolerance,
  ])

  useEffect(() => {
    if (gameState !== 'playing') return

    const frame = requestAnimationFrame((paintedAt) => {
      onTargetPainted(currentRound, paintedAt)
    })

    return () => cancelAnimationFrame(frame)
  }, [
    currentRound,
    gameState,
    onTargetPainted,
    targetPosition.x,
    targetPosition.y,
  ])

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0 h-full aspect-square bg-white rounded-lg shadow-lg overflow-hidden"
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className={`cursor-crosshair transition duration-200 ${
          showStartOverlay ? 'blur-sm' : ''
        }`}
        style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
        onMouseMove={onMouseMove}
        onClick={onMouseClick}
      />
      {showStartOverlay && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/25">
          <div className="rounded-lg border border-gray-200 bg-white/95 p-6 shadow-xl">
            <button
              type="button"
              className="rounded bg-blue-600 px-6 py-3 text-base font-semibold text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              onClick={onStartGame}
            >
              Начать тест
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default GameCanvas
