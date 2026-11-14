import {
  ApplicationConfig,
  provideBrowserGlobalErrorListeners,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { provideRouter } from '@angular/router';

import { environment } from '../environments/environment';
import { routes } from './app.routes';
import { API_CLIENT } from './services/api-client';
import { ApiService } from './services/api.service';
import { AuthService } from './services/auth.service';
import { sessionInterceptor } from './services/session.interceptor';
import { SESSION_SERVICE } from './services/session';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideHttpClient(withInterceptors([sessionInterceptor])),
    provideRouter(routes),
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideAuth(() => getAuth()),
    ApiService,
    AuthService,
    { provide: API_CLIENT, useExisting: ApiService },
    { provide: SESSION_SERVICE, useExisting: AuthService },
  ],
};
