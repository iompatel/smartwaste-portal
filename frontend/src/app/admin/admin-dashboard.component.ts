import { Component, OnDestroy, OnInit, computed, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  AvatarComponent,
  MetricCardComponent,
  SectionHeaderComponent,
  StatusBadgeComponent,
  SurfaceComponent,
  TextLinkComponent,
} from '../shared/ui-components';
import {
  ActivityAreaChartComponent,
  ActivityDataPoint,
  CategoryDataPoint,
  WastePieChartComponent,
} from '../shared/charts.component';
import { View } from '../smartwaste/data';
import { AdminService } from '../core/admin.service';
import { AuthService } from '../core/auth.service';
import { TicketService } from '../core/ticket.service';
import { BackendTicket } from '../core/api.types';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    AvatarComponent,
    MetricCardComponent,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
    TextLinkComponent,
    ActivityAreaChartComponent,
    WastePieChartComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      @if (error()) {
        <p role="alert" class="rounded-xl bg-danger/10 p-3 text-xs text-danger">{{ error() }}</p>
      }
      <!-- Admin Hero (City Command) -->
      <section class="flex flex-col justify-between gap-5 rounded-[26px] border border-primary/15 bg-admin-hero p-6 sm:p-8 md:flex-row md:items-end">
        <div>
          <div class="flex items-center gap-2 text-[11px] font-medium text-primary">
            <span class="flex size-7 items-center justify-center rounded-[9px] bg-primary/10">
              <app-icon name="shield-check" class="size-4"></app-icon>
            </span>
            City operations desk · City command
          </div>
          <h1 class="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] text-foreground sm:text-[40px]">
            Welcome back, {{ adminName() }}<span class="text-primary">.</span>
          </h1>
          <p class="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
            A real-time view of your city. Keep teams moving and neighborhoods thriving.
          </p>
        </div>
        <div class="flex shrink-0 flex-col items-start gap-2 md:items-end">
          <span class="inline-flex items-center gap-2 rounded-full bg-card/70 px-3 py-1.5 text-[11px] text-muted-foreground">
            <app-icon name="activity" class="size-3.5 text-primary"></app-icon>
            Current snapshot
          </span>
          <span class="text-[28px] font-medium tracking-[-0.05em] tabular-nums text-foreground">{{ timeString() }}</span>
          <span class="text-[11px] text-muted-foreground">{{ today }} · Local time</span>
        </div>
      </section>

      <!-- Metric Cards -->
      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <app-metric-card label="Active reports" [value]="activeReports()" detail="Across all sectors" icon="activity" tone="blue"></app-metric-card>
        <app-metric-card label="Pending action" [value]="pendingReports()" detail="Require dispatch" icon="alert-triangle" tone="red"></app-metric-card>
        <app-metric-card label="Total tickets" [value]="totalTickets()" detail="All time records" icon="clock-3" tone="amber"></app-metric-card>
        <app-metric-card label="Workers online" [value]="workersOnlineText()" detail="Fleet availability" icon="users-round" tone="green"></app-metric-card>
      </section>

      <!-- Charts Grid -->
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
        <!-- Collection activity Area Chart -->
        <app-surface class="min-w-0 p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">Collection activity</h2>
              <p class="text-sm leading-5 text-muted-foreground">Reports received vs. verified completions · Last 7 days</p>
            </div>
            <span class="rounded-full bg-muted px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
              Last 7 days
            </span>
          </div>

          <div class="mt-5 h-[220px] w-full">
            <app-activity-area-chart [data]="activityList()"></app-activity-area-chart>
          </div>

          <div class="mt-2 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-primary"></span>
              Reports
            </span>
            <span class="flex items-center gap-1.5">
              <span class="size-2 rounded-full bg-brand"></span>
              Completed
            </span>

          </div>
        </app-surface>

        <!-- Waste Composition Pie Chart -->
        <app-surface class="p-5 sm:p-6">
          <app-section-header
            title="Waste composition"
            [description]="'All records · ' + tickets().length + ' reports'"
          ></app-section-header>

          <app-waste-pie-chart [data]="categoriesList()" [centerValue]="tickets().length"></app-waste-pie-chart>

          @if (categoriesList().length === 0) {
            <p class="mt-2 text-center text-xs text-muted-foreground">No reports yet.</p>
          }
          <div class="mt-4 grid grid-cols-2 gap-x-4 gap-y-3">
            @for (item of categoriesList(); track item.name; let i = $index) {
              <div class="flex items-center gap-2 text-[11px]">
                <span
                  class="size-2 rounded-full"
                  [class.bg-brand]="i === 0"
                  [class.bg-primary]="i === 1"
                  [class.bg-warning]="i === 2"
                  [class.bg-muted-foreground]="i === 3"
                ></span>
                <span class="flex-1 text-muted-foreground">{{ item.name }}</span>
                <span class="font-medium tabular-nums text-foreground">{{ item.value }}%</span>
              </div>
            }
          </div>
        </app-surface>
      </div>

      <!-- Field Fleet Table & Quick Broadcast -->
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,1fr)]">
        <app-surface class="overflow-hidden p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">Field fleet</h2>
              <p class="text-sm leading-5 text-muted-foreground">Live status from your verified operatives.</p>
            </div>
            <app-text-link (clicked)="navigate.emit('workers')">View all</app-text-link>
          </div>

          <div class="mt-5 overflow-x-auto">
            <table class="w-full min-w-[520px] text-left">
              <thead>
                <tr class="border-b border-border/60 text-[10px] tracking-[0.08em] text-muted-foreground uppercase">
                  <th class="pb-3 font-medium">Operative</th>
                  <th class="pb-3 font-medium">Current route</th>
                  <th class="pb-3 font-medium">Status</th>
                  <th class="pb-3 font-medium">Progress</th>
                  <th class="pb-3 font-medium">Rating</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border/60">
                @for (worker of workers(); track worker.name) {
                  <tr class="text-xs">
                    <td class="py-3">
                      <div class="flex items-center gap-2.5">
                        <app-avatar [initials]="worker.initials" class="size-8 text-[10px]" [online]="worker.status === 'Online'"></app-avatar>
                        <span class="font-medium text-foreground">{{ worker.name }}</span>
                      </div>
                    </td>
                    <td class="py-3 text-muted-foreground">{{ worker.route }}</td>
                    <td class="py-3">
                      <app-status-badge [status]="worker.status"></app-status-badge>
                    </td>
                    <td class="py-3 tabular-nums text-muted-foreground">{{ worker.collections }}</td>
                    <td class="py-3 font-medium tabular-nums text-foreground">{{ worker.rating }}</td>
                  </tr>
                }
                @if (workers().length === 0) {
                  <tr>
                    <td colspan="5" class="py-8 text-center text-xs text-muted-foreground">No field operatives found.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </app-surface>

        <!-- Quick Action broadcast card -->
        <app-surface class="p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <p class="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Quick action</p>
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">Keep your city informed</h2>
              <p class="text-sm leading-5 text-muted-foreground">Send an update to citizens or field teams in one step.</p>
            </div>
            <span class="flex size-8 items-center justify-center rounded-full bg-primary/10 text-primary">
              <app-icon name="bell-ring" class="size-4"></app-icon>
            </span>
          </div>

          <div class="mt-5 rounded-[16px] bg-muted/60 p-4">
            <p class="text-xs font-medium text-foreground">Broadcast to citizens or field teams</p>
            <p class="mt-2 text-[11px] leading-5 text-muted-foreground">
              Send a notification to every account in the role you choose. Delivery is recorded in the audit trail.
            </p>
          </div>

          <button
            type="button"
            appButton
            variant="brand"
            (click)="navigate.emit('broadcast')"
            class="mt-4 h-10 w-full rounded-full"
          >
            <app-icon name="send" class="size-4"></app-icon>
            Create broadcast
          </button>


        </app-surface>
      </div>
    </div>
  `
})
export class AdminDashboardComponent implements OnInit, OnDestroy {
  navigate = output<View>();

  timeString = signal<string>('--:--:--');
  private timerId?: number;

  activeReports = signal<string>('0');
  pendingReports = signal<string>('0');
  totalTickets = signal<string>('0');
  workersOnlineText = signal<string>('0/0');

  tickets = signal<BackendTicket[]>([]);
  workers = signal<
    Array<{ name: string; initials: string; route: string; status: string; collections: string; rating: string }>
  >([]);

  activityList = computed<ActivityDataPoint[]>(() => {
    const now = new Date();
    return Array.from({ length: 7 }, (_, index) => {
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      start.setDate(start.getDate() - (6 - index));
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      const inRange = (value?: string) => {
        const time = value ? new Date(value).getTime() : NaN;
        return time >= start.getTime() && time < end.getTime();
      };
      return {
        day: start.toLocaleDateString('en-US', { weekday: 'short' }),
        reports: this.tickets().filter((ticket) => inRange(ticket.createdAt)).length,
        completed: this.tickets().filter(
          (ticket) => ticket.status === 'completed' && inRange(ticket.updatedAt)
        ).length,
      };
    });
  });

  categoriesList = computed<CategoryDataPoint[]>(() => {
    const counts = new Map<string, number>();
    for (const ticket of this.tickets()) {
      const name = ticket.wasteType || 'Other';
      counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    const total = this.tickets().length || 1;
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([name, count], index) => ({
        name,
        value: Math.round((count / total) * 100),
        fill: `var(--chart-${index + 1})`,
      }));
  });

  today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  adminName = computed(() => this.auth.currentUser()?.firstName || 'Administrator');
  error = signal<string>('');

  constructor(
    private adminService: AdminService,
    private auth: AuthService,
    private ticketService: TicketService,
  ) {}

  async ngOnInit() {
    this.updateTime();
    this.timerId = window.setInterval(() => this.updateTime(), 1000);

    try {
      const summary = await this.adminService.getSummary();
      if (summary) {
        this.totalTickets.set(String(summary.totalTickets).padStart(2, '0'));
        this.pendingReports.set(String(summary.pendingTickets).padStart(2, '0'));
        this.activeReports.set(String(summary.totalTickets - summary.pendingTickets).padStart(2, '0'));
        this.workersOnlineText.set(`${summary.onlineWorkers}/${summary.totalWorkers}`);
      }
    } catch (error: any) {
      this.error.set(error?.message || 'Some dashboard data could not be loaded.');
    }

    try {
      const users = await this.adminService.getUsers();
      this.workers.set(
        (users ?? [])
          .filter((user) => user.role === 'worker')
          .map((user) => ({
            name: `${user.firstName} ${user.lastName}`.trim() || user.email,
            initials: `${user.firstName?.[0] ?? ''}${user.lastName?.[0] ?? ''}`.toUpperCase() || 'OP',
            route: user.workerOnline ? 'Available for dispatch' : 'Offline',
            status: user.workerOnline ? 'Online' : 'Offline',
            collections: '—',
            rating: user.ratingAverage ? user.ratingAverage.toFixed(1) : '—',
          })),
      );
    } catch (error: any) {
      this.workers.set([]);
      this.error.set(error?.message || 'Some dashboard data could not be loaded.');
    }

    try {
      this.tickets.set(await this.ticketService.getTickets());
    } catch (error: any) {
      this.tickets.set([]);
      this.error.set(error?.message || 'Some dashboard data could not be loaded.');
    }
  }

  ngOnDestroy() {
    if (this.timerId) {
      clearInterval(this.timerId);
    }
  }

  private updateTime() {
    this.timeString.set(
      new Date().toLocaleTimeString('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      })
    );
  }
}
