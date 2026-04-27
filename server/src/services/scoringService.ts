import {
  RawTrial,
  RawSessionRequest,
  TrialScores,
  SessionScores,
  TrajectoryPoint,
} from '../types/game.js'
import { SCORING_CONFIG, WEIGHT_SUM } from '../config/scoring.js'

const dist = (ax: number, ay: number, bx: number, by: number): number =>
  Math.hypot(ax - bx, ay - by)

type ThresholdScoreEntry = {
  max: number
  score: number
}

type ExactScoreEntry = {
  value: number
  score: number
}

function thresholdScore(
  value: number,
  table: readonly ThresholdScoreEntry[],
): number {
  const entry = table.find((item) => value <= item.max)
  return entry?.score ?? SCORING_CONFIG.SCORE_TABLES.defaultScore
}

function cappedExactScore(
  value: number,
  table: readonly ExactScoreEntry[],
): number {
  const exact = table.find((item) => item.value === value)
  if (exact) return exact.score

  const last = table[table.length - 1]
  if (last && value > last.value) return last.score

  return SCORING_CONFIG.SCORE_TABLES.defaultScore
}

function reactionScore(rtMs: number): number {
  return thresholdScore(rtMs, SCORING_CONFIG.SCORE_TABLES.reaction)
}

function hitScore(d: number, R: number): number {
  return thresholdScore(d / R, SCORING_CONFIG.SCORE_TABLES.hit)
}

function movementScore(deltaPct: number): number {
  return thresholdScore(deltaPct, SCORING_CONFIG.SCORE_TABLES.movement)
}

function parasiticScore(k: number): number {
  return cappedExactScore(k, SCORING_CONFIG.SCORE_TABLES.parasitic)
}

function positioningScore(rhoPct: number): number {
  return thresholdScore(rhoPct, SCORING_CONFIG.SCORE_TABLES.positioning)
}

function stabilityScore(loops: number): number {
  return cappedExactScore(loops, SCORING_CONFIG.SCORE_TABLES.stability)
}

function pathLength(points: TrajectoryPoint[]): number {
  let length = 0
  for (let i = 1; i < points.length; i++) {
    length += dist(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y)
  }
  return length
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const vx = bx - ax
  const vy = by - ay
  const lenSq = vx * vx + vy * vy
  if (lenSq === 0) return dist(px, py, ax, ay)

  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / lenSq))
  return dist(px, py, ax + vx * t, ay + vy * t)
}

function computeTrajectoryDifference(
  trajectory: TrajectoryPoint[],
  idealStartX: number,
  idealStartY: number,
  xm: number,
  ym: number,
): number {
  const idealLength = dist(idealStartX, idealStartY, xm, ym)
  if (idealLength === 0 || trajectory.length === 0) return 0

  const actualLength = pathLength(trajectory)
  const pathExcessPct = Math.max(
    0,
    ((actualLength - idealLength) / idealLength) * 100,
  )

  let deviationSum = 0
  for (const p of trajectory) {
    deviationSum += distanceToSegment(
      p.x,
      p.y,
      idealStartX,
      idealStartY,
      xm,
      ym,
    )
  }

  const meanDeviationPct =
    ((deviationSum / trajectory.length) / idealLength) * 100

  return pathExcessPct + meanDeviationPct * 2
}

function countOvershoots(
  trajectory: TrajectoryPoint[],
  xm: number,
  ym: number,
  R: number,
): number {
  if (trajectory.length < 2) return 0

  let count = 0
  let wasInside = dist(trajectory[0].x, trajectory[0].y, xm, ym) <= R

  for (let i = 1; i < trajectory.length; i++) {
    const isInside = dist(trajectory[i].x, trajectory[i].y, xm, ym) <= R
    if (wasInside && !isInside) count++
    wasInside = isInside
  }

  return count
}

