import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, stagger } from 'motion';
import { catchError, forkJoin, of } from 'rxjs';

import { DashboardSummary, HireRequest, Ticket, WorkerReviewSummary } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { BarChartComponent, BarDatum } from '../../shared/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/donut-chart.component';
import { SparklineComponent } from '../../shared/sparkline.component';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BarChartComponent,
    DonutChartComponent,
    SparklineComponent,
    StatCardComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  loading = true;
  summary: DashboardSummary | null = null;
  tickets: Ticket[] = [];
  hireRequests: HireRequest[] = [];
  ticketsError = '';
  hireError = '';
  error = '';
  savingAvailability = false;
  workerReviews: WorkerReviewSummary | null = null;

  constructor(
    private readonly portalService: PortalService,
    private readonly authService: AuthService,
  ) {}

  get isUser() {
    return this.authService.currentUser?.role === 'user';
  }

  get isWorker() {
    return this.authService.currentUser?.role === 'worker';
  }

  get workerOnline() {
    return Boolean(this.authService.currentUser?.workerOnline);
  }

  get workerRatingLabel() {
    return this.workerReviews?.ratingCount
      ? this.workerReviews.ratingAverage.toFixed(1)
      : 'New';
  }

  get myTicketCount() {
    return this.tickets.length;
  }

  get openTicketCount() {
    return this.tickets.filter((ticket) => !['completed', 'cancelled'].includes(ticket.status)).length;
  }

  get completedTicketCount() {
    return this.tickets.filter((ticket) => ticket.status === 'completed').length;
  }

  get hireRequestCount() {
    return this.hireRequests.length;
  }

  get pendingHireCount() {
    return this.hireRequests.filter((request) => request.status === 'pending').length;
  }

  get recentTickets() {
    return [...this.tickets]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }

  get recentHireRequests() {
    return [...this.hireRequests]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 6);
  }

  get statusBreakdown(): DonutSlice[] {
    const open = this.tickets.filter(
      (ticket) => !['completed', 'cancelled'].includes(ticket.status),
    ).length;
    return [
      { label: 'Open', value: open, color: 'var(--chart-2)' },
      { label: 'Completed', value: this.completedTicketCount, color: 'var(--chart-1)' },
      {
        label: 'Cancelled',
        value: this.tickets.filter((ticket) => ticket.status === 'cancelled').length,
        color: 'var(--chart-5)',
      },
    ];
  }

  get weeklyTrend(): number[] {
    const days = [0, 0, 0, 0, 0, 0, 0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (const ticket of this.tickets) {
      const created = new Date(ticket.createdAt);
      created.setHours(0, 0, 0, 0);
      const age = Math.floor((today.getTime() - created.getTime()) / 86400000);
      if (age >= 0 && age < 7) {
        days[6 - age]++;
      }
    }
    return days;
  }

  get wasteTypeBreakdown(): BarDatum[] {
    const counts = new Map<string, number>();
    for (const ticket of this.tickets) {
      counts.set(ticket.wasteType, (counts.get(ticket.wasteType) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }

  ngOnInit() {
    this.reload();
  }

  reload() {
    this.loading = true;
    this.error = '';
    this.ticketsError = '';
    this.hireError = '';

    const summary$ = this.portalService.getSummary().pipe(
      catchError((err) => {
        this.error = err?.error?.message ?? 'Unable to load dashboard data.';
        return of(null);
      }),
    );

    const tickets$ = this.portalService.getTickets().pipe(
      catchError((err) => {
        this.ticketsError = err?.error?.message ?? 'Unable to load tickets.';
        return of([] as Ticket[]);
      }),
    );

    const hireRequests$ = this.isUser || this.isWorker
      ? this.portalService.getHireRequests().pipe(
          catchError((err) => {
            this.hireError = err?.error?.message ?? 'Unable to load hire requests.';
            return of([] as HireRequest[]);
          }),
        )
      : of([] as HireRequest[]);

    forkJoin([summary$, tickets$, hireRequests$]).subscribe({
      next: ([summary, tickets, hireRequests]) => {
        this.summary = summary;
        this.tickets = tickets;
        this.hireRequests = hireRequests;
        this.loading = false;
        setTimeout(() => this.playIntro());
        if (this.isWorker && this.authService.currentUser) {
          this.portalService.getWorkerReviews(this.authService.currentUser.id).subscribe({
            next: (reviews) => (this.workerReviews = reviews),
          });
        }
      },
      error: () => {
        this.loading = false;
        this.error = this.error || 'Unable to load dashboard data.';
      },
    });
  }

  toggleAvailability() {
    if (!this.isWorker || this.savingAvailability) return;
    this.savingAvailability = true;
    this.portalService.setWorkerAvailability(!this.workerOnline).subscribe({
      next: () => {
        this.authService.refreshUser().subscribe({
          next: () => {
            this.savingAvailability = false;
            this.reload();
          },
          error: () => (this.savingAvailability = false),
        });
      },
      error: (err) => {
        this.savingAvailability = false;
        this.error = err?.error?.message ?? 'Unable to update worker availability.';
      },
    });
  }

  openDirections(address: string) {
    const destination = encodeURIComponent(String(address ?? '').trim());
    if (!destination) {
      return;
    }

    window.open(
      `https://www.google.com/maps/dir/?api=1&destination=${destination}`,
      '_blank',
      'noopener',
    );
  }

  private playIntro() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate('.dashboard .stats app-stat-card', { opacity: [0, 1], y: [14, 0] }, { duration: 0.45, delay: stagger(0.06), ease: 'easeOut' });
    animate('.dashboard .chart-card', { opacity: [0, 1], y: [14, 0] }, { duration: 0.45, delay: stagger(0.08, { startDelay: 0.15 }), ease: 'easeOut' });
    animate('.dashboard .tracking-row', { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: stagger(0.05, { startDelay: 0.3 }), ease: 'easeOut' });
  }
}
