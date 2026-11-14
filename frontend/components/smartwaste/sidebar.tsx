'use client'

import { ChevronDown, Leaf, LogOut, MapPin, Moon, Settings2, Sun, X, ShieldCheck, UserCheck, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { navByRole, roleMeta, secondaryNav, type Role, type View } from './data'
import { Avatar, BrandMark, LiveDot } from './shared'
import { useAuth } from '@/lib/auth-context'

interface SidebarProps {
  role: Role
  view: View
  open: boolean
  theme: 'system' | 'light' | 'dark'
  onClose: () => void
  onNavigate: (view: View) => void
  onRoleChange: (role: Role) => void
  onThemeToggle: () => void
  ticketCount: number
  routeCount: number
  bookingCount: number
}

export function Sidebar({
  role,
  view,
  open,
  theme,
  onClose,
  onNavigate,
  onRoleChange,
  onThemeToggle,
  ticketCount,
  routeCount,
  bookingCount,
}: SidebarProps) {
  const { user, logout, switchRole } = useAuth()
  const meta = roleMeta[role]

  const displayName = user ? `${user.firstName} ${user.lastName}`.trim() : meta.name
  const initials = user
    ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() || meta.initials
    : meta.initials
  const subtitle = user ? user.email : meta.subtitle

  const handleRoleSelect = async (nextRole: Role) => {
    onRoleChange(nextRole)
    try {
      await switchRole(nextRole)
    } catch {
      // fallback
    }
  }

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onClose}
          className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-sidebar-border bg-sidebar px-4 py-5 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-2">
          <BrandMark />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close navigation"
            onClick={onClose}
            className="rounded-full lg:hidden"
          >
            <X data-icon="inline-start" />
          </Button>
        </div>

        <div className="mt-8 flex items-center gap-2 rounded-[14px] border border-sidebar-border bg-sidebar-accent/50 px-3 py-2.5 text-left">
          <span className="flex size-7 items-center justify-center rounded-[9px] bg-sidebar-accent text-muted-foreground">
            <MapPin className="size-3.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium">
              {user?.address?.split(',')[0] || 'San Francisco'}
            </span>
            <span className="block text-[10px] text-muted-foreground">
              {role === 'admin' ? 'Central Command' : role === 'worker' ? 'Sector Fleet' : 'District 04 · Live'}
            </span>
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </div>

        <div className="relative mt-4">
          <label htmlFor="portal-role" className="sr-only">
            Switch portal role
          </label>
          <select
            id="portal-role"
            value={role}
            onChange={(event) => handleRoleSelect(event.target.value as Role)}
            className="h-10 w-full appearance-none rounded-[12px] border border-sidebar-border bg-sidebar-accent/30 px-3 text-xs font-medium text-foreground outline-none transition-colors focus:border-primary focus:bg-sidebar-accent/70"
          >
            <option value="citizen">👤 Citizen portal</option>
            <option value="worker">👷 Field operations</option>
            <option value="admin">🛡️ City command</option>
          </select>
          <ChevronDown className="pointer-events-none absolute top-3.5 right-3 size-3.5 text-muted-foreground" />
        </div>

        <nav aria-label="Main navigation" className="mt-8 flex flex-1 flex-col gap-1 overflow-y-auto">
          <p className="mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Workspace
          </p>
          {navByRole[role].map((item) => {
            const Icon = item.icon
            const active = view === item.id
            const badge =
              item.id === 'tickets'
                ? String(role === 'citizen' ? ticketCount : routeCount)
                : item.id === 'hire' && role === 'worker'
                  ? String(bookingCount)
                  : item.badge
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'group flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium transition-all duration-200',
                  active
                    ? 'bg-sidebar-accent text-foreground shadow-[0_2px_8px_color-mix(in_oklab,var(--foreground)_4%,transparent)]'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                )}
              >
                <Icon className={cn('size-[17px]', active && 'text-brand')} />
                <span className="flex-1">{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] tabular-nums',
                      active ? 'bg-brand/15 text-brand' : 'bg-sidebar-accent text-muted-foreground'
                    )}
                  >
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
          <p className="mt-7 mb-2 px-3 text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
            Preferences
          </p>
          {secondaryNav.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                aria-current={view === item.id ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium transition-colors',
                  view === item.id
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground'
                )}
              >
                <Icon className="size-[17px]" />
                <span>{item.label}</span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={onThemeToggle}
            className="flex h-11 items-center gap-3 rounded-[12px] px-3 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="size-[17px]" /> : <Moon className="size-[17px]" />}
            <span>{theme === 'dark' ? 'Light appearance' : 'Dark appearance'}</span>
          </button>
        </nav>

        {role === 'citizen' && (
          <div className="mb-4 rounded-[18px] bg-brand/10 p-4">
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-[10px] bg-brand/15 text-brand">
                <Leaf className="size-4" />
              </span>
              <LiveDot />
            </div>
            <p className="mt-3 text-xs font-medium">Your impact this year</p>
            <p className="mt-1 text-[22px] font-semibold tracking-[-0.06em]">
              48.2 <span className="text-xs font-normal text-muted-foreground">kg diverted</span>
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">Live synced with city recycling.</p>
          </div>
        )}
        {role === 'worker' && (
          <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-brand/10 px-3 py-3 text-xs text-brand">
            <LiveDot />
            <span>GPS dispatch connected</span>
          </div>
        )}
        {role === 'admin' && (
          <div className="mb-4 flex items-center gap-2 rounded-[14px] bg-primary/10 px-3 py-3 text-xs text-primary">
            <span className="size-2 rounded-full bg-primary" />
            <span>All systems operational</span>
          </div>
        )}

        <div className="flex items-center gap-2 border-t border-sidebar-border px-1 pt-4">
          <Avatar initials={initials} online={role === 'worker' || !!user?.workerOnline} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{displayName}</p>
            <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
          </div>
          <button
            type="button"
            aria-label="Sign out"
            onClick={() => logout()}
            title="Sign out or reset session"
            className="flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </aside>
    </>
  )
}
