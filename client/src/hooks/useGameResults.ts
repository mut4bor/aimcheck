import { useState, useCallback } from 'react'
import { GameApiService } from '@/services/gameApiService'
import { RawSessionRequest, SessionSubmitResponse } from '@/types'

interface UseGameResultsReturn {
  submitResults: (data: RawSessionRequest) => Promise<SessionSubmitResponse>
  isLoading: boolean
  error: string | null
  lastResponse: SessionSubmitResponse | null
}

export const useGameResults = (): UseGameResultsReturn => {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResponse, setLastResponse] =
    useState<SessionSubmitResponse | null>(null)

  const submitResults = useCallback(
    async (data: RawSessionRequest): Promise<SessionSubmitResponse> => {
      setIsLoading(true)
      setError(null)
      try {
        const response = await GameApiService.submitSession(data)
        setLastResponse(response)
        return response
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error occurred'
        setError(msg)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [],
  )

  return { submitResults, isLoading, error, lastResponse }
}
