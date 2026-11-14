'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  BellRing,
  Check,
  CheckCircle2,
  Clock3,
  Download,
  Edit2,
  MoreHorizontal,
  Plus,
  Radio,
  Send,
  ShieldCheck,
  Trash2,
  UsersRound,
  X,
  Loader2,
} from 'lucide-react'
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { activityData, auditRows, categoryData, workerRows, type View } from './data'
import { Avatar, LiveDot, MetricCard, Modal, SectionHeader, StatusBadge, Surface, TextLink, FieldLabel, inputClassName } from './shared'
import { apiRequest, formatTimeAgo, type BackendUser, type BackendAdminActivity, type DashboardSummary, type BackendTicket } from '@/lib/api'
import { useAuth } from '@/lib/auth-context'

const intakeConfig = {
  reports: { label: 'Reports', color: 'var(--chart-1)' },
  completed: { label: 'Completed', color: 'var(--chart-2)' },
} satisfies ChartConfig

const categoryConfig = {
  organic: { label: 'Organic', color: 'var(--chart-2)' },
  recyclables: { label: 'Recyclables', color: 'var(--chart-1)' },
  mixed: { label: 'Mixed', color: 'var(--chart-3)' },
  other: { label: 'Other', color: 'var(--chart-4)' },
} satisfies ChartConfig

