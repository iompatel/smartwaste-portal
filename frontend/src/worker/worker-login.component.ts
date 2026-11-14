import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { APP_TITLE } from '../app/core/constants';
import { loginErrorMessage } from '../app/core/auth-errors';
import { AuthService } from '../app/services/auth.service';

@Component({
  selector: 'worker-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './worker-login.component.html',
  styleUrl: '../app/pages/auth/auth.component.scss',
})
export class WorkerLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  readonly title = APP_TITLE;
  loading = false;
  showPassword = false;
  error = '';

  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  get returnUrl() {
    const url = this.route.snapshot.queryParams?.['returnUrl'];
    return typeof url === 'string' &&
      !url.startsWith('//') &&
      /^\/(dashboard|tickets|hire-worker|profile|settings)(?:\/|\?|$)/.test(url)
      ? url
      : '/dashboard';
  }

  submit() {
    if (this.loading) return;
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const value = this.form.getRawValue();
    const email = value.email.trim().toLowerCase();
    const password = value.password;

    this.authService.workerLogin(email, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.loading = false;
        this.error = loginErrorMessage(error, 'worker');
      },
    });
  }
}
