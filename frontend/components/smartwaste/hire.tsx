'use client'

import { useState, type FormEvent } from 'react'
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Home,
  Leaf,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Truck,
  UserRound,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Booking } from './data'
import { Avatar, FieldLabel, SectionHeader, StatusBadge, Surface, inputClassName } from './shared'
import { useAuth } from '@/lib/auth-context'

const services = [
  { title: 'Home cleaning', description: 'A fresh start for your space.', icon: Home, price: 'From $48' },
  { title: 'Garden cleanup', description: 'Make your outdoors feel new.', icon: Leaf, price: 'From $36' },
  { title: 'Bulk waste pickup', description: 'For the things that do not fit.', icon: Truck, price: 'From $64' },
]

export function HireView({
  bookings,
  onCreateBooking,
  onCompleteBooking,
  worker = false,
}: {
  bookings: Booking[]
  onCreateBooking?: (booking: any) => Promise<void> | void
  onCompleteBooking?: (booking: Booking) => Promise<void> | void
  worker?: boolean
}) {
  if (worker) return <WorkerHireView bookings={bookings} onCompleteBooking={onCompleteBooking} />
  return <CitizenHireView bookings={bookings} onCreateBooking={onCreateBooking!} />
}

function CitizenHireView({
  bookings,
  onCreateBooking,
}: {
  bookings: Booking[]
  onCreateBooking: (booking: any) => Promise<void> | void
}) {
  const { user } = useAuth()
  const [selectedService, setSelectedService] = useState('Home cleaning')
  const [selectedWorker, setSelectedWorker] = useState('Field Worker')
  const [date, setDate] = useState('2026-11-16')
  const [time, setTime] = useState('10:00 – 12:00')
  const [address, setAddress] = useState(user?.address || '18 Valencia Street, San Francisco')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      setSubmitting(true)
      await onCreateBooking({
        title: selectedService,
        purpose: note.trim() || `${selectedService} requested at ${time}`,
        workAddress: address.trim(),
        worker: selectedWorker,
        requesterMobile: user?.mobile || '7777777777',
        requesterAddress: user?.address || address.trim(),
      })
      setSuccess(true)
      setNote('')
      window.setTimeout(() => setSuccess(false), 3500)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="relative isolate overflow-hidden rounded-[26px] border border-brand/15 bg-hero p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-10 -bottom-28 -z-10 size-72 rounded-full border border-brand/15" />
        <div className="max-w-xl">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
            <Sparkles className="size-3.5" />Trusted help, on your schedule
          </span>
          <h1 className="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] sm:text-[40px]">
            A helping hand, when you need it<span className="text-brand">.</span>
          </h1>
          <p className="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
            Book a verified local operative for the jobs that need extra care. Transparent pricing, no surprises.
          </p>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(300px,0.85fr)]">
        <Surface className="p-5 sm:p-7">
          <SectionHeader title="What can we help with?" description="Choose a service and find your ideal time." />
          <form onSubmit={submit} className="mt-6 flex flex-col gap-5">
            <div className="grid gap-3 sm:grid-cols-3">
              {services.map((service) => {
                const Icon = service.icon
                const selected = selectedService === service.title
                return (
                  <button
                    key={service.title}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setSelectedService(service.title)}
                    className={cn(
                      'flex flex-col items-start rounded-[16px] border p-4 text-left transition-all',
                      selected ? 'border-brand/50 bg-brand/10' : 'border-border hover:border-brand/30'
                    )}
                  >
                    <span
                      className={cn(
                        'flex size-9 items-center justify-center rounded-[11px]',
                        selected ? 'bg-brand/15 text-brand' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span className="mt-3 text-xs font-medium">{service.title}</span>
                    <span className="mt-1 text-[10px] leading-4 text-muted-foreground">{service.description}</span>
                    <span className="mt-3 text-[11px] font-medium text-brand">{service.price}</span>
                  </button>
                )
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <FieldLabel htmlFor="hire-date">Preferred date</FieldLabel>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                  <input
                    id="hire-date"
                    type="date"
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className={cn(inputClassName, 'pl-10')}
                  />
                </div>
              </div>
              <div>
                <FieldLabel htmlFor="hire-time">Preferred time</FieldLabel>
                <select
                  id="hire-time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className={inputClassName}
                >
                  <option>10:00 – 12:00</option>
                  <option>12:00 – 14:00</option>
                  <option>14:00 – 16:00</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="hire-address">Work address</FieldLabel>
              <div className="relative">
                <MapPin className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
                <input
                  id="hire-address"
                  value={address}
                  onChange={(event) => setAddress(event.target.value)}
                  className={cn(inputClassName, 'pl-10')}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="hire-note" optional>Tell your operative a little more</FieldLabel>
              <textarea
                id="hire-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={3}
                placeholder="Access notes, special requests, or anything helpful..."
                className={cn(inputClassName, 'h-auto resize-none py-3')}
              />
            </div>

            {success && (
              <p className="flex items-center gap-1.5 text-xs text-brand">
                <CheckCircle2 className="size-4" />Booking requested! Dispatch is matching an operative.
              </p>
            )}

            <div className="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-brand" />Verified operatives · City dispatch guarantee
              </span>
              <Button type="submit" variant="brand" disabled={submitting} className="rounded-full">
                {submitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />Booking...
                  </>
                ) : (
                  <>
                    Request booking<ArrowRight data-icon="inline-end" />
                  </>
                )}
              </Button>
            </div>
          </form>
        </Surface>

        <div className="flex flex-col gap-5">
          <Surface className="p-5 sm:p-6">
            <SectionHeader title="Top-rated operatives near you" description="Fleet members trusted by residents." />
            <div className="mt-5 flex flex-col gap-3">
              {[
                { name: 'Field Worker', initials: 'FW', skill: 'Deep cleaning & hazardous clearance', rating: '4.9', jobs: '128 jobs' },
                { name: 'Jordan Lee', initials: 'JL', skill: 'Garden & bulk waste specialist', rating: '4.9', jobs: '94 jobs' },
                { name: 'Priya Shah', initials: 'PS', skill: 'Home & balcony cleaning expert', rating: '4.8', jobs: '76 jobs' },
              ].map((workerItem) => (
                <button
                  key={workerItem.name}
                  type="button"
                  onClick={() => setSelectedWorker(workerItem.name)}
                  className={cn(
                    'flex items-center gap-3 rounded-[15px] border p-3 text-left transition-colors',
                    selectedWorker === workerItem.name
                      ? 'border-brand/40 bg-brand/5'
                      : 'border-transparent hover:bg-muted/60'
                  )}
                >
                  <Avatar initials={workerItem.initials} className="size-10" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-medium">{workerItem.name}</span>
                    <span className="mt-1 block truncate text-[10px] text-muted-foreground">{workerItem.skill}</span>
                    <span className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Star className="size-3 fill-warning text-warning" />
                      {workerItem.rating} · {workerItem.jobs}
                    </span>
                  </span>
                  {selectedWorker === workerItem.name ? (
                    <span className="flex size-5 items-center justify-center rounded-full bg-brand text-brand-foreground">
                      <Check className="size-3" />
                    </span>
                  ) : (
                    <ChevronRight className="size-4 text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <SectionHeader title="Your bookings" action={<BriefcaseBusiness className="size-4 text-muted-foreground" />} />
            <div className="mt-4 flex flex-col gap-3">
              {bookings.map((booking) => (
                <div key={booking.id} className="rounded-[14px] bg-muted/50 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-medium">{booking.title}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{booking.worker}</p>
                    </div>
                    <StatusBadge status={booking.status} />
                  </div>
                  <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="size-3" />
                      {booking.date}
                    </span>
                    <span className="font-medium text-foreground">{booking.price}</span>
                  </div>
                </div>
              ))}
              {bookings.length === 0 && (
                <p className="py-6 text-center text-xs text-muted-foreground">No bookings yet. Fill the form to request a helper.</p>
              )}
            </div>
          </Surface>
        </div>
      </div>
    </div>
  )
}

function WorkerHireView({
  bookings,
  onCompleteBooking,
}: {
  bookings: Booking[]
  onCompleteBooking?: (booking: Booking) => Promise<void> | void
}) {
  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        eyebrow="Field operations"
        title="Hired tasks"
        description="Private assistance requests from residents in your assigned zone."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {bookings.map((booking) => (
          <Surface key={booking.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-[13px] bg-brand/10 text-brand">
                <BriefcaseBusiness className="size-5" />
              </span>
              <StatusBadge status={booking.status} />
            </div>
            <h3 className="mt-4 text-base font-medium tracking-[-0.02em]">{booking.title}</h3>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MapPin className="size-3.5" />{booking.address || 'Resident Address, District 04'}
            </p>
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="size-3.5" />{booking.date}
            </p>
            <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4">
              <span className="text-sm font-semibold">{booking.price}</span>
              {booking.status === 'Confirmed' || booking.status === 'Pending' ? (
                <Button
                  type="button"
                  variant="brand"
                  size="sm"
                  onClick={() => onCompleteBooking?.(booking)}
                  className="rounded-full"
                >
                  Mark completed<ArrowRight data-icon="inline-end" />
                </Button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs text-brand font-medium">
                  <CheckCircle2 className="size-3.5" />Completed
                </span>
              )}
            </div>
          </Surface>
        ))}

        {bookings.length === 0 && (
          <Surface className="col-span-2 p-10 text-center">
            <CheckCircle2 className="mx-auto size-10 text-brand" />
            <h3 className="mt-3 text-sm font-medium">No pending hired tasks</h3>
            <p className="mt-1 text-xs text-muted-foreground">Resident bookings assigned to you will show up here.</p>
          </Surface>
        )}
      </div>
    </div>
  )
}
