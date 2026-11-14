'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, Lock, Mail, MapPin, Phone, User, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandMark, FieldLabel, Surface, inputClassName } from '@/components/smartwaste/shared'
import { useAuth } from '@/lib/auth-context'
import { cn } from '@/lib/utils'

export default function SignupPage() {
  const router = useRouter()
  const { signup } = useAuth()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [mobile, setMobile] = useState('')
  const [password, setPassword] = useState('')
  const [address, setAddress] = useState('')
  const [gender, setGender] = useState('Other')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName || !email || !mobile || !password || !address) {
      setError('Please fill all mandatory fields.')
      return
    }

    try {
      setSubmitting(true)
      setError('')
      const success = await signup({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
        address: address.trim(),
        gender,
      })
      if (success) {
        router.push('/citizen')
      } else {
        setError('Signup failed. Ensure password has at least 8 chars, 1 uppercase, and 1 special symbol.')
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to create account.')
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
            Create Citizen Account
          </h1>
          <p className="mt-2 text-xs text-muted-foreground max-w-xs">
            Join your neighbors in keeping the city clean and tracking verified waste collections.
          </p>
        </div>

        <Surface className="mt-8 p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="su-first-name">First name</FieldLabel>
                <div className="relative">
                  <User className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                  <input
                    id="su-first-name"
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={cn(inputClassName, 'pl-10')}
                    placeholder="Alex"
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="su-last-name">Last name</FieldLabel>
                <input
                  id="su-last-name"
                  required
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  className={inputClassName}
                  placeholder="Morgan"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="su-email">Email address</FieldLabel>
              <div className="relative">
                <Mail className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="su-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                  placeholder="alex.morgan@example.com"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="su-mobile">Mobile number</FieldLabel>
                <div className="relative">
                  <Phone className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                  <input
                    id="su-mobile"
                    type="tel"
                    required
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    className={cn(inputClassName, 'pl-10')}
                    placeholder="7777777777"
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="su-gender">Gender</FieldLabel>
                <select
                  id="su-gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={inputClassName}
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="su-password">Password</FieldLabel>
              <div className="relative">
                <Lock className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="su-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                  placeholder="Min 8 chars, 1 uppercase & 1 symbol"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="su-address">Street address</FieldLabel>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="su-address"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                  placeholder="18 Valencia Street, San Francisco"
                />
              </div>
            </div>

            {error && (
              <p className="rounded-lg bg-danger/10 p-3 text-xs text-danger font-medium leading-5">{error}</p>
            )}

            <Button type="submit" variant="brand" disabled={submitting} className="mt-2 h-11 w-full rounded-full">
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />Creating account...
                </>
              ) : (
                <>
                  Create Account<ArrowRight data-icon="inline-end" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              Sign in
            </Link>
          </p>
        </Surface>
      </div>
    </div>
  )
}
