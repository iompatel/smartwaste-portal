import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { animate, stagger } from 'animejs';
import { forkJoin } from 'rxjs';

import { HireRequest, Ticket, User } from '../../models/types';
import { PortalService } from '../../services/portal.service';
import { BarChartComponent, BarDatum } from '../../shared/bar-chart.component';
import { DonutChartComponent, DonutSlice } from '../../shared/donut-chart.component';
import { SparklineComponent } from '../../shared/sparkline.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    BarChartComponent,
    DonutChartComponent,
    SparklineComponent,
    StatusBadgeComponent,
  ],
  templateUrl: './admin-panel.component.html',
  styleUrl: './admin-panel.component.scss',
})
export class AdminPanelComponent implements OnInit, OnDestroy {
  private readonly portalService = inject(PortalService);

  users: User[] = [];
  tickets: Ticket[] = [];
  hireRequests: HireRequest[] = [];

  loading = true;
  error = '';
  nowLabel = '';

  private nowTimer: ReturnType<typeof setInterval> | null = null;

  ngOnInit() {
    this.refreshNowLabel();
    this.nowTimer = setInterval(() => this.refreshNowLabel(), 1000);
    this.loadData();
  }

  ngOnDestroy() {
    if (this.nowTimer) {
      clearInterval(this.nowTimer);
      this.nowTimer = null;
    }
  }

  loadData() {
    this.loading = true;
    this.error = '';

    forkJoin({
      users: this.portalService.getUsers(),
      tickets: this.portalService.getTickets(),
      hireRequests: this.portalService.getHireRequests(),
    }).subscribe({
      next: ({ users, tickets, hireRequests }) => {
        this.users = users;
        this.tickets = tickets;
        this.hireRequests = hireRequests;
        this.loading = false;
        setTimeout(() => this.playIntro());
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.message ?? 'Failed to load admin data.';
      },
    });
  }

  get workerCount() {
    return this.users.filter((item) => item.role === 'worker').length;
  }

  get onlineWorkerCount() {
    return this.users.filter((item) => item.role === 'worker' && item.workerOnline).length;
  }

  get highPriorityTickets() {
    return this.tickets.filter(
      (item) => item.priority === 'high' && !['completed', 'cancelled'].includes(item.status),
    ).length;
  }

  get pendingTickets() {
    return this.tickets.filter((item) => item.status === 'pending').length;
  }

  get activeTicketCount() {
    return this.tickets.filter((item) => !['completed', 'cancelled'].includes(item.status)).length;
  }

  get closedTicketCount() {
    return this.tickets.filter((item) => ['completed', 'cancelled'].includes(item.status)).length;
  }

  get overdueTicketCount() {
    return this.tickets.filter((item) => item.slaOverdue).length;
  }

  get pendingHireRequests() {
    return this.hireRequests.filter((item) => item.status === 'pending').length;
  }

  get latestPendingHireRequests() {
    return this.hireRequests.filter((item) => item.status === 'pending').slice(0, 5);
  }

  get statusBreakdown(): DonutSlice[] {
    const open = this.activeTicketCount;
    return [
      { label: 'Open', value: open, color: 'var(--chart-2)' },
      { label: 'Completed', value: this.tickets.filter((item) => item.status === 'completed').length, color: 'var(--chart-1)' },
      { label: 'Cancelled', value: this.tickets.filter((item) => item.status === 'cancelled').length, color: 'var(--chart-5)' },
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

  private refreshNowLabel() {
    // Keep a stable binding value to avoid ExpressionChangedAfterItHasBeenCheckedError in dev mode.
    this.nowLabel = new Date().toLocaleString();
  }

  private playIntro() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate('.admin-page .hero-panel', { opacity: [0, 1], translateY: [-10, 0], duration: 400, ease: 'out(3)' });
    animate('.stats article', { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: stagger(60), ease: 'out(3)' });
    animate('.metrics-bar .metric', { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: stagger(60, { start: 150 }), ease: 'out(3)' });
    animate('.charts .card', { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: stagger(80, { start: 200 }), ease: 'out(3)' });
    animate('.panel-grid .card', { opacity: [0, 1], translateY: [14, 0], duration: 450, delay: stagger(80, { start: 280 }), ease: 'out(3)' });
  }
}
