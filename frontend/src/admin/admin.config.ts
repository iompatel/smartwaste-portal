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
  { label: 'Admin Panel', path: '/admin-panel', roles: ['admin'], exact: true },
  { label: 'Users', path: '/admin-panel/users', roles: ['admin'] },
  { label: 'Workers', path: '/admin-panel/workers', roles: ['admin'] },
  { label: 'Tickets', path: '/tickets', roles: ['admin'] },
  { label: 'Assign Worker', path: '/hire-worker', roles: ['admin'] },
  { label: 'Broadcast Desk', path: '/broadcast-desk', roles: ['admin'] },
  { label: 'Admin Activity', path: '/admin-activity', roles: ['admin'] },
  { label: 'Profile', path: '/profile', roles: ['admin'] },
  { label: 'Settings', path: '/settings', roles: ['admin'] },
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
