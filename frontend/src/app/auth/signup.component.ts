import { Component, DestroyRef, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { BrandMarkComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';
import { AuthService } from '../core/auth.service';
import { Role } from '../smartwaste/data';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    BrandMarkComponent,
    SurfaceComponent,
  ],
  template: `
    <div class="min-h-screen flex flex-col justify-center items-center bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div class="w-full max-w-md">
        <!-- Brand Header -->
        <div class="flex flex-col items-center text-center">
          <app-brand-mark></app-brand-mark>
          <h1 class="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Create Citizen Account
          </h1>
          <p class="mt-2 text-xs text-muted-foreground max-w-xs">
            Join your neighbors in keeping the city clean and tracking verified waste collections.
          </p>
        </div>

        <app-surface class="mt-8 p-6 sm:p-8 block">
          @if (step() === 'verify') {
            <div class="flex flex-col items-center text-center">
              <div class="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10">
                <app-icon name="mail" class="size-6 text-primary"></app-icon>
              </div>
              <h2 class="mt-4 text-lg font-semibold text-foreground">Verify your email</h2>
              <p class="mt-2 text-xs text-muted-foreground leading-5 max-w-xs">
                We sent a verification link to
                <span class="font-medium text-foreground break-all">{{ verifiedEmail }}</span>.
                Click the link in the email to activate your account. This page updates automatically.
              </p>

              <div class="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <app-icon name="refresh-cw" class="size-3.5 animate-spin"></app-icon>
                Waiting for verification...
              </div>

              @if (verifyError()) {
                <div class="mt-3 w-full rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium leading-5">
                  {{ verifyError() }}
                </div>
              }

              <button
                type="button"
                appButton
                variant="outline"
                (click)="resendLink()"
                [disabled]="resending() || resendIn() > 0"
                class="mt-4 h-10 w-full rounded-full cursor-pointer"
              >
                @if (resending()) {
                  Sending link...
                } @else if (resendIn() > 0) {
                  Resend available in {{ resendIn() }}s
                } @else {
                  Resend verification link
                }
              </button>

              <p class="mt-5 text-xs text-muted-foreground">
                <button
                  type="button"
                  (click)="loginClick.emit()"
                  class="font-medium text-primary hover:underline cursor-pointer bg-transparent border-none p-0 inline"
                >
                  Back to sign in
                </button>
              </p>
            </div>
          } @else {
          <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="su-first-name" class="block text-xs font-medium text-foreground mb-1.5">
                  First name
                </label>
                <div class="relative">
                  <app-icon name="user" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                  <input
                    id="su-first-name"
                    required
                    [(ngModel)]="firstName"
                    name="firstName"
                    autocomplete="given-name"
                    [class]="inputCls + ' pl-10'"
                    placeholder="Alex"
                  />
                </div>
              </div>

              <div>
                <label for="su-last-name" class="block text-xs font-medium text-foreground mb-1.5">
                  Last name
                </label>
                <input
                  id="su-last-name"
                  required
                  [(ngModel)]="lastName"
                  name="lastName"
                  autocomplete="family-name"
                  [class]="inputCls"
                  placeholder="Morgan"
                />
              </div>
            </div>

            <div>
              <label for="su-email" class="block text-xs font-medium text-foreground mb-1.5">
                Email address
              </label>
              <div class="relative">
                <app-icon name="mail" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="su-email"
                  type="email"
                  required
                  [(ngModel)]="email"
                  name="email"
                  autocomplete="email"
                  [class]="inputCls + ' pl-10'"
                  placeholder="alex.morgan@example.com"
                />
              </div>
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label for="su-mobile" class="block text-xs font-medium text-foreground mb-1.5">
                  Mobile number
                </label>
                <div class="relative">
                  <app-icon name="phone" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                  <input
                    id="su-mobile"
                    type="tel"
                    required
                    [(ngModel)]="mobile"
                    name="mobile"
                    autocomplete="tel"
                    [class]="inputCls + ' pl-10'"
                    placeholder="7777777777"
                  />
                </div>
              </div>

              <div>
                <label for="su-gender" class="block text-xs font-medium text-foreground mb-1.5">
                  Gender
                </label>
                <select
                  id="su-gender"
                  [(ngModel)]="gender"
                  name="gender"
                  [class]="inputCls"
                >
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label for="su-password" class="block text-xs font-medium text-foreground mb-1.5">
                Password
              </label>
              <div class="relative">
                <app-icon name="lock" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="su-password"
                  [type]="showPassword() ? 'text' : 'password'"
                  required
                  [(ngModel)]="password"
                  name="password"
                  autocomplete="new-password"
                  [class]="inputCls + ' pl-10 pr-10'"
                  placeholder="Min 8 chars, 1 uppercase & 1 symbol"
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
              <p class="mt-1 text-[10px] text-muted-foreground">
                Requires at least 8 characters, 1 uppercase letter, and 1 special symbol.
              </p>
            </div>

            <div>
              <label for="su-address" class="block text-xs font-medium text-foreground mb-1.5">
                Street address
              </label>
              <div class="relative">
                <app-icon name="map-pin" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="su-address"
                  required
                  [(ngModel)]="address"
                  name="address"
                  autocomplete="street-address"
                  [class]="inputCls + ' pl-10'"
                  placeholder="123 Main Street"
                />
              </div>
            </div>

            @if (errorMessage()) {
              <div class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium leading-5">
                {{ errorMessage() }}
              </div>
            }

            <button
              type="submit"
              appButton
              variant="brand"
              [disabled]="submitting()"
              class="mt-2 h-11 w-full rounded-full cursor-pointer"
            >
              @if (submitting()) {
                <span class="inline-flex items-center gap-2">
                  <app-icon name="refresh-cw" class="size-4 animate-spin"></app-icon>
                  Creating account...
                </span>
              } @else {
                <span class="inline-flex items-center gap-1.5 justify-center">
                  Create Account
                  <app-icon name="arrow-right" class="size-4"></app-icon>
                </span>
              }
            </button>
          </form>

            <p class="mt-6 text-center text-xs text-muted-foreground">
              Already have an account?
              <button
                type="button"
                (click)="loginClick.emit()"
                class="font-medium text-primary hover:underline ml-1 cursor-pointer bg-transparent border-none p-0 inline"
              >
                Sign in
              </button>
            </p>
          }
        </app-surface>
      </div>
    </div>
  `,
})
export class SignupComponent {
  success = output<Role>();
  loginClick = output<void>();

