import axios, { AxiosResponse } from 'axios'
import { GameResultRequest, GameResultResponse, ApiError } from '@/types'
import { API_URL } from '@/config'

// Конфигурация API
const API_BASE_URL = API_URL || 'http://localhost:3000'
const API_TIMEOUT = 10000 // 10 секунд

// Создаем экземпляр axios с базовой конфигурацией
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: API_TIMEOUT,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Интерцептор для обработки ответов
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message)
    return Promise.reject(error)
  },
)

export class GameApiService {
  /**
   * Отправка результатов игры на сервер
   */
  static async submitGameResults(
    data: GameResultRequest,
  ): Promise<GameResultResponse> {
    try {
      const response: AxiosResponse<GameResultResponse> = await apiClient.post(
        '/api/game-results',
        data,
      )

      return response.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        // Обработка ошибок от сервера
        if (error.response) {
          const apiError: ApiError = error.response.data
          throw new Error(apiError.error || 'Server error occurred')
        }

        // Обработка сетевых ошибок
        if (error.request) {
          throw new Error('Network error: Unable to connect to server')
        }
      }

      throw new Error('An unexpected error occurred')
    }
  }

  /**
   * Проверка состояния API
   */
  static async checkHealth(): Promise<{ status: string; timestamp: string }> {
    try {
      const response = await apiClient.get('/api/health')
      return response.data
    } catch (error) {
      throw new Error('API is not available')
    }
  }
}
