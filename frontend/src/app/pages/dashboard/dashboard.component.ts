import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { animate, stagger } from 'motion';
import { catchError, forkJoin, of } from 'rxjs';

import { formatTimeAgo } from '../../core/time.utils';
import { DashboardSummary, HireRequest, Ticket, WorkerReviewSummary } from '../../models/types';
import { AuthService } from '../../services/auth.service';
import { PortalService } from '../../services/portal.service';
import { StatCardComponent } from '../../shared/stat-card.component';
import { StatusBadgeComponent } from '../../shared/status-badge.component';
import { SkeletonComponent } from '../../shared/skeleton/skeleton.component';
import { EmptyStateComponent } from '../../shared/empty-state/empty-state.component';
import { ToastService } from '../../shared/toast/toast.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    StatCardComponent,
    StatusBadgeComponent,
    SkeletonComponent,
    EmptyStateComponent,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  loading = true;
  summary: DashboardSummary | null = null;
  tickets: Ticket[] = [];
  hireRequests: HireRequest[] = [];
  ticketsError = '';
  hireError = '';
  error = '';
  savingAvailability = false;
  workerReviews: WorkerReviewSummary | null = null;
  activeTab = 'tickets';
  nowTimestamp = Date.now();

  private autoReloadTimer: any = null;
  private liveClockTimer: any = null;

  constructor(
    private readonly portalService: PortalService,
    private readonly authService: AuthService,
    private readonly router: Router,
    private readonly toastService: ToastService,
  ) {}

  get isUser() {
    return this.authService.currentUser?.role === 'user';
  }

  get isWorker() {
    return this.authService.currentUser?.role === 'worker';
  }

  get currentUser() {
    return this.authService.currentUser;
  }

  get userDisplayName(): string {
    const user = this.authService.currentUser;
    if (!user) return 'Citizen';
    if (user.firstName) return user.firstName;
    return user.email?.split('@')[0] || 'Citizen';
  }

  get greeting(): string {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  }

  get currentDateFormatted(): string {
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    }).format(new Date());
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

  ngOnInit() {
    this.reload();
    this.autoReloadTimer = setInterval(() => this.autoReload(), 8_000);
    this.liveClockTimer = setInterval(() => {
      this.nowTimestamp = Date.now();
    }, 5_000);
  }

  ngOnDestroy() {
    if (this.autoReloadTimer) clearInterval(this.autoReloadTimer);
    if (this.liveClockTimer) clearInterval(this.liveClockTimer);
  }

  timeAgo(date: string | Date | null | undefined): string {
    return formatTimeAgo(date, this.nowTimestamp);
  }

  private autoReload() {
    if (document.hidden) return;
    const summary$ = this.portalService.getSummary().pipe(catchError(() => of(this.summary)));
    const tickets$ = this.portalService.getTickets().pipe(catchError(() => of(this.tickets)));
    const hireRequests$ = (this.isUser || this.isWorker)
      ? this.portalService.getHireRequests().pipe(catchError(() => of(this.hireRequests)))
      : of([] as HireRequest[]);

    forkJoin([summary$, tickets$, hireRequests$]).subscribe({
      next: ([summary, tickets, hireRequests]) => {
        if (summary) this.summary = summary;
        if (tickets) this.tickets = tickets;
        if (hireRequests) this.hireRequests = hireRequests;
        if (this.isWorker && this.authService.currentUser) {
          this.portalService.getWorkerReviews(this.authService.currentUser.id).subscribe({
            next: (reviews) => (this.workerReviews = reviews),
          });
        }
      },
    });
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
    const goingOnline = !this.workerOnline;
    this.savingAvailability = true;
    this.portalService.setWorkerAvailability(goingOnline).subscribe({
      next: () => {
        this.authService.refreshUser().subscribe({
          next: () => {
            this.savingAvailability = false;
            this.toastService.success(
              goingOnline ? 'You are now online' : 'You are now offline',
              goingOnline ? 'Automatic ticket assignments are enabled.' : 'You will no longer receive automatic assignments.',
            );
            this.reload();
          },
          error: () => (this.savingAvailability = false),
        });
      },
      error: (err) => {
        this.savingAvailability = false;
        this.toastService.error('Update failed', err?.error?.message ?? 'Unable to update worker availability.');
      },
    });
  }

  openDirections(address: string) {
    const destination = encodeURIComponent(String(address ?? '').trim());
    if (!destination) {
      return;
    }

    window.open(`https://www.google.com/maps/dir/?api=1&destination=${destination}`, '_blank', 'noopener');
  }

  openCreate() {
    // Create form lives on the tickets page
    this.router.navigate(['/tickets']);
  }

  createTicketAction = () => {
    this.openCreate();
  };

  hireWorkerAction = () => {
    this.router.navigate(['/hire-worker']);
  };

  private playIntro() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    animate('.dashboard .stats-grid app-stat-card', { opacity: [0, 1], y: [14, 0] }, { duration: 0.45, delay: stagger(0.06), ease: 'easeOut' });
    animate('.dashboard .tracking-item', { opacity: [0, 1], y: [10, 0] }, { duration: 0.4, delay: stagger(0.05, { startDelay: 0.2 }), ease: 'easeOut' });
  }
}