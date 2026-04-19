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

function reactionScore(rtMs: number): number {
  if (rtMs < 300) return 100
  if (rtMs < 400) return 80
  if (rtMs < 500) return 60
  if (rtMs <= 550) return 50
  return 0
}

function hitScore(d: number, R: number): number {
  if (d <= 0.2 * R) return 100
  if (d <= 0.5 * R) return 85
  if (d <= R) return 50
  return 0
}

function movementScore(deltaPct: number): number {
  if (deltaPct <= 5) return 100
  if (deltaPct <= 10) return 90
  if (deltaPct <= 15) return 80
  if (deltaPct <= 19) return 60
  if (deltaPct <= 25) return 50
  if (deltaPct <= 30) return 40
  if (deltaPct <= 40) return 30
  return 0
}

function parasiticScore(k: number): number {
  if (k === 0) return 100
  if (k === 1) return 70
  if (k === 2) return 40
  return 0
}

function positioningScore(rhoPct: number): number {
  if (rhoPct <= 5) return 100
  if (rhoPct <= 10) return 85
  if (rhoPct <= 20) return 70
  if (rhoPct <= 35) return 50
  return 0
}

function stabilityScore(loops: number): number {
  if (loops === 0) return 100
  if (loops === 1) return 75
  if (loops === 2) return 50
  if (loops === 3) return 25
  return 0
}

function computeMPD(
  trajectory: TrajectoryPoint[],
  x0: number,
  y0: number,
  xm: number,
  ym: number,
): { mpd: number; sLen: number } {
  const sx = xm - x0
  const sy = ym - y0
  const sLen = Math.hypot(sx, sy)
  if (sLen === 0 || trajectory.length === 0) return { mpd: 0, sLen }

  let sum = 0
  for (const p of trajectory) {
    const num = Math.abs((p.x - x0) * sy - (p.y - y0) * sx)
    sum += num / sLen
  }
  return { mpd: sum / trajectory.length, sLen }
}

function countOvershoots(
  trajectory: TrajectoryPoint[],
  xm: number,
  ym: number,
  R: number,
): number {
  if (trajectory.length < 2) return 0
  let minIdx = 0
  let minD = dist(trajectory[0].x, trajectory[0].y, xm, ym)
  for (let i = 1; i < trajectory.length; i++) {
    const d = dist(trajectory[i].x, trajectory[i].y, xm, ym)
    if (d < minD) {
      minD = d
      minIdx = i
    }
  }
  if (minD >= R) return 0
  for (let j = minIdx + 1; j < trajectory.length; j++) {
    if (dist(trajectory[j].x, trajectory[j].y, xm, ym) > R) return 1
  }
  return 0
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

function countLoops(trajectory: TrajectoryPoint[]): number {
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
  return loops
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

  const { mpd, sLen } = computeMPD(
    trial.trajectory,
    trial.start_cursor_x,
    trial.start_cursor_y,
    trial.target_x,
    trial.target_y,
  )
  const delta = sLen > 0 ? (mpd / sLen) * 100 : 0

  const over = countOvershoots(
    trial.trajectory,
    trial.target_x,
    trial.target_y,
    targetRadius,
  )
  const under = countUndershoots(
    trial.trajectory,
    trial.target_x,
    trial.target_y,
    targetRadius,
  )
  const loops = countLoops(trial.trajectory)

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

  const avgRT = avg(trials.map((t) => t.rt_ms))
  const reactionAgg = reactionScore(avgRT)

  const hitAgg = avg(trials.map((t) => t.hit_score))
  const movementAgg = avg(trials.map((t) => t.movement_score))
  const parasiticAgg = avg(trials.map((t) => t.parasitic_score))
  const stabilityAgg = avg(trials.map((t) => t.stability_score))

  const positioningValues = trials
    .map((t) => t.positioning_score)
    .filter((v): v is number => v !== null)
  const positioningAgg = avg(positioningValues)

  const w = SCORING_CONFIG.WEIGHTS
  const integral =
    (w.hit * hitAgg +
      w.positioning * positioningAgg +
      w.reaction * reactionAgg +
      w.movement * movementAgg +
      w.parasitic * parasiticAgg +
      w.stability * stabilityAgg) /
    WEIGHT_SUM

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
