export interface Round {
  accuracy_score: number
  distance_from_center: number
  time: {
    value_ms: number
    score: number
  }
}

export interface GameResultRequest {
  rounds: Round[]
}
