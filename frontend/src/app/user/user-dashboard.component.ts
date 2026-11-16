import { Component, computed, input, output, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  AvatarComponent,
  MetricCardComponent,
  ProgressBarComponent,
  ScoreRingComponent,
  SectionHeaderComponent,
  StatusBadgeComponent,
  SurfaceComponent,
  TextLinkComponent,
} from '../shared/ui-components';
import { Booking, Ticket, View, isClosedStatus } from '../smartwaste/data';

@Component({
  selector: 'app-citizen-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    AvatarComponent,
    MetricCardComponent,
    ProgressBarComponent,
    ScoreRingComponent,
    SectionHeaderComponent,
    StatusBadgeComponent,
    SurfaceComponent,
    TextLinkComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <!-- Hero Banner (Citizen Portal) -->
      <section class="relative isolate overflow-hidden rounded-[26px] border border-brand/15 bg-hero p-6 sm:p-8">
        <div class="pointer-events-none absolute -top-28 -right-20 -z-10 size-[330px] rounded-full border border-brand/10"></div>
        <div class="pointer-events-none absolute -top-16 -right-4 -z-10 size-[240px] rounded-full border border-brand/10"></div>
        <div class="pointer-events-none absolute right-24 -bottom-36 -z-10 size-[280px] rounded-full bg-brand/5 blur-2xl"></div>

        <div class="flex items-center justify-between gap-5">
          <div class="max-w-[560px]">
            <div class="flex flex-wrap items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-brand">
                <app-icon name="check-circle-2" class="size-3.5"></app-icon>Account overview
              </span>
              <span>{{ today }}</span>
            </div>
            <h1 class="mt-5 text-[32px] leading-[1.08] font-semibold tracking-[-0.065em] text-foreground sm:text-[42px]">
              {{ greeting() }}, {{ userName() }}<span class="text-brand">.</span>
            </h1>
            <p class="mt-3 max-w-[410px] text-sm leading-6 text-muted-foreground sm:text-[15px]">
              A cleaner neighborhood starts with one small action. Here is what is happening around you today.
            </p>
            <div class="mt-6 flex flex-wrap gap-2.5">
              <button
                type="button"
                appButton
                variant="brand"
                (click)="report.emit()"
                class="h-11 rounded-full px-5"
              >
                <app-icon name="plus" class="size-4"></app-icon>
                Report waste
              </button>
              <button
                type="button"
                appButton
                variant="outline"
                (click)="hire.emit()"
                class="h-11 rounded-full bg-card/60 px-5"
              >
                <app-icon name="briefcase-business" class="size-4"></app-icon>
                Hire a worker
              </button>
            </div>
          </div>
          <div class="hidden shrink-0 flex-col items-center gap-3 md:flex">
            <app-score-ring [score]="completionRate()"></app-score-ring>
            <span class="inline-flex items-center gap-1 text-[11px] font-medium text-brand">
              <app-icon name="check-circle-2" class="size-3.5"></app-icon>
              {{ completionRate() }}% of reports completed
            </span>
          </div>
        </div>

        <div class="mt-7 flex items-center gap-2 text-[11px] text-muted-foreground md:hidden">
          <app-score-ring [score]="completionRate()"></app-score-ring>
          <div>
            <p class="font-medium text-foreground">Report completion</p>
            <p class="mt-1 flex items-center gap-1 text-brand">
              <app-icon name="check-circle-2" class="size-3.5"></app-icon>
              {{ completionRate() }}% completed
            </p>
          </div>
        </div>
      </section>

      <!-- Quick Actions -->
      <section aria-labelledby="quick-actions-title">
        <app-section-header
          title="What would you like to do?"
          description="Your everyday tools, all in one place."
        ></app-section-header>
        <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
          <button
            type="button"
            (click)="report.emit()"
            class="group flex min-h-[142px] flex-col items-start rounded-[20px] border border-border/70 bg-card p-4 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_color-mix(in_oklab,var(--foreground)_7%,transparent)] active:scale-[0.98] sm:p-5"
          >
            <span class="flex size-9 items-center justify-center rounded-[12px] bg-primary/10 text-primary transition-transform duration-300 group-hover:scale-105">
              <app-icon name="camera" class="size-[18px]"></app-icon>
            </span>
            <span class="mt-4 text-[13px] font-medium text-foreground">Report waste</span>
            <span class="mt-1 text-[11px] leading-4 text-muted-foreground">Snap it. Pin it. Done.</span>
            <app-icon name="arrow-up-right" class="mt-auto self-end text-muted-foreground/50 transition-colors group-hover:text-primary size-4"></app-icon>
          </button>

          <button
            type="button"
            (click)="hire.emit()"
            class="group flex min-h-[142px] flex-col items-start rounded-[20px] border border-border/70 bg-card p-4 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_color-mix(in_oklab,var(--foreground)_7%,transparent)] active:scale-[0.98] sm:p-5"
          >
            <span class="flex size-9 items-center justify-center rounded-[12px] bg-brand/10 text-brand transition-transform duration-300 group-hover:scale-105">
              <app-icon name="briefcase-business" class="size-[18px]"></app-icon>
            </span>
            <span class="mt-4 text-[13px] font-medium text-foreground">Hire a worker</span>
            <span class="mt-1 text-[11px] leading-4 text-muted-foreground">A helping hand, on demand.</span>
            <app-icon name="arrow-up-right" class="mt-auto self-end text-muted-foreground/50 transition-colors group-hover:text-primary size-4"></app-icon>
          </button>

          <button
            type="button"
            (click)="trackActiveTicket()"
            class="group flex min-h-[142px] flex-col items-start rounded-[20px] border border-border/70 bg-card p-4 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_color-mix(in_oklab,var(--foreground)_7%,transparent)] active:scale-[0.98] sm:p-5"
          >
            <span class="flex size-9 items-center justify-center rounded-[12px] bg-warning/10 text-warning transition-transform duration-300 group-hover:scale-105">
              <app-icon name="locate-fixed" class="size-[18px]"></app-icon>
            </span>
            <span class="mt-4 text-[13px] font-medium text-foreground">View active report</span>
            <span class="mt-1 text-[11px] leading-4 text-muted-foreground">Check its latest status.</span>
            <app-icon name="arrow-up-right" class="mt-auto self-end text-muted-foreground/50 transition-colors group-hover:text-primary size-4"></app-icon>
          </button>

          <button
            type="button"
            (click)="navigate.emit('profile')"
            class="group flex min-h-[142px] flex-col items-start rounded-[20px] border border-border/70 bg-card p-4 text-left shadow-[0_8px_30px_color-mix(in_oklab,var(--foreground)_3%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_12px_30px_color-mix(in_oklab,var(--foreground)_7%,transparent)] active:scale-[0.98] sm:p-5"
          >
            <span class="flex size-9 items-center justify-center rounded-[12px] bg-muted text-muted-foreground transition-transform duration-300 group-hover:scale-105">
              <app-icon name="user-round" class="size-[18px]"></app-icon>
            </span>
            <span class="mt-4 text-[13px] font-medium text-foreground">Your profile</span>
            <span class="mt-1 text-[11px] leading-4 text-muted-foreground">Keep your details up to date.</span>
            <app-icon name="arrow-up-right" class="mt-auto self-end text-muted-foreground/50 transition-colors group-hover:text-primary size-4"></app-icon>
          </button>
        </div>
      </section>

      <!-- Metric Cards -->
      <section aria-label="Your waste collection metrics" class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <app-metric-card label="My reports" [value]="reportCountText()" detail="All time submissions" icon="clipboard-check" tone="blue"></app-metric-card>
        <app-metric-card label="Open reports" [value]="openCountText()" detail="Being taken care of" icon="clock-3" tone="amber"></app-metric-card>
        <app-metric-card label="Completed" [value]="completedCountText()" detail="Verified collections" icon="check-circle-2" tone="green"></app-metric-card>
        <app-metric-card label="Hire requests" [value]="bookingCountText()" detail="Personal service tasks" icon="briefcase-business" tone="blue"></app-metric-card>
      </section>

      <!-- Activity & Live Collection Grid -->
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,1fr)]">
        <!-- Recent Activity Surface -->
        <app-surface class="min-w-0 p-5 sm:p-6">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <app-section-header title="Recent activity" description="Your latest reports and requests."></app-section-header>
            <div class="flex rounded-full bg-muted p-1" role="tablist" aria-label="Activity type">
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="activityTab() === 'tickets'"
                (click)="activityTab.set('tickets')"
                class="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer"
                [class.bg-card]="activityTab() === 'tickets'"
                [class.text-foreground]="activityTab() === 'tickets'"
                [class.shadow-sm]="activityTab() === 'tickets'"
                [class.text-muted-foreground]="activityTab() !== 'tickets'"
              >
                Reports
              </button>
              <button
                type="button"
                role="tab"
                [attr.aria-selected]="activityTab() === 'bookings'"
                (click)="activityTab.set('bookings')"
                class="rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors cursor-pointer"
                [class.bg-card]="activityTab() === 'bookings'"
                [class.text-foreground]="activityTab() === 'bookings'"
                [class.shadow-sm]="activityTab() === 'bookings'"
                [class.text-muted-foreground]="activityTab() !== 'bookings'"
              >
                Bookings
              </button>
            </div>
          </div>

          @if (activityTab() === 'tickets') {
            <div class="mt-5 flex flex-col divide-y divide-border/60">
              @for (ticket of recentTickets(); track ticket.id) {
                <button
                  type="button"
                  (click)="selectTicket.emit(ticket)"
                  class="group flex items-center gap-3 py-3.5 text-left first:pt-0 last:pb-0 cursor-pointer"
                >
                  <span class="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-muted text-muted-foreground transition-colors group-hover:bg-primary/10 group-hover:text-primary">
                    <app-icon name="trash-2" class="size-[17px]"></app-icon>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="flex items-center gap-2">
                      <span class="truncate text-[13px] font-medium text-foreground">{{ ticket.title }}</span>
                      <span class="hidden text-[10px] text-muted-foreground sm:inline">{{ ticket.id }}</span>
                    </span>
                    <span class="mt-1 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <app-icon name="map-pin" class="size-3 shrink-0"></app-icon>
                      {{ ticket.address }}
                      <span class="mx-1">·</span>
                      {{ ticket.time }}
                    </span>
                  </span>
                  <span class="hidden shrink-0 sm:block">
                    <app-status-badge [status]="ticket.status"></app-status-badge>
                  </span>
                  <app-icon name="chevron-right" class="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5"></app-icon>
                </button>
              }
              @if (recentTickets().length === 0) {
                <div class="py-8 text-center text-xs text-muted-foreground">
                  No reports submitted yet. Snap a photo or report waste above!
                </div>
              }
            </div>
          } @else {
            <div class="mt-5 flex flex-col gap-3">
              @for (booking of recentBookings(); track booking.id) {
                <div class="flex items-center gap-3 rounded-[14px] bg-muted/50 p-3">
                  <span class="flex size-9 items-center justify-center rounded-[11px] bg-brand/10 text-brand">
                    <app-icon name="briefcase-business" class="size-4"></app-icon>
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-xs font-medium text-foreground">{{ booking.title }}</p>
                    <p class="mt-1 truncate text-[11px] text-muted-foreground">{{ booking.worker }} · {{ booking.date }}</p>
                  </div>
                  <app-status-badge [status]="booking.status"></app-status-badge>
                </div>
              }
              @if (recentBookings().length === 0) {
                <div class="py-8 text-center text-xs text-muted-foreground">
                  No service bookings yet. Book a verified worker above!
                </div>
              }
            </div>
          }

          <div class="mt-4 border-t border-border/60 pt-4">
            <app-text-link (clicked)="navigate.emit(activityTab() === 'tickets' ? 'tickets' : 'hire')">
              View all {{ activityTab() === 'tickets' ? 'reports' : 'bookings' }}
            </app-text-link>
          </div>
        </app-surface>

        <!-- Live Collection Card -->
        <app-surface class="overflow-hidden p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <p class="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Active report</p>
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">
                {{ activeTicket() ? collectionHeading(activeTicket()!) : 'Collection status' }}
              </h2>
            </div>
            <span class="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
              <app-icon name="navigation" class="size-4"></app-icon>
            </span>
          </div>

          @if (activeTicket(); as ticket) {
            <div class="mt-5 flex items-center gap-3">
              <app-avatar [initials]="workerInitials()" [online]="ticket.status === 'In progress'" class="size-11"></app-avatar>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-foreground">{{ ticket.worker || 'Your operative' }}</p>
                <p class="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <app-icon name="shield-check" class="size-3 text-brand"></app-icon>
                  Verified operative · {{ ticket.status }}
                </p>
              </div>
              <button
                type="button"
                aria-label="Open report details"
                (click)="selectTicket.emit(ticket)"
                class="flex size-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:text-foreground cursor-pointer"
              >
                <app-icon name="message-circle" class="size-4"></app-icon>
              </button>
            </div>

            <div class="mt-5 rounded-[16px] bg-muted/60 p-4">
              <div class="flex items-center justify-between gap-3">
                <span class="text-xs font-medium text-foreground">{{ ticket.status }}</span>
                <span class="text-[11px] text-muted-foreground">{{ ticket.id }}</span>
              </div>
              <div class="mt-4">
                <app-progress-bar [value]="statusProgress(ticket)"></app-progress-bar>
              </div>
              <div class="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>Reported</span>
                <span>Completed</span>
              </div>
            </div>

            <div class="mt-5 flex items-start gap-2.5">
              <app-icon name="map-pin" class="mt-0.5 size-4 shrink-0 text-muted-foreground"></app-icon>
              <div>
                <p class="text-xs font-medium text-foreground">{{ ticket.address }}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">{{ ticket.category }} · {{ ticket.id }}</p>
              </div>
            </div>

            <button
              type="button"
              appButton
              variant="secondary"
              (click)="trackActiveTicket()"
              class="mt-5 h-10 w-full rounded-full cursor-pointer"
            >
              Track this collection
              <app-icon name="arrow-right" class="size-4"></app-icon>
            </button>
          } @else {
            <div class="mt-5 py-6 text-center text-xs text-muted-foreground">
              All collections are up to date in your area. Report an issue to schedule a collection.
            </div>
          }
        </app-surface>
      </div>

      <!-- Impact Card -->
      <app-surface class="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div class="flex items-center gap-4">
          <span class="flex size-11 shrink-0 items-center justify-center rounded-[15px] bg-brand/10 text-brand">
            <app-icon name="leaf" class="size-5"></app-icon>
          </span>
          <div>
            <p class="text-sm font-medium text-foreground">Your collection progress</p>
            <p class="mt-1 text-xs leading-5 text-muted-foreground">
              You have completed <strong class="font-medium text-foreground">{{ completedCount() }}</strong> of
              <strong class="font-medium text-foreground">{{ reportCount() }}</strong> reports.
            </p>
          </div>
        </div>
        <div class="w-full sm:w-44">
          <div class="mb-2 flex justify-between text-[10px] text-muted-foreground">
            <span>Completion rate</span>
            <span>{{ completionRate() }}%</span>
          </div>
          <app-progress-bar [value]="completionRate()"></app-progress-bar>
        </div>
      </app-surface>
    </div>
  `
})
export class CitizenDashboardComponent {
  tickets = input.required<Ticket[]>();
  bookings = input<Booking[]>([]);
  userName = input<string>('Citizen');
  report = output<void>();
  hire = output<void>();
  navigate = output<View>();
  selectTicket = output<Ticket>();

  today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  greeting = computed(() => {
    const hour = new Date().getHours();
    return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  });

  activityTab = signal<'tickets' | 'bookings'>('tickets');

  reportCount = computed(() => this.tickets().length);
  openCount = computed(() => this.tickets().filter((t) => !isClosedStatus(t.status)).length);
  completedCount = computed(() => this.tickets().filter((t) => t.status === 'Completed').length);
  bookingCount = computed(() => this.bookings().length);

  reportCountText = computed(() => this.pad(this.reportCount()));
  openCountText = computed(() => this.pad(this.openCount()));
  completedCountText = computed(() => this.pad(this.completedCount()));
  bookingCountText = computed(() => this.pad(this.bookingCount()));

  workerInitials = computed(() => {
    const name = this.activeTicket()?.worker;
    if (!name) return 'OP';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  });

  private pad(value: number): string {
    return String(value).padStart(2, '0');
  }

  activeTicket = computed<Ticket | null>(() => {
    const list = this.tickets();
    if (!list || list.length === 0) return null;
    return (
      list.find((t) => t.status === 'In progress') ??
      list.find((t) => !isClosedStatus(t.status)) ??
      null
    );
  });

  recentTickets = computed(() => this.tickets().slice(0, 3));
  recentBookings = computed(() => this.bookings().slice(0, 3));

  completionRate = computed(() =>
    this.reportCount() ? Math.round((this.completedCount() / this.reportCount()) * 100) : 0
  );

  statusProgress(ticket: Ticket): number {
    switch (ticket.status) {
      case 'Completed':
        return 100;
      case 'In progress':
        return 65;
      case 'Scheduled':
        return 30;
      default:
        return 10;
    }
  }

  collectionHeading(ticket: Ticket): string {
    if (ticket.status === 'In progress') {
      return ticket.worker ? `${ticket.worker} is collecting` : 'Collection in progress';
    }
    if (ticket.status === 'Scheduled') return 'An operative has been assigned';
    return 'Awaiting dispatch';
  }

  trackActiveTicket() {
    const t = this.activeTicket();
    if (t) {
      this.selectTicket.emit(t);
    } else {
      this.navigate.emit('tickets');
    }
  }
}

// UserDashboardComponent alias for flexible referencing
export { CitizenDashboardComponent as UserDashboardComponent };
