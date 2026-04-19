import { Point } from '@/types'

export const getDistance = (p1: Point, p2: Point): number =>
  Math.hypot(p2.x - p1.x, p2.y - p1.y)

export const checkInCenter = (
  point: Point,
  centerX: number,
  centerY: number,
  tolerance: number,
): boolean => getDistance(point, { x: centerX, y: centerY }) <= tolerance

export const generateTargetPosition = (
  centerX: number,
  centerY: number,
  circleRadius: number,
): Point => {
  const angle = Math.random() * 2 * Math.PI
  return {
    x: centerX + circleRadius * Math.cos(angle),
    y: centerY + circleRadius * Math.sin(angle),
  }
}
