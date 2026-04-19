export const SCORING_CONFIG = {
  ROUNDS_COUNT: 40,
  TARGET_RADIUS: 20,
  PREPARATION_TIME_MS: 2000,
  CENTER_TOLERANCE: 20,

  UNDERSHOOT_VELOCITY_EPSILON: 0.05, // px/ms
  UNDERSHOOT_PAUSE_MS: 50,

  MIN_SEGMENT_LENGTH: 2, // px

  WEIGHTS: {
    hit: 1.5,
    positioning: 1.5,
    reaction: 1.0,
    movement: 0.75,
    parasitic: 0.5,
    stability: 0.5,
  },
} as const

export const WEIGHT_SUM =
  SCORING_CONFIG.WEIGHTS.hit +
  SCORING_CONFIG.WEIGHTS.positioning +
  SCORING_CONFIG.WEIGHTS.reaction +
  SCORING_CONFIG.WEIGHTS.movement +
  SCORING_CONFIG.WEIGHTS.parasitic +
  SCORING_CONFIG.WEIGHTS.stability
