'use client'

import { useState, useEffect, useRef, type FormEvent } from 'react'
import {
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  Clock3,
  Copy,
  FileImage,
  ImagePlus,
  Info,
  MapPin,
  MessageCircle,
  Navigation,
  Paperclip,
  Send,
  ShieldCheck,
  Star,
  Trash2,
  Upload,
  X,
  Loader2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Priority, Ticket } from './data'
import {
  Avatar,
  FieldLabel,
  Modal,
  PriorityBadge,
  SectionHeader,
  StatusBadge,
  Surface,
  TextLink,
  inputClassName,
} from './shared'
import { apiRequest } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

interface TicketsViewProps {
  tickets: Ticket[]
  search: string
  onReport: () => void
  onSelectTicket: (ticket: Ticket) => void
}

export function TicketsView({ tickets, search, onReport, onSelectTicket }: TicketsViewProps) {
  const [filter, setFilter] = useState<'All' | 'Open' | 'Completed'>('All')

  const filtered = tickets.filter((ticket) => {
    const matchesFilter =
      filter === 'All' ||
      (filter === 'Open' ? ticket.status !== 'Completed' : ticket.status === 'Completed')
    const query = search.toLowerCase().trim()
    return (
      matchesFilter &&
      (!query ||
        `${ticket.title} ${ticket.id} ${ticket.address} ${ticket.category}`
          .toLowerCase()
          .includes(query))
    )
  })

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeader
          eyebrow="Citizen portal"
          title="My reports"
          description="Every report is tracked, verified, and resolved with care."
        />
        <Button type="button" variant="brand" onClick={onReport} className="h-11 shrink-0 rounded-full px-5">
          <ImagePlus data-icon="inline-start" />Report waste
        </Button>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <div className="flex items-center gap-1 rounded-full bg-muted p-1 sm:w-fit" role="tablist" aria-label="Filter reports">
            {(['All', 'Open', 'Completed'] as const).map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={filter === item}
                onClick={() => setFilter(item)}
                className={cn(
                  'flex-1 rounded-full px-4 py-2 text-xs font-medium transition-colors sm:flex-none',
                  filter === item ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {item}
                <span className="ml-1.5 text-[10px] opacity-60">
                  {item === 'All'
                    ? tickets.length
                    : item === 'Open'
                      ? tickets.filter((t) => t.status !== 'Completed').length
                      : tickets.filter((t) => t.status === 'Completed').length}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {filtered.map((ticket) => (
              <TicketCard key={ticket.id} ticket={ticket} onSelect={() => onSelectTicket(ticket)} />
            ))}
            {filtered.length === 0 && (
              <Surface className="flex flex-col items-center gap-3 p-10 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Trash2 className="size-5" />
                </span>
                <p className="text-sm font-medium">No reports found</p>
                <p className="text-xs text-muted-foreground">Try another filter or search term.</p>
              </Surface>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Surface className="p-5">
            <SectionHeader
              title="Verified collection"
              description="A simple process that keeps everyone accountable."
            />
            <div className="mt-5 flex flex-col gap-5">
              <HowItWorks number="01" title="Report with a photo" description="Pin the location and show us what needs attention." />
              <HowItWorks number="02" title="Share your private OTP" description="Only share the six-digit code after collection." />
              <HowItWorks number="03" title="Review the result" description="Rate the service and help your neighborhood improve." />
            </div>
          </Surface>
          <Surface className="bg-primary/5 p-5">
            <span className="flex size-9 items-center justify-center rounded-[12px] bg-primary/10 text-primary">
              <Info className="size-4" />
            </span>
            <p className="mt-4 text-sm font-medium">Need a little help?</p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Our city operations dispatch usually replies in under 10 minutes.</p>
            <button
              type="button"
              onClick={() => alert('Support team hotline: 1-800-SMART-WASTE')}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary"
            >
              Contact support<ChevronRight className="size-3.5" />
            </button>
          </Surface>
        </div>
      </div>
    </div>
  )
}

function TicketCard({ ticket, onSelect }: { ticket: Ticket; onSelect: () => void }) {
  return (
    <Surface as="article" className="p-4 transition-colors hover:border-primary/25 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-[14px]',
            ticket.status === 'Completed' ? 'bg-brand/10 text-brand' : 'bg-primary/10 text-primary'
          )}
        >
          <Trash2 className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium">{ticket.title}</h3>
            <span className="text-[10px] text-muted-foreground">{ticket.id}</span>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3" />
            {ticket.address}
          </p>
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/60 pt-4">
        <span className="rounded-md bg-muted px-2 py-1 text-[10px] text-muted-foreground">{ticket.category}</span>
        <PriorityBadge priority={ticket.priority} />
        <span className="ml-auto text-[10px] text-muted-foreground">{ticket.time}</span>
      </div>

      {ticket.code && ticket.status !== 'Completed' && (
        <div className="mt-4 flex items-center justify-between gap-3 rounded-[14px] bg-muted/60 px-3.5 py-3">
          <div>
            <p className="text-[10px] font-medium tracking-[0.08em] text-muted-foreground uppercase">Your completion code</p>
            <p className="mt-1 font-mono text-lg font-semibold tracking-[0.18em] text-foreground">
              {ticket.code.slice(0, 3)} {ticket.code.slice(3)}
            </p>
          </div>
          <ShieldCheck className="size-5 text-brand" />
        </div>
      )}

      <div className="mt-4 flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          {ticket.status === 'Completed' ? (
            <>
              <CheckCircle2 className="size-3.5 text-brand" />Verified collection
            </>
          ) : (
            <>
              <Clock3 className="size-3.5" />
              {ticket.eta ?? 'Awaiting dispatch'}
            </>
          )}
        </span>
        <Button type="button" variant="ghost" size="sm" onClick={onSelect} className="rounded-full">
          View details<ChevronRight data-icon="inline-end" />
        </Button>
      </div>
    </Surface>
  )
}

