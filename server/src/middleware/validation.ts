import { Request, Response, NextFunction } from 'express'
import { RawSessionRequest, TrajectoryPoint } from '../types/game.js'
import { SCORING_CONFIG } from '../config/scoring.js'

const MAX_POINTS_PER_ARRAY = 20000

function isPoint(p: unknown): p is TrajectoryPoint {
  if (typeof p !== 'object' || p === null) return false
  const r = p as Record<string, unknown>
  return (
    typeof r.x === 'number' &&
    typeof r.y === 'number' &&
    typeof r.t === 'number' &&
    Number.isFinite(r.x) &&
    Number.isFinite(r.y) &&
    Number.isFinite(r.t)
  )
}

function validatePointArray(
  arr: unknown,
  name: string,
): string | null {
  if (!Array.isArray(arr)) return `${name} must be an array`
  if (arr.length > MAX_POINTS_PER_ARRAY)
    return `${name} exceeds ${MAX_POINTS_PER_ARRAY} points`
  for (let i = 0; i < arr.length; i++) {
    if (!isPoint(arr[i])) return `${name}[${i}] invalid shape`
    if (i > 0 && (arr[i] as TrajectoryPoint).t < (arr[i - 1] as TrajectoryPoint).t)
      return `${name} timestamps must be monotonic`
  }
  return null
}

export function validateSessionCapture(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const body = req.body as RawSessionRequest

  if (!body || typeof body !== 'object') {
    res.status(400).json({ error: 'invalid body' })
    return
  }

  if (
    typeof body.field_width !== 'number' ||
    typeof body.field_height !== 'number' ||
    typeof body.target_radius !== 'number' ||
    body.field_width <= 0 ||
    body.field_height <= 0 ||
    body.target_radius <= 0
  ) {
    res.status(400).json({ error: 'invalid field dimensions or target_radius' })
    return
  }

  if (!Array.isArray(body.trials) || body.trials.length !== SCORING_CONFIG.ROUNDS_COUNT) {
    res.status(400).json({
      error: `trials must be an array of exactly ${SCORING_CONFIG.ROUNDS_COUNT} entries`,
    })
    return
  }

  for (let i = 0; i < body.trials.length; i++) {
    const t = body.trials[i]
    const numericFields: (keyof typeof t)[] = [
      'round_number',
      'appeared_at_ms',
      'clicked_at_ms',
      'target_x',
      'target_y',
      'start_cursor_x',
      'start_cursor_y',
      'click_x',
      'click_y',
    ]
    for (const f of numericFields) {
      if (typeof t[f] !== 'number' || !Number.isFinite(t[f] as number)) {
        res.status(400).json({ error: `trial ${i}: ${String(f)} must be a finite number` })
        return
      }
    }
    if (t.clicked_at_ms < t.appeared_at_ms) {
      res.status(400).json({ error: `trial ${i}: clicked_at_ms before appeared_at_ms` })
      return
    }

    const trajErr = validatePointArray(t.trajectory, `trial ${i} trajectory`)
    if (trajErr) {
      res.status(400).json({ error: trajErr })
      return
    }
    const btwErr = validatePointArray(t.between_samples, `trial ${i} between_samples`)
    if (btwErr) {
      res.status(400).json({ error: btwErr })
      return
    }
  }

  next()
}
