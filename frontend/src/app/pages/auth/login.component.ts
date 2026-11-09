import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

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
  readonly isAdminConsole = this.route.snapshot.data['adminOnly'] === true;
  loading = false;
  showPassword = false;
  error = '';

  get returnUrl(): string {
    const url = this.route.snapshot.queryParams?.['returnUrl'];
    const fallback = this.isAdminConsole ? '/admin-panel' : '/dashboard';
    if (typeof url !== 'string' || !url.startsWith('/') || url.startsWith('//')) {
      return fallback;
    }

    if (
      this.isAdminConsole &&
      !/^\/(admin-panel(?:\/|$)|admin-activity(?:\/|$)|broadcast-desk(?:\/|$))/.test(url)
    ) {
      return fallback;
    }

    return url;
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
    const { email, password } = this.form.getRawValue();
    const loginRequest = this.isAdminConsole
      ? this.authService.adminLogin(email, password)
      : this.authService.login(email, password);

    loginRequest.subscribe({
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
          return;
        }
        this.error = err?.error?.message ?? 'Unable to login right now.';
      },
    });
  }

  loginWithGoogle() {
    this.loading = true;
    this.error = '';

    this.authService.googleLogin().subscribe({
      next: () => {
        this.loading = false;
        if (this.authService.needsContactDetails()) {
          this.router.navigate(['/profile'], {
            queryParams: { completeProfile: '1' },
          });
          return;
        }

        this.router.navigateByUrl(this.returnUrl);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Google login unavailable.';
      },
    });
  }
}
