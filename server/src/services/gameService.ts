import { Pool } from 'pg'
import { dbConfig } from '../config/database.js'
import {
  RawSessionRequest,
  SessionScores,
  TrialScores,
} from '../types/game.js'
import { scoreSession } from './scoringService.js'

export class GameService {
  private pool: Pool

  constructor() {
    this.pool = new Pool(dbConfig)
  }

  async saveSession(
    userId: string,
    raw: RawSessionRequest,
  ): Promise<{
    sessionId: number
    session: SessionScores
    trials: TrialScores[]
  }> {
    const { session, trials } = scoreSession(raw)

    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const sessionQuery = await client.query(
        `INSERT INTO game_sessions
          (user_id, field_width, field_height, target_radius, rounds_count,
           f_hit, f_positioning, f_reaction, f_movement, f_parasitic, f_stability, integral_score)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          userId,
          raw.field_width,
          raw.field_height,
          raw.target_radius,
          raw.trials.length,
          session.f_hit,
          session.f_positioning,
          session.f_reaction,
          session.f_movement,
          session.f_parasitic,
          session.f_stability,
          session.integral_score,
        ],
      )
      const sessionId = sessionQuery.rows[0].id

      for (let i = 0; i < raw.trials.length; i++) {
        const t = raw.trials[i]
        const s = trials[i]
        await client.query(
          `INSERT INTO trials
            (session_id, round_number, appeared_at_ms, clicked_at_ms,
             target_x, target_y, start_cursor_x, start_cursor_y, click_x, click_y,
             trajectory, between_samples,
             rt_ms, hit_distance, hit_score, movement_delta_pct, movement_score,
             overshoots, undershoots, parasitic_score,
             positioning_rho_pct, positioning_score, loops_count, stability_score)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)`,
          [
            sessionId,
            t.round_number,
            t.appeared_at_ms,
            t.clicked_at_ms,
            t.target_x,
            t.target_y,
            t.start_cursor_x,
            t.start_cursor_y,
            t.click_x,
            t.click_y,
            JSON.stringify(t.trajectory),
            JSON.stringify(t.between_samples),
            s.rt_ms,
            s.hit_distance,
            s.hit_score,
            s.movement_delta_pct,
            s.movement_score,
            s.overshoots,
            s.undershoots,
            s.parasitic_score,
            s.positioning_rho_pct,
            s.positioning_score,
            s.loops_count,
            s.stability_score,
          ],
        )
      }

      await client.query('COMMIT')
      return { sessionId, session, trials }
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getUserSessions(userId: string) {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT
          id, created_at, rounds_count,
          f_hit, f_positioning, f_reaction, f_movement, f_parasitic, f_stability,
          integral_score
         FROM game_sessions
         WHERE user_id = $1
         ORDER BY created_at DESC`,
        [userId],
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  async getSessionForUser(sessionId: number, userId: string) {
    const client = await this.pool.connect()
    try {
      const sessRes = await client.query(
        `SELECT * FROM game_sessions WHERE id = $1 AND user_id = $2`,
        [sessionId, userId],
      )
      if (sessRes.rows.length === 0) return null

      const trialsRes = await client.query(
        `SELECT round_number, rt_ms, hit_distance, hit_score,
                movement_delta_pct, movement_score,
                overshoots, undershoots, parasitic_score,
                positioning_rho_pct, positioning_score,
                loops_count, stability_score
         FROM trials WHERE session_id = $1 ORDER BY round_number`,
        [sessionId],
      )

      return { session: sessRes.rows[0], trials: trialsRes.rows }
    } finally {
      client.release()
    }
  }

  async getLeaderboard(limit = 10) {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT
          u.username, u.name,
          COUNT(s.id) AS total_sessions,
          ROUND(AVG(s.integral_score)::numeric, 2) AS avg_integral_score,
          ROUND(MAX(s.integral_score)::numeric, 2) AS best_integral_score
         FROM "user" u
         JOIN game_sessions s ON u.id = s.user_id
         GROUP BY u.id, u.username, u.name
         HAVING COUNT(s.id) >= 1
         ORDER BY best_integral_score DESC
         LIMIT $1`,
        [limit],
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  async close() {
    await this.pool.end()
  }
}
