import { Component, OnDestroy, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  AvatarComponent,
  BrandMarkComponent,
  ModalComponent,
  ToastComponent,
} from '../shared/ui-components';
import { SidebarComponent } from './sidebar.component';
import { CitizenDashboardComponent } from '../user';
import { WorkerDashboardComponent } from '../worker';
import {
  AdminAccountsComponent,
  AdminActivityComponent,
  AdminBroadcastComponent,
  AdminDashboardComponent,
} from '../admin';
import {
  HandoverModalComponent,
  ReportModalComponent,
  TicketDetailModalComponent,
  TicketsViewComponent,
  WorkerRoutesViewComponent,
} from './tickets.component';
import { HireViewComponent } from './hire.component';
import {
  ProfileViewComponent,
  SettingsViewComponent,
} from './profile.component';
import { LoginComponent } from '../auth/login.component';
import { SignupComponent } from '../auth/signup.component';
import { WorkerLoginComponent } from '../auth/worker-login.component';
import { AdminLoginComponent } from '../auth/admin-login.component';
import { AuthService } from '../core/auth.service';
import { TicketService } from '../core/ticket.service';
import { HireService } from '../core/hire.service';
import { WorkerService } from '../core/worker.service';
import { AdminService } from '../core/admin.service';
import { ApiService } from '../core/api.service';
import { BackendNotification } from '../core/api.types';
import {
  Booking,
  Role,
  Ticket,
  View,
  roleMeta,
} from './data';

type Theme = 'system' | 'light' | 'dark';
type ModalName = 'report' | 'notifications' | 'ticket' | 'handover' | null;

