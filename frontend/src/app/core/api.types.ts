export interface BackendUser {
  id: number;
  firstName: string;
  lastName: string;
  gender?: string;
  mobile: string;
  email: string;
  role: 'admin' | 'worker' | 'user';
  address: string;
  profileImage?: string | null;
  workerOnline?: boolean;
  workerSkills?: string[];
  workerLastSeenAt?: string | null;
  ratingAverage?: number;
  ratingCount?: number;
  createdAt?: string;
  updatedAt?: string;
  lastLoginAt?: string | null;
}

export interface BackendPublicWorker {
  id: number;
  firstName: string;
  lastName: string;
  role: 'worker';
  ratingAverage?: number;
  ratingCount?: number;
}

export interface BackendTicket {
  id: number;
  ticketCode: string;
  userId: number;
  workerId?: number | null;
  wasteType: string;
  description: string;
  mediaData?: string | null;
  locationAddress: string;
  status: 'pending' | 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  priority: 'low' | 'medium' | 'high' | 'critical';
  completionCode?: string | null;
  completionMediaData?: string | null;
  statusHistory?: Array<{
    status: string;
    actorId?: number | null;
    actorRole?: string;
    note?: string;
    createdAt?: string;
  }>;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string;
  slaOverdue?: boolean;
  requester?: BackendUser | null;
  assignedWorker?: BackendUser | BackendPublicWorker | null;
  review?: { rating: number; comment?: string } | null;
}

export interface BackendHireRequest {
  id: number;
  requestCode: string;
  userId: number;
  requesterName: string;
  requesterMobile: string;
  requesterEmail: string;
  requesterAddress: string;
  title: string;
  purpose: string;
  workAddress: string;
  status: 'pending' | 'assigned' | 'completed' | 'cancelled';
  assignedWorkerId?: number | null;
  assignedWorker?: BackendUser | BackendPublicWorker | null;
  createdAt: string;
  updatedAt: string;
}

export interface BackendNotification {
  id: number;
  userId?: number | null;
  title: string;
  message: string;
  createdAt: string;
  read?: boolean;
  readBy?: number[];
}

export interface BackendAdminActivity {
  id: number;
  adminId: number;
  adminName: string;
  sessionLabel?: string | null;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  summary: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalUsers: number;
  totalWorkers: number;
  onlineWorkers: number;
  totalTickets: number;
  pendingTickets: number;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  senderId: number;
  senderName: string;
  senderRole: 'admin' | 'worker' | 'user';
  message: string;
  createdAt: string;
}

export interface AccountPayload {
  id?: number;
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
  address: string;
  gender: string;
  role: 'admin' | 'worker' | 'user';
  password?: string;
  confirmPassword?: string;
}

export interface AccountActivity {
  id: number;
  actorId: number;
  actorRole: 'user' | 'worker' | 'admin';
  actorName: string;
  actorEmail: string;
  action: string;
  targetType?: string | null;
  targetId?: number | null;
  summary: string;
  details: Record<string, any>;
  createdAt: string;
}

export interface ActivityPage {
  items: AccountActivity[];
  total: number;
  page: number;
  limit: number;
}

export interface ActivityFilters {
  actorRole?: 'user' | 'worker' | 'admin';
  actorId?: number;
  action?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface WorkerLiveLocation {
  workerId: number;
  firstName: string;
  lastName: string;
  email: string;
  workerOnline: boolean;
  lastSeenAt: string | null;
  location: {
    latitude: number;
    longitude: number;
    accuracy: number;
    updatedAt: string;
  } | null;
  activeTickets: Array<{
    id: number;
    ticketCode: string;
    status: string;
    locationAddress: string;
  }>;
}

export interface WorkerLocationSnapshot {
  workers: WorkerLiveLocation[];
  updatedAt: string;
}
