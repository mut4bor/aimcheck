export type GameState = 'waiting' | 'preparing' | 'playing' | 'finished'

export interface Point {
  x: number
  y: number
}

export interface TrajectoryPoint {
  x: number
  y: number
  t: number
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

export interface SessionSubmitResponse {
  sessionId: number
  session: SessionScores
  trials: TrialScores[]
}

export interface SessionConfig {
  roundsCount: number
  targetRadius: number
  preparationTimeMs: number
  centerTolerance: number
}

export interface UserSessionSummary {
  id: number
  created_at: string
  rounds_count: number
  f_hit: number
  f_positioning: number
  f_reaction: number
  f_movement: number
  f_parasitic: number
  f_stability: number
  integral_score: number
}

export interface SessionTrialRow {
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

export interface SessionDetailResponse {
  session: UserSessionSummary & {
    field_width: number
    field_height: number
    target_radius: number
  }
  trials: SessionTrialRow[]
}

export interface ApiError {
  error: string
  message?: string
}