@Component({
  selector: 'app-smartwaste-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
    AvatarComponent,
    BrandMarkComponent,
    ModalComponent,
    ToastComponent,
    SidebarComponent,
    CitizenDashboardComponent,
    WorkerDashboardComponent,
    TicketsViewComponent,
    WorkerRoutesViewComponent,
    ReportModalComponent,
    TicketDetailModalComponent,
    HandoverModalComponent,
    HireViewComponent,
    ProfileViewComponent,
    SettingsViewComponent,
    AdminDashboardComponent,
    AdminAccountsComponent,
    AdminBroadcastComponent,
    AdminActivityComponent,
    LoginComponent,
    SignupComponent,
    WorkerLoginComponent,
    AdminLoginComponent,
  ],
  template: `
    @if (!isLoggedIn() || (consoleMode() === 'admin' && currentUser()?.role !== 'admin') || (consoleMode() === 'worker' && currentUser()?.role !== 'worker') || (consoleMode() === 'citizen' && currentUser()?.role !== 'user')) {
      @if (consoleMode() === 'worker') {
        <app-worker-login
          (success)="onAuthSuccess('worker')"
        ></app-worker-login>
      } @else if (consoleMode() === 'admin') {
        <app-admin-login
          (success)="onAuthSuccess('admin')"
        ></app-admin-login>
      } @else {
        @if (authView() === 'signup') {
          <app-signup
            (success)="onAuthSuccess('citizen')"
            (loginClick)="authView.set('login')"
          ></app-signup>
        } @else {
          <app-login
            (success)="onAuthSuccess('citizen')"
            (signupClick)="authView.set('signup')"
          ></app-login>
        }
      }
    } @else {
      <div class="min-h-screen bg-background text-foreground">
        <!-- Sidebar -->
        <app-sidebar
          [role]="role()"
          [view]="view()"
          [open]="mobileNavOpen()"
          [theme]="isDark() ? 'dark' : 'light'"
          [ticketCount]="tickets().length"
          [routeCount]="activeRouteCount()"
          [bookingCount]="bookings().length"
          [userName]="currentUser() ? currentUser()!.firstName + ' ' + currentUser()!.lastName : undefined"
          [userSubtitle]="currentUser() ? currentUser()!.email : undefined"
          [userInitials]="displayInitials()"
          [userOnline]="role() === 'worker' && onDuty()"
          (close)="mobileNavOpen.set(false)"
          (navigate)="onNavigate($event)"
          (themeToggle)="toggleTheme()"
          (signOut)="onSignOut()"
        ></app-sidebar>

        <div class="min-h-screen lg:pl-[248px]">
          <!-- Sticky Header -->
          <header class="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
            <div class="mx-auto flex h-[72px] max-w-[1500px] items-center gap-3 px-4 sm:px-6 lg:px-8">
              <button
                type="button"
                appButton
                variant="ghost"
                size="icon"
                aria-label="Open navigation"
                (click)="mobileNavOpen.set(true)"
                class="rounded-full lg:hidden"
              >
                <app-icon name="menu" class="size-4"></app-icon>
              </button>

              <!-- Breadcrumbs -->
              <div class="hidden min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span class="font-medium text-foreground">{{ currentRoleMeta().label }}</span>
                <app-icon name="chevron-right" class="size-3.5"></app-icon>
                <span class="truncate">{{ currentViewLabel() }}</span>
              </div>

              <!-- Mobile Center Brand -->
              <div class="flex flex-1 justify-center sm:hidden">
                <app-brand-mark [compact]="true"></app-brand-mark>
              </div>

              <!-- Search Bar -->
              <div class="relative ml-auto hidden w-full max-w-[240px] md:block">
                <app-icon name="search" class="pointer-events-none absolute inset-y-0 left-3.5 my-auto size-4 text-muted-foreground"></app-icon>
                <input
                  aria-label="Search reports and accounts"
                  [(ngModel)]="search"
                  (keydown.enter)="onSearchEnter()"
                  placeholder="Search anything"
                  class="h-10 w-full rounded-full border border-border/70 bg-muted/50 pr-4 pl-10 text-xs outline-none transition-colors placeholder:text-muted-foreground/70 focus:border-primary/50 focus:bg-card focus:ring-3 focus:ring-primary/10 text-foreground"
                />
              </div>

              <!-- Right Header Actions -->
              <div class="flex items-center gap-1.5">
                <button
                  type="button"
                  appButton
                  variant="ghost"
                  size="icon"
                  [attr.aria-label]="isDark() ? 'Switch to light mode' : 'Switch to dark mode'"
                  (click)="toggleTheme()"
                  class="rounded-full"
                >
                  @if (isDark()) {
                    <app-icon name="sun" class="size-4"></app-icon>
                  } @else {
                    <app-icon name="moon" class="size-4"></app-icon>
                  }
                </button>

                <button
                  type="button"
                  appButton
                  variant="ghost"
                  size="icon"
                  aria-label="Open notifications"
                  (click)="openNotificationsModal()"
                  class="relative rounded-full"
                >
                  <app-icon name="bell" class="size-4"></app-icon>
                  @if (unreadNotifCount() > 0) {
                    <span class="absolute top-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-danger text-[8px] font-semibold text-white">
                      {{ unreadNotifCount() > 9 ? '9+' : unreadNotifCount() }}
                    </span>
                  }
                </button>

                <button
                  type="button"
                  aria-label="Open your profile"
                  (click)="onNavigate('profile')"
                  class="ml-1 rounded-full transition-transform hover:scale-105 cursor-pointer"
                >
                  <app-avatar [initials]="displayInitials()" class="size-9" [online]="role() === 'worker' && onDuty()"></app-avatar>
                </button>
              </div>
            </div>
          </header>

          <!-- Main Content Area -->
          <main class="mx-auto w-full max-w-[1500px] px-4 pt-5 pb-24 sm:px-6 sm:pt-6 lg:px-8 lg:pt-8 lg:pb-10">
            @if (role() === 'citizen' && view() === 'overview') {
              <app-citizen-dashboard
                [tickets]="tickets()"
                [bookings]="bookings()"
                [userName]="currentUser() ? currentUser()!.firstName : 'Citizen'"
                (report)="modal.set('report')"
                (hire)="onNavigate('hire')"
                (navigate)="onNavigate($event)"
                (selectTicket)="selectTicket($event)"
              ></app-citizen-dashboard>
            }

            @if (role() === 'citizen' && view() === 'tickets') {
              <app-tickets-view
                [tickets]="tickets()"
                [search]="search"
                (report)="modal.set('report')"
                (selectTicket)="selectTicket($event)"
              ></app-tickets-view>
            }

            @if (role() === 'citizen' && view() === 'hire') {
              <app-hire-view
                [bookings]="bookings()"
                (createBooking)="createBooking($event)"
              ></app-hire-view>
            }

            @if (role() === 'worker' && view() === 'overview') {
              <app-worker-dashboard
                [tickets]="tickets()"
                [onDuty]="onDuty()"
                [location]="workerLocation()"
                (dutyChange)="onDutyChange($event)"
                (openHandover)="openHandover($event)"
                (startRoute)="startTicket($event)"
                (navigate)="onNavigate($event)"
              ></app-worker-dashboard>
            }

            @if (role() === 'worker' && view() === 'tickets') {
              <app-worker-routes-view
                [tickets]="tickets()"
                [onDuty]="onDuty()"
                (openHandover)="openHandover($event)"
                (startRoute)="startTicket($event)"
              ></app-worker-routes-view>
            }

            @if (role() === 'worker' && view() === 'hire') {
              <app-hire-view
                [bookings]="bookings()"
                [worker]="true"
                (createBooking)="createBooking($event)"
                (completeBooking)="completeBooking($event)"
              ></app-hire-view>
            }

            @if (role() === 'admin' && view() === 'overview') {
              <app-admin-dashboard
                (navigate)="onNavigate($event)"
              ></app-admin-dashboard>
            }

            @if (role() === 'admin' && view() === 'accounts') {
              <app-admin-accounts [search]="search"></app-admin-accounts>
            }

            @if (role() === 'admin' && view() === 'broadcast') {
              <app-admin-broadcast></app-admin-broadcast>
            }

            @if (role() === 'admin' && view() === 'activity') {
              <app-admin-activity></app-admin-activity>
            }

            @if (view() === 'profile') {
              <app-profile-view [role]="role()"></app-profile-view>
            }

            @if (view() === 'settings') {
              <app-settings-view
                [theme]="theme()"
                (themeChange)="setTheme($event)"
              ></app-settings-view>
            }
          </main>
        </div>

        <!-- Modals -->
        @if (modal() === 'report') {
          <app-report-modal
            (close)="modal.set(null)"
            (create)="createTicket($event)"
          ></app-report-modal>
        }

        @if (modal() === 'ticket' && selectedTicket(); as ticket) {
          <app-ticket-detail-modal
            [ticket]="ticket"
            (close)="modal.set(null)"
          ></app-ticket-detail-modal>
        }

        @if (modal() === 'handover' && selectedTicket(); as ticket) {
          <app-handover-modal
            [ticket]="ticket"
            (close)="modal.set(null)"
            (complete)="completeTicket($event)"
          ></app-handover-modal>
        }

        @if (modal() === 'notifications') {
          <app-modal
            title="Notifications"
            description="Updates from your neighborhood and collections."
            (close)="modal.set(null)"
          >
            <div class="mb-4 flex items-center justify-between">
              <span class="inline-flex items-center gap-2 text-[11px] text-brand">
                <app-icon name="bell" class="size-3.5"></app-icon>Latest updates
              </span>
              <button
                type="button"
                (click)="markAllNotificationsRead()"
                class="text-xs font-medium text-primary cursor-pointer hover:opacity-80"
              >
                Mark all as read
              </button>
            </div>

            <div class="flex flex-col gap-2">
              @for (notification of notifications(); track notification.id; let i = $index) {
                <div
                  class="flex w-full items-start gap-3 rounded-[16px] p-3.5 text-left bg-muted/40"
                  [ngClass]="isNotificationUnread(notification) ? 'bg-primary/5 border border-primary/20' : ''"
                >
                  <span class="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-brand/10 text-brand">
                    <app-icon name="bell" class="size-4"></app-icon>
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block text-xs font-medium text-foreground">{{ notification.title }}</span>
                    <span class="mt-1 block text-[11px] leading-4 text-muted-foreground">{{ notification.message }}</span>
                    <span class="mt-2 block text-[10px] text-muted-foreground">{{ apiService.formatTimeAgo(notification.createdAt) }}</span>
                  </span>
                  @if (isNotificationUnread(notification)) {
                    <span class="mt-1 size-2 shrink-0 rounded-full bg-primary"></span>
                  }
                </div>
              }

              @if (notifications().length === 0) {
                <div class="py-8 text-center text-xs text-muted-foreground">
                  No notifications yet. You are all caught up!
                </div>
              }
            </div>

            <div class="mt-5 border-t border-border/60 pt-4 text-center">
              <button
                type="button"
                (click)="modal.set(null)"
                class="text-xs font-medium text-primary cursor-pointer hover:opacity-80"
              >
                Close
              </button>
            </div>
          </app-modal>
        }

        <!-- Toast Feedback -->
        @if (toast()) {
          <app-toast [message]="toast()" (close)="toast.set('')"></app-toast>
        }
      </div>
    }
  `
})
export class SmartWastePortalComponent implements OnInit, OnDestroy {
  authView = signal<'login' | 'signup'>('login');
  consoleMode = signal<'citizen' | 'worker' | 'admin'>('citizen');

