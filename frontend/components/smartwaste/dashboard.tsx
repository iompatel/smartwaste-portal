'use client'

import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CalendarDays,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  ClipboardCheck,
  Clock3,
  Compass,
  Gauge,
  Leaf,
  LocateFixed,
  MapPin,
  MessageCircle,
  Navigation,
  PackageCheck,
  Plus,
  Radio,
  Recycle,
  Route,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserRound,
  UsersRound,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Booking, Ticket, View } from './data'
import { Avatar, LiveDot, MetricCard, PriorityBadge, ProgressBar, ScoreRing, SectionHeader, StatusBadge, Surface, TextLink, Toggle } from './shared'
import { useAuth } from '@/lib/auth-context'

interface CitizenDashboardProps {
  tickets: Ticket[]
  bookings?: Booking[]
  onReport: () => void
  onHire: () => void
  onNavigate: (view: View) => void
  onSelectTicket: (ticket: Ticket) => void
}

export function CitizenDashboard({
  tickets,
  bookings = [],
  onReport,
  onHire,
  onNavigate,
  onSelectTicket,
}: CitizenDashboardProps) {
  const { user } = useAuth()
  const [activityTab, setActivityTab] = useState<'tickets' | 'bookings'>('tickets')

  const totalReports = tickets.length
  const openReports = tickets.filter((t) => t.status !== 'Completed').length
  const completedReports = tickets.filter((t) => t.status === 'Completed').length
  const hireCount = bookings.length

  const activeTicket =
    tickets.find((t) => t.status === 'In progress') ||
    tickets.find((t) => t.status !== 'Completed') ||
    tickets[0]

  const firstName = user?.firstName || 'Alex'

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-brand/15 bg-hero p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-28 -right-20 -z-10 size-[330px] rounded-full border border-brand/10" />
        <div className="pointer-events-none absolute -top-16 -right-4 -z-10 size-[240px] rounded-full border border-brand/10" />
        <div className="pointer-events-none absolute right-24 -bottom-36 -z-10 size-[280px] rounded-full bg-brand/5 blur-2xl" />
        <div className="flex items-center justify-between gap-5">
          <div className="max-w-[560px]">
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-brand">
                <LiveDot />Live sync
              </span>
              <span>
                {new Date().toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </span>
            </div>
            <h1 className="mt-5 text-[32px] leading-[1.08] font-semibold tracking-[-0.065em] text-foreground sm:text-[42px]">
              Good morning, {firstName}
              <span className="text-brand">.</span>
            </h1>
            <p className="mt-3 max-w-[410px] text-sm leading-6 text-muted-foreground sm:text-[15px]">
              A cleaner neighborhood starts with one small action. Here is what is happening around you today.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Button type="button" variant="brand" onClick={onReport} className="h-11 rounded-full px-5">
                <Plus data-icon="inline-start" />Report waste
              </Button>
              <Button type="button" variant="outline" onClick={onHire} className="h-11 rounded-full bg-card/60 px-5">
                <BriefcaseBusiness data-icon="inline-start" />Hire a worker
              </Button>
            </div>
          </div>
          <div className="hidden shrink-0 flex-col items-center gap-3 md:flex">
            <ScoreRing score={92} />
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
              <ArrowUpRight className="size-3.5" />8% healthier this month
            </span>
          </div>
        </div>
        <div className="mt-7 flex items-center gap-2 text-[11px] text-muted-foreground md:hidden">
          <ScoreRing score={92} />
          <div>
            <p className="font-medium text-foreground">Your neighborhood is thriving.</p>
            <p className="mt-1 flex items-center gap-1 text-brand">
              <ArrowUpRight className="size-3.5" />8% healthier this month
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="quick-actions-title">
        <SectionHeader title="What would you like to do?" description="Your everyday tools, all in one place." />
        <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <QuickAction title="Report waste" description="Snap it. Pin it. Done." icon={Camera} tone="blue" onClick={onReport} />
          <QuickAction title="Hire a worker" description="A helping hand, on demand." icon={BriefcaseBusiness} tone="green" onClick={onHire} />
          <QuickAction
            title="Track collections"
            description="Know when we are close."
            icon={LocateFixed}
            tone="amber"
            onClick={() => activeTicket && onSelectTicket(activeTicket)}
          />
          <QuickAction title="Your profile" description="Keep your details up to date." icon={UserRound} tone="neutral" onClick={() => onNavigate('profile')} />
        </div>
      </section>

      <section aria-label="Your waste collection metrics" className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="My reports" value={String(totalReports).padStart(2, '0')} detail="All time submissions" icon={ClipboardCheck} trend="+2 this month" tone="blue" />
        <MetricCard label="Open reports" value={String(openReports).padStart(2, '0')} detail="Being taken care of" icon={Clock3} tone="amber" />
        <MetricCard label="Completed" value={String(completedReports).padStart(2, '0')} detail="Verified collections" icon={CheckCircle2} trend="+18%" tone="green" />
        <MetricCard label="Hire requests" value={String(hireCount).padStart(2, '0')} detail="Personal task bookings" icon={BriefcaseBusiness} tone="blue" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <Surface className="min-w-0 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SectionHeader title="Recent activity" description="Your latest reports and requests." />
            <div className="flex rounded-full bg-muted p-1" role="tablist" aria-label="Activity type">
              <button
                type="button"
                role="tab"
                aria-selected={activityTab === 'tickets'}
                onClick={() => setActivityTab('tickets')}
                className={cn('rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors', activityTab === 'tickets' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
              >
                Reports ({tickets.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activityTab === 'bookings'}
                onClick={() => setActivityTab('bookings')}
                className={cn('rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors', activityTab === 'bookings' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground')}
              >
                Bookings ({bookings.length})
              </button>
            </div>
          </div>
          {activityTab === 'tickets' ? (
            <div className="mt-5 flex flex-col divide-y divide-border/60">
              {tickets.slice(0, 3).map((ticket) => (
                <ActivityRow key={ticket.id} ticket={ticket} onClick={() => onSelectTicket(ticket)} />
              ))}
              {tickets.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No reports yet. Click "Report waste" above to submit one.</p>}
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-3">
              {bookings.slice(0, 3).map((b) => (
                <BookingRow key={b.id} title={b.title} detail={`${b.worker} · ${b.date}`} status={b.status} />
              ))}
              {bookings.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">No bookings yet. Hire an operative anytime.</p>}
            </div>
          )}
          <div className="mt-4 border-t border-border/60 pt-4">
            <TextLink onClick={() => onNavigate(activityTab === 'tickets' ? 'tickets' : 'hire')}>
              View all {activityTab === 'tickets' ? 'reports' : 'bookings'}
            </TextLink>
          </div>
        </Surface>

        <Surface className="overflow-hidden p-5 sm:p-6">
          <SectionHeader
            eyebrow="Live collection"
            title={activeTicket?.worker ? `${activeTicket.worker} is on route` : 'Collection in queue'}
            action={
              <span className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Navigation className="size-4" />
              </span>
            }
          />
          <div className="mt-5 flex items-center gap-3">
            <Avatar initials={activeTicket?.worker?.split(' ').map((p) => p[0]).join('').slice(0, 2) || 'FW'} online className="size-11" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{activeTicket?.worker || 'Field Operative'}</p>
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="size-3 fill-warning text-warning" />4.9 · Verified operative
              </p>
            </div>
            <button
              type="button"
              aria-label="View collection"
              onClick={() => activeTicket && onSelectTicket(activeTicket)}
              className="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground"
            >
              <MessageCircle className="size-4" />
            </button>
          </div>
          <div className="mt-5 rounded-[16px] bg-muted/60 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-medium">{activeTicket?.eta ?? 'Arriving soon'}</span>
              <span className="text-[11px] text-brand">GPS live</span>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <span className="size-2 rounded-full bg-brand" />
              <ProgressBar value={activeTicket?.status === 'Completed' ? 100 : activeTicket?.status === 'In progress' ? 72 : 25} />
              <span className="size-2 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
              <span>Depot</span>
              <span>Your address</span>
            </div>
          </div>
          <div className="mt-5 flex items-start gap-2.5">
            <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-xs font-medium">{activeTicket?.address || 'Community Area'}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {activeTicket?.category || 'Mixed waste'} · {activeTicket?.id || 'SWM-1001'}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() => activeTicket && onSelectTicket(activeTicket)}
            className="mt-5 h-10 w-full rounded-full"
          >
            Track this collection<ArrowRight data-icon="inline-end" />
          </Button>
        </Surface>
      </div>

      <Surface className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-4">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-brand/10 text-brand">
            <Leaf className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Small actions. Real impact.</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              You have helped divert <strong className="font-medium text-foreground">48.2 kg</strong> of waste from landfill this year.
            </p>
          </div>
        </div>
        <div className="w-full sm:w-44">
          <div className="mb-2 flex justify-between text-[10px] text-muted-foreground">
            <span>Annual goal</span>
            <span>72%</span>
          </div>
          <ProgressBar value={72} />
        </div>
      </Surface>
    </div>
  )
}

function QuickAction({
  title,
  description,
  icon: Icon,
  tone,
  onClick,
}: {
  title: string
  description: string
  icon: LucideIcon
  tone: 'blue' | 'green' | 'amber' | 'neutral'
  onClick: () => void
}) {
  const tones = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-brand/10 text-brand',
    amber: 'bg-warning/10 text-warning',
    neutral: 'bg-muted text-muted-foreground',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-h-[142px] flex-col items-start rounded-[20px] border border-border/70 bg-card p-4 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_color-mix(in_oklab,var(--foreground)_7%,transparent)] active:scale-[0.98] sm:p-5"
    >
      <span className={cn('flex size-9 items-center justify-center rounded-[12px] transition-transform duration-300 group-hover:scale-105', tones[tone])}>
        <Icon className="size-[18px]" />
      </span>
      <span className="mt-4 text-[13px] font-medium text-foreground">{title}</span>
      <span className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</span>
      <ArrowUpRight className="mt-auto self-end text-muted-foreground/50 transition-colors group-hover:text-primary" />
    </button>
  )
}

function ActivityRow({ ticket, onClick }: { ticket: Ticket; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="group flex items-center gap-3 py-3.5 text-left first:pt-0 last:pb-0">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
        <Trash2 className="size-[17px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-[13px] font-medium">{ticket.title}</span>
          <span className="hidden text-[10px] text-muted-foreground sm:inline">{ticket.id}</span>
        </span>
        <span className="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
          <MapPin className="size-3 shrink-0" />
          {ticket.address}
          <span className="mx-1">·</span>
          {ticket.time}
        </span>
      </span>
      <span className="hidden shrink-0 sm:block">
        <StatusBadge status={ticket.status} />
      </span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </button>
  )
}

function BookingRow({
  title,
  detail,
  status,
}: {
  title: string
  detail: string
  status: 'Confirmed' | 'Pending' | 'Completed'
}) {
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-muted/50 p-3">
      <span className="flex size-9 items-center justify-center rounded-[11px] bg-brand/10 text-brand">
        <BriefcaseBusiness className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{title}</p>
        <p className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</p>
      </div>
      <StatusBadge status={status} />
    </div>
  )
}

interface WorkerDashboardProps {
  tickets: Ticket[]
  onDuty: boolean
  onDutyChange: (value: boolean) => void
  onOpenHandover: (ticket: Ticket) => void
  onStartRoute?: (ticket: Ticket) => void
  onNavigate: (view: View) => void
}

export function WorkerDashboard({
  tickets,
  onDuty,
  onDutyChange,
  onOpenHandover,
  onStartRoute,
  onNavigate,
}: WorkerDashboardProps) {
  const { user } = useAuth()
  const routeTickets = tickets.filter((ticket) => ticket.status !== 'Completed')
  const completedToday = tickets.filter((ticket) => ticket.status === 'Completed').length

  const workerName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Jordan'
  const rating = user?.ratingAverage ? user.ratingAverage.toFixed(1) : '4.9'

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-brand/20 bg-hero p-6 sm:p-8">
        <div className="pointer-events-none absolute -top-32 -right-16 -z-10 size-[360px] rounded-full border border-brand/15" />
        <div className="pointer-events-none absolute -top-20 -right-4 -z-10 size-[250px] rounded-full border border-brand/15" />
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <ShieldCheck className="size-3.5" />Field operative · City fleet
              </span>
              <span className="text-[11px] text-muted-foreground">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </span>
            </div>
            <h1 className="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] sm:text-[40px]">
              Ready for action, {workerName}
              <span className="text-brand">.</span>
            </h1>
            <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {routeTickets.length} stop{routeTickets.length === 1 ? '' : 's'} assigned on your route. Real-time GPS broadcasting is enabled.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3 rounded-[18px] border border-border/60 bg-card/70 p-4">
            <div>
              <p className="text-xs font-medium">{onDuty ? 'On duty' : 'Off duty'}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                {onDuty ? (
                  <>
                    <LiveDot />GPS active
                  </>
                ) : (
                  'Availability paused'
                )}
              </p>
            </div>
            <Toggle checked={onDuty} onChange={onDutyChange} label="Toggle duty availability" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Assigned stops" value={String(routeTickets.length).padStart(2, '0')} detail="Pending collection" icon={Route} tone="blue" />
        <MetricCard label="Collected today" value={String(completedToday).padStart(2, '0')} detail="Verified handovers" icon={PackageCheck} trend="+20%" tone="green" />
        <MetricCard label="Your rating" value={rating} detail="Verified resident ratings" icon={Star} tone="amber" />
        <MetricCard label="Route efficiency" value="96%" detail="Above fleet average" icon={Gauge} trend="+6%" tone="green" />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <Surface className="p-5 sm:p-6">
          <SectionHeader
            title="Next on your route"
            description="Verified handover keeps every collection accountable."
            action={
              <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate('tickets')} className="rounded-full">
                View queue<ArrowRight data-icon="inline-end" />
              </Button>
            }
          />
          <div className="mt-5 flex flex-col gap-3">
            {routeTickets.slice(0, 3).map((ticket, index) => (
              <WorkerRouteRow
                key={ticket.id}
                ticket={ticket}
                index={index}
                onVerify={() => onOpenHandover(ticket)}
                onStart={() => onStartRoute?.(ticket)}
              />
            ))}
            {routeTickets.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">Your route is completely clear. Great job!</p>
            )}
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Telemetry"
            title="Dispatch connected"
            action={
              <span className="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
                <Radio className="size-4" />
              </span>
            }
          />
          <div className="relative mx-auto mt-6 flex size-40 items-center justify-center">
            <div className="absolute size-40 rounded-full border border-brand/15" />
            <div className="absolute size-28 rounded-full border border-brand/20" />
            <div className="absolute size-16 rounded-full border border-brand/25" />
            <div className="absolute top-5 right-8 size-2.5 rounded-full bg-brand shadow-[0_0_0_5px_color-mix(in_oklab,var(--brand)_12%,transparent)]" />
            <div className="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <LocateFixed className="size-5" />
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <div className="rounded-[14px] bg-muted/60 p-3">
              <p className="text-[10px] text-muted-foreground">Latitude</p>
              <p className="mt-1 text-xs font-medium tabular-nums">37.7749° N</p>
            </div>
            <div className="rounded-[14px] bg-muted/60 p-3">
              <p className="text-[10px] text-muted-foreground">Longitude</p>
              <p className="mt-1 text-xs font-medium tabular-nums">122.4194° W</p>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-brand">
              <LiveDot />{onDuty ? 'Broadcasting live' : 'Broadcasting idle'}
            </span>
            <span className="text-muted-foreground">Accuracy 8m</span>
          </div>
        </Surface>
      </div>

      <Surface className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
            <Compass className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">Need turn-by-turn directions?</p>
            <p className="mt-1 text-xs text-muted-foreground">Open your next stop in Maps and keep moving.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const dest = routeTickets[0]?.address || 'Market Street, San Francisco'
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`, '_blank')
          }}
          className="rounded-full"
        >
          <Navigation data-icon="inline-start" />Open directions
        </Button>
      </Surface>
    </div>
  )
}

function WorkerRouteRow({
  ticket,
  index,
  onVerify,
  onStart,
}: {
  ticket: Ticket
  index: number
  onVerify: () => void
  onStart?: () => void
}) {
  const isInProgress = ticket.status === 'In progress'
  return (
    <div className="flex flex-col gap-3 rounded-[16px] border border-border/60 p-4 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {String(index + 1).padStart(2, '0')}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{ticket.address}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>{ticket.category}</span>
            <span>·</span>
            <span>{ticket.id}</span>
            <PriorityBadge priority={ticket.priority} />
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:shrink-0">
        <StatusBadge status={ticket.status} />
        {isInProgress ? (
          <Button type="button" variant="brand" size="sm" onClick={onVerify} className="rounded-full">
            Verify<ChevronRight data-icon="inline-end" />
          </Button>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={onStart || onVerify} className="rounded-full">
            Start<ChevronRight data-icon="inline-end" />
          </Button>
        )}
      </div>
    </div>
  )
}
