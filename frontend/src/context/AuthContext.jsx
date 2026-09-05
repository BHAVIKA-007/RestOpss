import { createContext, useContext, useEffect, useState } from 'react'
import {
  clearStoredToken,
  getCurrentUser,
  getStoredToken,
  setStoredToken,
} from '../api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const token = getStoredToken()

    if (!token) {
      setIsLoading(false)
      return
    }

    getCurrentUser()
      .then(setUser)
      .catch(() => {
        clearStoredToken()
        setUser(null)
      })
      .finally(() => setIsLoading(false))
  }, [])

  async function login(token) {
    setStoredToken(token)
    const currentUser = await getCurrentUser()
    setUser(currentUser)
    return currentUser
  }

  function logout() {
    clearStoredToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used inside an AuthProvider')
  }

  return context
}
