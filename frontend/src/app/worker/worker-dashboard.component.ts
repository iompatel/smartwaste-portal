import { Component, computed, input, output, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  LiveDotComponent,
  MetricCardComponent,
  PriorityBadgeComponent,
  StatusBadgeComponent,
  SurfaceComponent,
  ToggleComponent,
} from '../shared/ui-components';
import { Ticket, View, isClosedStatus } from '../smartwaste/data';

@Component({
  selector: 'app-worker-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IconComponent,
    ButtonDirective,
    LiveDotComponent,
    MetricCardComponent,
    PriorityBadgeComponent,
    StatusBadgeComponent,
    SurfaceComponent,
    ToggleComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="flex flex-col gap-5 sm:gap-6">
      <!-- Hero Banner (Field Operations) -->
      <section class="relative isolate overflow-hidden rounded-[26px] border border-brand/20 bg-hero p-6 sm:p-8">
        <div class="pointer-events-none absolute -top-32 -right-16 -z-10 size-[360px] rounded-full border border-brand/15"></div>
        <div class="pointer-events-none absolute -top-20 -right-4 -z-10 size-[250px] rounded-full border border-brand/15"></div>
        <div class="flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div class="flex flex-wrap items-center gap-2">
              <span class="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-medium text-brand">
                <app-icon name="shield-check" class="size-3.5"></app-icon>
                Field operative · City fleet
              </span>
              <span class="text-[11px] text-muted-foreground">{{ today }}</span>
            </div>
            <h1 class="mt-5 text-[32px] leading-tight font-semibold tracking-[-0.065em] text-foreground sm:text-[40px]">
              Your route is ready<span class="text-brand">.</span>
            </h1>
            <p class="mt-3 max-w-md text-sm leading-6 text-muted-foreground">
              {{ assignedCount() }} open stops across District 04. You are making the city a little better, one collection at a time.
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3 rounded-[18px] border border-border/60 bg-card/70 p-4">
            <div>
              <p class="text-xs font-medium text-foreground">{{ onDuty() ? 'On duty' : 'Off duty' }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                @if (onDuty()) {
                  <app-live-dot></app-live-dot>{{ location() ? 'GPS active' : 'Waiting for location' }}
                } @else {
                  Availability paused
                }
              </p>
            </div>
            <app-toggle
              [checked]="onDuty()"
              (checkedChange)="dutyChange.emit($event)"
              label="Toggle duty availability"
            ></app-toggle>
          </div>
        </div>
      </section>

      <!-- Metric Cards -->
      <section class="grid grid-cols-2 gap-3 md:grid-cols-4">
        <app-metric-card label="Assigned stops" [value]="assignedCountText()" detail="Open route stops" icon="route" tone="blue"></app-metric-card>
        <app-metric-card label="Collected" [value]="collectedCountText()" detail="Completed collections" icon="package-check" tone="green"></app-metric-card>
        <app-metric-card label="Total stops" [value]="totalCountText()" detail="All assigned records" icon="clipboard-check" tone="amber"></app-metric-card>
        <app-metric-card label="Completion rate" [value]="completionRateText()" detail="Of your route stops" icon="gauge" tone="green"></app-metric-card>
      </section>

      <!-- Next on Route & Telemetry Grid -->
      <div class="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,1fr)]">
        <!-- Next stops queue -->
        <app-surface class="p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">Next on your route</h2>
              <p class="text-sm leading-5 text-muted-foreground">Verified handover keeps every collection accountable.</p>
            </div>
            <button
              type="button"
              appButton
              variant="ghost"
              size="sm"
              (click)="navigate.emit('tickets')"
              class="rounded-full"
            >
              View queue
              <app-icon name="arrow-right" class="size-3.5"></app-icon>
            </button>
          </div>

          <div class="mt-5 flex flex-col gap-3">
            @for (ticket of routeTickets(); track ticket.id; let i = $index) {
              <div class="flex flex-col gap-3 rounded-[16px] border border-border/60 p-4 sm:flex-row sm:items-center">
                <div class="flex min-w-0 flex-1 items-center gap-3">
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {{ (i + 1).toString().padStart(2, '0') }}
                  </span>
                  <div class="min-w-0">
                    <p class="truncate text-sm font-medium text-foreground">{{ ticket.address }}</p>
                    <p class="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{{ ticket.category }}</span>
                      <span>·</span>
                      <span>{{ ticket.id }}</span>
                      <app-priority-badge [priority]="ticket.priority"></app-priority-badge>
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2 sm:shrink-0">
                  <app-status-badge [status]="ticket.status"></app-status-badge>
                  <button
                    type="button"
                    appButton
                    [variant]="ticket.status === 'In progress' ? 'brand' : 'outline'"
                    size="sm"
                    (click)="ticket.status === 'In progress' ? openHandover.emit(ticket) : startRoute.emit(ticket)"
                    class="rounded-full cursor-pointer"
                  >
                    {{ ticket.status === 'In progress' ? 'Verify' : 'Start' }}
                    <app-icon name="chevron-right" class="size-3.5"></app-icon>
                  </button>
                </div>
              </div>
            }

            @if (routeTickets().length === 0) {
              <p class="py-8 text-center text-sm text-muted-foreground">Your route is clear. Nice work.</p>
            }
          </div>
        </app-surface>

        <!-- Telemetry radar card -->
        <app-surface class="p-5 sm:p-6">
          <div class="flex items-start justify-between gap-4">
            <div class="flex flex-col gap-1.5">
              <p class="text-[10px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">Telemetry</p>
              <h2 class="text-[17px] font-semibold tracking-[-0.025em] text-foreground">
                {{ onDuty() ? 'Dispatch connected' : 'Dispatch offline' }}
              </h2>
            </div>
            <span class="flex size-8 items-center justify-center rounded-full bg-brand/10 text-brand">
              <app-icon name="radio" class="size-4"></app-icon>
            </span>
          </div>

          <div class="relative mx-auto mt-6 flex size-40 items-center justify-center">
            <div class="absolute size-40 rounded-full border border-brand/15"></div>
            <div class="absolute size-28 rounded-full border border-brand/20"></div>
            <div class="absolute size-16 rounded-full border border-brand/25"></div>
            <div class="absolute top-5 right-8 size-2.5 rounded-full bg-brand shadow-[0_0_0_5px_color-mix(in_oklab,var(--brand)_12%,transparent)]"></div>
            <div class="flex size-12 items-center justify-center rounded-full bg-brand/10 text-brand">
              <app-icon name="locate-fixed" class="size-5"></app-icon>
            </div>
          </div>

          <div class="mt-5 grid grid-cols-2 gap-3">
            <div class="rounded-[14px] bg-muted/60 p-3">
              <p class="text-[10px] text-muted-foreground">Latitude</p>
              <p class="mt-1 text-xs font-medium tabular-nums text-foreground">
                {{ location() ? location()!.latitude.toFixed(4) : '—' }}
              </p>
            </div>
            <div class="rounded-[14px] bg-muted/60 p-3">
              <p class="text-[10px] text-muted-foreground">Longitude</p>
              <p class="mt-1 text-xs font-medium tabular-nums text-foreground">
                {{ location() ? location()!.longitude.toFixed(4) : '—' }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between text-[11px]">
            @if (onDuty()) {
              <span class="flex items-center gap-1.5 text-brand">
                <app-live-dot></app-live-dot>
                Broadcasting every 15s
              </span>
              <span class="text-muted-foreground">
                Accuracy {{ location() ? location()!.accuracy.toFixed(0) + 'm' : '—' }}
              </span>
            } @else {
              <span class="text-muted-foreground">Go on duty to broadcast your location.</span>
            }
          </div>
        </app-surface>
      </div>

      <!-- Turn by Turn Surface -->
      <app-surface class="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div class="flex items-center gap-3">
          <span class="flex size-10 items-center justify-center rounded-[13px] bg-primary/10 text-primary">
            <app-icon name="compass" class="size-5"></app-icon>
          </span>
          <div>
            <p class="text-sm font-medium text-foreground">Need turn-by-turn directions?</p>
            <p class="mt-1 text-xs text-muted-foreground">Open your next stop in Maps and keep moving.</p>
          </div>
        </div>
        <button
          type="button"
          appButton
          variant="outline"
          class="rounded-full"
          [disabled]="routeTickets().length === 0"
          (click)="openDirections()"
        >
          <app-icon name="navigation" class="size-4"></app-icon>
          Open directions
        </button>
      </app-surface>
    </div>
  `
})
export class WorkerDashboardComponent {
  tickets = input.required<Ticket[]>();
  onDuty = input.required<boolean>();
  location = input<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  dutyChange = output<boolean>();
  openHandover = output<Ticket>();
  startRoute = output<Ticket>();
  navigate = output<View>();

  today = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  assignedCount = computed(() => this.tickets().filter((t) => !isClosedStatus(t.status)).length);
  collectedCount = computed(() => this.tickets().filter((t) => t.status === 'Completed').length);
  totalCount = computed(() => this.tickets().length);
  assignedCountText = computed(() => String(this.assignedCount()).padStart(2, '0'));
  collectedCountText = computed(() => String(this.collectedCount()).padStart(2, '0'));
  totalCountText = computed(() => String(this.totalCount()).padStart(2, '0'));
  completionRate = computed(() =>
    this.totalCount() ? Math.round((this.collectedCount() / this.totalCount()) * 100) : 0
  );
  completionRateText = computed(() => `${this.completionRate()}%`);

  routeTickets = computed(() => {
    return this.tickets().filter((t) => !isClosedStatus(t.status)).slice(0, 3);
  });

  openDirections() {
    const next = this.routeTickets()[0];
    if (!next) return;
    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(next.address)}`,
      '_blank',
      'noopener'
    );
  }
}
