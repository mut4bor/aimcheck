export const BASE_GAME_CONFIG = {
  TARGET_SIZE: 20,
  CENTER_TOLERANCE: 20,
  ROUNDS_COUNT: 40,
  PREPARATION_TIME: 2000,
  MAX_SCORE_PER_CATEGORY: 100,
  IS_RESULT_OUT_OF_SHOWN: true,

  // Скорость наведения
  IDEAL_TIME_MS: 520, // эталонное время ~0.52с (из примера в описании)
  MAX_TIME_DEVIATION_MS: 1200, // порог ошибки: >1200мс

  // Точность движений
  MAX_ACCURACY_DEVIATION_RATIO: 0.15, // порог ошибки: >15% длины эталонной прямой

  // Точность попадания
  MAX_HIT_DISTANCE_RATIO: 0.2, // порог ошибки: >20% радиуса мишени
}
