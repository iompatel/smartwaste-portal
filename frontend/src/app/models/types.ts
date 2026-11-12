export type UserRole = 'admin' | 'worker' | 'user';
export type TicketStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled';
export type TicketPriority = 'low' | 'medium' | 'high';
export type HireRequestStatus = 'pending' | 'assigned' | 'completed' | 'cancelled';

export interface User {
  id: number;
  firstName: string;
  lastName: string;
  gender: string;
  mobile: string;
  email: string;
  role: UserRole;
  address: string;
  profileImage: string | null;
  createdAt: string;
  updatedAt: string;
  workerOnline?: boolean;
  workerLastSeenAt?: string | null;
  workerSkills?: string[];
  ratingAverage?: number;
  ratingCount?: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface DashboardSummary {
  totalUsers: number;
  totalWorkers: number;
  onlineWorkers: number;
  totalTickets: number;
  pendingTickets: number;
}

export interface Ticket {
  id: number;
  ticketCode: string;
  userId: number;
  workerId: number | null;
  wasteType: string;
  description: string;
  mediaData: string | null;
  locationAddress: string;
  status: TicketStatus;
  priority: TicketPriority;
  statusHistory?: TicketStatusEvent[];
  acceptedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  completionCode?: string | null;
  completionMediaData?: string | null;
  requester?: User | null;
  assignedWorker?: User | null;
  review?: Review | null;
  slaDueAt?: string;
  slaOverdue?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TicketStatusEvent {
  status: TicketStatus;
  actorId: number | null;
  actorRole: UserRole | 'system' | null;
  note: string | null;
  createdAt: string;
}

export interface TicketMessage {
  id: number;
  ticketId: number;
  senderId: number;
  senderRole: UserRole;
  message: string;
  readBy: number[];
  createdAt: string;
}

export interface Review {
  id: number;
  ticketId: number;
  userId: number;
  workerId: number;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface WorkerReviewSummary {
  ratingAverage: number;
  ratingCount: number;
  reviews: Review[];
}

export interface WorkerLocation {
  available: boolean;
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  updatedAt?: string;
}

export interface HireRequest {
  id: number;
  requestCode: string;
  userId: number;
  requesterName: string;
  requesterMobile: string;
  requesterEmail: string;
  requesterAddress: string;
  title?: string;
  purpose: string;
  workAddress: string;
  status: HireRequestStatus;
  assignedWorkerId: number | null;
  assignedByAdminId: number | null;
  assignedAt: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedWorker?: User | null;
}

export interface AppNotification {
  id: number;
  userId: number | null;
  title: string;
  message: string;
  read?: boolean;
  createdAt: string;
}

export interface AdminActivity {
  id: number;
  adminId: number;
  adminName: string;
  sessionLabel: string | null;
  action: string;
  targetType: string | null;
  targetId: number | null;
  summary: string;
  createdAt: string;
}
