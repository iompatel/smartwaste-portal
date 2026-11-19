import { Component, OnInit, signal, input, computed, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService } from '../core/admin.service';
import { LeaveApplication } from '../core/api.types';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  FieldLabelComponent,
  ModalComponent,
  SurfaceComponent,
  inputClassName,
} from '../shared/ui-components';

@Component({
  selector: 'app-admin-leaves',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    SurfaceComponent,
    ModalComponent,
    FieldLabelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-6">
      <!-- Header -->
      <app-surface class="p-6">
        <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex flex-col gap-1">
            <h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              {{ isRosterMode() ? 'Workers on Leave' : 'Worker Leave Applications' }}
            </h1>
            <p class="text-sm text-muted-foreground">
              {{
                isRosterMode()
                  ? 'Real-time roster of operatives currently on active approved leave today.'
                  : 'Review incoming worker leave requests, grant approvals, or specify rejection feedback.'
              }}
            </p>
          </div>

          <button
            type="button"
            appButton
            variant="outline"
            class="rounded-full self-start sm:self-auto"
            (click)="refresh()"
          >
            <app-icon name="refresh-cw" [class]="'size-4 ' + (loading() ? 'animate-spin' : '')"></app-icon>
            Refresh
          </button>
        </div>
      </app-surface>

      <!-- View: Workers On Leave Roster Mode -->
      @if (isRosterMode()) {
        <app-surface class="p-6">
          <div class="flex items-center justify-between pb-4 border-b border-border/60">
            <div class="flex items-center gap-2">
              <span class="flex size-2 rounded-full bg-amber-500 animate-pulse"></span>
              <h2 class="text-base font-semibold text-foreground">Active On-Leave Operatives</h2>
            </div>
            <span class="text-xs text-muted-foreground">{{ activeRoster().length }} operative(s) on leave</span>
          </div>

          @if (loading()) {
            <div class="py-12 text-center text-sm text-muted-foreground">
              <app-icon name="refresh-cw" class="mx-auto size-5 animate-spin text-primary mb-2"></app-icon>
              Loading current leave roster...
            </div>
          } @else if (activeRoster().length === 0) {
            <div class="py-12 text-center text-sm text-muted-foreground">
              <app-icon name="check-circle-2" class="mx-auto size-8 text-emerald-500/50 mb-3"></app-icon>
              No operatives are currently on leave today. All active workers are available for duty dispatch.
            </div>
          } @else {
            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              @for (item of activeRoster(); track item.id) {
                <div class="rounded-xl border border-border/70 p-4 flex flex-col justify-between gap-4 bg-muted/20">
                  <div class="flex flex-col gap-2.5">
                    <div class="flex items-start justify-between gap-3">
                      <div class="flex items-center gap-3">
                        <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 font-bold text-sm text-primary">
                          {{ item.worker ? (item.worker.firstName[0] + item.worker.lastName[0]) : 'W' }}
                        </span>
                        <div>
                          <p class="font-semibold text-sm text-foreground">
                            {{ item.worker ? (item.worker.firstName + ' ' + item.worker.lastName) : 'Worker #' + item.workerId }}
                          </p>
                          <p class="text-xs text-muted-foreground">ID #{{ item.workerId }}</p>
                        </div>
                      </div>
                      <span class="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
                        {{ item.daysRemaining }} day(s) left
                      </span>
                    </div>

                    <div class="flex flex-col gap-1 text-xs text-muted-foreground">
                      <p class="flex items-center gap-1.5">
                        <app-icon name="calendar-days" class="size-3.5 text-primary"></app-icon>
                        <span class="text-foreground font-medium">{{ formatDate(item.startDate) }} &rarr; {{ formatDate(item.endDate) }}</span>
                      </p>
                      <p class="flex items-center gap-1.5">
                        <app-icon name="tag" class="size-3.5"></app-icon>
                        Type: <span class="text-foreground">{{ item.leaveType }}</span>
                      </p>
                      @if (item.worker?.mobile) {
                        <p class="flex items-center gap-1.5">
                          <app-icon name="phone" class="size-3.5"></app-icon>
                          <a [href]="'tel:' + item.worker.mobile" class="hover:underline text-primary">{{ item.worker.mobile }}</a>
                        </p>
                      }
                      <p class="mt-1 text-[11px] text-muted-foreground">
                        <strong class="text-foreground/80">Reason:</strong> {{ item.reason }}
                      </p>
                    </div>
                  </div>

                  <div class="rounded-lg bg-border/40 p-2 text-center text-[11px] font-medium text-muted-foreground">
                    Unavailable for dispatch · Returns {{ formatDate(item.endDate) }}
                  </div>
                </div>
              }
            </div>
          }
        </app-surface>
      } @else {
        <!-- View: Applications Management Mode -->
        <app-surface class="p-6">
          <div class="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-border/60">
            <!-- Filter Pills -->
            <div class="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              @for (f of filters; track f.id) {
                <button
                  type="button"
                  appButton
                  [variant]="activeFilter() === f.id ? 'brand' : 'outline'"
                  size="sm"
                  class="rounded-full text-xs"
                  (click)="setFilter(f.id)"
                >
                  {{ f.label }}
                  @if (f.id === 'pending' && pendingCount() > 0) {
                    <span class="ml-1.5 flex size-4 items-center justify-center rounded-full bg-white text-brand-ink text-[9px] font-bold">
                      {{ pendingCount() }}
                    </span>
                  }
                </button>
              }
            </div>

            <span class="text-xs text-muted-foreground">{{ filteredApplications().length }} application(s)</span>
          </div>

          @if (loading()) {
            <div class="py-12 text-center text-sm text-muted-foreground">
              <app-icon name="refresh-cw" class="mx-auto size-5 animate-spin text-primary mb-2"></app-icon>
              Loading leave applications...
            </div>
          } @else if (filteredApplications().length === 0) {
            <div class="py-12 text-center text-sm text-muted-foreground">
              <app-icon name="clipboard-check" class="mx-auto size-8 text-muted-foreground/40 mb-3"></app-icon>
              No {{ activeFilter() !== 'all' ? activeFilter() : '' }} leave applications found.
            </div>
          } @else {
            <div class="mt-4 flex flex-col gap-4">
              @for (app of filteredApplications(); track app.id) {
                <div class="rounded-xl border border-border/70 p-4 transition-colors hover:border-border">
                  <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div class="flex flex-col gap-2">
                      <div class="flex flex-wrap items-center gap-2">
                        <span class="font-bold text-sm text-foreground">
                          {{ app.worker ? (app.worker.firstName + ' ' + app.worker.lastName) : 'Worker #' + app.workerId }}
                        </span>
                        <span class="text-xs text-muted-foreground">(ID #{{ app.workerId }})</span>
                        <span [class]="getStatusBadgeClass(app.status)">
                          {{ app.status | uppercase }}
                        </span>
                        <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {{ app.leaveType }}
                        </span>
                      </div>

                      <div class="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span class="flex items-center gap-1">
                          <app-icon name="calendar-days" class="size-3.5 text-primary"></app-icon>
                          {{ formatDate(app.startDate) }} &rarr; {{ formatDate(app.endDate) }}
                          ({{ getDurationDays(app.startDate, app.endDate) }} day(s))
                        </span>
                        @if (app.worker?.mobile) {
                          <span class="flex items-center gap-1">
                            <app-icon name="phone" class="size-3.5"></app-icon>
                            <a [href]="'tel:' + app.worker.mobile" class="hover:underline text-primary">{{ app.worker.mobile }}</a>
                          </span>
                        }
                        <span>Applied {{ formatDateTime(app.createdAt) }}</span>
                      </div>

                      <p class="text-xs text-foreground/90 mt-1">
                        <strong class="text-foreground">Reason:</strong> {{ app.reason }}
                      </p>

                      @if (app.status === 'rejected' && app.rejectionReason) {
                        <div class="mt-2 rounded-lg bg-danger/10 border border-danger/20 p-2 text-xs text-danger-ink">
                          <strong>Rejection Note:</strong> {{ app.rejectionReason }}
                        </div>
                      }
                    </div>

                    <!-- Actions (if Pending) -->
                    @if (app.status === 'pending') {
                      <div class="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        <button
                          type="button"
                          appButton
                          variant="outline"
                          size="sm"
                          class="rounded-full text-danger-ink border-danger/30 hover:bg-danger/10"
                          (click)="openRejectModal(app)"
                        >
                          <app-icon name="x-circle" class="size-3.5"></app-icon>
                          Reject
                        </button>
                        <button
                          type="button"
                          appButton
                          variant="brand"
                          size="sm"
                          class="rounded-full"
                          (click)="approve(app)"
                        >
                          <app-icon name="check" class="size-3.5"></app-icon>
                          Approve
                        </button>
                      </div>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </app-surface>
      }
    </div>

    <!-- Rejection Modal -->
    @if (selectedForReject()) {
      <app-modal
        title="Reject Leave Application"
        description="Provide a mandatory reason for rejecting this operative's leave request."
        (close)="selectedForReject.set(null)"
      >
        <form (ngSubmit)="submitReject()" class="flex flex-col gap-4">
          <div>
            <app-field-label htmlFor="rejection-reason">Rejection Reason</app-field-label>
            <textarea
              id="rejection-reason"
              [(ngModel)]="rejectionReasonText"
              name="rejectionReason"
              rows="3"
              maxlength="500"
              placeholder="Explain why this leave application is rejected (e.g. high service demand, insufficient coverage)..."
              [class]="inputCls + ' min-h-[90px]'"
              required
            ></textarea>
            <p class="mt-1 text-right text-[11px] text-muted-foreground">{{ rejectionReasonText.length }}/500</p>
          </div>

          @if (rejectError()) {
            <p role="alert" class="text-xs text-danger-ink">{{ rejectError() }}</p>
          }

          <div class="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              appButton
              variant="outline"
              class="rounded-full"
              (click)="selectedForReject.set(null)"
            >
              Cancel
            </button>
            <button
              type="submit"
              appButton
              variant="destructive"
              class="rounded-full"
              [disabled]="rejecting()"
            >
              Confirm Rejection
            </button>
          </div>
        </form>
      </app-modal>
    }
  `
})
export class AdminLeavesComponent implements OnInit {
  mode = input<'applications' | 'on-leave'>('applications');
  inputCls = inputClassName;

  filters = [
    { id: 'all', label: 'All' },
    { id: 'pending', label: 'Pending' },
    { id: 'approved', label: 'Approved' },
    { id: 'rejected', label: 'Rejected' },
  ];

  activeFilter = signal<'all' | 'pending' | 'approved' | 'rejected'>('all');
  applications = signal<LeaveApplication[]>([]);
  activeRoster = signal<LeaveApplication[]>([]);
  loading = signal(false);

  selectedForReject = signal<LeaveApplication | null>(null);
  rejectionReasonText = '';
  rejecting = signal(false);
  rejectError = signal('');

  isRosterMode = computed(() => this.mode() === 'on-leave');

  filteredApplications = computed(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.applications();
    return this.applications().filter((a) => a.status === f);
  });

  pendingCount = computed(() => this.applications().filter((a) => a.status === 'pending').length);

  constructor(private adminService: AdminService) {}

  async ngOnInit() {
    await this.refresh();
  }

  async refresh() {
    this.loading.set(true);
    try {
      if (this.isRosterMode()) {
        const roster = await this.adminService.getWorkersOnLeave();
        this.activeRoster.set(roster);
      } else {
        const data = await this.adminService.getLeaves();
        this.applications.set(data);
      }
    } catch (err: any) {
      // non-fatal
    } finally {
      this.loading.set(false);
    }
  }

  setFilter(f: string) {
    this.activeFilter.set(f as any);
  }

  getStatusBadgeClass(status: string): string {
    if (status === 'approved') {
      return 'inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20';
    }
    if (status === 'rejected') {
      return 'inline-flex items-center rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20';
    }
    return 'inline-flex items-center rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20';
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  formatDateTime(dateStr: string): string {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  getDurationDays(start: string, end: string): number {
    if (!start || !end) return 1;
    const diffMs = Math.abs(new Date(end).getTime() - new Date(start).getTime());
    return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
  }

  async approve(app: LeaveApplication) {
    try {
      await this.adminService.updateLeaveStatus(app.id, 'approved');
      await this.refresh();
    } catch (err: any) {
      alert(err?.message || 'Failed to approve leave.');
    }
  }

  openRejectModal(app: LeaveApplication) {
    this.selectedForReject.set(app);
    this.rejectionReasonText = '';
    this.rejectError.set('');
  }

  async submitReject() {
    const target = this.selectedForReject();
    if (!target) return;
    if (!this.rejectionReasonText.trim()) {
      this.rejectError.set('Please provide a reason for the rejection.');
      return;
    }

    this.rejecting.set(true);
    this.rejectError.set('');
    try {
      await this.adminService.updateLeaveStatus(target.id, 'rejected', this.rejectionReasonText.trim());
      this.selectedForReject.set(null);
      await this.refresh();
    } catch (err: any) {
      this.rejectError.set(err?.message || 'Failed to reject leave application.');
    } finally {
      this.rejecting.set(false);
    }
  }
}