  role = signal<Role>('citizen');
  view = signal<View>('overview');
  tickets = signal<Ticket[]>([]);
  bookings = signal<Booking[]>([]);
  notifications = signal<BackendNotification[]>([]);
  selectedTicket = signal<Ticket | null>(null);
  modal = signal<ModalName>(null);
  mobileNavOpen = signal<boolean>(false);
  search = '';
  theme = signal<Theme>('system');
  systemDark = signal<boolean>(false);
  toast = signal<string>('');
  onDuty = signal<boolean>(false);
  workerLocation = signal<{ latitude: number; longitude: number; accuracy: number } | null>(null);
  private dutyTimer?: number;

  currentUser = computed(() => this.auth.currentUser());
  isLoggedIn = computed(() => this.auth.isLoggedIn());

  unreadNotifCount = computed(() => {
    return this.notifications().filter((n) => !n.read).length;
  });

  isDark = computed(() => {
    return this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark());
  });

  currentRoleMeta = computed(() => roleMeta[this.role()]);

  displayInitials = computed(() => {
    const user = this.currentUser();
    if (user) {
      const f = user.firstName ? user.firstName[0] : '';
      const l = user.lastName ? user.lastName[0] : '';
      return (f + l).toUpperCase() || 'U';
    }
    return this.currentRoleMeta().initials;
  });

  currentViewLabel = computed(() => {
    const v = this.view();
    const r = this.role();
    if (v === 'overview') return r === 'admin' ? 'Command center' : r === 'worker' ? 'Field cockpit' : 'Overview';
    if (v === 'tickets') return r === 'worker' ? 'Route queue' : 'My reports';
    if (v === 'hire') return r === 'worker' ? 'Hired tasks' : 'Hire a worker';
    if (v === 'profile') return r === 'worker' ? 'Field credentials' : 'Profile & settings';
    if (v === 'accounts') return 'Accounts';
    if (v === 'broadcast') return 'Broadcast';
    if (v === 'activity') return 'Audit activity';
    return 'Settings';
  });

  activeRouteCount = computed(() => {
    return this.tickets().filter((t) => t.status !== 'Completed').length;
  });

  constructor(
    public auth: AuthService,
    private ticketService: TicketService,
    private hireService: HireService,
    private workerService: WorkerService,
    private adminService: AdminService,
    public apiService: ApiService
  ) {
    effect(() => {
      const dark = this.isDark();
      const root = document.documentElement;
      root.classList.toggle('dark', dark);
      root.classList.toggle('light', !dark);
    });

    effect(() => {
      const msg = this.toast();
      if (msg) {
        setTimeout(() => this.toast.set(''), 4200);
      }
    });

    effect(() => {
      this.role();
      this.view();
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'auto' });
      }
    });
  }

  async ngOnInit() {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname.toLowerCase();
      const host = window.location.hostname.toLowerCase();
      const port = window.location.port;
      const search = new URLSearchParams(window.location.search);
      const param = (search.get('console') || search.get('portal') || search.get('role') || '').toLowerCase();
      const storedTheme = localStorage.getItem('swms_theme');
      if (storedTheme === 'system' || storedTheme === 'light' || storedTheme === 'dark') {
        this.theme.set(storedTheme);
      }

      const configuredConsole = String((window as any).__SWMS_CONFIG__?.CONSOLE_MODE ?? '');
      const detectedConsole: 'citizen' | 'worker' | 'admin' =
        path.includes('worker') || host.startsWith('worker') || port === '4400' || param === 'worker'
          ? 'worker'
          : path.includes('admin') || host.startsWith('admin') || port === '4300' || param === 'admin'
            ? 'admin'
            : 'citizen';
      // A deploy that declares its console is authoritative, so the worker site
      // cannot render the citizen login (and its Google button) on an odd host.
      const consoleMode: 'citizen' | 'worker' | 'admin' =
        configuredConsole === 'worker' || configuredConsole === 'admin' || configuredConsole === 'citizen'
          ? configuredConsole
          : detectedConsole;

      this.consoleMode.set(consoleMode);
      this.role.set(consoleMode);
      if (consoleMode === 'citizen') {
        this.authView.set(path.includes('signup') ? 'signup' : 'login');
      }

      await this.auth.initialized;
      const user = this.auth.currentUser();
      if (user) {
        if (user.role === 'admin' && this.consoleMode() === 'admin') this.role.set('admin');
        else if (user.role === 'worker' && this.consoleMode() === 'worker') this.role.set('worker');
        else if (user.role === 'user' && this.consoleMode() === 'citizen') this.role.set('citizen');
      }

      const media = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(media.matches);
      media.addEventListener('change', (e) => this.systemDark.set(e.matches));
    }

    if (this.isLoggedIn()) {
      await this.loadData();
    }
  }

  async loadData() {
    if (!this.isLoggedIn()) return;

    try {
      const liveTickets = await this.ticketService.getTickets();
      if (liveTickets && liveTickets.length > 0) {
        this.tickets.set(liveTickets.map((t) => this.apiService.mapTicketToUi(t)));
      } else {
        this.tickets.set([]);
      }
    } catch {
      // Retain the last successful snapshot during transient API failures.
    }

    try {
      const liveHires = await this.hireService.getHireRequests();
      if (liveHires && liveHires.length > 0) {
        this.bookings.set(liveHires.map((h) => this.apiService.mapHireToUi(h)));
      } else {
        this.bookings.set([]);
      }
    } catch {
      // Retain the last successful snapshot during transient API failures.
    }

    try {
      const liveNotifs = await this.adminService.getNotifications();
      if (liveNotifs && liveNotifs.length > 0) {
        this.notifications.set(liveNotifs);
      } else {
        this.notifications.set([]);
      }
    } catch {
      // Retain the last successful snapshot during transient API failures.
    }

    const user = this.currentUser();
    if (user?.role === 'worker') {
      this.onDuty.set(user.workerOnline ?? false);
      if (this.onDuty()) {
        this.startDutyHeartbeat();
      }
    }
  }

  ngOnDestroy() {
    this.stopDutyHeartbeat();
  }

  private startDutyHeartbeat() {
    this.stopDutyHeartbeat();
    this.broadcastLocation();
    this.dutyTimer = window.setInterval(() => {
      void this.workerService.sendHeartbeat().catch(() => undefined);
      this.broadcastLocation();
    }, 15000);
  }

  private stopDutyHeartbeat() {
    if (this.dutyTimer) {
      clearInterval(this.dutyTimer);
      this.dutyTimer = undefined;
    }
  }

  private broadcastLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.workerLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 10,
        });
        void this.workerService
          .updateLocation(
            position.coords.latitude,
            position.coords.longitude,
            position.coords.accuracy ?? 10,
          )
          .catch(() => undefined);
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 },
    );
  }

  onNavigate(nextView: View) {
    this.view.set(nextView);
    this.mobileNavOpen.set(false);
  }

  async onAuthSuccess(newRole: Role) {
    this.authView.set('login');
    this.role.set(newRole);
    this.view.set('overview');
    const name = this.currentUser()?.firstName || 'User';
    this.toast.set(`Welcome, ${name}! Signed in successfully.`);
    await this.loadData();
  }

  async onSignOut() {
    this.stopDutyHeartbeat();
    await this.auth.logout();
    this.tickets.set([]);
    this.bookings.set([]);
    this.notifications.set([]);
    this.toast.set('Signed out successfully.');
    this.authView.set('login');
  }

  selectTicket(ticket: Ticket) {
    this.selectedTicket.set(ticket);
    this.modal.set('ticket');
  }

  openHandover(ticket: Ticket) {
    this.selectedTicket.set(ticket);
    this.modal.set('handover');
  }

  openNotificationsModal() {
    this.modal.set('notifications');
  }

  isNotificationUnread(notif: BackendNotification): boolean {
    return !notif.read;
  }

  async markAllNotificationsRead() {
    try {
      await this.adminService.markAllNotificationsRead();
      this.notifications.update((list) => list.map((n) => ({ ...n, read: true })));
    } catch (err) {
      console.warn('Mark all read failed:', err);
    }
  }

  async createTicket(ticket: Ticket) {
    try {
      const created = await this.ticketService.createTicket({
        wasteType: ticket.category,
        description: ticket.description || ticket.title,
        locationAddress: ticket.address,
        priority: (ticket.priority.toLowerCase() as any) || 'medium',
        mediaData: ticket.mediaData || null,
      });

      if (created) {
        const uiTicket = this.apiService.mapTicketToUi(created);
        this.tickets.update((list) => [uiTicket, ...list]);
        this.modal.set(null);
        this.view.set('tickets');
        this.toast.set(`${uiTicket.id} submitted. Dispatch will review it shortly.`);
        await this.loadData();
        return;
      }
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not submit report.');
    }
  }

  async createBooking(booking: Booking) {
    try {
      const created = await this.hireService.createHireRequest({
        title: booking.title,
        purpose: booking.purpose || 'Residential maintenance and waste collection',
        workAddress: booking.address || '',
      });
      if (created) {
        const uiHire = this.apiService.mapHireToUi(created);
        this.bookings.update((list) => [uiHire, ...list]);
        this.toast.set(`${uiHire.title} requested successfully.`);
        await this.loadData();
        return;
      }
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not create booking.');
    }
  }

  async completeBooking(booking: Booking) {
    if (!booking.numericId) return;
    try {
      const updated = await this.hireService.completeHireRequest(booking.numericId);
      if (updated) {
        this.bookings.update((list) =>
          list.map((b) => (b.id === booking.id ? this.apiService.mapHireToUi(updated) : b))
        );
        this.toast.set(`${booking.id} marked complete. Dispatch has been notified.`);
        await this.loadData();
      }
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not complete booking.');
    }
  }

  async startTicket(ticket: Ticket) {
    const numId = ticket.numericId;
    if (numId) {
      try {
        const rawStatus = ticket.raw?.status;
        if (rawStatus === 'pending' || rawStatus === 'assigned') {
          await this.ticketService.updateWorkerStatus(numId, 'accepted');
        }
        const updated = await this.ticketService.updateWorkerStatus(numId, 'in_progress');
        if (updated) {
          const uiUpdated = this.apiService.mapTicketToUi(updated);
          this.tickets.update((list) =>
            list.map((t) => (t.id === ticket.id ? uiUpdated : t))
          );
          this.toast.set(`Started ${ticket.id}. Completion code was sent to the resident.`);
          await this.loadData();
          return;
        }
      } catch (err: any) {
        this.toast.set(err?.message || 'Failed to start route on server.');
        return;
      }
    }
    this.tickets.update((list) =>
      list.map((t) => (t.id === ticket.id ? { ...t, status: 'In progress' } : t))
    );
    this.toast.set(`Started route for ${ticket.id}.`);
  }

  async completeTicket(payload: { ticket: Ticket; otp: string; photoData: string }) {
    const { ticket, otp, photoData } = payload;
    const numId = ticket.numericId;

    if (numId) {
      try {
        const updated = await this.ticketService.updateWorkerStatus(numId, 'completed', {
          completionCode: otp,
          completionMediaData: photoData,
        });
        if (updated) {
          const uiUpdated = this.apiService.mapTicketToUi(updated);
          this.tickets.update((list) =>
            list.map((item) => (item.id === ticket.id ? uiUpdated : item))
          );
          this.modal.set(null);
          this.toast.set(`${ticket.id} completed and verified with after-photo.`);
          await this.loadData();
          return;
        }
      } catch (err: any) {
        this.toast.set(err?.message || 'Verification failed on server.');
        return;
      }
    }

    this.tickets.update((list) =>
      list.map((item) =>
        item.id === ticket.id ? { ...item, status: 'Completed' as const, time: 'Just now' } : item
      )
    );
    this.modal.set(null);
    this.toast.set(`${ticket.id} completed and verified.`);
  }

  async onDutyChange(onDuty: boolean) {
    this.onDuty.set(onDuty);
    try {
      await this.workerService.setAvailability(onDuty);
      if (onDuty) {
        this.startDutyHeartbeat();
      } else {
        this.stopDutyHeartbeat();
        this.workerLocation.set(null);
      }
      const user = this.currentUser();
      if (user) {
        const updatedUser = { ...user, workerOnline: onDuty };
        this.auth.currentUser.set(updatedUser);
        this.apiService.setStoredUser(updatedUser);
      }
      this.toast.set(onDuty ? 'Dispatch availability enabled.' : 'Shift paused.');
    } catch (err: any) {
      this.onDuty.set(!onDuty);
      this.toast.set(err?.message || 'Could not update duty status.');
    }
  }

  setTheme(t: Theme) {
    this.theme.set(t);
    localStorage.setItem('swms_theme', t);
  }

  toggleTheme() {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  onSearchEnter() {
    this.onNavigate(this.role() === 'admin' ? 'accounts' : 'tickets');
  }
}
