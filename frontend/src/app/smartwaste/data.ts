export type Role = 'citizen' | 'worker' | 'admin';
export type View =
  | 'overview'
  | 'tickets'
  | 'hire'
  | 'profile'
  | 'settings'
  | 'faq'
  | 'terms'
  | 'accounts'
  | 'users'
  | 'workers'
  | 'reports'
  | 'live-map'
  | 'broadcast'
  | 'activity'
  | 'leaves'
  | 'on-leave';

export type TicketStatus = 'In progress' | 'Pending' | 'Completed' | 'Cancelled' | 'Scheduled';
export type Priority = 'High' | 'Medium' | 'Low';

export interface Ticket {
  id: string;
  numericId?: number;
  title: string;
  category: string;
  address: string;
  status: TicketStatus;
  priority: Priority;
  time: string;
  code?: string;
  worker?: string;
  eta?: string;
  description?: string;
  mediaData?: string | null;
  workerId?: number;
  workerMobile?: string;
  scheduledFor?: string | null;
  scheduledSlot?: string | null;
  cancellationReason?: string | null;
  raw?: any;
}

export interface Booking {
  id: string;
  numericId?: number;
  title: string;
  worker: string;
  date: string;
  status: 'Confirmed' | 'Pending' | 'Completed' | 'Cancelled';
  purpose?: string;
  address?: string;
  scheduledFor?: string | null;
  scheduledSlot?: string | null;
  raw?: any;
}

export function isClosedStatus(status: TicketStatus | Booking['status']): boolean {
  return status === 'Completed' || status === 'Cancelled';
}

export interface NavItem {
  id: View;
  label: string;
  icon: string;
  badge?: string;
}

export const roleMeta: Record<Role, { label: string; name: string; subtitle: string; initials: string }> = {
  citizen: { label: 'Citizen portal', name: 'Citizen', subtitle: 'Personal account', initials: 'C' },
  worker: { label: 'Field operations', name: 'Field operative', subtitle: 'Verified operative', initials: 'FO' },
  admin: { label: 'City command', name: 'Administrator', subtitle: 'Administrator', initials: 'AD' },
};

export const navByRole: Record<Role, NavItem[]> = {
  citizen: [
    { id: 'overview', label: 'Overview', icon: 'layout-grid' },
    { id: 'tickets', label: 'My reports', icon: 'clipboard-check' },
    { id: 'hire', label: 'Hire a worker', icon: 'briefcase-business' },
    { id: 'profile', label: 'Profile & settings', icon: 'user-round' },
    { id: 'faq', label: 'FAQ', icon: 'info' },
    { id: 'terms', label: 'Terms & conditions', icon: 'file-text' },
  ],
  worker: [
    { id: 'overview', label: 'Field cockpit', icon: 'layout-grid' },
    { id: 'tickets', label: 'Route queue', icon: 'route' },
    { id: 'hire', label: 'Hired tasks', icon: 'briefcase-business' },
    { id: 'leaves', label: 'My leaves', icon: 'calendar-check-2' },
    { id: 'profile', label: 'Field credentials', icon: 'shield-check' },
  ],
  admin: [
    { id: 'overview', label: 'Command center', icon: 'bar-chart-3' },
    { id: 'users', label: 'Users', icon: 'user-round' },
    { id: 'workers', label: 'Workers', icon: 'users-round' },
    { id: 'leaves', label: 'Leave requests', icon: 'calendar-check-2' },
    { id: 'on-leave', label: 'Workers on leave', icon: 'user-x' },
    { id: 'live-map', label: 'Live worker map', icon: 'map-pin' },
    { id: 'reports', label: 'PDF reports', icon: 'clipboard-check' },
    { id: 'broadcast', label: 'Broadcast', icon: 'bell-ring' },
    { id: 'activity', label: 'Account activity', icon: 'activity' },
  ],
};

export const secondaryNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: 'settings-2' },
];
