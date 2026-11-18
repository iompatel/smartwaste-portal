import { Component, OnInit, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { BrandMarkComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';
import { AuthService } from '../core/auth.service';
import { Role } from '../smartwaste/data';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    BrandMarkComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div class="w-full max-w-md">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center">
          <app-brand-mark></app-brand-mark>
          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Sign in to SmartWaste
          </h1>
          <p class="mt-2 text-xs text-muted-foreground max-w-xs">
            Connect to municipal waste dispatch, track neighborhood collections, and keep our community clean.
          </p>
        </div>

        <app-surface class="mt-8 p-6 sm:p-8 block">
          <!-- Google Sign In Button -->
          <button
            type="button"
            (click)="onGoogleLogin()"
            [disabled]="googleLoading() || submitting()"
            class="flex h-11 w-full items-center justify-center gap-2.5 rounded-full border border-border bg-card px-4 text-xs font-medium text-foreground transition-all hover:bg-muted/60 hover:border-border/80 cursor-pointer shadow-xs disabled:opacity-50"
          >
            @if (googleLoading()) {
              <app-icon name="refresh-cw" class="size-4 animate-spin text-muted-foreground"></app-icon>
              <span>Connecting to Google...</span>
            } @else {
              <svg class="size-4 shrink-0" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
              </svg>
              <span>Continue with Google</span>
            }
          </button>

          <!-- Divider -->
          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center">
              <span class="w-full border-t border-border/60"></span>
            </div>
            <div class="relative flex justify-center text-[10px] uppercase">
              <span class="bg-card px-2.5 text-muted-foreground font-medium">Or continue with email</span>
            </div>
          </div>

          <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
            <div>
              <label for="login-email" class="block text-xs font-medium text-foreground mb-1.5">
                Email address
              </label>
              <div class="relative">
                <app-icon name="mail" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="login-email"
                  type="email"
                  required
                  [(ngModel)]="email"
                  name="email"
                  autocomplete="email"
                  [class]="inputCls + ' pl-10'"
                  placeholder="resident@example.com"
                />
              </div>
            </div>

            <div>
              <label for="login-password" class="block text-xs font-medium text-foreground mb-1.5">
                Password
              </label>
              <div class="relative">
                <app-icon name="lock" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="login-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  required
                  [(ngModel)]="password"
                  name="password"
                  autocomplete="current-password"
                  [class]="inputCls + ' pl-10 pr-10'"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  (click)="showPassword.set(!showPassword())"
                  class="absolute inset-y-0 right-3 my-auto flex items-center bg-transparent border-none p-0 cursor-pointer text-muted-foreground hover:text-foreground"
                  [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                >
                  <app-icon [name]="showPassword() ? 'eye-off' : 'eye'" class="size-4"></app-icon>
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium">
                {{ errorMessage() }}
              </div>
            }

            @if (showPasswordReset()) {
              <div class="rounded-xl border border-primary/25 bg-primary/5 p-3 text-xs leading-5">
                <p class="font-medium text-foreground">Forgot your password?</p>
                <p class="mt-1 text-muted-foreground">We can email a secure Firebase link to choose a new password.</p>
                <button
                  type="button"
                  (click)="sendResetLink()"
                  [disabled]="resetSending() || resetLinkSent()"
                  class="mt-2 min-h-11 font-semibold text-primary underline underline-offset-2 disabled:opacity-60"
                >
                  {{ resetLinkSent() ? 'Reset link sent' : resetSending() ? 'Sending...' : 'Email password reset link' }}
                </button>
                @if (resetNote()) { <p class="mt-1 text-muted-foreground" aria-live="polite">{{ resetNote() }}</p> }
              </div>
            }

            @if (needsVerification()) {
              <div class="rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning font-medium leading-5">
                Your email is not verified yet. Click the verification link in your inbox.
                <button
                  type="button"
                  (click)="resendLink()"
                  class="ml-1 underline font-semibold cursor-pointer bg-transparent border-none p-0 text-warning"
                >
                  Resend verification link
                </button>
                @if (resendNote()) {
                  <span class="block mt-1 text-muted-foreground">{{ resendNote() }}</span>
                }
              </div>
            }

            <button
              type="submit"
              appButton
              variant="brand"
              [disabled]="submitting() || googleLoading()"
              class="mt-1 h-11 w-full rounded-full cursor-pointer"
            >
              @if (submitting()) {
                <span class="inline-flex items-center gap-2">
                  <app-icon name="refresh-cw" class="size-4 animate-spin"></app-icon>
                  Signing in...
                </span>
              } @else {
                <span class="inline-flex items-center gap-1.5 justify-center">
                  Sign in
                  <app-icon name="arrow-right" class="size-4"></app-icon>
                </span>
              }
            </button>
          </form>

          <p class="mt-6 text-center text-xs text-muted-foreground">
            Don't have an account?
            <button
              type="button"
              (click)="signupClick.emit()"
              class="font-medium text-primary hover:underline ml-1 cursor-pointer bg-transparent border-none p-0 inline"
            >
              Create resident account
            </button>
          </p>
        </app-surface>
      </div>
    </div>
  `
})
export class LoginComponent implements OnInit {
  success = output<Role>();
  signupClick = output<void>();

  email = '';
  password = '';
  errorMessage = signal<string>('');
  submitting = signal<boolean>(false);
  googleLoading = signal<boolean>(false);
  showPassword = signal<boolean>(false);
  needsVerification = signal<boolean>(false);
  resendNote = signal<string>('');
  failedAttempts = signal<number>(0);
  resetSending = signal<boolean>(false);
  resetLinkSent = signal<boolean>(false);
  resetNote = signal<string>('');
  showPasswordReset = signal<boolean>(false);
  private attemptedEmail = '';

  inputCls = inputClassName;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.email = '';
    this.password = '';
  }

  async onGoogleLogin() {
    this.errorMessage.set('');
    this.googleLoading.set(true);
    try {
      await this.auth.googleLogin();
      this.success.emit('citizen');
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Google sign-in could not be completed.');
    } finally {
      this.googleLoading.set(false);
    }
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.email || !this.password) {
      this.errorMessage.set('Please provide both email and password.');
      return;
    }
    this.executeLogin();
  }

  private async executeLogin() {
    const normalizedEmail = this.email.trim().toLowerCase();
    if (normalizedEmail !== this.attemptedEmail) {
      this.attemptedEmail = normalizedEmail;
      this.failedAttempts.set(0);
      this.showPasswordReset.set(false);
      this.resetLinkSent.set(false);
      this.resetNote.set('');
    }
    this.submitting.set(true);
    this.errorMessage.set('');
    this.needsVerification.set(false);
    this.resendNote.set('');
    try {
      await this.auth.login('citizen', this.email, this.password);
      this.failedAttempts.set(0);
      this.success.emit('citizen');
    } catch (err: any) {
      this.needsVerification.set(err?.code === 'EMAIL_NOT_VERIFIED');
      const credentialFailure = err?.status === 401
        || err?.status === 429
        || ['auth/invalid-credential', 'auth/wrong-password', 'auth/too-many-requests'].includes(err?.code);
      if (credentialFailure) {
        const attempts = this.failedAttempts() + 1;
        this.failedAttempts.set(attempts);
        this.showPasswordReset.set(attempts >= 3 || err?.status === 429 || err?.code === 'auth/too-many-requests');
      }
      this.errorMessage.set(err.message || 'Invalid email or password.');
    } finally {
      this.submitting.set(false);
    }
  }

  async resendLink() {
    try {
      await this.auth.resendVerification();
      this.resendNote.set('Verification link sent. Check your inbox and spam folder.');
    } catch (err: any) {
      this.resendNote.set(err?.message || 'Could not resend right now. Please try again.');
    }
  }

  async sendResetLink() {
    this.resetSending.set(true);
    this.resetNote.set('');
    try {
      await this.auth.sendPasswordReset(this.email);
      this.resetLinkSent.set(true);
      this.resetNote.set('If this email has a password account, Firebase has sent the reset link. Check inbox and spam.');
    } catch (err: any) {
      this.resetNote.set(err?.message || 'Could not send the reset link.');
    } finally {
      this.resetSending.set(false);
    }
  }
}
