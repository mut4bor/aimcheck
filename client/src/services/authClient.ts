import { createAuthClient } from 'better-auth/react'
import { usernameClient } from 'better-auth/client/plugins'
import { API_URL } from '@/config'

export const authClient = createAuthClient({
  baseURL: API_URL || 'http://localhost:3000',
  plugins: [usernameClient()],
  fetchOptions: {
    credentials: 'include',
  },
})

export const { signIn, signUp, signOut, useSession, getSession } = authClient
