import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { login as apiLogin, logout as apiLogout, register as apiRegister } from '../api/auth'
import { getToken, clearTokens } from '../api/client'

const AuthContext = createContext(null)
const DEMO_STARTING_BALANCE = 1000

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [demoMode, setDemoMode] = useState(false)
  const [demoBalance, setDemoBalance] = useState(DEMO_STARTING_BALANCE)

  useEffect(() => {
    const stored = localStorage.getItem('user')
    if (stored && getToken()) {
      try { setUser(JSON.parse(stored)) } catch { clearTokens() }
    }
    setLoading(false)

    const handleLogout = () => {
      setUser(null)
      localStorage.removeItem('user')
    }
    window.addEventListener('auth:logout', handleLogout)
    return () => window.removeEventListener('auth:logout', handleLogout)
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await apiLogin(email, password)
    setUser(data.user)
    setDemoMode(false)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }, [])

  const register = useCallback(async (username, email, password) => {
    const data = await apiRegister(username, email, password)
    setUser(data.user)
    setDemoMode(false)
    localStorage.setItem('user', JSON.stringify(data.user))
    return data
  }, [])

  const enterDemo = useCallback(() => {
    setDemoBalance(DEMO_STARTING_BALANCE)
    setDemoMode(true)
  }, [])

  const exitDemo = useCallback(() => {
    setDemoMode(false)
    setDemoBalance(DEMO_STARTING_BALANCE)
  }, [])

  const updateDemoBalance = useCallback((balanceOrFn) => {
    setDemoBalance(prev => typeof balanceOrFn === 'function' ? balanceOrFn(prev) : balanceOrFn)
  }, [])

  const logout = useCallback(async () => {
    await apiLogout()
    setUser(null)
    localStorage.removeItem('user')
  }, [])

  const updateBalance = useCallback((balanceOrFn) => {
    setUser(prev => {
      if (!prev) return prev
      const balance = typeof balanceOrFn === 'function'
        ? balanceOrFn(Number(prev.balance))
        : balanceOrFn
      const updated = { ...prev, balance }
      localStorage.setItem('user', JSON.stringify(updated))
      return updated
    })
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, updateBalance, demoMode, demoBalance, enterDemo, exitDemo, updateDemoBalance }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
