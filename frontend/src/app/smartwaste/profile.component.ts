import { Component, computed, input, OnInit, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  AvatarComponent,
  FieldLabelComponent,
  SectionHeaderComponent,
  SurfaceComponent,
  inputClassName,
} from '../shared/ui-components';
import { roleMeta, Role } from './data';
import { AuthService } from '../core/auth.service';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-profile-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    AvatarComponent,
    FieldLabelComponent,
    SectionHeaderComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <app-section-header
        [eyebrow]="role() === 'worker' ? 'Field operations' : 'Citizen portal'"
        [title]="role() === 'worker' ? 'Field credentials' : 'Profile & settings'"
        description="Keep your details current so we can serve you better."
      ></app-section-header>

      <div class="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <!-- Profile Identity Card -->
        <app-surface class="h-fit p-6 text-center">
            <app-avatar
              [initials]="displayInitials()"
              class="mx-auto size-24 rounded-[28px] text-2xl"
              [online]="isWorkerOnline()"
          ></app-avatar>
          <h2 class="mt-5 text-lg font-semibold tracking-[-0.04em] text-foreground">{{ displayName() }}</h2>
          <p class="mt-1 text-xs text-muted-foreground">{{ meta().subtitle }}</p>
          <span class="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1.5 text-[11px] font-medium text-brand">
            <app-icon name="user-round" class="size-3.5"></app-icon>
            {{ role() === 'worker' ? 'Field operative account' : 'Citizen account' }}
          </span>

          <div class="mt-6 flex flex-col gap-3 border-t border-border/60 pt-5 text-left">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <app-icon name="mail" class="size-3.5"></app-icon>
              {{ userEmail() }}
            </div>
            @if (userLocation()) {
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <app-icon name="map-pin" class="size-3.5"></app-icon>
                {{ userLocation() }}
              </div>
            }
            @if (memberSince()) {
              <div class="flex items-center gap-2 text-xs text-muted-foreground">
                <app-icon name="check-circle-2" class="size-3.5 text-brand"></app-icon>
                Member since {{ memberSince() }}
              </div>
            }
          </div>
        </app-surface>

        <!-- Personal Info Form -->
        <app-surface class="p-5 sm:p-7">
          <app-section-header
            title="Personal information"
            description="This information is only shared with your assigned crew when needed."
          ></app-section-header>

          <form (ngSubmit)="submit()" class="mt-6 flex flex-col gap-5">
            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <app-field-label htmlFor="profile-first-name">First name</app-field-label>
                <input
                  id="profile-first-name"
                  [(ngModel)]="firstName"
                  name="firstName"
                  autocomplete="given-name"
                  [class]="inputCls"
                />
              </div>
              <div>
                <app-field-label htmlFor="profile-last-name">Last name</app-field-label>
                <input
                  id="profile-last-name"
                  [(ngModel)]="lastName"
                  name="lastName"
                  autocomplete="family-name"
                  [class]="inputCls"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <app-field-label htmlFor="profile-email">Email address</app-field-label>
                <input
                  id="profile-email"
                  type="email"
                  [ngModel]="userEmail()"
                  name="email"
                  readonly
                  disabled
                  [class]="inputCls + ' opacity-75 cursor-not-allowed'"
                />
              </div>
              <div>
                <app-field-label htmlFor="profile-phone">Mobile number</app-field-label>
                <input
                  id="profile-phone"
                  type="tel"
                  [(ngModel)]="mobile"
                  name="mobile"
                  autocomplete="tel"
                  [class]="inputCls"
                />
              </div>
            </div>

            <div>
              <app-field-label htmlFor="profile-address">Default collection address</app-field-label>
              <div class="relative">
                <app-icon name="map-pin" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  id="profile-address"
                  [(ngModel)]="address"
                  name="address"
                  autocomplete="street-address"
                  [class]="inputCls + ' pl-10'"
                />
              </div>
              <p class="mt-2 text-[11px] text-muted-foreground">Used as your default collection address.</p>
            </div>

            @if (errorMessage()) {
              <p role="alert" class="text-xs leading-5 text-danger">{{ errorMessage() }}</p>
            }

            <div class="flex items-center justify-between border-t border-border/60 pt-5">
              <span class="text-[11px] text-muted-foreground">Changes are saved to your account.</span>
              <button
                type="submit"
                appButton
                variant="brand"
                class="rounded-full"
              >
                @if (saved()) {
                  <app-icon name="check" class="size-4"></app-icon>
                  Saved
                } @else {
                  Save changes
                }
              </button>
            </div>
          </form>
        </app-surface>
      </div>

    </div>
  `
})
export class ProfileViewComponent implements OnInit {
  role = input.required<Role>();
  inputCls = inputClassName;

  saved = signal<boolean>(false);
  errorMessage = signal<string>('');

  meta = computed(() => roleMeta[this.role()]);
  isWorkerOnline = computed(() => this.role() === 'worker' && Boolean(this.auth.currentUser()?.workerOnline));

  userEmail = computed(() => this.auth.currentUser()?.email || '');

  userLocation = computed(() => this.auth.currentUser()?.address || '');

  memberSince = computed(() => {
    const createdAt = this.auth.currentUser()?.createdAt;
    return createdAt
      ? new Date(createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : '';
  });

  displayName = computed(() => {
    const user = this.auth.currentUser();
    if (user) {
      return `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email;
    }
    return this.meta().name;
  });

  displayInitials = computed(() => {
    const user = this.auth.currentUser();
    if (user) {
      const f = user.firstName ? user.firstName[0] : '';
      const l = user.lastName ? user.lastName[0] : '';
      return (f + l).toUpperCase() || 'U';
    }
    return this.meta().initials;
  });

  firstName = '';
  lastName = '';
  mobile = '';
  address = '';

  constructor(
    private auth: AuthService,
    private api: ApiService
  ) {}

  ngOnInit() {
    const user = this.auth.currentUser();
    if (user) {
      this.firstName = user.firstName || '';
      this.lastName = user.lastName || '';
      this.mobile = user.mobile || '';
      this.address = user.address || '';
    } else {
      const parts = this.meta().name.split(' ');
      this.firstName = parts[0] || '';
      this.lastName = parts[1] || '';
      this.mobile = '';
      this.address = '';
    }
  }

  async submit() {
    this.errorMessage.set('');
    try {
      const res = await this.api.request<any>('/api/me', {
        method: 'PUT',
        body: JSON.stringify({
          firstName: this.firstName.trim(),
          lastName: this.lastName.trim(),
          mobile: this.mobile.trim(),
          address: this.address.trim(),
        }),
      });

      const user = res?.user || res?.worker || res?.admin || (res?.id ? res : null);
      if (user) {
        this.auth.currentUser.set(user);
        this.api.setStoredUser(user);
      }
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 2500);
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Failed to update profile.');
    }
  }
}

