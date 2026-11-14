'use client'

import { useState, useEffect, type FormEvent } from 'react'
import {
  Bell,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Globe2,
  LockKeyhole,
  Mail,
  MapPin,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserRound,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { roleMeta, type Role } from './data'
import { Avatar, FieldLabel, Modal, SectionHeader, Surface, Toggle, inputClassName } from './shared'
import { useAuth } from '@/lib/auth-context'
import { apiRequest } from '@/lib/api'

export function ProfileView({ role }: { role: Role }) {
  const { user, refreshUser } = useAuth()
  const meta = roleMeta[role]

  const [saved, setSaved] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [mobile, setMobile] = useState('')
  const [address, setAddress] = useState('')
  const [passwordModalOpen, setPasswordModalOpen] = useState(false)

  // Password change state
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passError, setPassError] = useState('')
  const [passSuccess, setPassSuccess] = useState('')
  const [changingPass, setChangingPass] = useState(false)

  useEffect(() => {
    if (user) {
      setFirstName(user.firstName || '')
      setLastName(user.lastName || '')
      setMobile(user.mobile || '')
      setAddress(user.address || '')
    } else {
      setFirstName(meta.name.split(' ')[0] || 'Alex')
      setLastName(meta.name.split(' ')[1] || 'Morgan')
      setMobile('+1 (415) 555-0148')
      setAddress('18 Valencia Street, San Francisco, CA 94103')
    }
  }, [user, meta])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSubmitting(true)
      await apiRequest('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          mobile: mobile.trim(),
          address: address.trim(),
        }),
      })
      await refreshUser()
      setSaved(true)
      window.setTimeout(() => setSaved(false), 2500)
    } catch (err: any) {
      alert(err?.message || 'Failed to update profile.')
    } finally {
      setSubmitting(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPassError('')
    setPassSuccess('')

    if (newPassword.length < 8) {
      setPassError('New password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setPassError('Passwords do not match.')
      return
    }

    try {
      setChangingPass(true)
      await apiRequest('/api/me/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setPassSuccess('Password updated successfully!')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      window.setTimeout(() => {
        setPasswordModalOpen(false)
        setPassSuccess('')
      }, 1500)
    } catch (err: any) {
      setPassError(err?.message || 'Could not update password.')
    } finally {
      setChangingPass(false)
    }
  }

  const displayName = `${firstName} ${lastName}`.trim() || meta.name
  const initials = `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase() || meta.initials

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <SectionHeader
        eyebrow={role === 'worker' ? 'Field operations' : role === 'admin' ? 'City command' : 'Citizen portal'}
        title={role === 'worker' ? 'Field credentials' : role === 'admin' ? 'Administrator profile' : 'Profile & settings'}
        description="Keep your details current so city services and dispatches can reach you."
      />

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <Surface className="h-fit p-6 text-center">
          <div className="relative mx-auto w-fit">
            <Avatar initials={initials} className="size-24 rounded-[28px] text-2xl" online={role === 'worker'} />
            <button
              type="button"
              aria-label="Change profile photo"
              onClick={() => alert('Profile photo upload active.')}
              className="absolute right-0 bottom-0 flex size-8 items-center justify-center rounded-full border-4 border-card bg-primary text-primary-foreground"
            >
              <Camera className="size-3.5" />
            </button>
          </div>
          <h2 className="mt-5 text-lg font-semibold tracking-[-0.04em]">{displayName}</h2>
          <p className="mt-1 text-xs text-muted-foreground">{user?.email || meta.subtitle}</p>
          <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-medium text-brand">
            <ShieldCheck className="size-3.5" />Verified {role} account
          </span>

          <div className="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 text-left">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Mail className="size-3.5" />{user?.email || `${firstName.toLowerCase()}.${lastName.toLowerCase()}@smartwaste.com`}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="size-3.5" />{mobile || '+1 (415) 555-0148'}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />{address?.split(',')[0] || 'San Francisco'}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-brand" />Status: Live connected
            </div>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-7">
          <SectionHeader
            title="Personal information"
            description="This information is used by operations and assigned crews when delivering services."
          />
          <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="profile-first-name">First name</FieldLabel>
                <input
                  id="profile-first-name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="profile-last-name">Last name</FieldLabel>
                <input
                  id="profile-last-name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="profile-email">Email address</FieldLabel>
                <input
                  id="profile-email"
                  type="email"
                  disabled
                  value={user?.email || 'user@smartwaste.com'}
                  className={cn(inputClassName, 'opacity-70 cursor-not-allowed')}
                />
              </div>
              <div>
                <FieldLabel htmlFor="profile-phone">Mobile number</FieldLabel>
                <input
                  id="profile-phone"
                  type="tel"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="profile-address">Default collection address</FieldLabel>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="profile-address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className={`${inputClassName} pl-10`}
                />
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-brand">
                <CheckCircle2 className="size-3.5" />Address verified for municipal dispatch
              </p>
            </div>

            <div className="flex items-center justify-between border-t border-border/60 pt-5">
              <span className="text-[11px] text-muted-foreground">Changes sync directly to city database</span>
              <Button type="submit" variant="brand" disabled={submitting} className="rounded-full">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />Saving...
                  </>
                ) : saved ? (
                  <>
                    <Check data-icon="inline-start" />Saved
                  </>
                ) : (
                  'Save changes'
                )}
              </Button>
            </div>
          </form>
        </Surface>
      </div>

      <Surface className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
            <LockKeyhole className="size-4" />
          </span>
          <div>
            <p className="text-sm font-medium">Privacy & security</p>
            <p className="mt-1 text-xs text-muted-foreground">Update your account password and review active sessions.</p>
          </div>
        </div>
        <Button type="button" variant="outline" onClick={() => setPasswordModalOpen(true)} className="rounded-full">
          Manage password<ChevronRight data-icon="inline-end" />
        </Button>
      </Surface>

      {passwordModalOpen && (
        <Modal title="Change Password" description="Enter your current and new password." onClose={() => setPasswordModalOpen(false)}>
          <form onSubmit={handlePasswordChange} className="flex flex-col gap-4">
            <div>
              <FieldLabel htmlFor="curr-pass">Current Password</FieldLabel>
              <input
                id="curr-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className={inputClassName}
              />
            </div>
            <div>
              <FieldLabel htmlFor="new-pass">New Password</FieldLabel>
              <input
                id="new-pass"
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className={inputClassName}
                placeholder="Min 8 characters"
              />
            </div>
            <div>
              <FieldLabel htmlFor="confirm-pass">Confirm New Password</FieldLabel>
              <input
                id="confirm-pass"
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={inputClassName}
              />
            </div>

            {passError && <p className="text-xs text-danger">{passError}</p>}
            {passSuccess && <p className="text-xs text-brand">{passSuccess}</p>}

            <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
              <Button type="button" variant="outline" onClick={() => setPasswordModalOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={changingPass} className="rounded-full">
                {changingPass ? <Loader2 className="size-4 animate-spin" /> : 'Update Password'}
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}

export function SettingsView({
  theme,
  onThemeChange,
}: {
  theme: 'system' | 'light' | 'dark'
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void
}) {
  const [push, setPush] = useState(true)
  const [location, setLocation] = useState(true)
  const [email, setEmail] = useState(false)

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <SectionHeader eyebrow="Preferences" title="Settings" description="Make SmartWaste feel right for you." />
      <Surface className="p-5 sm:p-7">
        <SectionHeader title="Appearance" description="Choose how the portal looks on this device." />
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {[
            { id: 'light' as const, label: 'Light', icon: Sun },
            { id: 'dark' as const, label: 'Dark', icon: Moon },
            { id: 'system' as const, label: 'System', icon: Globe2 },
          ].map((option) => {
            const Icon = option.icon
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={theme === option.id}
                onClick={() => onThemeChange(option.id)}
                className={`flex items-center gap-3 rounded-[14px] border p-3.5 text-left text-xs font-medium transition-colors ${
                  theme === option.id
                    ? 'border-primary/50 bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                {option.label}
                {theme === option.id && <Check className="ml-auto size-4" />}
              </button>
            )
          })}
        </div>
      </Surface>

      <Surface className="p-5 sm:p-7">
        <SectionHeader title="Notifications" description="Stay in the loop with live operational status." />
        <div className="mt-2 flex flex-col divide-y divide-border/60">
          <SettingRow
            icon={Bell}
            title="Push notifications"
            description="Collection updates, worker arrivals, and report status."
            control={<Toggle checked={push} onChange={setPush} label="Enable push notifications" />}
          />
          <SettingRow
            icon={Mail}
            title="Email summaries"
            description="A weekly recap of your reports and neighborhood impact."
            control={<Toggle checked={email} onChange={setEmail} label="Enable email summaries" />}
          />
          <SettingRow
            icon={MapPin}
            title="Location services"
            description="Help us pre-fill addresses and show nearby collections."
            control={<Toggle checked={location} onChange={setLocation} label="Enable location services" />}
          />
        </div>
      </Surface>

      <Surface className="flex items-center gap-3 p-5 text-xs text-muted-foreground sm:p-6">
        <ShieldCheck className="size-5 shrink-0 text-brand" />
        <p>Your preferences are applied instantly on this device. Security policies are strictly enforced.</p>
      </Surface>
    </div>
  )
}

function SettingRow({
  icon: Icon,
  title,
  description,
  control,
}: {
  icon: typeof Bell
  title: string
  description: string
  control: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-3 py-4 first:pt-0 last:pb-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
      </div>
      {control}
    </div>
  )
}
