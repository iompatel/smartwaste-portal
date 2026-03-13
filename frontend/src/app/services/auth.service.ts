import { inject, Injectable } from '@angular/core';
import {
  Auth,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from '@angular/fire/auth';
import { BehaviorSubject, catchError, from, map, of, switchMap, tap, throwError } from 'rxjs';

import { SESSION_TOKEN_KEY, SESSION_USER_KEY } from '../core/constants';
import { AuthResponse, User } from '../models/types';
import { ApiService } from './api.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly firebaseAuth = inject(Auth);
  private readonly userSubject = new BehaviorSubject<User | null>(this.loadUserFromStorage());
  readonly currentUser$ = this.userSubject.asObservable();

  constructor(private readonly api: ApiService) {}

  get currentUser(): User | null {
    return this.userSubject.value;
  }

  get isAuthenticated(): boolean {
    return Boolean(localStorage.getItem(SESSION_TOKEN_KEY) && this.userSubject.value);
  }

  login(email: string, password: string) {
    return from(signInWithEmailAndPassword(this.firebaseAuth, email, password)).pipe(
      switchMap((credential) => from(credential.user.getIdToken())),
      switchMap((idToken) =>
        this.api.post<AuthResponse>(
          '/auth/firebase-login',
          {
            idToken,
          },
          false,
        ),
      ),
      tap((response) => this.persistSession(response)),
      catchError(() =>
        this.api
          .post<AuthResponse>(
            '/auth/login',
            {
              email,
              password,
            },
            false,
          )
          .pipe(tap((response) => this.persistSession(response))),
      ),
    );
  }

  googleDemoLogin(_email?: string) {
    const provider = new GoogleAuthProvider();
    return from(signInWithPopup(this.firebaseAuth, provider)).pipe(
      switchMap((credential) =>
        from(credential.user.getIdToken()).pipe(
          switchMap((idToken) =>
            this.api.post<AuthResponse>(
              '/auth/firebase-login',
              {
                idToken,
              },
              false,
            ),
          ),
          tap((response) => this.persistSession(response)),
          catchError((error) => {
            const email = credential.user.email ?? '';
            if (!email) {
              return throwError(() => error);
            }
            return this.api
              .post<AuthResponse>(
                '/auth/google-demo',
                {
                  email,
                  displayName: credential.user.displayName ?? email,
                },
                false,
              )
              .pipe(tap((response) => this.persistSession(response)));
          }),
        ),
      ),
    );
  }

  needsContactDetails(user: User | null = this.currentUser) {
    if (!user || user.role !== 'user') {
      return false;
    }

    const mobile = String(user.mobile ?? '').trim();
    const address = String(user.address ?? '').trim();

    const hasPlaceholderMobile = !mobile || /^0+$/.test(mobile);
    const hasPlaceholderAddress =
      !address ||
      ['firebase auth user', 'google auth user'].includes(address.toLowerCase());

    return hasPlaceholderMobile || hasPlaceholderAddress;
  }

  signup(payload: Record<string, unknown>) {
    const email = String(payload['email'] ?? '').trim().toLowerCase();
    const password = String(payload['password'] ?? '');

    const firstName = String(payload['firstName'] ?? 'Firebase');
    const lastName = String(payload['lastName'] ?? 'User');
    const gender = String(payload['gender'] ?? 'Other');
    const mobile = String(payload['mobile'] ?? '0000000000');
    const address = String(payload['address'] ?? 'Firebase Auth User');
    // Public signup can create only the "user" role.
    const role = 'user';

    const localSignup$ = this.api
      .post<AuthResponse>(
        '/auth/signup',
        {
          firstName,
          lastName,
          gender,
          mobile,
          email,
          password,
          role,
          address,
        },
        false,
      )
      .pipe(tap((response) => this.persistSession(response)));

    return from(createUserWithEmailAndPassword(this.firebaseAuth, email, password)).pipe(
      switchMap((credential) => {
        const displayName = `${firstName} ${lastName}`.trim();
        if (!displayName) {
          return of(credential);
        }
        return from(updateProfile(credential.user, { displayName })).pipe(
          map(() => credential),
        );
      }),
      switchMap((credential) => from(credential.user.getIdToken())),
      switchMap((idToken) =>
        this.api.post<AuthResponse>(
          '/auth/firebase-login',
          {
            idToken,
            firstName,
            lastName,
            gender,
            mobile,
            address,
            role,
          },
          false,
        ),
      ),
      tap((response) => this.persistSession(response)),
      catchError((firebaseError) =>
        (() => {
          const code = String(firebaseError?.code ?? '');
          const status = Number(firebaseError?.status ?? 0);

          const firebaseFallbackCodes = new Set([
            'auth/operation-not-allowed',
            'auth/unauthorized-domain',
            'auth/network-request-failed',
            'auth/invalid-api-key',
            'auth/app-not-authorized',
            'auth/invalid-credential',
            'auth/internal-error',
          ]);

          const shouldFallback =
            (code.startsWith('auth/') && firebaseFallbackCodes.has(code)) ||
            (!code.startsWith('auth/') && status >= 500);

          if (!shouldFallback) {
            return throwError(() => firebaseError);
          }

          // Fallback to backend-local signup so demo projects work even if Firebase signup is disabled.
          return localSignup$.pipe(
            catchError((apiError) => throwError(() => apiError ?? firebaseError)),
          );
        })(),
      ),
    );
  }

  forgotPassword(email: string) {
    return this.api.post<{ message: string }>('/auth/forgot-password', { email }, false).pipe(
      switchMap(() => from(sendPasswordResetEmail(this.firebaseAuth, email))),
      map(() => ({
        message:
          'Password reset link sent. Use only the latest email link and check spam folder.',
      })),
    );
  }

  refreshUser() {
    return this.api.get<User>('/me').pipe(
      tap((user) => {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        this.userSubject.next(user);
      }),
    );
  }

  updateProfile(payload: Partial<User>) {
    return this.api.put<User>('/me', payload).pipe(
      tap((user) => {
        localStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
        this.userSubject.next(user);
      }),
    );
  }

  hasRole(roles: Array<User['role']>) {
    return this.currentUser$.pipe(map((user) => (user ? roles.includes(user.role) : false)));
  }

  logout() {
    this.api.post<{ message: string }>('/auth/logout', {}).subscribe({
      error: () => {
        // Logout should still complete locally even if activity logging fails.
      },
    });
    void signOut(this.firebaseAuth);
    localStorage.removeItem(SESSION_TOKEN_KEY);
    localStorage.removeItem(SESSION_USER_KEY);
    this.userSubject.next(null);
  }

  private persistSession(response: AuthResponse) {
    localStorage.setItem(SESSION_TOKEN_KEY, response.token);
    localStorage.setItem(SESSION_USER_KEY, JSON.stringify(response.user));
    this.userSubject.next(response.user);
  }

  private loadUserFromStorage(): User | null {
    const raw = localStorage.getItem(SESSION_USER_KEY);
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as User;
    } catch {
      localStorage.removeItem(SESSION_USER_KEY);
      return null;
    }
  }
}
