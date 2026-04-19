import { useRef, useEffect, MouseEvent, RefObject } from 'react'
import { Point, GameState } from '@/types'
import { UI_CONFIG } from '@/constants'

interface Props {
  canvasSize: number
  targetRadius: number
  centerTolerance: number
  gameState: GameState
  targetPosition: Point
  mousePosition: Point
  isInCenter: boolean
  holdProgress?: number
  onMouseMove: (e: MouseEvent<HTMLCanvasElement>) => void
  onMouseClick: (e: MouseEvent<HTMLCanvasElement>) => void
  containerRef: RefObject<HTMLDivElement | null>
}

const GameCanvas = ({
  canvasSize,
  targetRadius,
  centerTolerance,
  gameState,
  targetPosition,
  mousePosition,
  isInCenter,
  holdProgress = 0,
  onMouseMove,
  onMouseClick,
  containerRef,
}: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const CIRCLE_RADIUS = (canvasSize - targetRadius * 2) / 2 - 20
  const centerX = canvasSize / 2
  const centerY = canvasSize / 2

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
    ctx.strokeStyle = isInCenter ? '#00ff00' : '#ff0000'
    ctx.lineWidth = 1
    ctx.stroke()

    if (
      (gameState === 'waiting' || gameState === 'finished') &&
      holdProgress > 0
    ) {
      ctx.beginPath()
      ctx.arc(
        centerX,
        centerY,
        centerTolerance - 2,
        -Math.PI / 2,
        -Math.PI / 2 + 2 * Math.PI * holdProgress,
      )
      ctx.strokeStyle = 'rgba(0,150,255,0.7)'
      ctx.lineWidth = 4
      ctx.stroke()
    }

    if (gameState === 'playing') {
      ctx.beginPath()
      ctx.arc(
        targetPosition.x,
        targetPosition.y,
        UI_CONFIG.TARGET_SIZE,
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
    isInCenter,
    canvasSize,
    CIRCLE_RADIUS,
    holdProgress,
    centerX,
    centerY,
    centerTolerance,
  ])

  return (
    <div
      className="flex items-center justify-center flex-shrink-0 h-full aspect-square bg-white rounded-lg shadow-lg"
      ref={containerRef}
    >
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        className="cursor-crosshair"
        style={{ width: `${canvasSize}px`, height: `${canvasSize}px` }}
        onMouseMove={onMouseMove}
        onClick={onMouseClick}
      />
    </div>
  )
}

export default GameCanvas