  step = signal<'form' | 'verify'>('form');
  verifiedEmail = '';
  resendIn = signal(0);
  resending = signal(false);
  verifyError = signal<string>('');
  showPassword = signal(false);

  firstName = '';
  lastName = '';
  email = '';
  mobile = '';
  password = '';
  address = '';
  gender = 'Female';
  errorMessage = signal<string>('');
  submitting = signal<boolean>(false);
  inputCls = inputClassName;

  private watchTimer: ReturnType<typeof setInterval> | null = null;
  private destroyRef = inject(DestroyRef);

  constructor(private auth: AuthService) {}

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.firstName || !this.lastName || !this.email || !this.mobile || !this.password || !this.address) {
      this.errorMessage.set('Please fill all mandatory fields.');
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set('');

    try {
      await this.auth.signup({
        firstName: this.firstName.trim(),
        lastName: this.lastName.trim(),
        email: this.email.trim(),
        mobile: this.mobile.trim(),
        password: this.password,
        address: this.address.trim(),
        gender: this.gender,
      });
      this.verifiedEmail = this.email.trim();
      this.step.set('verify');
      this.startVerificationWatch();
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to create account. Ensure password meets security policy.');
    } finally {
      this.submitting.set(false);
    }
  }

  // Poll Firebase every 3s; once the user clicks the verification link, the
  // account is created and the citizen is signed in automatically.
  private startVerificationWatch(): void {
    this.stopVerificationWatch();
    const startedAt = Date.now();
    let tick = 0;
    this.resendIn.set(60);
    this.watchTimer = setInterval(async () => {
      if (this.resendIn() > 0) {
        this.resendIn.set(this.resendIn() - 1);
      }
      if (tick % 3 !== 0) {
        tick += 1;
        return;
      }
      tick += 1;
      try {
        if (await this.auth.emailVerified()) {
          this.stopVerificationWatch();
          try {
            await this.auth.completeSignup();
            this.success.emit('citizen');
          } catch (err: any) {
            this.verifyError.set(err?.message || 'Could not finish creating your account.');
          }
          return;
        }
      } catch {
        // Transient Firebase error; keep polling.
      }
      if (Date.now() - startedAt > 10 * 60 * 1000) {
        this.stopVerificationWatch();
        this.verifyError.set(
          'This is taking a while. Click the link in the email — you can sign in as soon as your email is verified.',
        );
      }
    }, 1000);
    this.destroyRef.onDestroy(() => this.stopVerificationWatch());
  }

  private stopVerificationWatch(): void {
    if (this.watchTimer) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  async resendLink(): Promise<void> {
    if (this.resending() || this.resendIn() > 0) return;
    this.resending.set(true);
    this.verifyError.set('');
    try {
      await this.auth.resendVerification();
      this.resendIn.set(60);
    } catch (err: any) {
      this.verifyError.set(err?.message || 'Could not resend right now. Please try again.');
    } finally {
      this.resending.set(false);
    }
  }
}