function countUndershoots(
  trajectory: TrajectoryPoint[],
  xm: number,
  ym: number,
  R: number,
): number {
  if (trajectory.length < 2) return 0
  const { UNDERSHOOT_VELOCITY_EPSILON: eps, UNDERSHOOT_PAUSE_MS: pauseMs } =
    SCORING_CONFIG

  let count = 0
  let pauseStart: number | null = null
  let pauseOutside = false

  for (let i = 1; i < trajectory.length; i++) {
    const prev = trajectory[i - 1]
    const cur = trajectory[i]
    const dt = cur.t - prev.t
    const v = dt > 0 ? Math.hypot(cur.x - prev.x, cur.y - prev.y) / dt : 0
    const d = dist(cur.x, cur.y, xm, ym)

    if (v < eps) {
      if (pauseStart === null) {
        pauseStart = prev.t
        pauseOutside = dist(prev.x, prev.y, xm, ym) > R
      }
      if (!pauseOutside && d > R) pauseOutside = true
    } else {
      if (pauseStart !== null) {
        const duration = prev.t - pauseStart
        if (duration >= pauseMs && pauseOutside && i < trajectory.length - 1) {
          count++
        }
        pauseStart = null
        pauseOutside = false
      }
    }
  }

  if (pauseStart !== null) {
    const last = trajectory[trajectory.length - 1]
    const duration = last.t - pauseStart
    if (duration >= pauseMs && pauseOutside) count++
  }

  return count
}

function segmentsIntersect(
  a: TrajectoryPoint,
  b: TrajectoryPoint,
  c: TrajectoryPoint,
  d: TrajectoryPoint,
): boolean {
  const cross = (
    p: TrajectoryPoint,
    q: TrajectoryPoint,
    r: TrajectoryPoint,
  ): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)
  const s1 = sign(cross(a, b, c))
  const s2 = sign(cross(a, b, d))
  const s3 = sign(cross(c, d, a))
  const s4 = sign(cross(c, d, b))
  return s1 !== s2 && s3 !== s4
}

function countClosedReturnLoops(
  trajectory: TrajectoryPoint[],
  closureRadius: number,
  minPathLength: number,
): number {
  if (trajectory.length < 3) return 0

  const pathLengths = [0]
  for (let i = 1; i < trajectory.length; i++) {
    pathLengths[i] =
      pathLengths[i - 1] +
      dist(trajectory[i - 1].x, trajectory[i - 1].y, trajectory[i].x, trajectory[i].y)
  }

  let loops = 0
  let lastLoopEndIdx = -1
  for (let i = 0; i < trajectory.length; i++) {
    if (i <= lastLoopEndIdx) continue

    for (let j = i + 2; j < trajectory.length; j++) {
      const pathLength = pathLengths[j] - pathLengths[i]
      if (pathLength < minPathLength) continue

      if (
        dist(trajectory[i].x, trajectory[i].y, trajectory[j].x, trajectory[j].y) <=
        closureRadius
      ) {
        loops++
        lastLoopEndIdx = j
        break
      }
    }
  }

  return loops
}

function countLoops(trajectory: TrajectoryPoint[], targetRadius: number): number {
  const minLen = SCORING_CONFIG.MIN_SEGMENT_LENGTH
  const segs: [TrajectoryPoint, TrajectoryPoint][] = []
  for (let i = 0; i < trajectory.length - 1; i++) {
    const a = trajectory[i]
    const b = trajectory[i + 1]
    if (Math.hypot(b.x - a.x, b.y - a.y) >= minLen) segs.push([a, b])
  }
  let loops = 0
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 2; j < segs.length; j++) {
      if (segmentsIntersect(segs[i][0], segs[i][1], segs[j][0], segs[j][1])) {
        loops++
      }
    }
  }

  const closedReturnLoops = countClosedReturnLoops(
    trajectory,
    targetRadius * SCORING_CONFIG.LOOP_CLOSURE_RADIUS_RATIO,
    targetRadius * SCORING_CONFIG.LOOP_MIN_PATH_LENGTH_RATIO,
  )

  return loops + closedReturnLoops
}