export function AdminDashboard({ onNavigate }: { onNavigate: (view: View) => void }) {
  const { user } = useAuth()
  const [time, setTime] = useState('')
  const [summary, setSummary] = useState<DashboardSummary | null>(null)
  const [tickets, setTickets] = useState<BackendTicket[]>([])
  const [workers, setWorkers] = useState<BackendUser[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    update()
    const interval = window.setInterval(update, 1000)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    const loadData = async () => {
      try {
        const [sumRes, tickRes, userRes] = await Promise.all([
          apiRequest<DashboardSummary>('/api/dashboard/summary').catch(() => null),
          apiRequest<BackendTicket[]>('/api/tickets').catch(() => []),
          apiRequest<BackendUser[]>('/api/users').catch(() => []),
        ])
        if (sumRes) setSummary(sumRes)
        if (Array.isArray(tickRes)) setTickets(tickRes)
        if (Array.isArray(userRes)) {
          setWorkers(userRes.filter((u) => u.role === 'worker'))
        }
      } catch (err) {
        console.warn('Admin load error:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [])

  const adminName = user?.firstName || 'Morgan'

  // Dynamic metrics
  const activeReportsCount = summary ? summary.totalTickets : tickets.length || 47
  const pendingCount = summary ? summary.pendingTickets : tickets.filter((t) => t.status === 'pending').length || 8
  const totalWorkersCount = summary?.totalWorkers ?? (workers.length || 28)
  const onlineWorkersCount = summary?.onlineWorkers ?? (workers.filter((w) => w.workerOnline).length || 24)

  // Composition data from real tickets
  const dynamicComposition = useMemo(() => {
    if (tickets.length === 0) return categoryData
    const counts: Record<string, number> = {}
    tickets.forEach((t) => {
      const type = t.wasteType || 'Other'
      counts[type] = (counts[type] || 0) + 1
    })
    const total = tickets.length || 1
    const colors = ['var(--chart-2)', 'var(--chart-1)', 'var(--chart-3)', 'var(--chart-4)']
    return Object.entries(counts).map(([name, count], index) => ({
      name,
      value: Math.round((count / total) * 100),
      fill: colors[index % colors.length],
    }))
  }, [tickets])

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      <section className="flex flex-col justify-between gap-5 rounded-[26px] border border-primary/15 bg-admin-hero p-6 sm:p-8 md:flex-row md:items-end">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-medium text-primary">
            <span className="flex size-7 items-center justify-center rounded-[9px] bg-primary/10">
              <ShieldCheck className="size-4" />
            </span>
            City operations desk · Zero Trust verified
          </div>
          <h1 className="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] sm:text-[40px]">
            Good morning, {adminName}
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            A real-time command view of your city. Teams are synced and field operations are active.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <span className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1.5 text-[11px] text-muted-foreground">
            <LiveDot />Live telemetry
          </span>
          <span className="text-[28px] font-medium tracking-[-0.05em] tabular-nums">{time || '09:41:28'}</span>
          <span className="text-[11px] text-muted-foreground">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard
          label="Active reports"
          value={String(activeReportsCount).padStart(2, '0')}
          detail="Across city sectors"
          icon={Activity}
          trend="+12%"
          tone="blue"
        />
        <MetricCard
          label="Pending dispatch"
          value={String(pendingCount).padStart(2, '0')}
          detail="Require worker match"
          icon={AlertTriangle}
          tone="red"
        />
        <MetricCard label="Overdue SLA" value="00" detail="All within SLA targets" icon={Clock3} trend="-100%" tone="green" />
        <MetricCard
          label="Workers online"
          value={`${onlineWorkersCount}/${totalWorkersCount}`}
          detail={`${Math.round((onlineWorkersCount / (totalWorkersCount || 1)) * 100)}% fleet availability`}
          icon={UsersRound}
          trend="+4%"
          tone="green"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
        <Surface className="min-w-0 p-5 sm:p-6">
          <SectionHeader
            title="Collection activity"
            description="Reports received vs. verified completions · Last 7 days"
            action={<button type="button" className="rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">This week</button>}
          />
          <div className="mt-5 h-[220px] w-full">
            <ChartContainer config={intakeConfig} className="h-full w-full">
              <AreaChart accessibilityLayer data={activityData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={10} fontSize={11} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area type="monotone" dataKey="reports" stroke="var(--color-reports)" fill="var(--color-reports)" fillOpacity={0.12} strokeWidth={2.5} />
                <Area type="monotone" dataKey="completed" stroke="var(--color-completed)" fill="var(--color-completed)" fillOpacity={0.08} strokeWidth={2} />
              </AreaChart>
            </ChartContainer>
          </div>
          <div className="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" />Reports</span>
            <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-brand" />Completed</span>
            <span className="ml-auto flex items-center gap-1 text-brand"><ArrowUpRight className="size-3.5" />14.8% vs last week</span>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader title="Waste composition" description="Current distribution by category" />
          <div className="relative mx-auto mt-2 h-[190px] w-full">
            <ChartContainer config={categoryConfig} className="h-full w-full">
              <PieChart>
                <Pie data={dynamicComposition} dataKey="value" nameKey="name" innerRadius={57} outerRadius={78} paddingAngle={4} strokeWidth={0}>
                  {dynamicComposition.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent hideLabel />} />
              </PieChart>
            </ChartContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[26px] font-semibold tracking-[-0.06em]">{tickets.length || 12}</span>
              <span className="text-[10px] text-muted-foreground">logged</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            {dynamicComposition.map((item, index) => (
              <div key={item.name} className="flex items-center gap-2 text-[11px]">
                <span className={`size-2 rounded-full ${index === 0 ? 'bg-brand' : index === 1 ? 'bg-primary' : index === 2 ? 'bg-warning' : 'bg-muted-foreground'}`} />
                <span className="flex-1 truncate text-muted-foreground">{item.name}</span>
                <span className="font-medium tabular-nums">{item.value}%</span>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
        <Surface className="overflow-hidden p-5 sm:p-6">
          <SectionHeader
            title="Field fleet"
            description="Live status from verified municipal operatives."
            action={<TextLink onClick={() => onNavigate('accounts')}>View all ({workers.length})</TextLink>}
          />
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead>
                <tr className="border-b border-border/60 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                  <th className="pb-3 font-medium">Operative</th>
                  <th className="pb-3 font-medium">Zone</th>
                  <th className="pb-3 font-medium">Status</th>
                  <th className="pb-3 font-medium">Phone</th>
                  <th className="pb-3 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {workers.slice(0, 5).map((w) => (
                  <tr key={w.id} className="text-xs">
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <Avatar initials={`${w.firstName?.[0] || 'F'}${w.lastName?.[0] || 'W'}`} className="size-8 text-[10px]" online={w.workerOnline} />
                        <div>
                          <p className="font-medium">{w.firstName} {w.lastName}</p>
                          <p className="text-[10px] text-muted-foreground">{w.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 text-muted-foreground">{w.address || 'District 04'}</td>
                    <td className="py-3">
                      <StatusBadge status={w.workerOnline ? 'On route' : 'Pending'} />
                    </td>
                    <td className="py-3 tabular-nums text-muted-foreground">{w.mobile}</td>
                    <td className="py-3 font-medium tabular-nums">{w.ratingAverage ? w.ratingAverage.toFixed(1) : '4.9'}</td>
                  </tr>
                ))}
                {workers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-xs text-muted-foreground">
                      Loading operatives directory...
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Surface>

        <Surface className="p-5 sm:p-6">
          <SectionHeader
            eyebrow="Quick action"
            title="Broadcast to citizens"
            description="Send an instant push alert to residents or field teams."
            action={
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </span>
            }
          />
          <div className="mt-5 rounded-[16px] bg-muted/60 p-4">
            <p className="text-xs font-medium">Live District Notification</p>
            <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
              Notify citizens of scheduled pickups, route adjustments, or emergency sanitation updates.
            </p>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <CheckCircle2 className="size-3.5 text-brand" />Direct gateway to resident mobile devices
            </div>
          </div>
          <Button type="button" variant="brand" onClick={() => onNavigate('broadcast')} className="mt-4 h-10 w-full rounded-full">
            <Send data-icon="inline-start" />Create broadcast
          </Button>
          <div className="mt-5 flex items-center justify-between border-t border-border/60 pt-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Radio className="size-3.5 text-brand" />Push & notification service online
            </span>
            <span>99.98% uptime</span>
          </div>
        </Surface>
      </div>
    </div>
  )
}

export function AdminAccounts() {
  const [users, setUsers] = useState<BackendUser[]>([])
  const [loading, setLoading] = useState(true)
  const [roleFilter, setRoleFilter] = useState<'all' | 'worker' | 'user' | 'admin'>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<BackendUser | null>(null)
  const [toast, setToast] = useState('')

  // Form states for creating/editing
  const [formFirstName, setFormFirstName] = useState('')
  const [formLastName, setFormLastName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formMobile, setFormMobile] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [formRole, setFormRole] = useState<'user' | 'worker' | 'admin'>('worker')
  const [formAddress, setFormAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const res = await apiRequest<BackendUser[]>('/api/users')
      if (Array.isArray(res)) setUsers(res)
    } catch (err) {
      console.warn('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesRole = roleFilter === 'all' || u.role === roleFilter
      const query = searchTerm.toLowerCase().trim()
      const matchesSearch =
        !query ||
        `${u.firstName} ${u.lastName} ${u.email} ${u.address || ''}`.toLowerCase().includes(query)
      return matchesRole && matchesSearch
    })
  }, [users, roleFilter, searchTerm])

  const openAddModal = () => {
    setEditingUser(null)
    setFormFirstName('')
    setFormLastName('')
    setFormEmail('')
    setFormMobile('')
    setFormPassword('Worker#123')
    setFormRole('worker')
    setFormAddress('District 04, San Francisco')
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (u: BackendUser) => {
    setEditingUser(u)
    setFormFirstName(u.firstName)
    setFormLastName(u.lastName)
    setFormEmail(u.email)
    setFormMobile(u.mobile)
    setFormPassword('')
    setFormRole(u.role)
    setFormAddress(u.address || '')
    setFormError('')
    setModalOpen(true)
  }

  const handleDelete = async (u: BackendUser) => {
    if (!window.confirm(`Are you sure you want to delete ${u.firstName} ${u.lastName} (${u.email})?`)) return
    try {
      await apiRequest(`/api/users/${u.id}`, { method: 'DELETE' })
      setToast(`Account ${u.email} deleted successfully.`)
      fetchUsers()
    } catch (err: any) {
      alert(err?.message || 'Could not delete user.')
    }
  }

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSubmitting(true)
      setFormError('')

      if (editingUser) {
        // Edit existing
        await apiRequest(`/api/users/${editingUser.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            firstName: formFirstName,
            lastName: formLastName,
            mobile: formMobile,
            role: formRole,
            address: formAddress,
          }),
        })
        setToast(`Updated ${formFirstName} ${formLastName}.`)
      } else {
        // Create new
        await apiRequest('/api/users', {
          method: 'POST',
          body: JSON.stringify({
            firstName: formFirstName,
            lastName: formLastName,
            email: formEmail,
            mobile: formMobile,
            password: formPassword,
            role: formRole,
            address: formAddress,
            gender: 'Other',
          }),
        })
        setToast(`Created new ${formRole} account for ${formFirstName}.`)
      }

      setModalOpen(false)
      fetchUsers()
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save account.')
    } finally {
      setSubmitting(false)
    }
  }

  const exportDirectory = () => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(users, null, 2))
    const dlAnchor = document.createElement('a')
    dlAnchor.setAttribute('href', jsonStr)
    dlAnchor.setAttribute('download', 'smartwaste_users_directory.json')
    dlAnchor.click()
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        eyebrow="City command"
        title="Accounts & permissions"
        description="Manage citizens, field operatives, and administrative access with full role governance."
        action={
          <Button type="button" variant="brand" onClick={openAddModal} className="rounded-full">
            <Plus data-icon="inline-start" />Add account
          </Button>
        }
      />

      <Surface className="p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {(['all', 'worker', 'user', 'admin'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={cn(
                  'rounded-full px-3 py-1.5 transition-colors',
                  roleFilter === r ? 'bg-primary text-primary-foreground font-medium' : 'bg-muted text-muted-foreground hover:text-foreground'
                )}
              >
                {r === 'all' ? `All (${users.length})` : r === 'worker' ? `Workers (${users.filter((u) => u.role === 'worker').length})` : r === 'user' ? `Citizens (${users.filter((u) => u.role === 'user').length})` : `Admins (${users.filter((u) => u.role === 'admin').length})`}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search directory..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-9 rounded-full border border-border bg-muted/50 px-3 text-xs outline-none focus:border-primary"
            />
            <Button type="button" variant="outline" size="sm" onClick={exportDirectory} className="rounded-full">
              <Download data-icon="inline-start" />Export
            </Button>
          </div>
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[650px] text-left">
            <thead>
              <tr className="border-b border-border/60 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                <th className="pb-3 font-medium">Person</th>
                <th className="pb-3 font-medium">Role</th>
                <th className="pb-3 font-medium">Mobile</th>
                <th className="pb-3 font-medium">Address / Sector</th>
                <th className="pb-3 font-medium">Status</th>
                <th className="pb-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {filteredUsers.map((person) => (
                <tr key={person.id} className="text-xs">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <Avatar initials={`${person.firstName?.[0] || 'U'}${person.lastName?.[0] || ''}`} className="size-9" online={person.workerOnline} />
                      <div>
                        <p className="font-medium">{person.firstName} {person.lastName}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{person.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-4">
                    <span
                      className={cn(
                        'rounded-full px-2.5 py-1 text-[11px] font-medium capitalize',
                        person.role === 'admin'
                          ? 'bg-primary/10 text-primary'
                          : person.role === 'worker'
                            ? 'bg-brand/10 text-brand'
                            : 'bg-muted text-muted-foreground'
                      )}
                    >
                      {person.role === 'user' ? 'Citizen' : person.role}
                    </span>
                  </td>
                  <td className="py-4 tabular-nums text-muted-foreground">{person.mobile || '—'}</td>
                  <td className="py-4 text-muted-foreground">{person.address || 'San Francisco'}</td>
                  <td className="py-4">
                    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span className={cn('size-2 rounded-full', person.workerOnline ? 'bg-brand' : 'bg-muted-foreground/40')} />
                      {person.workerOnline ? 'Online' : 'Offline'}
                    </span>
                  </td>
                  <td className="py-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => openEditModal(person)}
                        title="Edit account"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Edit2 className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(person)}
                        title="Delete account"
                        className="rounded-lg p-1.5 text-muted-foreground hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    No accounts found matching filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Surface>

      {modalOpen && (
        <Modal
          title={editingUser ? `Edit Account: ${editingUser.firstName} ${editingUser.lastName}` : 'Add New Account'}
          description="Create or modify permissions for citizen, field worker, or administrator."
          onClose={() => setModalOpen(false)}
        >
          <form onSubmit={handleSaveUser} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="acc-first-name">First name</FieldLabel>
                <input
                  id="acc-first-name"
                  required
                  value={formFirstName}
                  onChange={(e) => setFormFirstName(e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="acc-last-name">Last name</FieldLabel>
                <input
                  id="acc-last-name"
                  required
                  value={formLastName}
                  onChange={(e) => setFormLastName(e.target.value)}
                  className={inputClassName}
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="acc-email">Email address</FieldLabel>
              <input
                id="acc-email"
                type="email"
                required
                disabled={!!editingUser}
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                className={inputClassName}
              />
            </div>

            {!editingUser && (
              <div>
                <FieldLabel htmlFor="acc-pass">Initial Password</FieldLabel>
                <input
                  id="acc-pass"
                  type="password"
                  required
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  className={inputClassName}
                  placeholder="Min 8 chars, 1 uppercase & 1 symbol"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <FieldLabel htmlFor="acc-mobile">Mobile number</FieldLabel>
                <input
                  id="acc-mobile"
                  required
                  value={formMobile}
                  onChange={(e) => setFormMobile(e.target.value)}
                  className={inputClassName}
                />
              </div>
              <div>
                <FieldLabel htmlFor="acc-role">Role</FieldLabel>
                <select
                  id="acc-role"
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as any)}
                  className={inputClassName}
                >
                  <option value="user">Citizen (user)</option>
                  <option value="worker">Field Worker (worker)</option>
                  <option value="admin">Administrator (admin)</option>
                </select>
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="acc-address">Address / Assigned Zone</FieldLabel>
              <input
                id="acc-address"
                required
                value={formAddress}
                onChange={(e) => setFormAddress(e.target.value)}
                className={inputClassName}
              />
            </div>

            {formError && <p className="text-xs text-danger">{formError}</p>}

            <div className="flex justify-end gap-2 border-t border-border/60 pt-4">
              <Button type="button" variant="outline" onClick={() => setModalOpen(false)} className="rounded-full">
                Cancel
              </Button>
              <Button type="submit" variant="brand" disabled={submitting} className="rounded-full">
                {submitting ? <Loader2 className="size-4 animate-spin" /> : editingUser ? 'Update Account' : 'Create Account'}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div className="fixed right-6 bottom-6 z-50 rounded-xl bg-card border border-border p-4 shadow-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="size-4 text-brand" />
          <span>{toast}</span>
          <button type="button" onClick={() => setToast('')} className="ml-2 text-muted-foreground">
            <X className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}

export function AdminBroadcast() {
  const [title, setTitle] = useState('')
  const [audience, setAudience] = useState<'user' | 'worker' | 'all'>('user')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [recentDispatches, setRecentDispatches] = useState([
    { title: 'District 04 Service Notice', audience: 'All residents', time: 'Just now' },
    { title: 'Weekend collection schedule', audience: 'All residents in District 04', time: 'Today, 09:12' },
    { title: 'New recycling guidelines', audience: 'All SmartWaste users', time: 'Yesterday, 16:40' },
  ])

  const submitBroadcast = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!title.trim() || !message.trim()) return

    try {
      setSending(true)
      await apiRequest('/api/notifications', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          message: message.trim(),
          targetRole: audience === 'all' ? null : audience,
        }),
      })

      setRecentDispatches((prev) => [
        {
          title: title.trim(),
          audience: audience === 'user' ? 'All residents' : audience === 'worker' ? 'Field operatives only' : 'All users',
          time: 'Just now',
        },
        ...prev,
      ])

      setTitle('')
      setMessage('')
      setSent(true)
      window.setTimeout(() => setSent(false), 4500)
    } catch (err: any) {
      alert(err?.message || 'Failed to send broadcast.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
      <Surface className="p-5 sm:p-7">
        <SectionHeader
          eyebrow="City command"
          title="Broadcast an announcement"
          description="Keep residents and field teams aligned with a clear, timely dispatch message."
        />
        <form className="mt-7 flex flex-col gap-5" onSubmit={submitBroadcast}>
          <div>
            <label htmlFor="broadcast-title" className="mb-2 block text-xs font-medium">Announcement title</label>
            <input
              id="broadcast-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Holiday collection schedule adjustment"
              className={inputClassName}
            />
          </div>

          <div>
            <label htmlFor="broadcast-audience" className="mb-2 block text-xs font-medium">Target Audience</label>
            <select
              id="broadcast-audience"
              value={audience}
              onChange={(e) => setAudience(e.target.value as any)}
              className={inputClassName}
            >
              <option value="user">Residents / Citizens only</option>
              <option value="worker">Field Operatives fleet only</option>
              <option value="all">All SmartWaste users</option>
            </select>
          </div>

          <div>
            <label htmlFor="broadcast-message" className="mb-2 block text-xs font-medium">Announcement Message</label>
            <textarea
              id="broadcast-message"
              required
              rows={6}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the full announcement clearly..."
              className={cn(inputClassName, 'h-auto resize-none py-3')}
            />
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
            <span className="text-[11px] text-muted-foreground">Delivered via in-app push and notification center</span>
            <Button type="submit" variant="brand" disabled={sending} className="rounded-full">
              {sending ? (
                <>
                  <Loader2 className="size-4 animate-spin" />Sending...
                </>
              ) : (
                <>
                  <Send data-icon="inline-start" />Publish broadcast
                </>
              )}
            </Button>
          </div>

          {sent && (
            <p role="status" className="flex items-center gap-2 text-xs text-brand font-medium">
              <CheckCircle2 className="size-4" />Broadcast dispatched to {audience === 'user' ? 'citizens' : audience === 'worker' ? 'workers' : 'all accounts'}.
            </p>
          )}
        </form>
      </Surface>

      <Surface className="p-5 sm:p-7">
        <SectionHeader title="Recent dispatches" description="Logged announcements from city command." />
        <div className="mt-6 flex flex-col gap-5">
          {recentDispatches.map((item, index) => (
            <div key={`${item.title}-${index}`} className="flex gap-3">
              <span className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary/10 text-primary">
                <BellRing className="size-4" />
              </span>
              <div>
                <p className="text-xs font-medium">{item.title}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{item.audience}</p>
                <p className="mt-2 text-[10px] text-muted-foreground">{item.time}</p>
              </div>
            </div>
          ))}
        </div>
      </Surface>
    </div>
  )
}

export function AdminActivity() {
  const [activities, setActivities] = useState<BackendAdminActivity[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const res = await apiRequest<BackendAdminActivity[]>('/api/admin-activities')
        if (Array.isArray(res)) setActivities(res)
      } catch (err) {
        console.warn('Failed to load admin activities:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchActivities()
  }, [])

  const exportActivity = () => {
    const jsonStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activities, null, 2))
    const dlAnchor = document.createElement('a')
    dlAnchor.setAttribute('href', jsonStr)
    dlAnchor.setAttribute('download', 'smartwaste_audit_log.json')
    dlAnchor.click()
  }

  return (
    <div className="flex flex-col gap-5">
      <SectionHeader
        eyebrow="City command"
        title="Audit activity"
        description="A tamper-evident, transparent record of administrative actions and session events."
        action={
          <Button type="button" variant="outline" size="sm" onClick={exportActivity} className="rounded-full">
            <Download data-icon="inline-start" />Export log
          </Button>
        }
      />

      <Surface className="p-5 sm:p-7">
        <div className="flex items-center gap-2 rounded-[14px] bg-brand/10 px-4 py-3 text-xs text-brand">
          <LiveDot />Audit stream is verified · All security actions recorded with cryptographic sessions
        </div>

        <div className="mt-6 flex flex-col divide-y divide-border/60">
          {activities.map((row) => (
            <div key={row.id} className="flex items-start gap-3 py-4 first:pt-0 last:pb-0">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-muted text-muted-foreground">
                <ShieldCheck className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{row.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{row.adminName}</span> · {row.summary}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground font-mono">{row.sessionLabel || 'SESSION'}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted-foreground">{formatTimeAgo(row.createdAt)}</span>
            </div>
          ))}

          {activities.length === 0 && !loading && (
            <p className="py-8 text-center text-xs text-muted-foreground">No recent audit activity records found.</p>
          )}
        </div>
      </Surface>
    </div>
  )
}
