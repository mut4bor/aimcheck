import axios, { AxiosResponse } from 'axios'
import {
  RawSessionRequest,
  SessionSubmitResponse,
  SessionConfig,
  ApiError,
} from '@/types'
import { API_URL } from '@/config'

const apiClient = axios.create({
  baseURL: API_URL || 'http://localhost:3000',
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  },
)

function wrapError(error: unknown): Error {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      const apiError: ApiError = error.response.data
      return new Error(apiError.error || 'Server error occurred')
    }
    if (error.request) return new Error('Network error: Unable to connect to server')
  }
  return new Error('An unexpected error occurred')
}

export class GameApiService {
  static async getSessionConfig(): Promise<SessionConfig> {
    try {
      const res: AxiosResponse<SessionConfig> = await apiClient.get(
        '/api/session/config',
      )
      return res.data
    } catch (error) {
      throw wrapError(error)
    }
  }

  static async submitSession(
    data: RawSessionRequest,
  ): Promise<SessionSubmitResponse> {
    try {
      const res: AxiosResponse<SessionSubmitResponse> = await apiClient.post(
        '/api/sessions',
        data,
      )
      return res.data
    } catch (error) {
      throw wrapError(error)
    }
  }

  static async checkHealth() {
    try {
      const res = await apiClient.get('/api/health')
      return res.data
    } catch (error) {
      throw new Error('API is not available')
    }
  }
}
