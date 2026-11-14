'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowRight,
  CheckCircle2,
  Lock,
  Mail,
  Recycle,
  Shield,
  ShieldCheck,
  User,
  Zap,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark, FieldLabel, Surface, inputClassName } from '@/components/smartwaste/shared'
import { DEMO_ACCOUNTS, useAuth } from '@/lib/auth-context'
import type { Role } from '@/components/smartwaste/data'
import { cn } from '@/lib/utils'

export default function LoginPage() {
  const router = useRouter()
  const { login, demoLogin, isLoading } = useAuth()

  const [activeTab, setActiveTab] = useState<Role>('citizen')
  const [email, setEmail] = useState(DEMO_ACCOUNTS.citizen.email)
  const [password, setPassword] = useState(DEMO_ACCOUNTS.citizen.password)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleTabChange = (role: Role) => {
    setActiveTab(role)
    setEmail(DEMO_ACCOUNTS[role].email)
    setPassword(DEMO_ACCOUNTS[role].password)
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) {
      setError('Please provide your email and password.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      const success = await login(activeTab, email, password)
      if (success) {
        if (activeTab === 'admin') router.push('/admin')
        else if (activeTab === 'worker') router.push('/worker')
        else router.push('/citizen')
      } else {
        setError('Invalid credentials for this role.')
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDemoSignIn = async (role: Role) => {
    try {
      setSubmitting(true)
      setError('')
      const success = await demoLogin(role)
      if (success) {
        if (role === 'admin') router.push('/admin')
        else if (role === 'worker') router.push('/worker')
        else router.push('/citizen')
      } else {
        setError('Could not complete demo sign in.')
      }
    } catch (err: any) {
      setError(err?.message || 'Demo sign in failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center text-center">
          <BrandMark />
          <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sign in to SmartWaste
          </h1>
          <p className="mt-2 text-xs text-muted-foreground max-w-xs">
            Connect to municipal waste dispatch, verify collections, and manage environmental operations.
          </p>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          {/* Role selector tabs */}
          <div className="flex rounded-full bg-muted p-1" role="tablist">
            {(
              [
                { id: 'citizen', label: 'Citizen', icon: User },
                { id: 'worker', label: 'Worker', icon: Shield },
                { id: 'admin', label: 'Admin', icon: ShieldCheck },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-xs font-medium transition-all',
                    active
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className="size-3.5" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="login-email">Email address</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                  placeholder="name@smartwaste.com"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="login-password">Password</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 p-3 text-xs text-danger font-medium">{error}</p>
            )}

            <Button type="submit" variant="brand" disabled={submitting} className="mt-2 h-11 w-full rounded-full">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />Signing in...
                </>
              ) : (
                <>
                  Sign in as {activeTab === 'citizen' ? 'Citizen' : activeTab === 'worker' ? 'Worker' : 'Admin'}
                  <ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>

            {/* 1-click Demo Fill Button */}
            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/60" />
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-card px-2 text-muted-foreground">Instant Demo Access</span>
              </div>
            </div>

            <Button
              type="button"
              variant="outline"
              disabled={submitting}
              onClick={() => handleDemoSignIn(activeTab)}
              className="h-10 w-full rounded-full bg-muted/40 hover:bg-brand/10 hover:text-brand"
            >
              <Zap className="size-3.5 text-brand" />
              1-Click {activeTab.toUpperCase()} Demo Sign In
            </Button>
          </form>

          {activeTab === 'citizen' && (
            <p className="mt-6 text-center text-xs text-muted-foreground">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                Create resident account
              </Link>
            </p>
          )}

          <div className="mt-6 border-t border-border/60 pt-4 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground">
              ← Return to SmartWaste Portal
            </Link>
          </div>
        </Surface>
      </div>
    </div>
  )
}