@Component({
  selector: 'app-settings-view',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    SectionHeaderComponent,
    SurfaceComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <app-section-header
        eyebrow="Preferences"
        title="Settings"
        description="Make SmartWaste feel right for you."
      ></app-section-header>

      <!-- Appearance -->
      <app-surface class="p-5 sm:p-7">
        <app-section-header
          title="Appearance"
          description="Choose how the portal looks on this device."
        ></app-section-header>

        <div class="mt-5 grid gap-3 sm:grid-cols-3">
          @for (option of appearanceOptions; track option.id) {
            <button
              type="button"
              [attr.aria-pressed]="theme() === option.id"
              (click)="themeChange.emit(option.id)"
              class="flex items-center gap-3 rounded-[14px] border p-3.5 text-left text-xs font-medium transition-colors cursor-pointer"
              [ngClass]="theme() === option.id ? 'border-primary/50 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground'"
            >
              <app-icon [name]="option.icon" class="size-4"></app-icon>
              <span>{{ option.label }}</span>
              @if (theme() === option.id) {
                <app-icon name="check" class="ml-auto size-4"></app-icon>
              }
            </button>
          }
        </div>
      </app-surface>

      @if (role() === 'citizen') {
        <app-surface class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div class="flex items-start gap-3">
            <span class="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
              <app-icon name="lock" class="size-4"></app-icon>
            </span>
            <div>
              <p class="text-sm font-medium text-foreground">Change password</p>
              <p class="mt-1 text-xs leading-5 text-muted-foreground">Firebase will email a secure password-change link to {{ accountEmail() }}.</p>
              @if (passwordNote()) { <p class="mt-2 text-xs text-brand" aria-live="polite">{{ passwordNote() }}</p> }
            </div>
          </div>
          <button type="button" appButton variant="outline" class="min-h-11 rounded-full" [disabled]="passwordSending()" (click)="sendPasswordLink()">
            <app-icon name="mail" class="size-4"></app-icon>
            {{ passwordSending() ? 'Sending...' : 'Send change link' }}
          </button>
        </app-surface>
      }

      <app-surface class="flex items-center gap-3 p-5 text-xs text-muted-foreground sm:p-6">
        <app-icon name="shield-check" class="size-5 shrink-0 text-brand"></app-icon>
        <p>Your appearance preference is saved on this device.</p>
      </app-surface>
    </div>
  `
})
export class SettingsViewComponent {
  theme = input.required<'system' | 'light' | 'dark'>();
  role = input.required<Role>();
  themeChange = output<'system' | 'light' | 'dark'>();
  passwordSending = signal(false);
  passwordNote = signal('');
  accountEmail = computed(() => this.auth.currentUser()?.email ?? 'your account email');

  appearanceOptions = [
    { id: 'light' as const, label: 'Light', icon: 'sun' },
    { id: 'dark' as const, label: 'Dark', icon: 'moon' },
    { id: 'system' as const, label: 'System', icon: 'globe-2' },
  ];

  constructor(private auth: AuthService) {}

  async sendPasswordLink() {
    const email = this.auth.currentUser()?.email;
    if (!email || this.passwordSending()) return;
    this.passwordSending.set(true);
    this.passwordNote.set('');
    try {
      await this.auth.sendPasswordReset(email);
      this.passwordNote.set('Reset link sent. Check your inbox and spam folder.');
    } catch (err: any) {
      this.passwordNote.set(err?.message || 'Could not send the password link.');
    } finally {
      this.passwordSending.set(false);
    }
  }
}
