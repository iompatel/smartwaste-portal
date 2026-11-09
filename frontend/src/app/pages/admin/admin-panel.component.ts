import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { HireRequest, Ticket, User } from '../../models/types';
import { PortalService } from '../../services/portal.service';
import { StatusBadgeComponent } from '../../shared/status-badge.component';

@Component({
  selector: 'app-admin-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, StatusBadgeComponent],
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

  get highPriorityTickets() {
    return this.tickets.filter((item) => item.priority === 'high').length;
  }

  get pendingTickets() {
    return this.tickets.filter((item) => item.status === 'pending').length;
  }

  get activeTicketCount() {
    return this.tickets.filter((item) => item.status !== 'completed').length;
  }

  get closedTicketCount() {
    return this.tickets.filter((item) => item.status === 'completed').length;
  }

  get pendingHireRequests() {
    return this.hireRequests.filter((item) => item.status === 'pending').length;
  }

  get latestPendingHireRequests() {
    return this.hireRequests.filter((item) => item.status === 'pending').slice(0, 5);
  }

  private refreshNowLabel() {
    // Keep a stable binding value to avoid ExpressionChangedAfterItHasBeenCheckedError in dev mode.
    this.nowLabel = new Date().toLocaleString();
  }
}
