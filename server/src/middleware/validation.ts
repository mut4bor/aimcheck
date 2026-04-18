import { Request, Response, NextFunction } from 'express'
import { GameResultRequest } from '../types/game.js'

export function validateGameResult(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const { rounds }: GameResultRequest = req.body

  if (!rounds || !Array.isArray(rounds)) {
    res.status(400).json({ error: 'rounds must be an array' })
    return
  }

  if (rounds.length !== 3) {
    res.status(400).json({ error: 'Must contain exactly 3 rounds' })
    return
  }

  for (let i = 0; i < rounds.length; i++) {
    const round = rounds[i]

    if (
      typeof round.accuracy_score !== 'number' ||
      typeof round.distance_from_center !== 'number' ||
      typeof round.time !== 'object' ||
      round.time === null
    ) {
      res.status(400).json({
        error: `Round ${i + 1}: invalid field types`,
      })
      return
    }

    if (
      typeof round.time.value_ms !== 'number' ||
      typeof round.time.score !== 'number'
    ) {
      res
        .status(400)
        .json({ error: `Round ${i + 1}: time.value_ms and time.score must be numbers` })
      return
    }

    if (round.accuracy_score < 0 || round.accuracy_score > 100) {
      res.status(400).json({ error: `Round ${i + 1}: accuracy_score out of range` })
      return
    }

    if (round.distance_from_center < 0 || round.distance_from_center > 100) {
      res
        .status(400)
        .json({ error: `Round ${i + 1}: distance_from_center out of range` })
      return
    }

    if (round.time.value_ms <= 0) {
      res.status(400).json({ error: `Round ${i + 1}: time.value_ms must be positive` })
      return
    }

    if (round.time.score < 0 || round.time.score > 100) {
      res.status(400).json({ error: `Round ${i + 1}: time.score out of range` })
      return
    }

    if (
      !Number.isInteger(round.accuracy_score) ||
      !Number.isInteger(round.distance_from_center) ||
      !Number.isInteger(round.time.score)
    ) {
      res.status(400).json({ error: `Round ${i + 1}: scores must be integers` })
      return
    }
  }

  next()
}
