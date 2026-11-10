import { InjectionToken } from '@angular/core';
import { Observable } from 'rxjs';

import { User } from '../models/types';

export interface SessionService {
  readonly currentUser$: Observable<User | null>;
  readonly currentUser: User | null;
  readonly isAuthenticated: boolean;
  needsContactDetails(user?: User | null): boolean;
  loginPathForRole(role?: User['role']): string;
  refreshUser(): Observable<User>;
  updateProfile(payload: Partial<User>): Observable<User>;
  logout(): void;
}

export const SESSION_SERVICE = new InjectionToken<SessionService>('SESSION_SERVICE');
