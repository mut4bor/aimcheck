import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import { toNodeHandler } from 'better-auth/node'
import { GameService } from './services/gameService.js'
import { validateGameResult } from './middleware/validation.js'
import { requireAuth, AuthedRequest } from './middleware/requireAuth.js'
import { GameResultRequest } from './types/game.js'
import { runMigrations } from './database/migrations.js'
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

// Better-auth handler must be mounted BEFORE express.json()
app.all('/api/auth/*splat', toNodeHandler(auth))

app.use(express.json({ limit: '10mb' }))

app.post(
  '/api/game-results',
  requireAuth,
  validateGameResult,
  async (req: AuthedRequest, res) => {
    try {
      const { rounds }: GameResultRequest = req.body
      const gameResultId = await gameService.saveGameResult(req.user!.id, rounds)

      res.status(201).json({
        message: 'Game result saved successfully',
        gameResultId,
        roundsCount: rounds.length,
      })
    } catch (error) {
      console.error('Error saving game result:', error)
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  },
)

app.get('/api/my-results', requireAuth, async (req: AuthedRequest, res) => {
  try {
    const results = await gameService.getUserResults(req.user!.id)
    res.json({ user: req.user, results })
  } catch (error) {
    console.error('Error fetching user results:', error)
    res.status(500).json({ error: 'Internal server error' })
  }
})

app.get(
  '/api/my-results/:gameId',
  requireAuth,
  async (req: AuthedRequest, res) => {
    try {
      const gameId = parseInt(req.params.gameId)
      if (isNaN(gameId)) {
        res.status(400).json({ error: 'Invalid game ID' })
        return
      }
      const details = await gameService.getGameDetailsForUser(
        gameId,
        req.user!.id,
      )
      if (!details) {
        res.status(404).json({ error: 'Game not found' })
        return
      }
      res.json(details)
    } catch (error) {
      console.error('Error fetching game details:', error)
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
