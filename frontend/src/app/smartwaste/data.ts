export type Role = 'citizen' | 'worker' | 'admin';
export type View =
  | 'overview'
  | 'tickets'
  | 'hire'
  | 'profile'
  | 'settings'
  | 'accounts'
  | 'broadcast'
  | 'activity';

export type TicketStatus = 'In progress' | 'Pending' | 'Completed' | 'Scheduled';
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
  raw?: any;
}

export interface Booking {
  id: string;
  numericId?: number;
  title: string;
  worker: string;
  date: string;
  status: 'Confirmed' | 'Pending' | 'Completed';
  price: string;
  purpose?: string;
  address?: string;
  raw?: any;
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
  ],
  worker: [
    { id: 'overview', label: 'Field cockpit', icon: 'layout-grid' },
    { id: 'tickets', label: 'Route queue', icon: 'route' },
    { id: 'hire', label: 'Hired tasks', icon: 'briefcase-business' },
    { id: 'profile', label: 'Field credentials', icon: 'shield-check' },
  ],
  admin: [
    { id: 'overview', label: 'Command center', icon: 'bar-chart-3' },
    { id: 'accounts', label: 'Accounts', icon: 'users-round' },
    { id: 'broadcast', label: 'Broadcast', icon: 'bell-ring' },
    { id: 'activity', label: 'Audit activity', icon: 'activity' },
  ],
};

export const secondaryNav: NavItem[] = [
  { id: 'settings', label: 'Settings', icon: 'settings-2' },
];

