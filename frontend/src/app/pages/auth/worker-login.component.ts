import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { APP_TITLE } from '../../core/constants';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-worker-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './worker-login.component.html',
  styleUrl: './auth.component.scss',
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
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();

    this.authService.workerLogin(email, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message ?? 'Unable to access the Worker Console.';
      },
    });
  }
}
