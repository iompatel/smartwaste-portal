import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from './api.service';
import { BackendUser } from './api.types';
import { Role } from '../smartwaste/data';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  currentUser = signal<BackendUser | null>(null);
  currentRole = signal<Role>('citizen');
  isLoading = signal<boolean>(false);
  authInitialized = signal<boolean>(false);
  readonly initialized: Promise<void>;

  isLoggedIn = computed(() => !!this.currentUser());

  constructor(private api: ApiService) {
    this.initialized = this.initAuth();
  }

  async initAuth(): Promise<void> {
    const storedUser = this.api.getStoredUser();
    const storedRole = this.api.getStoredRole();
    const token = this.api.getToken();
    const csrf = this.api.getCsrf();

    if (storedRole) {
      this.currentRole.set(storedRole);
    }

    if (storedUser && (token || csrf)) {
      this.currentUser.set(storedUser);
      // Validate session in background with /api/me
      try {
        const user = await this.api.request<BackendUser>('/api/me');
        if (user) {
          this.currentUser.set(user);
          this.api.setStoredUser(user);
          if (user.role === 'admin') this.currentRole.set('admin');
          else if (user.role === 'worker') this.currentRole.set('worker');
          else this.currentRole.set('citizen');
        }
      } catch {
        // If session expired, clear auth
        this.api.clearAuth();
        this.currentUser.set(null);
      }
    }

    this.authInitialized.set(true);
  }

  async login(role: Role, email: string, password: string): Promise<BackendUser> {
    this.isLoading.set(true);
    try {
      let endpoint = '/api/auth/login';
      if (role === 'admin') {
        endpoint = '/api/auth/admin-login';
      } else if (role === 'worker') {
        endpoint = '/api/auth/worker-login';
      }

      const res = await this.api.request<{
        token?: string;
        csrfToken?: string;
        user?: BackendUser;
        admin?: BackendUser;
      }>(endpoint, {
        method: 'POST',
        body: JSON.stringify({ email: email.trim(), password }),
      });

      const user = res.user || res.admin;
      if (!user) {
        throw new Error('Authentication succeeded but user profile was missing.');
      }

      if (res.token) {
        this.api.setToken(res.token);
        this.api.setCsrf(null);
      }
      if (res.csrfToken) {
        this.api.setCsrf(res.csrfToken);
        this.api.setToken(null);
      }

      this.api.setStoredUser(user);
      this.api.setStoredRole(role);
      this.currentUser.set(user);
      this.currentRole.set(role);

      return user;
    } finally {
      this.isLoading.set(false);
    }
  }

  async signup(data: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    password: string;
    address: string;
    gender?: string;
  }): Promise<BackendUser> {
    this.isLoading.set(true);
    try {
      const res = await this.api.request<{
        token: string;
        user: BackendUser;
      }>('/api/auth/signup', {
        method: 'POST',
        body: JSON.stringify(data),
      });

      if (!res.user || !res.token) {
        throw new Error('Signup failed.');
      }

      this.api.setToken(res.token);
      this.api.setCsrf(null);
      this.api.setStoredUser(res.user);
      this.api.setStoredRole('citizen');
      this.currentUser.set(res.user);
      this.currentRole.set('citizen');

      return res.user;
    } finally {
      this.isLoading.set(false);
    }
  }

  async googleLogin(): Promise<BackendUser> {
    this.isLoading.set(true);
    try {
      const { signInWithPopup } = await import('firebase/auth');
      const { firebaseAuth, googleAuthProvider } = await import('./firebase');
      const credential = await signInWithPopup(firebaseAuth, googleAuthProvider);
      const idToken = await credential.user.getIdToken();

      const fullName = credential.user.displayName || '';
      const nameParts = fullName.trim().split(/\s+/);
      const firstName = nameParts[0] || 'Resident';
      const lastName = nameParts.slice(1).join(' ') || 'User';

      const res = await this.api.request<{
        token: string;
        user: BackendUser;
      }>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          firstName,
          lastName,
          email: credential.user.email,
          profileImage: credential.user.photoURL,
        }),
      });

      if (!res.user || !res.token) {
        throw new Error('Google sign-in succeeded but backend did not return user.');
      }

      this.api.setToken(res.token);
      this.api.setCsrf(null);
      this.api.setStoredUser(res.user);
      this.api.setStoredRole('citizen');
      this.currentUser.set(res.user);
      this.currentRole.set('citizen');

      return res.user;
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    try {
      await this.api.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      this.api.clearAuth();
      this.currentUser.set(null);
    }
  }
}