function positioningRho(
  samples: TrajectoryPoint[],
  cx: number,
  cy: number,
  diagonal: number,
): number | null {
  if (samples.length === 0 || diagonal === 0) return null
  let sum = 0
  for (const s of samples) sum += dist(s.x, s.y, cx, cy)
  return ((sum / samples.length) / diagonal) * 100
}

export function scoreTrial(
  trial: RawTrial,
  targetRadius: number,
  fieldCenterX: number,
  fieldCenterY: number,
  diagonal: number,
): TrialScores {
  const rt = trial.clicked_at_ms - trial.appeared_at_ms
  const hitD = dist(trial.click_x, trial.click_y, trial.target_x, trial.target_y)

  const trajectoryWithClick = [
    {
      x: trial.start_cursor_x,
      y: trial.start_cursor_y,
      t: trial.appeared_at_ms,
    },
    ...trial.trajectory,
    { x: trial.click_x, y: trial.click_y, t: trial.clicked_at_ms },
  ]

  const delta = computeTrajectoryDifference(
    trajectoryWithClick,
    fieldCenterX,
    fieldCenterY,
    trial.target_x,
    trial.target_y,
  )

  const over = countOvershoots(
    trajectoryWithClick,
    trial.target_x,
    trial.target_y,
    targetRadius,
  )
  const under = countUndershoots(
    trajectoryWithClick,
    trial.target_x,
    trial.target_y,
    targetRadius,
  )
  const loops = countLoops(trajectoryWithClick, targetRadius)

  const rho = positioningRho(
    trial.between_samples,
    fieldCenterX,
    fieldCenterY,
    diagonal,
  )

  return {
    rt_ms: rt,
    hit_distance: hitD,
    hit_score: hitScore(hitD, targetRadius),
    movement_delta_pct: delta,
    movement_score: movementScore(delta),
    overshoots: over,
    undershoots: under,
    parasitic_score: parasiticScore(over + under),
    positioning_rho_pct: rho,
    positioning_score: rho === null ? null : positioningScore(rho),
    loops_count: loops,
    stability_score: stabilityScore(loops),
  }
}

export function scoreSession(
  raw: RawSessionRequest,
): { session: SessionScores; trials: TrialScores[] } {
  const cx = raw.field_width / 2
  const cy = raw.field_height / 2
  const diagonal = Math.hypot(raw.field_width, raw.field_height)
  const R = raw.target_radius

  const trials = raw.trials.map((t) => scoreTrial(t, R, cx, cy, diagonal))

  const avg = (xs: number[]): number =>
    xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length

  const reactionAgg = avg(trials.map((t) => reactionScore(t.rt_ms)))

  const hitAgg = avg(trials.map((t) => t.hit_score))
  const movementAgg = avg(trials.map((t) => t.movement_score))
  const parasiticAgg = avg(trials.map((t) => t.parasitic_score))
  const stabilityAgg = avg(trials.map((t) => t.stability_score))

  const positioningValues = trials
    .map((t) => t.positioning_score)
    .filter((v): v is number => v !== null)
  const hasPositioning = positioningValues.length > 0
  const positioningAgg = avg(positioningValues)

  const w = SCORING_CONFIG.WEIGHTS
  const activeWeightSum =
    WEIGHT_SUM - (hasPositioning ? 0 : w.positioning)
  const integral =
    (w.hit * hitAgg +
      (hasPositioning ? w.positioning * positioningAgg : 0) +
      w.reaction * reactionAgg +
      w.movement * movementAgg +
      w.parasitic * parasiticAgg +
      w.stability * stabilityAgg) /
    activeWeightSum

  return {
    session: {
      f_hit: hitAgg,
      f_positioning: positioningAgg,
      f_reaction: reactionAgg,
      f_movement: movementAgg,
      f_parasitic: parasiticAgg,
      f_stability: stabilityAgg,
      integral_score: integral,
    },
    trials,
  }
}
