import { Component, OnInit, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { WorkerService } from '../core/worker.service';
import { LeaveApplication, LeaveType } from '../core/api.types';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  FieldLabelComponent,
  ModalComponent,
  SurfaceComponent,
  inputClassName,
} from '../shared/ui-components';

@Component({
  selector: 'app-worker-leaves',
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
            <h1 class="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Leave Management</h1>
            <p class="text-sm text-muted-foreground">
              Apply for leave and review previous application statuses and admin feedback.
            </p>
          </div>
          <button
            type="button"
            appButton
            variant="brand"
            class="rounded-full shrink-0"
            (click)="showApplyModal.set(true)"
          >
            <app-icon name="plus" class="size-4"></app-icon>
            Apply for leave
          </button>
        </div>
      </app-surface>

      <!-- Leave Metrics / Summary -->
      <section class="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <app-surface class="p-4 flex items-center gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <app-icon name="clock-3" class="size-5"></app-icon>
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Pending Review</p>
            <p class="text-xl font-bold text-foreground">{{ pendingCount() }}</p>
          </div>
        </app-surface>

        <app-surface class="p-4 flex items-center gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <app-icon name="check-circle-2" class="size-5"></app-icon>
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Approved Leaves</p>
            <p class="text-xl font-bold text-foreground">{{ approvedCount() }}</p>
          </div>
        </app-surface>

        <app-surface class="p-4 flex items-center gap-3">
          <div class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <app-icon name="x-circle" class="size-5"></app-icon>
          </div>
          <div>
            <p class="text-xs text-muted-foreground font-medium">Rejected Leaves</p>
            <p class="text-xl font-bold text-foreground">{{ rejectedCount() }}</p>
          </div>
        </app-surface>
      </section>

      <!-- History List -->
      <app-surface class="p-6">
        <div class="flex items-center justify-between pb-4 border-b border-border/60">
          <h2 class="text-base font-semibold text-foreground">Leave Application History</h2>
          <span class="text-xs text-muted-foreground">{{ leaves().length }} application(s)</span>
        </div>

        @if (loading()) {
          <div class="py-12 text-center text-sm text-muted-foreground">
            <app-icon name="refresh-cw" class="mx-auto size-5 animate-spin text-primary mb-2"></app-icon>
            Loading your leave applications...
          </div>
        } @else if (leaves().length === 0) {
          <div class="py-12 text-center text-sm text-muted-foreground">
            <app-icon name="calendar-days" class="mx-auto size-8 text-muted-foreground/40 mb-3"></app-icon>
            No leave applications recorded yet. Click "Apply for leave" above when you need time off.
          </div>
        } @else {
          <div class="mt-4 flex flex-col gap-4">
            @for (leave of leaves(); track leave.id) {
              <div class="rounded-xl border border-border/70 p-4 transition-colors hover:border-border">
                <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div class="flex flex-col gap-1.5">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="font-semibold text-sm text-foreground">{{ leave.leaveType }}</span>
                      <span [class]="getStatusBadgeClass(leave.status)">
                        {{ leave.status | uppercase }}
                      </span>
                    </div>

                    <p class="text-xs font-medium text-foreground flex items-center gap-1.5">
                      <app-icon name="calendar-days" class="size-3.5 text-primary"></app-icon>
                      {{ formatDate(leave.startDate) }} &rarr; {{ formatDate(leave.endDate) }}
                      <span class="text-muted-foreground font-normal">({{ getDurationDays(leave.startDate, leave.endDate) }} day(s))</span>
                    </p>

                    <p class="text-xs text-muted-foreground mt-1">
                      <strong class="text-foreground/80">Reason:</strong> {{ leave.reason }}
                    </p>
                  </div>

                  <span class="text-[11px] text-muted-foreground self-start sm:self-auto">
                    Applied {{ formatDateTime(leave.createdAt) }}
                  </span>
                </div>

                <!-- Rejection Reason Alert -->
                @if (leave.status === 'rejected' && leave.rejectionReason) {
                  <div class="mt-3 rounded-lg bg-danger/10 border border-danger/20 p-3 text-xs text-danger-ink flex items-start gap-2">
                    <app-icon name="alert-triangle" class="size-4 shrink-0 mt-0.5 text-danger-ink"></app-icon>
                    <div>
                      <span class="font-semibold block">Admin Feedback / Rejection Note:</span>
                      <span class="mt-0.5 block">{{ leave.rejectionReason }}</span>
                    </div>
                  </div>
                }

                @if (leave.status === 'approved') {
                  <div class="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                    <app-icon name="check-circle-2" class="size-4 shrink-0 text-emerald-600 dark:text-emerald-400"></app-icon>
                    <span>Approved by supervisor. Auto-dispatch availability will pause during these dates.</span>
                  </div>
                }
              </div>
            }
          </div>
        }
      </app-surface>
    </div>

    <!-- Apply for Leave Modal -->
    @if (showApplyModal()) {
      <app-modal
        title="Apply for leave"
        description="Submit your leave request for supervisor review and roster planning."
        (close)="showApplyModal.set(false)"
      >
        <form (ngSubmit)="submitLeave()" class="flex flex-col gap-4">
          <div>
            <app-field-label htmlFor="leave-type">Leave Type</app-field-label>
            <select
              id="leave-type"
              [(ngModel)]="leaveForm.leaveType"
              name="leaveType"
              [class]="inputCls"
            >
              @for (type of leaveTypes; track type) {
                <option [value]="type">{{ type }}</option>
              }
            </select>
          </div>

          <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <app-field-label htmlFor="leave-start">Start Date</app-field-label>
              <input
                id="leave-start"
                type="date"
                [(ngModel)]="leaveForm.startDate"
                name="startDate"
                [min]="todayIso"
                [class]="inputCls"
                required
              />
            </div>

            <div>
              <app-field-label htmlFor="leave-end">End Date</app-field-label>
              <input
                id="leave-end"
                type="date"
                [(ngModel)]="leaveForm.endDate"
                name="endDate"
                [min]="leaveForm.startDate || todayIso"
                [class]="inputCls"
                required
              />
            </div>
          </div>

          <div>
            <app-field-label htmlFor="leave-reason">Detailed Reason</app-field-label>
            <textarea
              id="leave-reason"
              [(ngModel)]="leaveForm.reason"
              name="reason"
              rows="3"
              maxlength="500"
              placeholder="State the reason for taking leave (e.g., medical appointment, family obligation)..."
              [class]="inputCls + ' min-h-[80px]'"
              required
            ></textarea>
            <p class="mt-1 text-right text-[11px] text-muted-foreground">{{ leaveForm.reason.length }}/500</p>
          </div>

          @if (formError()) {
            <p role="alert" class="text-xs text-danger-ink">{{ formError() }}</p>
          }

          <div class="flex justify-end gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              appButton
              variant="outline"
              class="rounded-full"
              (click)="showApplyModal.set(false)"
            >
              Cancel
            </button>
            <button
              type="submit"
              appButton
              variant="brand"
              class="rounded-full"
              [disabled]="submitting()"
            >
              <app-icon name="send" class="size-4"></app-icon>
              {{ submitting() ? 'Submitting...' : 'Submit Request' }}
            </button>
          </div>
        </form>
      </app-modal>
    }
  `
})
export class WorkerLeavesComponent implements OnInit {
  inputCls = inputClassName;
  todayIso = new Date().toISOString().slice(0, 10);

  leaveTypes: LeaveType[] = ['Personal', 'Sick Leave', 'Casual Leave', 'Emergency', 'Annual'];

  leaves = signal<LeaveApplication[]>([]);
  loading = signal(false);
  submitting = signal(false);
  showApplyModal = signal(false);
  formError = signal('');

  leaveForm = {
    leaveType: 'Personal' as LeaveType,
    startDate: '',
    endDate: '',
    reason: '',
  };

  constructor(private workerService: WorkerService) {}

  async ngOnInit() {
    await this.loadLeaves();
  }

  async loadLeaves() {
    this.loading.set(true);
    try {
      const data = await this.workerService.getLeaves();
      this.leaves.set(data);
    } catch (err: any) {
      // non-fatal
    } finally {
      this.loading.set(false);
    }
  }

  pendingCount(): number {
    return this.leaves().filter((l) => l.status === 'pending').length;
  }

  approvedCount(): number {
    return this.leaves().filter((l) => l.status === 'approved').length;
  }

  rejectedCount(): number {
    return this.leaves().filter((l) => l.status === 'rejected').length;
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

  async submitLeave() {
    this.formError.set('');
    if (!this.leaveForm.startDate || !this.leaveForm.endDate) {
      this.formError.set('Please select both a start date and an end date.');
      return;
    }
    if (this.leaveForm.startDate > this.leaveForm.endDate) {
      this.formError.set('Start date cannot be after end date.');
      return;
    }
    if (!this.leaveForm.reason.trim()) {
      this.formError.set('Please provide a reason for taking leave.');
      return;
    }

    this.submitting.set(true);
    try {
      await this.workerService.applyLeave(this.leaveForm);
      this.showApplyModal.set(false);
      this.leaveForm = {
        leaveType: 'Personal',
        startDate: '',
        endDate: '',
        reason: '',
      };
      await this.loadLeaves();
    } catch (err: any) {
      this.formError.set(err?.message || 'Could not submit your leave application.');
    } finally {
      this.submitting.set(false);
    }
  }
}
