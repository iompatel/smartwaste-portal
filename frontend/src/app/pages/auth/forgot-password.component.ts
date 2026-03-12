import { CommonModule } from '@angular/common';
import { Component, OnDestroy, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './auth.component.scss',
})
export class ForgotPasswordComponent implements OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);

  loading = false;
  message = '';
  error = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
  });

  cooldownSeconds = 0;
  private cooldownTimer: ReturnType<typeof setInterval> | null = null;

  ngOnDestroy(): void {
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
      this.cooldownTimer = null;
    }
  }

  submit() {
    if (this.cooldownSeconds > 0) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    this.error = '';

    this.authService.forgotPassword(this.form.getRawValue().email).subscribe({
      next: (response) => {
        this.loading = false;
        this.message = response.message;
        this.startCooldown(45);
      },
      error: (err) => {
        this.loading = false;
        const code = String(err?.code ?? '');
        if (code.includes('auth/too-many-requests')) {
          this.error = 'Too many requests. Please wait a minute and try again.';
        } else if (code.includes('auth/invalid-email')) {
          this.error = 'Invalid email format.';
        } else {
          this.error =
            err?.error?.message ??
            'Could not process request. Use the latest reset email link only.';
        }
      },
    });
  }

  private startCooldown(seconds: number) {
    this.cooldownSeconds = seconds;
    if (this.cooldownTimer) {
      clearInterval(this.cooldownTimer);
    }

    this.cooldownTimer = setInterval(() => {
      this.cooldownSeconds -= 1;
      if (this.cooldownSeconds <= 0 && this.cooldownTimer) {
        clearInterval(this.cooldownTimer);
        this.cooldownTimer = null;
      }
    }, 1000);
  }
}
