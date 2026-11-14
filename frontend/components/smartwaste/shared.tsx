'use client'

import { useEffect, useId, type ReactNode } from 'react'
import { Check, ChevronRight, Leaf, Recycle, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { Priority, TicketStatus } from './data'

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-[14px] bg-brand text-brand-foreground shadow-[0_8px_20px_color-mix(in_oklab,var(--brand)_22%,transparent)]">
        <Recycle className="size-5" strokeWidth={2.2} />
      </span>
      {!compact && (
        <span className="text-[21px] font-semibold tracking-[-0.055em] text-foreground">
          smartwaste<span className="text-brand">.</span>
        </span>
      )}
    </div>
  )
}

export function Avatar({ initials, className, online = false }: { initials: string; className?: string; online?: boolean }) {
  return (
    <span className={cn('relative flex size-10 shrink-0 items-center justify-center rounded-full bg-avatar text-xs font-semibold text-avatar-foreground', className)}>
      {initials}
      {online && <span className="absolute right-0 bottom-0 size-2.5 rounded-full border-2 border-card bg-brand" aria-label="Online" />}
    </span>
  )
}

export function LiveDot({ className }: { className?: string }) {
  return <span className={cn('relative flex size-2', className)}><span className="absolute inline-flex size-full animate-ping rounded-full bg-brand opacity-50" /><span className="relative inline-flex size-2 rounded-full bg-brand" /></span>
}

export function StatusBadge({ status }: { status: TicketStatus | 'Confirmed' | 'Pending' | 'On route' | 'Break' | 'Open' }) {
  const tone = status === 'Completed' || status === 'Confirmed' || status === 'On route'
    ? 'bg-success/10 text-success'
    : status === 'In progress' || status === 'Pending' || status === 'Open'
      ? 'bg-primary/10 text-primary'
      : status === 'Scheduled'
        ? 'bg-warning/10 text-warning'
        : 'bg-muted text-muted-foreground'
  return <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap', tone)}><span className="size-1.5 rounded-full bg-current" />{status}</span>
}

export function PriorityBadge({ priority }: { priority: Priority }) {
  return <span className={cn('rounded-md px-2 py-1 text-[10px] font-semibold tracking-wide uppercase', priority === 'High' ? 'bg-danger/10 text-danger' : priority === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-muted text-muted-foreground')}>{priority}</span>
}

export function Surface({ children, className, as: Element = 'section' }: { children: ReactNode; className?: string; as?: 'section' | 'article' | 'div' }) {
  return <Element className={cn('rounded-[22px] border border-border/70 bg-card text-card-foreground shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] backdrop-blur-xl', className)}>{children}</Element>
}

export function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        {eyebrow && <p className="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">{eyebrow}</p>}
        <h2 className="text-[17px] font-semibold tracking-[-0.025em] text-foreground">{title}</h2>
        {description && <p className="text-sm leading-5 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({ label, value, detail, icon: Icon, trend, tone = 'blue' }: { label: string; value: string; detail: string; icon: typeof Leaf; trend?: string; tone?: 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    blue: 'bg-primary/10 text-primary',
    green: 'bg-brand/10 text-brand',
    amber: 'bg-warning/10 text-warning',
    red: 'bg-danger/10 text-danger',
  }
  return (
    <Surface className="p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <span className={cn('flex size-9 items-center justify-center rounded-[12px]', tones[tone])}><Icon className="size-[18px]" /></span>
        {trend && <span className="text-[11px] font-medium text-brand">{trend}</span>}
      </div>
      <div className="mt-5 flex flex-col gap-1">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        <strong className="text-[28px] font-semibold tracking-[-0.055em] tabular-nums text-foreground">{value}</strong>
        <span className="text-[11px] text-muted-foreground">{detail}</span>
      </div>
    </Surface>
  )
}

export function ProgressBar({ value, tone = 'brand' }: { value: number; tone?: 'brand' | 'primary' }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted"><div className={cn('h-full rounded-full transition-[width] duration-500', tone === 'brand' ? 'bg-brand' : 'bg-primary')} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} /></div>
}

export function ScoreRing({ score, label = 'Neighborhood score' }: { score: number; label?: string }) {
  return (
    <div className="relative flex size-[132px] shrink-0 items-center justify-center rounded-full p-[7px] sm:size-[154px]" style={{ background: 'conic-gradient(var(--brand) 0% ' + score + '%, color-mix(in oklab, var(--brand) 12%, transparent) ' + score + '% 100%)' }}>
      <div className="flex size-full flex-col items-center justify-center rounded-full bg-hero text-center">
        <span className="text-[42px] font-semibold leading-none tracking-[-0.08em] text-foreground">{score}</span>
        <span className="mt-2 max-w-[80px] text-[10px] leading-3 text-muted-foreground">{label}</span>
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className={cn('relative h-7 w-12 shrink-0 rounded-full p-1 transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring', checked ? 'bg-brand' : 'bg-muted-foreground/30')}><span className={cn('block size-5 rounded-full bg-white shadow-sm transition-transform duration-200', checked && 'translate-x-5')} /></button>
}

export function Modal({ title, description, onClose, children, wide = false }: { title: string; description?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const titleId = useId()
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKeyDown); document.body.style.overflow = previousOverflow }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={cn('max-h-[92vh] w-full overflow-y-auto rounded-t-[28px] border border-border/70 bg-card p-5 shadow-2xl sm:rounded-[28px] sm:p-7', wide ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5"><h2 id={titleId} className="text-xl font-semibold tracking-[-0.04em]">{title}</h2>{description && <p className="text-sm leading-5 text-muted-foreground">{description}</p>}</div>
          <Button type="button" variant="ghost" size="icon" aria-label="Close dialog" onClick={onClose} className="rounded-full"><X data-icon="inline-start" /></Button>
        </div>
        {children}
      </div>
    </div>
  )
}

export function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div role="status" className="fixed right-4 bottom-20 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-2xl border border-border/70 bg-card px-4 py-3 text-sm shadow-2xl backdrop-blur-xl sm:right-6 sm:bottom-6"><span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand"><Check className="size-3.5" /></span><span className="leading-5">{message}</span><button type="button" aria-label="Dismiss notification" onClick={onClose} className="ml-2 text-muted-foreground hover:text-foreground"><X className="size-4" /></button></div>
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-xs font-medium text-primary transition-opacity hover:opacity-70">{children}<ChevronRight className="size-3.5" /></button>
}

export function FieldLabel({ htmlFor, children, optional = false }: { htmlFor: string; children: ReactNode; optional?: boolean }) {
  return <label htmlFor={htmlFor} className="mb-2 flex items-center justify-between text-xs font-medium text-foreground">{children}{optional && <span className="font-normal text-muted-foreground">Optional</span>}</label>
}

export const inputClassName = 'h-11 w-full rounded-[12px] border border-input bg-background/70 px-3.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary focus:ring-3 focus:ring-primary/15'
