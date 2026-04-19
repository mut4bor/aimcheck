import { BrowserRouter, Routes, Route } from 'react-router-dom'
import GameScreen from '@/components/GameScreen'
import Login from '@/components/Login'
import Register from '@/components/Register'
import Profile from '@/components/Profile'
import SessionDetail from '@/components/SessionDetail'
import RequireAuth from '@/components/RequireAuth'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <Profile />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/sessions/:id"
          element={
            <RequireAuth>
              <SessionDetail />
            </RequireAuth>
          }
        />
        <Route
          path="/"
          element={
            <RequireAuth>
              <GameScreen />
            </RequireAuth>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App
