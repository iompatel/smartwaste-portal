import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, of } from 'rxjs';

import { DashboardSummary, HireRequest, Ticket } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, StatCardComponent, StatusBadgeComponent],
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

  get myTicketCount() {
    return this.tickets.length;
  }

  get openTicketCount() {
    return this.tickets.filter((ticket) => ticket.status !== 'completed').length;
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
      },
      error: () => {
        this.loading = false;
        this.error = this.error || 'Unable to load dashboard data.';
      },
    });
  }

  openDirections(address: string) {
    const destination = encodeURIComponent(String(address ?? '').trim());
    if (!destination) {
      return;
    }

    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank');
  }
}
