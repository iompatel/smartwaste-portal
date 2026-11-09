import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';

import { APP_TITLE } from '../../core/constants';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './login.component.html',
  styleUrl: './auth.component.scss',
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly title = APP_TITLE;
  loading = false;
  showPassword = false;
  error = '';
  showSyncPassword = false;
  syncing = false;

  get returnUrl(): string {
    const url = this.route.snapshot.queryParams?.['returnUrl'];
    return typeof url === 'string' && url.startsWith('/') ? url : '/dashboard';
  }

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    this.showSyncPassword = false;

    this.authService.login(this.form.getRawValue().email, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.loading = false;
        const code = String(err?.code ?? '');
        if (
          code.includes('auth/invalid-credential') ||
          code.includes('auth/user-not-found') ||
          code.includes('auth/wrong-password')
        ) {
          this.error = 'Invalid email or password.';
          this.showSyncPassword = true;
          return;
        }
        this.error = err?.error?.message ?? 'Unable to login right now.';
      },
    });
  }

  syncPassword() {
    const email = this.form.getRawValue().email;
    const newPassword = this.form.getRawValue().password;
    if (!email || !newPassword) {
      return;
    }

    this.syncing = true;
    this.error = '';

    this.authService.updatePassword(email, newPassword).subscribe({
      next: () => {
        this.syncing = false;
        this.showSyncPassword = false;
        this.submit();
      },
      error: () => {
        this.syncing = false;
        this.error = 'Unable to sync password. Please try again.';
      },
    });
  }

  loginWithGoogle() {
    this.loading = true;
    this.error = '';

    this.authService.googleDemoLogin().subscribe({
      next: () => {
        this.loading = false;
        if (this.authService.needsContactDetails()) {
          this.router.navigate(['/profile'], {
            queryParams: { completeProfile: '1' },
          });
          return;
        }

        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Google login unavailable.';
      },
    });
  }
}
