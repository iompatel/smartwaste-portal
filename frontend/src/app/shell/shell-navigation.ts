import { InjectionToken } from '@angular/core';

import { UserRole } from '../models/types';

export interface ShellNavItem {
  label: string;
  path: string;
  roles: UserRole[];
  exact?: boolean;
  icon?: string;
  group?: 'workspace' | 'admin' | 'settings';
}

export const PUBLIC_SHELL_NAVIGATION: ShellNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['user'], icon: 'dashboard', group: 'workspace' },
  { label: 'Tickets', path: '/tickets', roles: ['user'], icon: 'tickets', group: 'workspace' },
  { label: 'Hire Worker', path: '/hire-worker', roles: ['user'], icon: 'hire', group: 'workspace' },
  { label: 'Profile', path: '/profile', roles: ['user'], icon: 'profile', group: 'settings' },
  { label: 'Settings', path: '/settings', roles: ['user'], icon: 'settings', group: 'settings' },
];

export const SHELL_NAVIGATION = new InjectionToken<ShellNavItem[]>('SHELL_NAVIGATION', {
  providedIn: 'root',
  factory: () => PUBLIC_SHELL_NAVIGATION,
});
