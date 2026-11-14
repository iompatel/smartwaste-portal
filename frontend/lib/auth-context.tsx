'use client'

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  apiRequest,
  getStoredRole,
  getStoredToken,
  getStoredUser,
  setStoredCsrf,
  setStoredRole,
  setStoredToken,
  setStoredUser,
  type BackendUser,
} from './api'
import type { Role } from '@/components/smartwaste/data'

export interface DemoAccount {
  role: Role
  email: string
  password: string
  name: string
  subtitle: string
}

export const DEMO_ACCOUNTS: Record<Role, DemoAccount> = {
  citizen: {
    role: 'citizen',
    email: 'user@smartwaste.com',
    password: 'User#123',
    name: 'Citizen User',
    subtitle: 'Lakeview Resident',
  },
  worker: {
    role: 'worker',
    email: 'worker@smartwaste.com',
    password: 'Worker#123',
    name: 'Field Worker',
    subtitle: 'North Sector Fleet',
  },
  admin: {
    role: 'admin',
    email: 'admin@smartwaste.dev',
    password: 'Mn2glIufk!RdqehZxhNII',
    name: 'System Admin',
    subtitle: 'City Operations Command',
  },
}

interface AuthContextType {
  user: BackendUser | null
  role: Role
  token: string | null
  csrfToken: string | null
  isLoading: boolean
  error: string | null
  login: (role: Role, email: string, password: string) => Promise<boolean>
  demoLogin: (role: Role) => Promise<boolean>
  signup: (userData: any) => Promise<boolean>
  logout: () => Promise<void>
  switchRole: (role: Role) => Promise<void>
  refreshUser: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<BackendUser | null>(null)
  const [role, setRoleState] = useState<Role>('citizen')
  const [token, setTokenState] = useState<string | null>(null)
  const [csrfToken, setCsrfTokenState] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Initialize auth state on mount
  useEffect(() => {
    const init = async () => {
      try {
        const storedRole = getStoredRole()
        const storedToken = getStoredToken()
        const storedUser = getStoredUser()

        setRoleState(storedRole)
        setTokenState(storedToken)
        setUser(storedUser)

        // If we don't have an active user, automatically do a demo login for the stored role
        // so the app is immediately working with real live data!
        if (!storedUser) {
          const creds = DEMO_ACCOUNTS[storedRole]
          await performLogin(storedRole, creds.email, creds.password)
        } else {
          // Verify current user
          try {
            const meRes = await apiRequest<any>('/api/me')
            const validUser = meRes?.user || meRes
            if (validUser?.id) {
              setUser(validUser)
              setStoredUser(validUser)
            }
          } catch {
            // Token might have expired, try demo login for this role
            const creds = DEMO_ACCOUNTS[storedRole]
            await performLogin(storedRole, creds.email, creds.password)
          }
        }
      } catch (err: any) {
        console.warn('Auth initialization warning:', err?.message)
      } finally {
        setIsLoading(false)
      }
    }

    init()
  }, [])

  const performLogin = async (targetRole: Role, email: string, pass: string): Promise<boolean> => {
    try {
      setError(null)
      setIsLoading(true)

      let endpoint = '/api/auth/login'
      if (targetRole === 'worker') endpoint = '/api/auth/worker-login'
      if (targetRole === 'admin') endpoint = '/api/auth/admin-login'

      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email, password: pass }),
      })

      if (targetRole === 'admin') {
        const adminUser = data.user
        const csrf = data.csrfToken
        setUser(adminUser)
        setCsrfTokenState(csrf)
        setTokenState(null)
        setStoredCsrf(csrf)
        setStoredToken(null)
        setStoredUser(adminUser)
        setStoredRole('admin')
        setRoleState('admin')
      } else {
        const authUser = data.user
        const authToken = data.token
        setUser(authUser)
        setTokenState(authToken)
        setCsrfTokenState(null)
        setStoredCsrf(null)
        setStoredToken(authToken)
        setStoredUser(authUser)
        setStoredRole(targetRole)
        setRoleState(targetRole)
      }

      return true
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check credentials.')
      return false
    } finally {
      setIsLoading(false)
    }
  }

  const login = useCallback(async (targetRole: Role, email: string, pass: string) => {
    return performLogin(targetRole, email, pass)
  }, [])

  const demoLogin = useCallback(async (targetRole: Role) => {
    const creds = DEMO_ACCOUNTS[targetRole]
    return performLogin(targetRole, creds.email, creds.password)
  }, [])

  const signup = useCallback(async (userData: any): Promise<boolean> => {
    try {
      setError(null)
      setIsLoading(true)
      const data = await apiRequest('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(userData),
      })
      if (data?.token && data?.user) {
        setUser(data.user)
        setTokenState(data.token)
        setStoredToken(data.token)
        setStoredUser(data.user)
        setStoredRole('citizen')
        setRoleState('citizen')
        return true
      }
      return false
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.')
      return false
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {})
    } finally {
      setUser(null)
      setTokenState(null)
      setCsrfTokenState(null)
      setStoredToken(null)
      setStoredCsrf(null)
      setStoredUser(null)
      // Switch back to citizen demo
      demoLogin('citizen')
    }
  }, [demoLogin])

  const switchRole = useCallback(async (nextRole: Role) => {
    const creds = DEMO_ACCOUNTS[nextRole]
    await performLogin(nextRole, creds.email, creds.password)
  }, [])

  const refreshUser = useCallback(async () => {
    try {
      const res = await apiRequest<any>('/api/me')
      const validUser = res?.user || res
      if (validUser?.id) {
        setUser(validUser)
        setStoredUser(validUser)
      }
    } catch {
      // ignore
    }
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        token,
        csrfToken,
        isLoading,
        error,
        login,
        demoLogin,
        signup,
        logout,
        switchRole,
        refreshUser,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
