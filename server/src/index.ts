import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { toNodeHandler } from 'better-auth/node'
import { GameService } from './services/gameService.js'
import { validateSessionCapture } from './middleware/validation.js'
import { requireAuth, AuthedRequest } from './middleware/requireAuth.js'
import { RawSessionRequest, SessionConfigResponse } from './types/game.js'
import { runMigrations } from './database/migrations.js'
import { SCORING_CONFIG } from './config/scoring.js'
import { auth } from './auth.js'

dotenv.config()

const app = express()
const port = process.env.PORT || 3000
const gameService = new GameService()

const clientOrigins = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim())

app.use(
  cors({
    origin: clientOrigins,
    credentials: true,
  }),
)

app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json({ limit: '10mb' }))

app.get('/api/session/config', (_req, res) => {
  const payload: SessionConfigResponse = {
    roundsCount: SCORING_CONFIG.ROUNDS_COUNT,
    targetRadius: SCORING_CONFIG.TARGET_RADIUS,
    preparationTimeMs: SCORING_CONFIG.PREPARATION_TIME_MS,
    centerTolerance: SCORING_CONFIG.CENTER_TOLERANCE,
  }
  res.json(payload)
})

app.post(
  '/api/sessions',
  requireAuth,
  validateSessionCapture,
  async (req: AuthedRequest, res) => {
    try {
      const raw = req.body as RawSessionRequest
      const result = await gameService.saveSession(req.user!.id, raw)
      res.status(201).json({
        sessionId: result.sessionId,
        session: result.session,
        trials: result.trials,
      })
    } catch (error) {
      console.error('Error saving session:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
)

app.get('/api/my-results', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const sessions = await gameService.getUserSessions(req.user!.id)
    res.json({ user: req.user, sessions })
  } catch (error) {
    console.error('Error fetching user sessions:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get(
  '/api/my-results/:sessionId',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const sessionId = parseInt(req.params.sessionId)
      if (isNaN(sessionId)) {
        res.status(400).json({ error: 'Invalid session ID' })
        return
      }
      const details = await gameService.getSessionForUser(
        sessionId,
        req.user!.id,
      )
      if (!details) {
        res.status(404).json({ error: 'Session not found' })
        return
      }
      res.json(details)
    } catch (error) {
      console.error('Error fetching session details:', error)
      res.status(500).json({ error: 'Internal server error' })
    }
  },
)

app.get('/api/leaderboard', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10
    res.json(await gameService.getLeaderboard(limit))
  } catch (error) {
    console.error('Error fetching leaderboard:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() })
})

app.use(
  (
    err: Error,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error(err.stack)
    res.status(500).json({ error: 'Something went wrong!' })
  },
)

async function startServer() {
  try {
    await runMigrations()

    app.listen(port, () => {
      console.log(`Server running at http://localhost:${port}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...')
  await gameService.close()
  process.exit(0)
})
