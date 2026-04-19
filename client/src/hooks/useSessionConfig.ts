import { useEffect, useState } from 'react'
import { GameApiService } from '@/services/gameApiService'
import { SessionConfig } from '@/types'

export const useSessionConfig = () => {
  const [config, setConfig] = useState<SessionConfig | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    GameApiService.getSessionConfig()
      .then((c) => {
        if (!cancelled) setConfig(c)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return { config, error }
}
