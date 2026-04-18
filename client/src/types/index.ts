export type GameState = 'waiting' | 'preparing' | 'playing' | 'finished'

export interface Point {
  x: number
  y: number
}

export interface RoundResult {
  accuracyScore: number
  distanceFromCenter: number
  time: {
    valueMs: number
    score: number
  }
}

export interface MousePath {
  points: Point[]
  startTime: number
}

export interface Round {
  accuracy_score: number // 0-100
  distance_from_center: number // 0-100 (100 = точное попадание в центр, 0 = максимальное отклонение)
  time: {
    value_ms: number // время в милисекундах
    score: number // 0-100
  } // время
}

export interface GameResultRequest {
  rounds: Round[] // ровно 3 раунда
}

export interface GameResultResponse {
  message: string
  gameResultId: number
  roundsCount: number
}

export interface UserGameResult {
  game_id: number
  created_at: string
  avg_accuracy: string | number
  avg_distance_from_center: string | number
  avg_time_value_ms: string | number
  avg_time_score: string | number
  combined_score: string | number
  rounds_count: string | number
}

export interface ApiError {
  error: string
  message?: string
}
