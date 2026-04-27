export const SCORING_CONFIG = {
  ROUNDS_COUNT: 40,
  TARGET_RADIUS: 20,
  PREPARATION_TIME_MS: 2000,
  CENTER_TOLERANCE: 20,

  UNDERSHOOT_VELOCITY_EPSILON: 0.05, // px/ms
  UNDERSHOOT_PAUSE_MS: 50,

  MIN_SEGMENT_LENGTH: 2, // px
  LOOP_CLOSURE_RADIUS_RATIO: 0.75,
  LOOP_MIN_PATH_LENGTH_RATIO: 4,

  WEIGHTS: {
    hit: 1.5,
    positioning: 1.5,
    reaction: 1.0,
    movement: 0.75,
    parasitic: 0.5,
    stability: 0.5,
  },

  SCORE_TABLES: {
    defaultScore: 0,
    reaction: [
      { max: 450, score: 100 },
      { max: 550, score: 90 },
      { max: 700, score: 75 },
      { max: 850, score: 60 },
      { max: 1000, score: 45 },
      { max: 1200, score: 25 },
    ],
    hit: [
      { max: 0.2, score: 100 },
      { max: 0.5, score: 85 },
      { max: 1, score: 50 },
    ],
    movement: [
      { max: 5, score: 100 },
      { max: 10, score: 90 },
      { max: 15, score: 80 },
      { max: 19, score: 60 },
      { max: 25, score: 50 },
      { max: 30, score: 40 },
      { max: 40, score: 30 },
    ],
    parasitic: [
      { value: 0, score: 100 },
      { value: 1, score: 70 },
      { value: 2, score: 40 },
    ],
    positioning: [
      { max: 5, score: 100 },
      { max: 10, score: 85 },
      { max: 20, score: 70 },
      { max: 35, score: 50 },
    ],
    stability: [
      { value: 0, score: 100 },
      { value: 1, score: 75 },
      { value: 2, score: 50 },
      { value: 3, score: 25 },
    ],
  },
} as const

export const WEIGHT_SUM =
  SCORING_CONFIG.WEIGHTS.hit +
  SCORING_CONFIG.WEIGHTS.positioning +
  SCORING_CONFIG.WEIGHTS.reaction +
  SCORING_CONFIG.WEIGHTS.movement +
  SCORING_CONFIG.WEIGHTS.parasitic +
  SCORING_CONFIG.WEIGHTS.stability
