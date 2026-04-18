import { Point, RoundResult } from '@/types'
import { BASE_GAME_CONFIG } from '@/constants'

export const getDistance = (p1: Point, p2: Point): number => {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
}

export const checkInCenter = (
  point: Point,
  centerX: number,
  centerY: number,
): boolean => {
  const distance = getDistance(point, { x: centerX, y: centerY })
  return distance <= BASE_GAME_CONFIG.CENTER_TOLERANCE
}

export const generateTargetPosition = (
  centerX: number,
  centerY: number,
  circleRadius: number,
): Point => {
  const angle = Math.random() * 2 * Math.PI
  const x = centerX + circleRadius * Math.cos(angle)
  const y = centerY + circleRadius * Math.sin(angle)
  return { x, y }
}

export const calculateAccuracyScore = (
  path: Point[],
  targetPosition: Point,
  centerX: number,
  centerY: number,
): number => {
  if (path.length < 2) return 0

  const start = { x: centerX, y: centerY }
  const end = targetPosition
  const idealLength = getDistance(start, end)

  let totalDeviation = 0
  const pathLength = path.length

  for (let i = 0; i < pathLength; i++) {
    const point = path[i]
    const progress = i / (pathLength - 1)

    const idealX = start.x + (end.x - start.x) * progress
    const idealY = start.y + (end.y - start.y) * progress

    const deviation = getDistance(point, { x: idealX, y: idealY })
    totalDeviation += deviation
  }

  const averageDeviation = totalDeviation / pathLength
  const maxDeviation =
    idealLength * BASE_GAME_CONFIG.MAX_ACCURACY_DEVIATION_RATIO
  const normalizedDeviation = Math.min(1, averageDeviation / maxDeviation)
  const score =
    BASE_GAME_CONFIG.MAX_SCORE_PER_CATEGORY * (1 - normalizedDeviation)

  return Math.max(0, score)
}

export const calculateDistanceFromCenter = (
  finalPosition: Point,
  targetPosition: Point,
): number => {
  const distance = getDistance(finalPosition, targetPosition)
  const maxDistance =
    BASE_GAME_CONFIG.TARGET_SIZE * BASE_GAME_CONFIG.MAX_HIT_DISTANCE_RATIO

  if (distance <= maxDistance) {
    return (
      BASE_GAME_CONFIG.MAX_SCORE_PER_CATEGORY -
      (distance / maxDistance) * BASE_GAME_CONFIG.MAX_SCORE_PER_CATEGORY
    )
  }
  return 0
}

export const calculateTimeScore = (actualTimeMs: number): number => {
  const deviation = Math.abs(actualTimeMs - BASE_GAME_CONFIG.IDEAL_TIME_MS)
  const normalizedDeviation = Math.min(
    1,
    deviation / BASE_GAME_CONFIG.MAX_TIME_DEVIATION_MS,
  )
  const score =
    BASE_GAME_CONFIG.MAX_SCORE_PER_CATEGORY * (1 - normalizedDeviation)

  return Math.max(0, score)
}

export const getTotalScore = (result: RoundResult): number =>
  result.accuracyScore + result.distanceFromCenter + result.time.score
