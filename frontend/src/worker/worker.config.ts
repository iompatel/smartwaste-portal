import { provideHttpClient } from '@angular/common/http';
import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { API_CLIENT } from '../app/services/api-client';
import { ApiService } from '../app/services/api.service';
import { AuthService } from '../app/services/auth.service';
import { SESSION_SERVICE } from '../app/services/session';
import { SHELL_NAVIGATION, ShellNavItem } from '../app/shell/shell-navigation';
import { workerRoutes } from './worker.routes';

const workerNavigation: ShellNavItem[] = [
  { label: 'Dashboard', path: '/dashboard', roles: ['worker'] },
  { label: 'Tickets', path: '/tickets', roles: ['worker'] },
  { label: 'Hired Task', path: '/hire-worker', roles: ['worker'] },
  { label: 'Profile', path: '/profile', roles: ['worker'] },
  { label: 'Settings', path: '/settings', roles: ['worker'] },
];

export const workerConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(),
    provideRouter(workerRoutes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    ApiService,
    AuthService,
    { provide: API_CLIENT, useExisting: ApiService },
    { provide: SESSION_SERVICE, useExisting: AuthService },
    { provide: SHELL_NAVIGATION, useValue: workerNavigation },
  ],
};
