import { Injectable } from '@angular/core';
import { BehaviorSubject, catchError, map, of, tap } from 'rxjs';

import { User } from '../app/models/types';
import { SessionService } from '../app/services/session';
import { AdminApiService } from './admin-api.service';
import { ADMIN_CSRF_KEY, ADMIN_USER_KEY } from './admin.constants';

interface AdminLoginResponse {
  user: User;
  csrfToken: string;
  expiresAt: string;
}

@Injectable()
export class AdminAuthService implements SessionService {
  private readonly userSubject = new BehaviorSubject<User | null>(this.loadUser());
  readonly currentUser$ = this.userSubject.asObservable();

  constructor(private readonly api: AdminApiService) {}

  get currentUser() {
    return this.userSubject.value;
  }

  get isAuthenticated() {
    return Boolean(sessionStorage.getItem(ADMIN_CSRF_KEY) && this.currentUser?.role === 'admin');
  }

  adminLogin(email: string, password: string) {
    return this.api
      .post<AdminLoginResponse>('/auth/admin-login', { email, password }, false)
      .pipe(
        tap(({ user, csrfToken }) => {
          sessionStorage.setItem(ADMIN_CSRF_KEY, csrfToken);
          this.setUser(user);
        }),
      );
  }

  validateSession() {
    if (!this.isAuthenticated) {
      return of(false);
    }

    return this.api.get<User>('/me').pipe(
      map((user) => {
        if (user.role !== 'admin') {
          this.clearSession();
          return false;
        }
        this.setUser(user);
        return true;
      }),
      catchError(() => {
        this.clearSession();
        return of(false);
      }),
    );
  }

  refreshUser() {
    return this.api.get<User>('/me').pipe(tap((user) => this.setUser(user)));
  }

  updateProfile(payload: Partial<User>) {
    return this.api.put<User>('/me', payload).pipe(tap((user) => this.setUser(user)));
  }

  needsContactDetails(_user: User | null = this.currentUser) {
    return false;
  }

  loginPathForRole(_role?: User['role']) {
    return '/admin-console';
  }

  logout() {
    this.api.post<{ message: string }>('/auth/logout', {}).subscribe({
      error: () => {},
    });
    this.clearSession();
  }

  private setUser(user: User) {
    sessionStorage.setItem(ADMIN_USER_KEY, JSON.stringify(user));
    this.userSubject.next(user);
  }

  private clearSession() {
    sessionStorage.removeItem(ADMIN_CSRF_KEY);
    sessionStorage.removeItem(ADMIN_USER_KEY);
    this.userSubject.next(null);
  }

  private loadUser(): User | null {
    const raw = sessionStorage.getItem(ADMIN_USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      const user = JSON.parse(raw) as User;
      return user.role === 'admin' ? user : null;
    } catch {
      sessionStorage.removeItem(ADMIN_USER_KEY);
      return null;
    }
  }
}
