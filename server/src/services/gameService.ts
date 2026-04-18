import { Pool } from 'pg'
import { dbConfig } from '../config/database.js'
import { Round } from '../types/game.js'

export class GameService {
  private pool: Pool

  constructor() {
    this.pool = new Pool(dbConfig)
  }

  async saveGameResult(userId: string, rounds: Round[]): Promise<number> {
    const client = await this.pool.connect()
    try {
      await client.query('BEGIN')

      const gameResultQuery = await client.query(
        'INSERT INTO game_results (user_id) VALUES ($1) RETURNING id',
        [userId],
      )

      const gameResultId = gameResultQuery.rows[0].id

      for (let i = 0; i < rounds.length; i++) {
        const round = rounds[i]
        await client.query(
          `INSERT INTO rounds
           (game_result_id, round_number, accuracy_score, distance_from_center, time_value_ms, time_score)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            gameResultId,
            i + 1,
            round.accuracy_score,
            round.distance_from_center,
            round.time.value_ms,
            round.time.score,
          ],
        )
      }

      await client.query('COMMIT')
      return gameResultId
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  }

  async getUserResults(userId: string): Promise<any[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT
          gr.id as game_id,
          gr.created_at,
          ROUND(AVG(r.accuracy_score), 2) as avg_accuracy,
          ROUND(AVG(r.distance_from_center), 2) as avg_distance_from_center,
          ROUND(AVG(r.time_value_ms), 2) as avg_time_value_ms,
          ROUND(AVG(r.time_score), 2) as avg_time_score,
          ROUND(AVG(r.accuracy_score + r.distance_from_center + r.time_score), 2) as combined_score,
          COUNT(r.id) as rounds_count
        FROM game_results gr
        LEFT JOIN rounds r ON gr.id = r.game_result_id
        WHERE gr.user_id = $1
        GROUP BY gr.id, gr.created_at
        ORDER BY gr.created_at DESC`,
        [userId],
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  async getGameDetailsForUser(
    gameId: number,
    userId: string,
  ): Promise<any | null> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT
          gr.id as game_id,
          gr.created_at,
          r.round_number,
          r.accuracy_score,
          r.distance_from_center,
          r.time_value_ms,
          r.time_score
        FROM game_results gr
        JOIN rounds r ON gr.id = r.game_result_id
        WHERE gr.id = $1 AND gr.user_id = $2
        ORDER BY r.round_number`,
        [gameId, userId],
      )

      if (result.rows.length === 0) return null

      return {
        game_id: result.rows[0].game_id,
        created_at: result.rows[0].created_at,
        rounds: result.rows.map((row) => ({
          round_number: row.round_number,
          accuracy_score: row.accuracy_score,
          distance_from_center: row.distance_from_center,
          time: {
            value_ms: row.time_value_ms,
            score: row.time_score,
          },
        })),
      }
    } finally {
      client.release()
    }
  }

  async getLeaderboard(limit: number = 10): Promise<any[]> {
    const client = await this.pool.connect()
    try {
      const result = await client.query(
        `SELECT
          u.username,
          u.name,
          COUNT(DISTINCT gr.id) as total_games,
          ROUND(AVG(r.accuracy_score), 2) as avg_accuracy,
          ROUND(AVG(r.distance_from_center), 2) as avg_distance_from_center,
          ROUND(AVG(r.time_value_ms), 2) as avg_time_value_ms,
          ROUND(AVG(r.time_score), 2) as avg_time_score,
          ROUND(AVG(r.accuracy_score + r.distance_from_center + r.time_score), 2) as combined_score
        FROM "user" u
        JOIN game_results gr ON u.id = gr.user_id
        JOIN rounds r ON gr.id = r.game_result_id
        GROUP BY u.id, u.username, u.name
        HAVING COUNT(DISTINCT gr.id) >= 1
        ORDER BY combined_score DESC, avg_time_value_ms ASC
        LIMIT $1`,
        [limit],
      )
      return result.rows
    } finally {
      client.release()
    }
  }

  async close(): Promise<void> {
    await this.pool.end()
  }
}
