import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { APP_TITLE } from '../../core/constants';
import { AdminAuthService } from '../../../admin/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './admin-login.component.html',
  styleUrl: './auth.component.scss',
})
export class AdminLoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AdminAuthService);
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
      /^\/(admin-panel(?:\/|\?|$)|admin-activity(?:\/|\?|$)|broadcast-desk(?:\/|\?|$)|tickets(?:\/|\?|$)|hire-worker(?:\/|\?|$)|profile(?:\/|\?|$)|settings(?:\/|\?|$))/.test(
        url,
      )
      ? url
      : '/admin-panel';
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.error = '';
    const { email, password } = this.form.getRawValue();

    this.authService.adminLogin(email, password).subscribe({
      next: () => {
        this.loading = false;
        this.router.navigateByUrl(this.returnUrl);
      },
      error: (error) => {
        this.loading = false;
        this.error = error?.error?.message ?? 'Unable to access the Admin Console.';
      },
    });
  }
}
