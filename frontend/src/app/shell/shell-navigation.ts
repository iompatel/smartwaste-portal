import { InjectionToken } from '@angular/core';

import { UserRole } from '../models/types';

export interface ShellNavItem {
  label: string;
  path: string;
  roles: UserRole[];
  exact?: boolean;
}

export const PUBLIC_SHELL_NAVIGATION: ShellNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['user'] },
  { label: 'Tickets', path: '/tickets', roles: ['user'] },
  { label: 'Hire Worker', path: '/hire-worker', roles: ['user'] },
  { label: 'Profile', path: '/profile', roles: ['user'] },
  { label: 'Settings', path: '/settings', roles: ['user'] },
];

export const SHELL_NAVIGATION = new InjectionToken<ShellNavItem[]>('SHELL_NAVIGATION', {
  providedIn: 'root',
  factory: () => PUBLIC_SHELL_NAVIGATION,
});
