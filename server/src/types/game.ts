export interface TrajectoryPoint {
  x: number
  y: number
  t: number // ms timestamp (performance.now or Date.now — monotonic within session)
}

export interface RawTrial {
  round_number: number
  appeared_at_ms: number
  clicked_at_ms: number
  target_x: number
  target_y: number
  start_cursor_x: number
  start_cursor_y: number
  click_x: number
  click_y: number
  trajectory: TrajectoryPoint[]
  between_samples: TrajectoryPoint[]
}

export interface RawSessionRequest {
  field_width: number
  field_height: number
  target_radius: number
  trials: RawTrial[]
}

export interface TrialScores {
  rt_ms: number
  hit_distance: number
  hit_score: number
  movement_delta_pct: number
  movement_score: number
  overshoots: number
  undershoots: number
  parasitic_score: number
  positioning_rho_pct: number | null
  positioning_score: number | null
  loops_count: number
  stability_score: number
}

export interface SessionScores {
  f_hit: number
  f_positioning: number
  f_reaction: number
  f_movement: number
  f_parasitic: number
  f_stability: number
  integral_score: number
}

export interface SessionConfigResponse {
  roundsCount: number
  targetRadius: number
  preparationTimeMs: number
  centerTolerance: number
}
