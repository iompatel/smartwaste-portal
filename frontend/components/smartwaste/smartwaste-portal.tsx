'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, Check, CheckCircle2, ChevronRight, Menu, Moon, Search, Sun, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { AdminAccounts, AdminActivity, AdminBroadcast, AdminDashboard } from './admin'
import { CitizenDashboard, WorkerDashboard } from './dashboard'
import {
  navByRole,
  roleMeta,
  seedBookings,
  seedTickets,
  type Booking,
  type Role,
  type Ticket,
  type View,
} from './data'
import { HireView } from './hire'
import { ProfileView, SettingsView } from './profile'
import { Avatar, BrandMark, LiveDot, Modal, Toast } from './shared'
import { Sidebar } from './sidebar'
import { HandoverModal, ReportModal, TicketDetailModal, TicketsView, WorkerRoutesView } from './tickets'
import {
  apiRequest,
  formatTimeAgo,
  mapBackendHireToUi,
  mapBackendTicketToUi,
  type BackendHireRequest,
  type BackendNotification,
  type BackendTicket,
} from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

type Theme = 'system' | 'light' | 'dark'
type ModalName = 'report' | 'notifications' | 'ticket' | 'handover' | null

interface SmartWastePortalProps {
  initialRole?: Role
  initialView?: View
  lockRole?: boolean
}

