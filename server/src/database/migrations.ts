import { Pool } from 'pg'
import { dbConfig } from '../config/database.js'

const pool = new Pool(dbConfig)

export async function runMigrations() {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // better-auth core tables
    await client.query(`
      CREATE TABLE IF NOT EXISTS "user" (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
        image TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        username TEXT UNIQUE,
        "displayUsername" TEXT
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        "expiresAt" TIMESTAMP NOT NULL,
        token TEXT NOT NULL UNIQUE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "ipAddress" TEXT,
        "userAgent" TEXT,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS account (
        id TEXT PRIMARY KEY,
        "accountId" TEXT NOT NULL,
        "providerId" TEXT NOT NULL,
        "userId" TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        "accessToken" TEXT,
        "refreshToken" TEXT,
        "idToken" TEXT,
        "accessTokenExpiresAt" TIMESTAMP,
        "refreshTokenExpiresAt" TIMESTAMP,
        scope TEXT,
        password TEXT,
        "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS verification (
        id TEXT PRIMARY KEY,
        identifier TEXT NOT NULL,
        value TEXT NOT NULL,
        "expiresAt" TIMESTAMP NOT NULL,
        "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `)

    // Drop obsolete legacy tables only. Current game history lives in
    // game_sessions/trials and must survive every backend restart.
    await client.query(`DROP TABLE IF EXISTS rounds CASCADE`)
    await client.query(`DROP TABLE IF EXISTS game_results CASCADE`)

    await client.query(`
      CREATE TABLE IF NOT EXISTS game_sessions (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        field_width INTEGER NOT NULL,
        field_height INTEGER NOT NULL,
        target_radius REAL NOT NULL,
        rounds_count INTEGER NOT NULL,
        f_hit REAL NOT NULL,
        f_positioning REAL NOT NULL,
        f_reaction REAL NOT NULL,
        f_movement REAL NOT NULL,
        f_parasitic REAL NOT NULL,
        f_stability REAL NOT NULL,
        integral_score REAL NOT NULL
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS trials (
        id SERIAL PRIMARY KEY,
        session_id INTEGER NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
        round_number INTEGER NOT NULL,
        appeared_at_ms DOUBLE PRECISION NOT NULL,
        clicked_at_ms DOUBLE PRECISION NOT NULL,
        target_x REAL NOT NULL,
        target_y REAL NOT NULL,
        start_cursor_x REAL NOT NULL,
        start_cursor_y REAL NOT NULL,
        click_x REAL NOT NULL,
        click_y REAL NOT NULL,
        trajectory JSONB NOT NULL,
        between_samples JSONB NOT NULL,
        rt_ms REAL NOT NULL,
        hit_distance REAL NOT NULL,
        hit_score REAL NOT NULL,
        movement_delta_pct REAL NOT NULL,
        movement_score REAL NOT NULL,
        overshoots INTEGER NOT NULL,
        undershoots INTEGER NOT NULL,
        parasitic_score REAL NOT NULL,
        positioning_rho_pct REAL,
        positioning_score REAL,
        loops_count INTEGER NOT NULL,
        stability_score REAL NOT NULL
      )
    `)

    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_trials_session ON trials(session_id, round_number)`,
    )
    await client.query(
      `CREATE INDEX IF NOT EXISTS idx_sessions_user ON game_sessions(user_id, created_at DESC)`,
    )

    await client.query('COMMIT')
    console.log('Migrations completed successfully')
  } catch (error) {
    await client.query('ROLLBACK')
    console.error('Migration failed:', error)
    throw error
  } finally {
    client.release()
  }
}

import { fileURLToPath } from 'url'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1))
}
