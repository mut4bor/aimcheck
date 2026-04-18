import { Request, Response, NextFunction } from 'express'
import { fromNodeHeaders } from 'better-auth/node'
import { auth } from '../auth.js'

export interface AuthedRequest extends Request {
  user?: { id: string; username: string | null; email: string }
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    })

    if (!session) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }

    req.user = {
      id: session.user.id,
      username: (session.user as { username?: string | null }).username ?? null,
      email: session.user.email,
    }
    next()
  } catch (err) {
    console.error('Auth check failed:', err)
    res.status(401).json({ error: 'Unauthorized' })
  }
}