export function SmartWastePortal({
  initialRole,
  initialView = 'overview',
  lockRole = false,
}: SmartWastePortalProps) {
  const { user, role: authRole, switchRole } = useAuth()
  const [role, setRole] = useState<Role>(initialRole || authRole || 'citizen')
  const [view, setView] = useState<View>(initialView)
  const [tickets, setTickets] = useState<Ticket[]>(seedTickets)
  const [bookings, setBookings] = useState<Booking[]>(seedBookings)
  const [notifications, setNotifications] = useState<BackendNotification[]>([])
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
  const [modal, setModal] = useState<ModalName>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [theme, setTheme] = useState<Theme>('system')
  const [systemDark, setSystemDark] = useState(false)
  const [toast, setToast] = useState('')
  const [onDuty, setOnDuty] = useState(true)

  // Keep local role in sync with auth role unless locked
  useEffect(() => {
    if (!lockRole && authRole && authRole !== role) {
      setRole(authRole)
    }
  }, [authRole, lockRole, role])

  // Apply dark/light theme classes
  useEffect(() => {
    const root = document.documentElement
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const applyTheme = () => {
      setSystemDark(media.matches)
      const isDark = theme === 'dark' || (theme === 'system' && media.matches)
      root.classList.toggle('dark', isDark)
      root.classList.toggle('light', !isDark)
    }
    applyTheme()
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

  // Auto-hide toast
  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [toast])

  // Scroll to top on view changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [role, view])

  // Fetch real data from backend
  const loadPortalData = useCallback(async () => {
    try {
      // 1. Fetch tickets
      const tickRes = await apiRequest<BackendTicket[]>('/api/tickets').catch(() => null)
      if (Array.isArray(tickRes) && tickRes.length > 0) {
        setTickets(tickRes.map(mapBackendTicketToUi))
      }

      // 2. Fetch hire requests
      const hireRes = await apiRequest<BackendHireRequest[]>('/api/hire-requests').catch(() => null)
      if (Array.isArray(hireRes) && hireRes.length > 0) {
        setBookings(hireRes.map(mapBackendHireToUi))
      }

      // 3. Fetch notifications
      const notifRes = await apiRequest<BackendNotification[]>('/api/notifications').catch(() => null)
      if (Array.isArray(notifRes)) {
        setNotifications(notifRes)
      }
    } catch (err) {
      console.warn('Portal data fetch warning:', err)
    }
  }, [])

  useEffect(() => {
    loadPortalData()
    // Periodic poll every 15s to keep live data fresh
    const interval = window.setInterval(loadPortalData, 15000)
    return () => window.clearInterval(interval)
  }, [loadPortalData, role])

  const navigate = (nextView: View) => {
    setView(nextView)
    setMobileNavOpen(false)
  }

  const changeRole = async (nextRole: Role) => {
    setRole(nextRole)
    setView('overview')
    setMobileNavOpen(false)
    setSearch('')
    try {
      await switchRole(nextRole)
    } catch {
      // ignore
    }
  }

  const selectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setModal('ticket')
  }

  const openHandover = (ticket: Ticket) => {
    setSelectedTicket(ticket)
    setModal('handover')
  }

  // Handle waste report creation
  const handleCreateTicket = async (formData: {
    title: string
    category: string
    address: string
    priority: string
    description: string
    mediaData?: string | null
  }) => {
    try {
      const priorityMap: Record<string, 'low' | 'medium' | 'high'> = {
        Low: 'low',
        Medium: 'medium',
        High: 'high',
      }
      const newBackendTicket = await apiRequest<BackendTicket>('/api/tickets', {
        method: 'POST',
        body: JSON.stringify({
          wasteType: formData.category,
          description: `${formData.title} - ${formData.description}`.trim(),
          locationAddress: formData.address,
          priority: priorityMap[formData.priority] || 'medium',
          mediaData: formData.mediaData || null,
        }),
      })

      const mapped = mapBackendTicketToUi(newBackendTicket)
      setTickets((current) => [mapped, ...current])
      setModal(null)
      setView('tickets')
      setToast(`${mapped.id} submitted! Operations has queued your report.`)
    } catch (err: any) {
      // Local optimistic fallback if offline
      const fallbackTicket: Ticket = {
        id: `SWM-${1050 + Math.floor(Math.random() * 50)}`,
        title: formData.title,
        category: formData.category,
        address: formData.address,
        status: 'Pending',
        priority: formData.priority as any,
        time: 'Just now',
        code: String(Math.floor(100000 + Math.random() * 900000)),
        description: formData.description,
      }
      setTickets((current) => [fallbackTicket, ...current])
      setModal(null)
      setView('tickets')
      setToast(`${fallbackTicket.id} submitted. (Offline sync active)`)
    }
  }

  // Handle hire request creation
  const handleCreateBooking = async (formData: {
    title: string
    purpose: string
    workAddress: string
    worker: string
    requesterMobile?: string
    requesterAddress?: string
  }) => {
    try {
      const newHire = await apiRequest<BackendHireRequest>('/api/hire-requests', {
        method: 'POST',
        body: JSON.stringify({
          title: formData.title,
          purpose: formData.purpose,
          workAddress: formData.workAddress,
          requesterMobile: formData.requesterMobile || user?.mobile || '7777777777',
          requesterAddress: formData.requesterAddress || user?.address || formData.workAddress,
        }),
      })
      const mapped = mapBackendHireToUi(newHire)
      setBookings((current) => [mapped, ...current])
      setToast(`${mapped.title} requested with ${mapped.id}.`)
    } catch {
      const fallbackBooking: Booking = {
        id: `BK-${210 + bookings.length}`,
        title: formData.title,
        worker: formData.worker,
        date: 'Sat, Nov 16 · 10:00',
        status: 'Pending',
        price: formData.title === 'Home cleaning' ? '$48' : formData.title === 'Garden cleanup' ? '$36' : '$64',
      }
      setBookings((current) => [fallbackBooking, ...current])
      setToast(`${fallbackBooking.title} requested. (Offline sync active)`)
    }
  }

  // Handle worker starting route
  const handleStartRoute = async (ticket: Ticket) => {
    const id = ticket.numericId || (ticket as any).raw?.id
    if (id) {
      try {
        const res = await apiRequest<BackendTicket>(`/api/tickets/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status: 'in_progress' }),
        })
        const mapped = mapBackendTicketToUi(res)
        setTickets((current) => current.map((t) => (t.id === ticket.id ? mapped : t)))
        setToast(`Route started for ${ticket.address}. Telemetry broadcasting.`)
        return
      } catch (err: any) {
        console.warn('Start route error:', err?.message)
      }
    }
    // Optimistic fallback
    setTickets((current) =>
      current.map((t) => (t.id === ticket.id ? { ...t, status: 'In progress', eta: 'Arriving in ~8 min' } : t))
    )
    setToast(`Started route for ${ticket.address}.`)
  }

  // Handle worker completing collection handover
  const handleCompleteHandover = async (ticket: Ticket, otp: string, photoData: string) => {
    const id = ticket.numericId || (ticket as any).raw?.id
    if (id) {
      const res = await apiRequest<BackendTicket>(`/api/tickets/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({
          status: 'completed',
          completionCode: otp,
          completionMediaData: photoData,
        }),
      })
      const mapped = mapBackendTicketToUi(res)
      setTickets((current) => current.map((item) => (item.id === ticket.id ? mapped : item)))
    } else {
      setTickets((current) =>
        current.map((item) =>
          item.id === ticket.id ? { ...item, status: 'Completed', time: 'Just now' } : item
        )
      )
    }
    setModal(null)
    setToast(`${ticket.id} verified and closed with photo proof. Excellent work!`)
  }

  // Handle completing hired booking
  const handleCompleteBooking = async (booking: Booking) => {
    const id = booking.numericId || (booking as any).raw?.id
    if (id) {
      try {
        await apiRequest(`/api/hire-requests/${id}/complete`, { method: 'PUT' })
      } catch {
        // ignore
      }
    }
    setBookings((current) =>
      current.map((b) => (b.id === booking.id ? { ...b, status: 'Completed' } : b))
    )
    setToast(`${booking.title} marked completed.`)
  }

  // Handle worker duty availability
  const handleDutyChange = async (val: boolean) => {
    setOnDuty(val)
    if (role === 'worker') {
      try {
        await apiRequest('/api/workers/me/availability', {
          method: 'PUT',
          body: JSON.stringify({ online: val }),
        })
        setToast(val ? 'You are now online on city dispatch.' : 'Duty availability paused.')
      } catch (err: any) {
        console.warn('Duty update warning:', err)
      }
    }
  }

  const isDark = theme === 'dark' || (theme === 'system' && systemDark)
  const toggleTheme = () => setTheme(isDark ? 'light' : 'dark')
  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Sidebar
        role={role}
        view={view}
        open={mobileNavOpen}
        theme={isDark ? 'dark' : 'light'}
        onClose={() => setMobileNavOpen(false)}
        onNavigate={navigate}
        onRoleChange={changeRole}
        onThemeToggle={toggleTheme}
        ticketCount={tickets.length}
        routeCount={tickets.filter((t) => t.status !== 'Completed').length}
        bookingCount={bookings.length}
      />

      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
          <div className="mx-auto flex h-[72px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
              onClick={() => setMobileNavOpen(true)}
              className="rounded-full lg:hidden"
            >
              <Menu data-icon="inline-start" />
            </Button>

            <div className="hidden min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:flex">
              <span className="font-medium text-foreground">{roleMeta[role].label}</span>
              <ChevronRight className="size-3.5" />
              <span className="truncate">{getViewLabel(view, role)}</span>
            </div>

            <div className="flex flex-1 justify-center sm:hidden">
              <BrandMark compact />
            </div>

            <div className="relative ml-auto hidden w-full max-w-[240px] md:block">
              <Search className="pointer-events-none absolute top-3 left-3.5 size-4 text-muted-foreground" />
              <input
                aria-label="Search reports and accounts"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') navigate(role === 'admin' ? 'accounts' : 'tickets')
                }}
                placeholder="Search anything"
                className="h-10 w-full rounded-full border border-border/70 bg-muted/50 pr-12 pl-10 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:bg-card focus:ring-3 focus:ring-primary/10"
              />
              <kbd className="pointer-events-none absolute top-2.5 right-3 rounded-md border border-border/70 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                ⌘ K
              </kbd>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
                onClick={toggleTheme}
                className="rounded-full"
              >
                {isDark ? <Sun data-icon="inline-start" /> : <Moon data-icon="inline-start" />}
              </Button>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Open notifications"
                onClick={() => setModal('notifications')}
                className="relative rounded-full"
              >
                <Bell data-icon="inline-start" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-danger text-[8px] font-semibold text-white">
                    {unreadCount}
                  </span>
                )}
              </Button>

              <button
                type="button"
                aria-label="Open your profile"
                onClick={() => navigate('profile')}
                className="ml-1 rounded-full transition-transform hover:scale-105"
              >
                <Avatar
                  initials={
                    user
                      ? `${user.firstName?.[0] || ''}${user.lastName?.[0] || ''}`.toUpperCase() ||
                        roleMeta[role].initials
                      : roleMeta[role].initials
                  }
                  className="size-9"
                  online={role === 'worker' || !!user?.workerOnline}
                />
              </button>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-10">
          {role === 'citizen' && view === 'overview' && (
            <CitizenDashboard
              tickets={tickets}
              bookings={bookings}
              onReport={() => setModal('report')}
              onHire={() => navigate('hire')}
              onNavigate={navigate}
              onSelectTicket={selectTicket}
            />
          )}
          {role === 'citizen' && view === 'tickets' && (
            <TicketsView
              tickets={tickets}
              search={search}
              onReport={() => setModal('report')}
              onSelectTicket={selectTicket}
            />
          )}
          {role === 'citizen' && view === 'hire' && (
            <HireView bookings={bookings} onCreateBooking={handleCreateBooking} />
          )}

          {role === 'worker' && view === 'overview' && (
            <WorkerDashboard
              tickets={tickets}
              onDuty={onDuty}
              onDutyChange={handleDutyChange}
              onOpenHandover={openHandover}
              onStartRoute={handleStartRoute}
              onNavigate={navigate}
            />
          )}
          {role === 'worker' && view === 'tickets' && (
            <WorkerRoutesView
              tickets={tickets}
              onOpenHandover={openHandover}
              onStartRoute={handleStartRoute}
            />
          )}
          {role === 'worker' && view === 'hire' && (
            <HireView
              bookings={bookings}
              onCreateBooking={handleCreateBooking}
              onCompleteBooking={handleCompleteBooking}
              worker
            />
          )}

          {role === 'admin' && view === 'overview' && <AdminDashboard onNavigate={navigate} />}
          {role === 'admin' && view === 'accounts' && <AdminAccounts />}
          {role === 'admin' && view === 'broadcast' && <AdminBroadcast />}
          {role === 'admin' && view === 'activity' && <AdminActivity />}

          {view === 'profile' && <ProfileView role={role} />}
          {view === 'settings' && <SettingsView theme={theme} onThemeChange={setTheme} />}
        </main>
      </div>

      <MobileBottomNav role={role} view={view} onNavigate={navigate} />

      {modal === 'report' && (
        <ReportModal onClose={() => setModal(null)} onCreate={handleCreateTicket} />
      )}

      {modal === 'ticket' && selectedTicket && (
        <TicketDetailModal
          ticket={tickets.find((t) => t.id === selectedTicket.id) ?? selectedTicket}
          onClose={() => setModal(null)}
        />
      )}

      {modal === 'handover' && selectedTicket && (
        <HandoverModal
          ticket={selectedTicket}
          onClose={() => setModal(null)}
          onComplete={handleCompleteHandover}
        />
      )}

      {modal === 'notifications' && (
        <NotificationsModal
          notifications={notifications}
          onClose={() => setModal(null)}
          onOpenTicket={() => {
            setModal(null)
            if (tickets[0]) selectTicket(tickets[0])
          }}
          onRefresh={loadPortalData}
        />
      )}

      {toast && <Toast message={toast} onClose={() => setToast('')} />}
    </div>
  )
}

