/**
 * SmartWaste API Client
 * Connects frontend components to the Node/Express/MongoDB backend
 */

export interface BackendUser {
  id: number
  firstName: string
  lastName: string
  gender?: string
  mobile: string
  email: string
  role: 'admin' | 'worker' | 'user'
  address: string
  profileImage?: string | null
  workerOnline?: boolean
  workerSkills?: string[]
  workerLastSeenAt?: string | null
  ratingAverage?: number
  ratingCount?: number
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string | null
}

export interface BackendTicket {
  id: number
  ticketCode: string
  userId: number
  workerId?: number | null
  wasteType: string
  description: string
  mediaData?: string | null
  locationAddress: string
  status: 'pending' | 'assigned' | 'in_progress' | 'completed' | 'cancelled'
  priority: 'low' | 'medium' | 'high' | 'critical'
  completionCode?: string | null
  completionMediaData?: string | null
  createdAt: string
  updatedAt: string
  slaDueAt?: string
  slaOverdue?: boolean
  requester?: BackendUser | null
  assignedWorker?: BackendUser | null
  review?: { rating: number; comment?: string } | null
}

export interface BackendHireRequest {
  id: number
  requestCode: string
  userId: number
  requesterName: string
  requesterMobile: string
  requesterEmail: string
  requesterAddress: string
  title: string
  purpose: string
  workAddress: string
  status: 'pending' | 'assigned' | 'completed' | 'cancelled'
  assignedWorkerId?: number | null
  assignedWorker?: BackendUser | null
  createdAt: string
  updatedAt: string
}

export interface BackendNotification {
  id: number
  userId?: number | null
  title: string
  message: string
  createdAt: string
  read?: boolean
}

export interface BackendAdminActivity {
  id: number
  adminId: number
  adminName: string
  sessionLabel?: string | null
  action: string
  targetType?: string | null
  targetId?: number | null
  summary: string
  createdAt: string
}

export interface DashboardSummary {
  totalUsers: number
  totalWorkers: number
  onlineWorkers: number
  totalTickets: number
  pendingTickets: number
}

// Token and CSRF storage keys
const TOKEN_KEY = 'swms_auth_token'
const CSRF_KEY = 'swms_csrf_token'
const USER_KEY = 'swms_user'
const ROLE_KEY = 'swms_active_role'

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(TOKEN_KEY)
}

export function setStoredToken(token: string | null) {
  if (typeof window === 'undefined') return
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

export function getStoredCsrf(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(CSRF_KEY)
}

export function setStoredCsrf(csrf: string | null) {
  if (typeof window === 'undefined') return
  if (csrf) localStorage.setItem(CSRF_KEY, csrf)
  else localStorage.removeItem(CSRF_KEY)
}

export function getStoredUser(): BackendUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function setStoredUser(user: BackendUser | null) {
  if (typeof window === 'undefined') return
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user))
  else localStorage.removeItem(USER_KEY)
}

export function getStoredRole(): 'citizen' | 'worker' | 'admin' {
  if (typeof window === 'undefined') return 'citizen'
  const role = localStorage.getItem(ROLE_KEY)
  if (role === 'admin' || role === 'worker' || role === 'citizen') return role
  return 'citizen'
}

export function setStoredRole(role: 'citizen' | 'worker' | 'admin') {
  if (typeof window === 'undefined') return
  localStorage.setItem(ROLE_KEY, role)
}

// Base fetch wrapper
export async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getStoredToken()
  const csrf = getStoredCsrf()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  if (csrf) {
    headers['X-Admin-CSRF'] = csrf
  }

  // Ensure path starts with /api if not already
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Needed for Admin cookie sessions
  })

  if (!response.ok) {
    let errMsg = `Request failed (${response.status})`
    try {
      const errData = await response.json()
      errMsg = errData.message || errMsg
    } catch {
      // ignore
    }
    const err = new Error(errMsg)
    ;(err as any).status = response.status
    throw err
  }

  // Handle empty responses (like 204 or delete messages)
  const contentType = response.headers.get('content-type')
  if (contentType && contentType.includes('application/json')) {
    return response.json()
  }
  return {} as T
}

// Format relative date/time
export function formatTimeAgo(dateStr?: string | Date | null): string {
  if (!dateStr) return 'Just now'
  const now = new Date().getTime()
  const then = new Date(dateStr).getTime()
  const diffMs = now - then
  if (diffMs < 0) return 'Just now'

  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`

  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours} hr${hours > 1 ? 's' : ''} ago`

  const days = Math.floor(hours / 24)
  if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`

  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Convert Backend Ticket to UI Ticket format
export function mapBackendTicketToUi(t: BackendTicket) {
  const statusMap: Record<string, 'In progress' | 'Pending' | 'Completed' | 'Scheduled'> = {
    pending: 'Pending',
    assigned: 'Scheduled',
    in_progress: 'In progress',
    completed: 'Completed',
    cancelled: 'Completed',
  }

  const priorityMap: Record<string, 'High' | 'Medium' | 'Low'> = {
    critical: 'High',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  }

  const workerName = t.assignedWorker
    ? `${t.assignedWorker.firstName} ${t.assignedWorker.lastName}`.trim()
    : undefined

  return {
    id: t.ticketCode || `SW-${t.id}`,
    numericId: t.id,
    title: t.description ? (t.description.length > 35 ? t.description.slice(0, 35) + '...' : t.description) : `${t.wasteType} collection`,
    category: t.wasteType,
    address: t.locationAddress,
    status: statusMap[t.status] || 'Pending',
    priority: priorityMap[t.priority] || 'Medium',
    time: formatTimeAgo(t.createdAt),
    code: t.completionCode || undefined,
    worker: workerName,
    eta: t.status === 'in_progress' ? 'Arriving in ~8 min' : t.status === 'assigned' ? 'Assigned to route' : undefined,
    description: t.description,
    mediaData: t.mediaData,
    raw: t,
  }
}

// Convert Backend HireRequest to UI Booking format
export function mapBackendHireToUi(h: BackendHireRequest) {
  const statusMap: Record<string, 'Confirmed' | 'Pending' | 'Completed'> = {
    pending: 'Pending',
    assigned: 'Confirmed',
    completed: 'Completed',
    cancelled: 'Completed',
  }

  const workerName = h.assignedWorker
    ? `${h.assignedWorker.firstName} ${h.assignedWorker.lastName}`.trim()
    : 'Awaiting operative'

  const priceMap: Record<string, string> = {
    'Home cleaning': '$48',
    'Garden cleanup': '$36',
    'Bulk waste pickup': '$64',
    'Balcony deep clean': '$48',
    'Garage clear-out': '$72',
  }

  return {
    id: h.requestCode || `BK-${h.id}`,
    numericId: h.id,
    title: h.title || 'Personal Work',
    worker: workerName,
    date: new Date(h.createdAt).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    }) + ' · 10:00',
    status: statusMap[h.status] || 'Pending',
    price: priceMap[h.title] || '$48',
    purpose: h.purpose,
    address: h.workAddress,
    raw: h,
  }
}
