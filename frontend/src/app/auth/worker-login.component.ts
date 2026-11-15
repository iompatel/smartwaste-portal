import { Component, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { BrandMarkComponent, SurfaceComponent, inputClassName } from '../shared/ui-components';
import { AuthService } from '../core/auth.service';
import { Role } from '../smartwaste/data';

@Component({
  selector: 'app-worker-login',
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
          <div class="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-3 py-1 text-xs font-semibold text-brand mb-4">
            <app-icon name="shield-check" class="size-4"></app-icon>
            Field Operative · City Fleet
          </div>
          <app-brand-mark></app-brand-mark>
          <h1 class="mt-4 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Worker Field Operations
          </h1>
          <p class="mt-2 text-xs text-muted-foreground max-w-xs">
            Restricted field operative access for route navigation, collections, and verified customer handovers.
          </p>
        </div>

        <app-surface class="mt-8 p-6 sm:p-8 block border-brand/20">
          <form (submit)="onSubmit($event)" class="flex flex-col gap-4">
            <div>
              <label for="worker-email" class="block text-xs font-medium text-foreground mb-1.5">
                Operative email
              </label>
              <div class="relative">
                <app-icon name="mail" class="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground"></app-icon>
                <input
                  id="worker-email"
                  type="email"
                  required
                  [(ngModel)]="email"
                  name="email"
                  autocomplete="email"
                  [class]="inputCls + ' pl-10'"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label for="worker-password" class="block text-xs font-medium text-foreground mb-1.5">
                Password
              </label>
              <div class="relative">
                <app-icon name="lock" class="pointer-events-none absolute top-3.5 left-3.5 size-4 text-muted-foreground"></app-icon>
                <input
                  id="worker-password"
                  type="password"
                  required
                  [(ngModel)]="password"
                  name="password"
                  autocomplete="current-password"
                  [class]="inputCls + ' pl-10'"
                  placeholder="••••••••"
                />
              </div>
            </div>

            @if (errorMessage()) {
              <div class="rounded-xl border border-danger/30 bg-danger/10 p-3 text-xs text-danger font-medium">
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
                  Connecting to dispatch...
                </span>
              } @else {
                <span class="inline-flex items-center gap-1.5 justify-center">
                  Sign in to Field Cockpit
                  <app-icon name="arrow-right" class="size-4"></app-icon>
                </span>
              }
            </button>
          </form>

          <div class="mt-6 pt-4 border-t border-border/60 text-center">
            <span class="text-[11px] text-muted-foreground">
              Staff credentials are assigned by the central municipal dispatch desk.
            </span>
          </div>
        </app-surface>
      </div>
    </div>
  `
})
export class WorkerLoginComponent implements OnInit {
  success = output<Role>();

  email = '';
  password = '';
  errorMessage = signal<string>('');
  submitting = signal<boolean>(false);

  inputCls = inputClassName;

  constructor(private auth: AuthService) {}

  ngOnInit() {
    this.email = '';
    this.password = '';
  }

  async onSubmit(event: Event) {
    event.preventDefault();
    if (!this.email || !this.password) {
      this.errorMessage.set('Please provide both worker email and password.');
      return;
    }
    this.executeLogin();
  }

  private async executeLogin() {
    this.submitting.set(true);
    this.errorMessage.set('');
    try {
      await this.auth.login('worker', this.email, this.password);
      this.success.emit('worker');
    } catch (err: any) {
      this.errorMessage.set(err.message || 'Invalid operative credentials.');
    } finally {
      this.submitting.set(false);
    }
  }
}