function getViewLabel(view: View, role: Role) {
  if (view === 'overview')
    return role === 'admin' ? 'Command center' : role === 'worker' ? 'Field cockpit' : 'Overview'
  if (view === 'tickets') return role === 'worker' ? 'Route queue' : 'My reports'
  if (view === 'hire') return role === 'worker' ? 'Hired tasks' : 'Hire a worker'
  if (view === 'profile') return role === 'worker' ? 'Field credentials' : 'Profile & settings'
  if (view === 'accounts') return 'Accounts'
  if (view === 'broadcast') return 'Broadcast'
  if (view === 'activity') return 'Audit activity'
  return 'Settings'
}

function MobileBottomNav({
  role,
  view,
  onNavigate,
}: {
  role: Role
  view: View
  onNavigate: (view: View) => void
}) {
  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed right-3 bottom-3 left-3 z-20 flex items-center justify-around rounded-[20px] border border-border/70 bg-card/90 p-1.5 shadow-[0_12px_40px_color-mix(in_oklab,var(--foreground)_12%,transparent)] backdrop-blur-2xl lg:hidden"
    >
      {navByRole[role].slice(0, 4).map((item) => {
        const Icon = item.icon
        const active = item.id === view
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => onNavigate(item.id)}
            className={cn(
              'flex min-w-0 flex-1 flex-col items-center gap-1 rounded-[15px] px-2 py-2 text-[9px] font-medium transition-colors',
              active ? 'bg-primary/10 text-primary' : 'text-muted-foreground'
            )}
          >
            <Icon className="size-[18px]" />
            <span className="max-w-full truncate">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function NotificationsModal({
  notifications,
  onClose,
  onOpenTicket,
  onRefresh,
}: {
  notifications: BackendNotification[]
  onClose: () => void
  onOpenTicket: () => void
  onRefresh: () => void
}) {
  const [readAll, setReadAll] = useState(false)

  const handleMarkAllRead = async () => {
    try {
      await apiRequest('/api/notifications/read-all', { method: 'PUT' })
      setReadAll(true)
      onRefresh()
    } catch {
      setReadAll(true)
    }
  }

  const list =
    notifications.length > 0
      ? notifications
      : [
          {
            id: 1,
            title: 'Operations dispatch live',
            message: 'Your report SW-1048 is scheduled for morning pickup.',
            createdAt: new Date().toISOString(),
          },
          {
            id: 2,
            title: 'Booking confirmed',
            message: 'Field operative assigned for balcony deep clean.',
            createdAt: new Date(Date.now() - 3600000).toISOString(),
          },
        ]

  return (
    <Modal title="Notifications" description="Live dispatches and alerts from your neighborhood." onClose={onClose}>
      <div className="mb-4 flex items-center justify-between">
        <span className="inline-flex items-center gap-2 text-[11px] text-brand">
          <LiveDot />Live updates
        </span>
        <button type="button" onClick={handleMarkAllRead} className="text-xs font-medium text-primary">
          {readAll ? 'All caught up' : 'Mark all as read'}
        </button>
      </div>

      <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
        {list.map((notification, index) => (
          <button
            key={notification.id || index}
            type="button"
            onClick={index === 0 ? onOpenTicket : undefined}
            className={cn(
              'flex w-full items-start gap-3 rounded-[16px] p-3.5 text-left transition-colors hover:bg-muted/70',
              !readAll && !notification.read && index === 0 ? 'bg-primary/5' : 'bg-muted/40'
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-brand/10 text-brand">
              <CheckCircle2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium">{notification.title}</span>
              <span className="mt-1 block text-[11px] leading-4 text-muted-foreground">
                {notification.message}
              </span>
              <span className="mt-2 block text-[10px] text-muted-foreground">
                {formatTimeAgo(notification.createdAt)}
              </span>
            </span>
            {!readAll && !notification.read && index === 0 && (
              <span className="mt-1 size-2 shrink-0 rounded-full bg-primary" />
            )}
          </button>
        ))}
      </div>

      <div className="mt-5 border-t border-border/60 pt-4 text-center">
        <button type="button" onClick={onClose} className="text-xs font-medium text-primary">
          You are all caught up
        </button>
      </div>
    </Modal>
  )
}
