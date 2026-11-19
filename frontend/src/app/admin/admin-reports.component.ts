import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import { SectionHeaderComponent, SurfaceComponent } from '../shared/ui-components';

@Component({
  selector: 'app-admin-reports',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent, ButtonDirective, SectionHeaderComponent, SurfaceComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5">
      <app-section-header
        eyebrow="City command"
        title="Corporation reports"
        description="Download account registers and service activity as a corporation PDF."
      ></app-section-header>

      <div class="grid gap-4 sm:grid-cols-2" role="group" aria-label="Account report type">
        @for (option of reportTypes; track option.role) {
          <button
            type="button"
            class="flex min-h-40 cursor-pointer items-start gap-4 rounded-2xl border p-5 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-wait disabled:opacity-60 sm:p-6"
            [ngClass]="selectedRole() === option.role ? 'border-brand bg-brand/5' : 'border-border bg-card hover:bg-muted/40'"
            [attr.aria-pressed]="selectedRole() === option.role"
            [disabled]="downloading()"
            (click)="selectReport(option.role)"
          >
            <span class="flex size-11 shrink-0 items-center justify-center rounded-[14px] bg-brand/10 text-brand-ink" aria-hidden="true">
              <app-icon [name]="option.icon" class="size-5"></app-icon>
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex items-center justify-between gap-2">
                <span class="text-sm font-semibold text-foreground">{{ option.title }}</span>
                @if (selectedRole() === option.role) {
                  <app-icon name="check-circle-2" class="size-4 shrink-0 text-brand-ink" aria-hidden="true"></app-icon>
                }
              </span>
              <span class="mt-2 block text-xs leading-relaxed text-muted-foreground">{{ option.description }}</span>
              <span class="mt-3 block text-[11px] font-medium text-brand-ink">{{ option.details }}</span>
            </span>
          </button>
        }
      </div>

      <app-surface class="p-5 sm:p-6">
        <form (ngSubmit)="downloadReport()" class="flex flex-col gap-5" [attr.aria-busy]="downloading()">
          <div>
            <h2 class="text-sm font-semibold text-foreground">Registration date range</h2>
            <p id="report-date-help" class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
              Optional filters apply to the date each account was registered. Ticket totals include all activity for the selected accounts.
            </p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <label for="report-from" class="text-xs font-medium text-foreground">Registered from</label>
              <input
                id="report-from" name="from" type="date" [(ngModel)]="fromDate" [attr.max]="toDate || null"
                aria-describedby="report-date-help" [disabled]="downloading()"
                class="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />
            </div>
            <div class="flex flex-col gap-2">
              <label for="report-to" class="text-xs font-medium text-foreground">Registered through</label>
              <input
                id="report-to" name="to" type="date" [(ngModel)]="toDate" [attr.min]="fromDate || null"
                aria-describedby="report-date-help" [disabled]="downloading()"
                class="h-11 w-full min-w-0 rounded-xl border border-input bg-background px-3 text-sm text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              />
            </div>
          </div>

          @if (error()) {
            <p role="alert" class="rounded-xl bg-danger/10 p-3 text-xs leading-relaxed text-danger-ink">{{ error() }}</p>
          }
          @if (success()) {
            <p role="status" class="rounded-xl bg-brand/10 p-3 text-xs text-brand-ink">{{ success() }}</p>
          }

          <div class="flex flex-col gap-3 border-t border-border/60 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <div class="flex items-center gap-2 text-xs text-muted-foreground">
              <app-icon name="shield-check" class="size-4 shrink-0 text-brand-ink" aria-hidden="true"></app-icon>
              <span>Includes account details, ticket totals, report date, and corporation seal.</span>
            </div>
            <div class="flex shrink-0 items-center gap-2">
              @if (fromDate || toDate) {
                <button type="button" appButton variant="ghost" class="h-11 rounded-xl px-4" [disabled]="downloading()" (click)="clearDates()">Clear dates</button>
              }
              <button type="submit" appButton variant="brand" class="h-11 rounded-xl px-4" [disabled]="downloading()">
                <app-icon name="download" class="size-4" aria-hidden="true"></app-icon>
                {{ downloading() ? 'Preparing PDF...' : 'Download ' + (selectedRole() === 'users' ? 'users' : 'workers') + ' report' }}
              </button>
            </div>
          </div>
        </form>
      </app-surface>
    </div>
  `,
})
export class AdminReportsComponent {
  readonly reportTypes = [
    { role: 'users' as const, title: 'Users report', icon: 'users-round', description: 'A register of resident accounts and their collection activity.', details: 'Contact details, registrations, and ticket totals' },
    { role: 'workers' as const, title: 'Workers report', icon: 'truck', description: 'A register of field operatives and their assigned service activity.', details: 'Contact details, availability, and ticket totals' },
  ];
  selectedRole = signal<'users' | 'workers'>('users');
  downloading = signal(false);
  error = signal('');
  success = signal('');
  fromDate = '';
  toDate = '';

  constructor(private adminService: AdminService) {}

  selectReport(role: 'users' | 'workers') {
    this.selectedRole.set(role);
    this.error.set('');
    this.success.set('');
  }

  clearDates() {
    this.fromDate = '';
    this.toDate = '';
    this.error.set('');
    this.success.set('');
  }

  async downloadReport() {
    if (this.downloading()) return;
    this.error.set('');
    this.success.set('');
    if (this.fromDate && this.toDate && this.fromDate > this.toDate) {
      this.error.set('The start date must be on or before the end date.');
      return;
    }
    this.downloading.set(true);
    try {
      await this.adminService.downloadAccountReport(this.selectedRole(), {
        ...(this.fromDate ? { from: this.fromDate } : {}),
        ...(this.toDate ? { to: this.toDate } : {}),
      });
      this.success.set('Your corporation PDF report has been downloaded.');
    } catch (error: any) {
      this.error.set(error?.message || 'Could not generate the report. Please try again.');
    } finally {
      this.downloading.set(false);
    }
  }
}
