import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { AuthService } from '../../services/auth.service';

function placeholderAddressValidator(control: AbstractControl): ValidationErrors | null {
  const value = String(control.value ?? '').trim().toLowerCase();
  if (!value || ['firebase auth user', 'google auth user'].includes(value)) {
    return { placeholderAddress: true };
  }

  return null;
}

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly route = inject(ActivatedRoute);

  loading = false;
  message = '';
  error = '';
  showCompletionPrompt = false;

  readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    gender: ['Other', [Validators.required]],
    mobile: ['', [Validators.required, Validators.pattern(/^(?!0+$)[0-9]{10,15}$/)]],
    email: [{ value: '', disabled: true }, [Validators.required, Validators.email]],
    role: [{ value: '', disabled: true }, [Validators.required]],
    address: ['', [Validators.required, Validators.minLength(5), placeholderAddressValidator]],
    profileImage: [''],
  });

  get user() {
    return this.authService.currentUser;
  }

  ngOnInit() {
    const user = this.user;
    if (!user) {
      return;
    }

    this.showCompletionPrompt =
      this.route.snapshot.queryParamMap.get('completeProfile') === '1' ||
      this.authService.needsContactDetails(user);

    this.form.patchValue({
      firstName: user.firstName,
      lastName: user.lastName,
      gender: user.gender,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      address: user.address,
      profileImage: user.profileImage ?? '',
    });
  }

  onImageSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      this.form.patchValue({
        profileImage: String(reader.result ?? ''),
      });
    };
    reader.readAsDataURL(file);
  }

  save() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading = true;
    this.message = '';
    this.error = '';

    const value = this.form.getRawValue();

    this.authService
      .updateProfile({
        firstName: value.firstName,
        lastName: value.lastName,
        gender: value.gender,
        mobile: value.mobile,
        address: value.address,
        profileImage: value.profileImage || null,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.showCompletionPrompt = this.authService.needsContactDetails(this.authService.currentUser);
          this.message = 'Profile updated successfully.';
        },
        error: (err) => {
          this.loading = false;
          this.error = err?.error?.message ?? 'Unable to update profile.';
        },
      });
  }

  get shouldHighlightContactDetails() {
    return this.showCompletionPrompt && this.authService.needsContactDetails(this.user);
  }

  get profileImageSrc() {
    return String(this.form.controls.profileImage.value ?? '').trim();
  }

  get profileInitials() {
    const first = this.form.controls.firstName.value?.[0] ?? this.user?.firstName?.[0] ?? '';
    const last = this.form.controls.lastName.value?.[0] ?? this.user?.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || 'SW';
  }
}
