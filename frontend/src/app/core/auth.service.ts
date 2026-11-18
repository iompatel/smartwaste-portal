import { Injectable, computed, signal } from '@angular/core';
import { ApiService } from './api.service';
import { BackendUser } from './api.types';
import { Role } from '../smartwaste/data';

function extractUser(payload: any): BackendUser | null {
  if (!payload || typeof payload !== 'object') return null;
  const candidate =
    payload.user ||
    payload.worker ||
    payload.admin ||
    payload.profile ||
    payload.account ||
    payload.data?.user ||
    payload.data?.worker ||
    payload.data?.profile ||
    payload.data;

  if (candidate && typeof candidate === 'object' && candidate.id && (candidate.email || candidate.role)) {
    return candidate as BackendUser;
  }
  if (payload.id && (payload.email || payload.role)) {
    return payload as BackendUser;
  }
  return null;
}

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

    if (token || csrf) {
      if (storedUser) {
        this.currentUser.set(storedUser);
      }
      // Validate or restore session with /api/me
      try {
        const rawMe = await this.api.request<any>('/api/me');
        const user = extractUser(rawMe);
        if (user) {
          this.currentUser.set(user);
          this.api.setStoredUser(user);
          if (user.role === 'admin') this.currentRole.set('admin');
          else if (user.role === 'worker') this.currentRole.set('worker');
          else this.currentRole.set('citizen');
        }
      } catch (err: any) {
        // Only clear auth if explicitly unauthorized/forbidden by the server.
        // On network drops or Render cold-start timeouts, preserve the cached session.
        if (err?.status === 401 || err?.status === 403) {
          this.api.clearAuth();
          this.currentUser.set(null);
        }
      }
    }

    this.authInitialized.set(true);
  }

  async login(role: Role, email: string, password: string): Promise<BackendUser> {
    this.isLoading.set(true);
    try {
      if (role === 'citizen') {
        try {
          // Existing citizens authenticate against the backend password store.
          return await this.passwordLogin('/api/auth/login', email, password, role);
        } catch (err: any) {
          // Firebase-era citizens have no backend password: fall back to Firebase.
          if (err?.status !== 401) throw err;
        }
        return await this.firebaseEmailLogin(email, password);
      }

      const endpoint =
        role === 'admin' ? '/api/auth/admin-login' : '/api/auth/worker-login';
      return await this.passwordLogin(endpoint, email, password, role);
    } finally {
      this.isLoading.set(false);
    }
  }

  private async passwordLogin(
    endpoint: string,
    email: string,
    password: string,
    role: Role,
  ): Promise<BackendUser> {
    const res = await this.api.request<any>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email: email.trim(), password }),
    });

    if (res?.token) {
      this.api.setToken(res.token);
      this.api.setCsrf(null);
    }
    if (res?.csrfToken) {
      this.api.setCsrf(res.csrfToken);
      this.api.setToken(null);
    }

    let user: BackendUser | null = extractUser(res);

    // If authentication token was returned but the user profile was missing in the login envelope,
    // fetch the user profile via /api/me before throwing an error.
    if (!user && (res?.token || res?.csrfToken || this.api.getToken() || this.api.getCsrf())) {
      try {
        const rawMe = await this.api.request<any>('/api/me');
        user = extractUser(rawMe);
      } catch {
        // Fall through to validation check below
      }
    }

    if (!user) {
      throw new Error('Authentication succeeded but user profile was missing.');
    }

    const resolvedRole: Role =
      user.role === 'admin'
        ? 'admin'
        : user.role === 'worker'
          ? 'worker'
          : user.role === 'user'
            ? 'citizen'
            : role;

    this.api.setStoredUser(user);
    this.api.setStoredRole(resolvedRole);
    this.currentUser.set(user);
    this.currentRole.set(resolvedRole);

    return user;
  }

  // Sign in a Firebase-era citizen with Firebase Email/Password, then exchange
  // the ID token for a SmartWaste session. A 403 with code EMAIL_NOT_VERIFIED
  // propagates so the login screen can offer a resend button.
  private async firebaseEmailLogin(email: string, password: string): Promise<BackendUser> {
    const { signInWithEmailAndPassword } = await import('firebase/auth');
    const { firebaseAuth } = await import('./firebase');
    let credential;
    try {
      credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
    } catch {
      throw new Error('Invalid email or password.');
    }

    const idToken = await credential.user.getIdToken();
    const res = await this.api.request<any>(
      '/api/auth/firebase-login',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      },
    );

    if (res?.token) {
      this.api.setToken(res.token);
      this.api.setCsrf(null);
    }

    let user: BackendUser | null = extractUser(res);

    if (!user && (res?.token || this.api.getToken())) {
      try {
        const rawMe = await this.api.request<any>('/api/me');
        user = extractUser(rawMe);
      } catch {}
    }

    if (!user || (!res?.token && !this.api.getToken())) {
      throw new Error('Authentication succeeded but user profile was missing.');
    }

    const resolvedRole: Role =
      user.role === 'admin'
        ? 'admin'
        : user.role === 'worker'
          ? 'worker'
          : 'citizen';

    this.api.setStoredUser(user);
    this.api.setStoredRole(resolvedRole);
    this.currentUser.set(user);
    this.currentRole.set(resolvedRole);

    return user;
  }

  // Creates the Firebase identity, sends the verification link, and stores a
  // pending registration. The SmartWaste account itself is created by
  // completeSignup() only after the user clicks the verification link.
  async signup(data: {
    firstName: string;
    lastName: string;
    email: string;
    mobile: string;
    password: string;
    address: string;
    gender?: string;
  }): Promise<{ pending: true }> {
    this.isLoading.set(true);
    try {
      const {
        createUserWithEmailAndPassword,
        sendEmailVerification,
        signInWithEmailAndPassword,
        deleteUser,
      } = await import('firebase/auth');
      const { firebaseAuth } = await import('./firebase');

      let fbUser = null;
      let createdHere = false;
      try {
        fbUser = (await createUserWithEmailAndPassword(firebaseAuth, data.email.trim(), data.password)).user;
        createdHere = true;
      } catch (err: any) {
        if (err?.code === 'auth/invalid-email') throw new Error('Invalid email format.');
        if (err?.code === 'auth/weak-password') {
          throw new Error(
            'Password must be at least 8 characters and include an uppercase letter and a special symbol.',
          );
        }
        if (err?.code !== 'auth/email-already-in-use') {
          throw new Error('Unable to create account. Please try again.');
        }
        // Firebase identity already exists (e.g. double submit): continue only
        // when the entered password matches it.
        try {
          fbUser = (await signInWithEmailAndPassword(firebaseAuth, data.email.trim(), data.password)).user;
        } catch {
          throw new Error('Email already registered.');
        }
      }

      try {
        if (!fbUser.emailVerified) {
          await sendEmailVerification(fbUser, {
            url: `${window.location.origin}/login`,
            handleCodeInApp: false,
          });
        }
      } catch (err: any) {
        if (err?.code !== 'auth/too-many-requests') {
          if (createdHere) await deleteUser(fbUser).catch(() => undefined);
          throw new Error('Could not send the verification email. Please try again.');
        }
      }

      const idToken = await fbUser.getIdToken();
      try {
        await this.api.request('/api/auth/signup', {
          method: 'POST',
          body: JSON.stringify({
            idToken,
            firstName: data.firstName,
            lastName: data.lastName,
            gender: data.gender,
            mobile: data.mobile,
            address: data.address,
            email: data.email,
          }),
        });
      } catch (err: any) {
        // Keep Firebase and SmartWaste in sync: a pending registration could
        // not be stored, so discard the identity created above.
        if (createdHere) await deleteUser(fbUser).catch(() => undefined);
        throw err;
      }

      return { pending: true };
    } finally {
      this.isLoading.set(false);
    }
  }

  // Called after the citizen clicks the verification link in the email.
  async completeSignup(): Promise<BackendUser> {
    const { firebaseAuth } = await import('./firebase');
    const { reload } = await import('firebase/auth');
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error('Verification session not found. Please sign up again.');

    await reload(fbUser);
    const idToken = await fbUser.getIdToken(true);
    const res = await this.api.request<any>(
      '/api/auth/complete-signup',
      {
        method: 'POST',
        body: JSON.stringify({ idToken }),
      },
    );

    if (res?.token) {
      this.api.setToken(res.token);
      this.api.setCsrf(null);
    }

    let user: BackendUser | null = extractUser(res);

    if (!user && (res?.token || this.api.getToken())) {
      try {
        const rawMe = await this.api.request<any>('/api/me');
        user = extractUser(rawMe);
      } catch {}
    }

    if (!user || (!res?.token && !this.api.getToken())) {
      throw new Error('Verification succeeded but account creation failed.');
    }

    this.api.setStoredUser(user);
    this.api.setStoredRole('citizen');
    this.currentUser.set(user);
    this.currentRole.set('citizen');

    return user;
  }

  async emailVerified(): Promise<boolean> {
    const { firebaseAuth } = await import('./firebase');
    const { reload } = await import('firebase/auth');
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) return false;
    await reload(fbUser);
    return fbUser.emailVerified;
  }

  async resendVerification(): Promise<void> {
    const { firebaseAuth } = await import('./firebase');
    const { sendEmailVerification } = await import('firebase/auth');
    const fbUser = firebaseAuth.currentUser;
    if (!fbUser) throw new Error('No pending verification. Please sign up again.');
    await sendEmailVerification(fbUser, {
      url: `${window.location.origin}/login`,
      handleCodeInApp: false,
    });
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

      const res = await this.api.request<any>('/api/auth/firebase-login', {
        method: 'POST',
        body: JSON.stringify({
          idToken,
          firstName,
          lastName,
          email: credential.user.email,
          profileImage: credential.user.photoURL,
        }),
      });

      if (res?.token) {
        this.api.setToken(res.token);
        this.api.setCsrf(null);
      }

      let user: BackendUser | null = extractUser(res);

      if (!user && (res?.token || this.api.getToken())) {
        try {
          const rawMe = await this.api.request<any>('/api/me');
          user = extractUser(rawMe);
        } catch {}
      }

      if (!user || (!res?.token && !this.api.getToken())) {
        throw new Error('Google sign-in succeeded but backend did not return user.');
      }

      const resolvedRole: Role =
        user.role === 'admin'
          ? 'admin'
          : user.role === 'worker'
            ? 'worker'
            : 'citizen';

      this.api.setStoredUser(user);
      this.api.setStoredRole(resolvedRole);
      this.currentUser.set(user);
      this.currentRole.set(resolvedRole);

      return user;
    } finally {
      this.isLoading.set(false);
    }
  }

  async logout(): Promise<void> {
    const role = this.currentRole();
    try {
      await this.api.request('/api/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    } finally {
      if (role === 'citizen') {
        const [{ signOut }, { firebaseAuth }] = await Promise.all([
          import('firebase/auth'),
          import('./firebase'),
        ]);
        await signOut(firebaseAuth).catch(() => undefined);
      }
      this.api.clearAuth();
      this.currentUser.set(null);
    }
  }
}
