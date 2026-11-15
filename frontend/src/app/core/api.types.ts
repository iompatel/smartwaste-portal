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
  assignedWorker?: BackendUser | null;
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
  assignedWorker?: BackendUser | null;
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
