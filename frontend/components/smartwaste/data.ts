import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  BarChart3,
  BellRing,
  BriefcaseBusiness,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  MapPinned,
  MessageSquareText,
  Route,
  Settings2,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
} from 'lucide-react'

export type Role = 'citizen' | 'worker' | 'admin'
export type View =
  | 'overview'
  | 'tickets'
  | 'hire'
  | 'profile'
  | 'settings'
  | 'accounts'
  | 'broadcast'
  | 'activity'

export type TicketStatus = 'In progress' | 'Pending' | 'Completed' | 'Scheduled'
export type Priority = 'High' | 'Medium' | 'Low'

export interface Ticket {
  id: string
  numericId?: number
  title: string
  category: string
  address: string
  status: TicketStatus
  priority: Priority
  time: string
  code?: string
  worker?: string
  eta?: string
  description?: string
  mediaData?: string | null
}

export interface Booking {
  id: string
  numericId?: number
  title: string
  worker: string
  date: string
  status: 'Confirmed' | 'Pending' | 'Completed'
  price: string
  purpose?: string
  address?: string
}

export interface NavItem {
  id: View
  label: string
  icon: LucideIcon
  badge?: string
}

export const roleMeta: Record<Role, { label: string; name: string; subtitle: string; initials: string }> = {
  citizen: { label: 'Citizen portal', name: 'Alex Morgan', subtitle: 'Personal account', initials: 'AM' },
  worker: { label: 'Field operations', name: 'Jordan Lee', subtitle: 'Verified operative', initials: 'JL' },
  admin: { label: 'City command', name: 'Morgan Chen', subtitle: 'Administrator', initials: 'MC' },
}

export const navByRole: Record<Role, NavItem[]> = {
  citizen: [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'tickets', label: 'My reports', icon: ClipboardCheck, badge: '4' },
    { id: 'hire', label: 'Hire a worker', icon: BriefcaseBusiness },
    { id: 'profile', label: 'Profile & settings', icon: UserRound },
  ],
  worker: [
    { id: 'overview', label: 'Field cockpit', icon: LayoutDashboard },
    { id: 'tickets', label: 'Route queue', icon: Route, badge: '8' },
    { id: 'hire', label: 'Hired tasks', icon: BriefcaseBusiness, badge: '2' },
    { id: 'profile', label: 'Field credentials', icon: ShieldCheck },
  ],
  admin: [
    { id: 'overview', label: 'Command center', icon: BarChart3 },
    { id: 'accounts', label: 'Accounts', icon: UsersRound },
    { id: 'broadcast', label: 'Broadcast', icon: BellRing },
    { id: 'activity', label: 'Audit activity', icon: Activity },
  ],
}

export const secondaryNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

export const seedTickets: Ticket[] = [
  {
    id: 'SW-1048',
    title: 'Overflowing street bin',
    category: 'Mixed waste',
    address: '18 Valencia Street',
    status: 'In progress',
    priority: 'High',
    time: '12 min ago',
    code: '648219',
    worker: 'Jordan Lee',
    eta: 'Arriving in 8 min',
    description: 'The corner bin is overflowing and blocking the pedestrian path.',
  },
  {
    id: 'SW-1046',
    title: 'Recycling pickup',
    category: 'Recyclables',
    address: '24 Hayes Street',
    status: 'Scheduled',
    priority: 'Medium',
    time: 'Yesterday',
    code: '391506',
    worker: 'Assigned to Jordan Lee',
    eta: 'Tomorrow, 09:30',
    description: 'Two bags of cardboard and mixed recycling outside the main entrance.',
  },
  {
    id: 'SW-1042',
    title: 'Garden waste collection',
    category: 'Organic',
    address: '8 Mission Street',
    status: 'Completed',
    priority: 'Low',
    time: 'Nov 10, 2026',
    worker: 'Jordan Lee',
    description: 'Collected and verified with photo proof.',
  },
  {
    id: 'SW-1039',
    title: 'Broken glass near bus stop',
    category: 'Glass',
    address: '112 Market Street',
    status: 'Completed',
    priority: 'High',
    time: 'Nov 08, 2026',
    worker: 'Sam Rivera',
    description: 'Area cleared and made safe for pedestrians.',
  },
]

export const seedBookings: Booking[] = [
  { id: 'BK-208', title: 'Balcony deep clean', worker: 'Priya Shah', date: 'Sat, Nov 15 · 10:00', status: 'Confirmed', price: '$48' },
  { id: 'BK-204', title: 'Garage clear-out', worker: 'Jordan Lee', date: 'Nov 09, 2026', status: 'Completed', price: '$72' },
]

export const activityData = [
  { day: 'Mon', reports: 28, completed: 22 },
  { day: 'Tue', reports: 36, completed: 29 },
  { day: 'Wed', reports: 31, completed: 27 },
  { day: 'Thu', reports: 44, completed: 35 },
  { day: 'Fri', reports: 39, completed: 32 },
  { day: 'Sat', reports: 52, completed: 41 },
  { day: 'Sun', reports: 47, completed: 38 },
]

export const categoryData = [
  { name: 'Organic', value: 38, fill: 'var(--color-organic)' },
  { name: 'Recyclables', value: 27, fill: 'var(--color-recyclables)' },
  { name: 'Mixed', value: 21, fill: 'var(--color-mixed)' },
  { name: 'Other', value: 14, fill: 'var(--color-other)' },
]

export const workerRows = [
  { name: 'Jordan Lee', initials: 'JL', route: 'Valencia → Hayes', status: 'On route', collections: '12 / 16', rating: '4.9' },
  { name: 'Priya Shah', initials: 'PS', route: 'Mission District', status: 'On route', collections: '9 / 14', rating: '4.8' },
  { name: 'Sam Rivera', initials: 'SR', route: 'Market Street', status: 'Break', collections: '16 / 18', rating: '4.9' },
  { name: 'Taylor Kim', initials: 'TK', route: 'Castro → Noe Valley', status: 'On route', collections: '7 / 12', rating: '4.7' },
]

export const auditRows = [
  { action: 'Updated worker role', actor: 'Morgan Chen', target: 'Sam Rivera', time: '2 min ago', icon: ShieldCheck },
  { action: 'Broadcast published', actor: 'Morgan Chen', target: 'All field operatives', time: '28 min ago', icon: MessageSquareText },
  { action: 'Report escalated', actor: 'System automation', target: 'SW-1048 · High priority', time: '41 min ago', icon: BellRing },
  { action: 'New account created', actor: 'Morgan Chen', target: 'Taylor Kim · Worker', time: '1 hr ago', icon: UserRound },
  { action: 'SLA policy updated', actor: 'Morgan Chen', target: 'District 04', time: '3 hrs ago', icon: FileText },
]

export const mapPins = [
  { label: 'SW-1048', location: 'Valencia St', tone: 'bg-primary' },
  { label: 'SW-1046', location: 'Hayes St', tone: 'bg-brand' },
  { label: 'SW-1042', location: 'Mission St', tone: 'bg-warning' },
]

export const iconByCategory: Record<string, LucideIcon> = {
  'Mixed waste': Trash2,
  Recyclables: ClipboardCheck,
  Organic: MapPinned,
  Glass: ShieldCheck,
}
