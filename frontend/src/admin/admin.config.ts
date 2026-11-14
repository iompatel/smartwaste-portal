import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';

import { API_CLIENT } from '../app/services/api-client';
import { SESSION_SERVICE } from '../app/services/session';
import { SHELL_NAVIGATION, ShellNavItem } from '../app/shell/shell-navigation';
import { AdminApiService } from './admin-api.service';
import { AdminAuthService } from './admin-auth.service';
import { adminRoutes } from './admin.routes';
import { adminSessionInterceptor } from './admin-session.interceptor';

const adminNavigation: ShellNavItem[] = [
  { label: 'Admin Panel', path: '/admin-panel', roles: ['admin'], exact: true, icon: 'dashboard', group: 'admin' },
  { label: 'Users', path: '/admin-panel/users', roles: ['admin'], icon: 'users', group: 'admin' },
  { label: 'Workers', path: '/admin-panel/workers', roles: ['admin'], icon: 'workers', group: 'admin' },
  { label: 'Tickets', path: '/tickets', roles: ['admin'], icon: 'tickets', group: 'workspace' },
  { label: 'Assign Worker', path: '/hire-worker', roles: ['admin'], icon: 'hire', group: 'workspace' },
  { label: 'Broadcast Desk', path: '/broadcast-desk', roles: ['admin'], icon: 'broadcast', group: 'admin' },
  { label: 'Admin Activity', path: '/admin-activity', roles: ['admin'], icon: 'activity', group: 'admin' },
  { label: 'Profile', path: '/profile', roles: ['admin'], icon: 'profile', group: 'settings' },
  { label: 'Settings', path: '/settings', roles: ['admin'], icon: 'settings', group: 'settings' },
];

export const adminConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([adminSessionInterceptor])),
    provideRouter(adminRoutes),
    AdminApiService,
    AdminAuthService,
    { provide: API_CLIENT, useExisting: AdminApiService },
    { provide: SESSION_SERVICE, useExisting: AdminAuthService },
    { provide: SHELL_NAVIGATION, useValue: adminNavigation },
  ],
};
