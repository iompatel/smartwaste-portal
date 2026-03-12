import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

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

  readonly title = APP_TITLE;
  loading = false;
  showPassword = false;
  error = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';

    this.authService.login(this.form.getRawValue().email, this.form.getRawValue().password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigate(['/dashboard']);
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