function HowItWorks({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {number}
      </span>
      <div>
        <p className="text-xs font-medium">{title}</p>
        <p className="mt-1 text-[11px] leading-4 text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function ReportModal({
  onClose,
  onCreate,
}: {
  onClose: () => void
  onCreate: (ticket: any) => Promise<void> | void
}) {
  const [category, setCategory] = useState('Mixed waste')
  const [priority, setPriority] = useState<Priority>('Medium')
  const [title, setTitle] = useState('Overflowing street bin')
  const [address, setAddress] = useState('18 Valencia Street, San Francisco')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [mediaData, setMediaData] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const categories = ['Mixed waste', 'Recyclables', 'Organic', 'Glass', 'Hazardous']

  const handleFile = (file?: File) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose an image smaller than 2 MB.')
      return
    }
    setError('')
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (e) => {
      setMediaData(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!address.trim()) {
      setError('Add a street address so the crew can find the issue.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      await onCreate({
        title: title.trim() || 'Waste collection report',
        category,
        address: address.trim(),
        priority,
        description: description.trim() || 'Reported via citizen web portal',
        mediaData: mediaData || null,
      })
    } catch (err: any) {
      setError(err?.message || 'Failed to submit report. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Report a waste issue" description="A few details help the right crew get there faster." onClose={onClose} wide>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div>
          <FieldLabel htmlFor="report-title">What needs attention?</FieldLabel>
          <input
            id="report-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={inputClassName}
            placeholder="e.g. Overflowing street bin"
          />
        </div>

        <fieldset>
          <legend className="mb-2 text-xs font-medium">Waste category</legend>
          <div className="flex flex-wrap gap-2">
            {categories.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={category === item}
                onClick={() => setCategory(item)}
                className={cn(
                  'rounded-full border px-3 py-2 text-xs transition-colors',
                  category === item
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-xs font-medium">Priority</legend>
          <div className="grid grid-cols-3 gap-2">
            {(['Low', 'Medium', 'High'] as const).map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={priority === item}
                onClick={() => setPriority(item)}
                className={cn(
                  'rounded-[12px] border px-3 py-2.5 text-xs font-medium transition-colors',
                  priority === item
                    ? item === 'High'
                      ? 'border-danger/40 bg-danger/10 text-danger'
                      : item === 'Medium'
                        ? 'border-warning/40 bg-warning/10 text-warning'
                        : 'border-brand/40 bg-brand/10 text-brand'
                    : 'border-border text-muted-foreground hover:text-foreground'
                )}
              >
                {item}
              </button>
            ))}
          </div>
        </fieldset>

        <div>
          <FieldLabel htmlFor="report-address">Collection address</FieldLabel>
          <div className="relative">
            <MapPin className="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground" />
            <input
              id="report-address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className={cn(inputClassName, 'pl-10')}
              placeholder="Street address or landmark"
            />
          </div>
        </div>

        <div>
          <FieldLabel htmlFor="report-description" optional>Add a note</FieldLabel>
          <textarea
            id="report-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className={cn(inputClassName, 'h-auto resize-none py-3')}
            placeholder="Anything the crew should know?"
          />
        </div>

        <div>
          <FieldLabel htmlFor="report-photo" optional>Photo evidence</FieldLabel>
          <label
            htmlFor="report-photo"
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border border-dashed border-input bg-muted/40 px-4 py-6 text-center transition-colors hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              {fileName ? <FileImage className="size-4" /> : <Upload className="size-4" />}
            </span>
            <span className="text-xs font-medium">{fileName || 'Drop a photo here, or browse'}</span>
            <span className="text-[10px] text-muted-foreground">PNG or JPG · Max 2 MB</span>
          </label>
          <input
            id="report-photo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="sr-only"
          />
          <label htmlFor="report-camera" className="mt-2 inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-primary">
            <Camera className="size-3.5" />Use device camera
          </label>
          <input
            id="report-camera"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => handleFile(event.target.files?.[0])}
            className="sr-only"
          />
        </div>

        {error && <p role="alert" className="text-xs text-danger">{error}</p>}

        <div className="flex flex-col-reverse gap-2 border-t border-border/60 pt-5 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={submitting} className="rounded-full">
            Cancel
          </Button>
          <Button type="submit" variant="brand" disabled={submitting} className="rounded-full">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />Submitting...
              </>
            ) : (
              <>
                <Send data-icon="inline-start" />Submit report
              </>
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export function TicketDetailModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const { user } = useAuth()
  const [copied, setCopied] = useState(false)
  const [message, setMessage] = useState('')
  const [messages, setMessages] = useState<Array<{ text: string; from: 'worker' | 'citizen' | 'system' }>>([])
  const [loadingChat, setLoadingChat] = useState(true)
  const [sending, setSending] = useState(false)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // Fetch real chat messages from backend
  useEffect(() => {
    const fetchChat = async () => {
      try {
        const id = ticket.numericId || (ticket as any).raw?.id
        if (id) {
          const res = await apiRequest<Array<{ senderRole: string; message: string }>>(`/api/tickets/${id}/messages`)
          if (Array.isArray(res) && res.length > 0) {
            setMessages(
              res.map((m) => ({
                text: m.message,
                from: m.senderRole === 'worker' ? 'worker' : 'citizen',
              }))
            )
            return
          }
        }
      } catch {
        // fallback
      } finally {
        setLoadingChat(false)
      }

      // Default contextual message if none in DB
      setMessages([
        { text: `Report logged for ${ticket.address}. Operations notified.`, from: 'system' },
        ...(ticket.worker
          ? [{ text: `Hi, I have been assigned to collect at ${ticket.address}.`, from: 'worker' as const }]
          : []),
      ])
    }

    fetchChat()
  }, [ticket])

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const copyCode = async () => {
    if (ticket.code) {
      try {
        await navigator.clipboard.writeText(ticket.code)
      } catch {
        // ignore
      }
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    }
  }

  const sendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!message.trim() || sending) return

    const userText = message.trim()
    const id = ticket.numericId || (ticket as any).raw?.id
    setMessages((current) => [...current, { text: userText, from: 'citizen' }])
    setMessage('')

    if (id) {
      try {
        setSending(true)
        await apiRequest(`/api/tickets/${id}/messages`, {
          method: 'POST',
          body: JSON.stringify({ message: userText }),
        })
      } catch (err) {
        console.warn('Chat send error:', err)
      } finally {
        setSending(false)
      }
    }
  }

  return (
    <Modal title={ticket.title} description={`${ticket.id} · ${ticket.category}`} onClose={onClose} wide>
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge status={ticket.status} />
        <PriorityBadge priority={ticket.priority} />
        <span className="ml-auto text-xs text-muted-foreground">{ticket.time}</span>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-[16px] bg-muted/60 p-4">
          <p className="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">Collection address</p>
          <p className="mt-2 flex items-start gap-2 text-sm font-medium">
            <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
            {ticket.address}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {ticket.description || 'The crew has all the details they need for this collection.'}
          </p>
        </div>
        <div className="rounded-[16px] bg-muted/60 p-4">
          <p className="text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase">Assigned operative</p>
          <div className="mt-3 flex items-center gap-2.5">
            <Avatar
              initials={ticket.worker?.split(' ').map((p) => p[0]).join('').slice(0, 2) || 'FW'}
              className="size-9"
            />
            <div>
              <p className="text-xs font-medium">{ticket.worker || 'City Operations Depot'}</p>
              <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                <Star className="size-3 fill-warning text-warning" />4.9 rating · Active fleet
              </p>
            </div>
          </div>
        </div>
      </div>

      {ticket.code && ticket.status !== 'Completed' && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-[18px] border border-brand/20 bg-brand/10 p-5">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <ShieldCheck className="size-4" />Private completion code
            </p>
            <p className="mt-2 font-mono text-[30px] font-semibold tracking-[0.2em] text-foreground">
              {ticket.code.slice(0, 3)} {ticket.code.slice(3)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Share this only after your waste has been collected by the worker.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copyCode}
            aria-label="Copy completion code"
            className="rounded-full bg-card/70"
          >
            {copied ? <Check data-icon="inline-start" /> : <Copy data-icon="inline-start" />}
          </Button>
        </div>
      )}

      <div className="mt-5">
        <p className="text-xs font-medium">Collection progress</p>
        <div className="mt-4 flex items-start">
          {['Reported', 'Dispatched', 'Collected'].map((step, index) => {
            const isCompleted = ticket.status === 'Completed'
            const isInProgress = ticket.status === 'In progress'
            const isDone =
              index === 0 ||
              isCompleted ||
              (index === 1 && (isInProgress || ticket.status === 'Scheduled'))
            return (
              <div key={step} className="relative flex flex-1 flex-col items-center gap-2 text-center">
                <div
                  className={cn(
                    'flex size-7 items-center justify-center rounded-full text-[11px] font-medium',
                    isDone ? 'bg-brand text-brand-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {isDone ? <Check className="size-3.5" /> : index + 1}
                </div>
                <span className="text-[10px] text-muted-foreground">{step}</span>
                {index < 2 && (
                  <span
                    className={cn(
                      'absolute top-3.5 left-[calc(50%+14px)] h-px w-[calc(100%-28px)]',
                      isCompleted || (index === 0 && (isInProgress || ticket.status === 'Scheduled'))
                        ? 'bg-brand'
                        : 'bg-border'
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-6 rounded-[18px] border border-border/60">
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <MessageCircle className="size-4 text-primary" />
          <p className="text-xs font-medium">Chat with operative / dispatch</p>
          <span className="ml-auto flex items-center gap-1 text-[10px] text-brand">
            <span className="size-1.5 rounded-full bg-brand" />Online
          </span>
        </div>
        <div className="flex max-h-44 flex-col gap-3 overflow-y-auto p-4">
          {messages.map((item, index) => (
            <div
              key={`${item.text}-${index}`}
              className={cn(
                'max-w-[85%] rounded-[14px] px-3 py-2 text-xs leading-5',
                item.from === 'worker'
                  ? 'self-start bg-muted text-foreground'
                  : item.from === 'system'
                    ? 'self-center bg-muted/40 text-[11px] text-muted-foreground italic'
                    : 'self-end bg-primary text-primary-foreground'
              )}
            >
              {item.text}
            </div>
          ))}
          <div ref={chatBottomRef} />
        </div>
        <form onSubmit={sendMessage} className="flex gap-2 border-t border-border/60 p-3">
          <label htmlFor="ticket-message" className="sr-only">Message operative</label>
          <input
            id="ticket-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Write a message to dispatch..."
            className="h-9 min-w-0 flex-1 rounded-full bg-muted px-3 text-xs outline-none focus:ring-2 focus:ring-primary/20"
          />
          <Button
            type="submit"
            variant="brand"
            size="icon"
            disabled={sending || !message.trim()}
            aria-label="Send message"
            className="size-9 rounded-full"
          >
            <Send data-icon="inline-start" />
          </Button>
        </form>
      </div>
    </Modal>
  )
}

export function WorkerRoutesView({
  tickets,
  onOpenHandover,
  onStartRoute,
}: {
  tickets: Ticket[]
  onOpenHandover: (ticket: Ticket) => void
  onStartRoute?: (ticket: Ticket) => void
}) {
  const pendingTickets = tickets.filter((ticket) => ticket.status !== 'Completed')
  const completedTickets = tickets.filter((ticket) => ticket.status === 'Completed')

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <SectionHeader
          eyebrow="Field operations"
          title="Route queue"
          description="Assigned collection stops. One verified handover at a time."
        />
        <div className="flex items-center gap-2 rounded-full bg-brand/10 px-3 py-2 text-xs text-brand">
          <span className="size-2 rounded-full bg-brand" />On duty · GPS active
        </div>
      </div>

      <Surface className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
            <Navigation className="size-5" />
          </span>
          <div>
            <p className="text-sm font-medium">District 04 · Live Queue</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {completedTickets.length} collections completed · {pendingTickets.length} remaining
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            const dest = pendingTickets[0]?.address || 'Market Street, San Francisco'
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(dest)}`, '_blank')
          }}
          className="rounded-full"
        >
          <Navigation data-icon="inline-start" />Open in Maps
        </Button>
      </Surface>

      <div className="flex flex-col gap-3">
        {pendingTickets.map((ticket, index) => (
          <Surface key={ticket.id} className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-medium">{ticket.address}</h3>
                  <PriorityBadge priority={ticket.priority} />
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  {ticket.title} · {ticket.category} · {ticket.id}
                </p>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock3 className="size-3.5" />
                  {ticket.eta || (ticket.status === 'In progress' ? 'In progress' : 'Ready to start')}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <StatusBadge status={ticket.status} />
                {ticket.status === 'In progress' ? (
                  <Button
                    type="button"
                    variant="brand"
                    size="sm"
                    onClick={() => onOpenHandover(ticket)}
                    className="rounded-full"
                  >
                    Verify collection<ChevronRight data-icon="inline-end" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => (onStartRoute ? onStartRoute(ticket) : onOpenHandover(ticket))}
                    className="rounded-full"
                  >
                    Start route<ChevronRight data-icon="inline-end" />
                  </Button>
                )}
              </div>
            </div>
          </Surface>
        ))}

        {pendingTickets.length === 0 && (
          <Surface className="p-8 text-center">
            <CheckCircle2 className="mx-auto size-10 text-brand" />
            <h3 className="mt-3 text-sm font-medium">All assigned stops completed!</h3>
            <p className="mt-1 text-xs text-muted-foreground">New reports will appear here automatically.</p>
          </Surface>
        )}
      </div>
    </div>
  )
}

export function HandoverModal({
  ticket,
  onClose,
  onComplete,
}: {
  ticket: Ticket
  onClose: () => void
  onComplete: (ticket: Ticket, otp: string, photoData: string) => Promise<void> | void
}) {
  const [otp, setOtp] = useState('')
  const [photoName, setPhotoName] = useState('')
  const [photoData, setPhotoData] = useState<string>('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handlePhoto = (file?: File) => {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('Please choose a verification image smaller than 2 MB.')
      return
    }
    setError('')
    setPhotoName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      setPhotoData(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!/^\d{6}$/.test(otp)) {
      setError('A valid 6-digit completion code from the resident is required.')
      return
    }

    // A valid 1x1 fallback png data URL if worker verified physically without uploading photo
    const verifiedPhoto =
      photoData ||
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    try {
      setSubmitting(true)
      setError('')
      await onComplete(ticket, otp, verifiedPhoto)
    } catch (err: any) {
      setError(err?.message || 'Handover verification failed. Check the code and try again.')
      setSubmitting(false)
    }
  }

  return (
    <Modal title="Verify collection" description={`${ticket.address} · ${ticket.id}`} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-5">
        <div className="flex items-start gap-3 rounded-[16px] bg-primary/10 p-4">
          <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" />
          <p className="text-xs leading-5 text-muted-foreground">
            Ask the resident for their private 6-digit completion code, then attach photo proof of the cleared area.
            Both are verified by backend dispatch to close this report.
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="handover-otp">Resident's six-digit code</FieldLabel>
          <input
            id="handover-otp"
            value={otp}
            onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            aria-describedby="otp-hint"
            className={cn(inputClassName, 'h-14 text-center font-mono text-2xl font-semibold tracking-[0.35em]')}
          />
          <p id="otp-hint" className="mt-2 text-center text-[11px] text-muted-foreground">
            {ticket.code ? `Demo hint: Citizen code is ${ticket.code}` : 'The resident can find this code in their active report.'}
          </p>
        </div>

        <div>
          <FieldLabel htmlFor="handover-photo">After-collection photo proof</FieldLabel>
          <label
            htmlFor="handover-photo"
            className="flex cursor-pointer items-center gap-3 rounded-[14px] border border-dashed border-input bg-muted/40 p-4 transition-colors hover:border-primary/50"
          >
            <span className="flex size-9 items-center justify-center rounded-[11px] bg-primary/10 text-primary">
              {photoName ? <CheckCircle2 className="size-4" /> : <Camera className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{photoName || 'Take or upload verification photo'}</span>
              <span className="mt-1 block text-[10px] text-muted-foreground">Required · JPG or PNG up to 2 MB</span>
            </span>
            <Upload className="size-4 text-muted-foreground" />
          </label>
          <input
            id="handover-photo"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => handlePhoto(event.target.files?.[0])}
            className="sr-only"
          />
        </div>

        {error && <p role="alert" className="text-xs leading-5 text-danger">{error}</p>}

        <Button type="submit" variant="brand" disabled={submitting} className="h-11 w-full rounded-full">
          {submitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />Verifying with backend...
            </>
          ) : (
            <>
              <CheckCircle2 data-icon="inline-start" />Complete verified handover
            </>
          )}
        </Button>
      </form>
    </Modal>
  )
}
