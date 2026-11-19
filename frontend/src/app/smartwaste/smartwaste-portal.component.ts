import { Component, OnDestroy, OnInit, computed, effect, signal, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '../shared/icon.component';
import { ButtonDirective } from '../shared/button.component';
import {
  BrandMarkComponent,
  ModalComponent,
  ToastComponent,
} from '../shared/ui-components';
import { SidebarComponent } from './sidebar.component';
import { CitizenDashboardComponent } from '../user';
import { WorkerDashboardComponent, WorkerLeavesComponent } from '../worker';
import {
  AdminAccountsComponent,
  AdminActivityComponent,
  AdminBroadcastComponent,
  AdminDashboardComponent,
  AdminLeavesComponent,
  AdminLiveMapComponent,
  AdminReportsComponent,
} from '../admin';
import {
  CancelTicketModalComponent,
  HandoverModalComponent,
  ReportModalComponent,
  TicketDraft,
  TicketDetailModalComponent,
  TicketsViewComponent,
  WorkerRoutesViewComponent,
} from './tickets.component';
import { HireViewComponent } from './hire.component';
import {
  ProfileViewComponent,
  SettingsViewComponent,
} from './profile.component';
import { FaqViewComponent, TermsViewComponent } from './help.component';
import {
  NotificationStackComponent,
  StackNotificationItem,
} from '../shared/notification-stack.component';
import {
  ProfileDropdownComponent,
  AccountStatus,
  AccountTheme,
} from '../shared/profile-dropdown.component';
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
import { BackendNotification, BackendTicket } from '../core/api.types';
import {
  Booking,
  Role,
  Ticket,
  View,
  isClosedStatus,
  navByRole,
  roleMeta,
} from './data';

type Theme = 'system' | 'light' | 'dark';
type ModalName = 'report' | 'notifications' | 'ticket' | 'handover' | 'cancel-ticket' | null;

@Component({
  selector: 'app-smartwaste-portal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonDirective,
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
    CancelTicketModalComponent,
    HireViewComponent,
    ProfileViewComponent,
    SettingsViewComponent,
    FaqViewComponent,
    TermsViewComponent,
    AdminDashboardComponent,
    AdminAccountsComponent,
    AdminBroadcastComponent,
    AdminActivityComponent,
    AdminLiveMapComponent,
    AdminReportsComponent,
    WorkerLeavesComponent,
    AdminLeavesComponent,
    LoginComponent,
    SignupComponent,
    WorkerLoginComponent,
    AdminLoginComponent,
    NotificationStackComponent,
    ProfileDropdownComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
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
          (close)="mobileNavOpen.set(false)"
          (navigate)="onNavigate($event)"
          (themeToggle)="toggleTheme()"
        ></app-sidebar>

        <div class="min-h-screen lg:pl-[248px]">
          <!-- Sticky Header -->
          <header class="sticky top-0 z-20 border-b border-border/60 bg-background/80 backdrop-blur-2xl">
            <div class="mx-auto flex h-[72px] max-w-[1500px] items-center gap-2.5 sm:gap-3 px-3.5 sm:px-6 lg:px-8">
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

              <!-- Mobile Brand with App Name (placed in the blank space next to menu) -->
              <div class="flex items-center min-w-0 sm:hidden">
                <button
                  type="button"
                  (click)="onNavigate('overview')"
                  aria-label="SmartWaste home"
                  class="inline-flex items-center cursor-pointer outline-none transition-transform hover:scale-105 active:scale-95 bg-transparent border-0 p-0"
                >
                  <app-brand-mark [size]="'responsive'"></app-brand-mark>
                </button>
              </div>

              <!-- Breadcrumbs -->
              <div class="hidden min-w-0 flex-1 items-center gap-2 text-xs text-muted-foreground sm:flex">
                <span class="font-medium text-foreground">{{ currentRoleMeta().label }}</span>
                <app-icon name="chevron-right" class="size-3.5"></app-icon>
                <span class="truncate">{{ currentViewLabel() }}</span>
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
              <div class="ml-auto flex items-center gap-1.5 md:ml-0">
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
                    <span class="absolute top-1.5 right-1.5 flex size-3.5 items-center justify-center rounded-full bg-danger-ink text-[8px] font-semibold text-white">
                      {{ unreadNotifCount() > 9 ? '9+' : unreadNotifCount() }}
                    </span>
                  }
                </button>

                <app-profile-dropdown
                  class="ml-1"
                  variant="compact"
                  placement="bottom-end"
                  [user]="currentUser()"
                  [role]="role()"
                  [currentTheme]="theme()"
                  [currentStatus]="role() === 'worker' ? (onDuty() ? 'online' : 'away') : 'online'"
                  (statusChange)="onProfileStatusChange($event)"
                  (themeChange)="onProfileThemeChange($event)"
                  (navigate)="onNavigate($event)"
                  (signOut)="onSignOut()"
                ></app-profile-dropdown>
              </div>
            </div>
          </header>

          <!-- Main Content Area -->
          <main class="mx-auto w-full max-w-[1500px] px-4 pt-5 pb-28 sm:px-6 sm:pt-6 sm:pb-28 lg:px-8 lg:pt-8 lg:pb-10">
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
                [availabilityPending]="availabilityPending()"
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
                (cancelTicket)="openCancelModal($event)"
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

            @if (role() === 'worker' && view() === 'leaves') {
              <app-worker-leaves></app-worker-leaves>
            }

            @if (role() === 'admin' && view() === 'leaves') {
              <app-admin-leaves mode="applications"></app-admin-leaves>
            }

            @if (role() === 'admin' && view() === 'on-leave') {
              <app-admin-leaves mode="on-leave"></app-admin-leaves>
            }

            @if (role() === 'admin' && view() === 'overview') {
              <app-admin-dashboard
                (navigate)="onNavigate($event)"
              ></app-admin-dashboard>
            }

            @if (role() === 'admin' && (view() === 'users' || view() === 'accounts')) {
              <app-admin-accounts [search]="search" section="user"></app-admin-accounts>
            }

            @if (role() === 'admin' && view() === 'workers') {
              <app-admin-accounts [search]="search" section="worker"></app-admin-accounts>
            }

            @if (role() === 'admin' && view() === 'reports') {
              <app-admin-reports></app-admin-reports>
            }

            @if (role() === 'admin' && view() === 'live-map') {
              <app-admin-live-map></app-admin-live-map>
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
                [role]="role()"
                (themeChange)="setTheme($event)"
              ></app-settings-view>
            }

            @if (role() === 'citizen' && view() === 'faq') {
              <app-faq-view></app-faq-view>
            }

            @if (role() === 'citizen' && view() === 'terms') {
              <app-terms-view></app-terms-view>
            }
          </main>
        </div>

        <!-- Mobile Floating Bottom Navigation -->
        <nav
          aria-label="Mobile navigation"
          style="bottom: max(1rem, env(safe-area-inset-bottom, 0px))"
          class="fixed bottom-4 left-1/2 z-30 flex w-[calc(100%-2rem)] max-w-[430px] -translate-x-1/2 items-center justify-between gap-1 rounded-[30px] border border-border/70 bg-card/95 p-1.5 shadow-[0_10px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl dark:shadow-[0_12px_36px_rgba(0,0,0,0.55)] lg:hidden"
        >
          @for (item of mobileNavItems(); track item.id) {
            @let active = view() === item.id;
            <button
              type="button"
              [attr.aria-current]="active ? 'page' : null"
              (click)="onNavigate(item.id)"
              class="group relative flex flex-1 flex-col items-center justify-center rounded-[20px] px-2 py-2 transition-all cursor-pointer"
              [ngClass]="active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'"
            >
              <app-icon
                [name]="item.icon"
                class="size-5 transition-transform group-active:scale-95"
              ></app-icon>
              <span
                class="mt-1 block max-w-[76px] truncate text-[11px] leading-tight tracking-tight text-center"
                [class.font-semibold]="active"
                [class.font-medium]="!active"
              >
                {{ item.shortLabel || item.label }}
              </span>
            </button>
          }
        </nav>

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
            (trackingChanged)="onTicketTrackingChanged($event)"
            (workerNearby)="onWorkerNearby($event)"
          ></app-ticket-detail-modal>
        }

        @if (modal() === 'handover' && selectedTicket(); as ticket) {
          <app-handover-modal
            [ticket]="ticket"
            (close)="modal.set(null)"
            (complete)="completeTicket($event)"
          ></app-handover-modal>
        }

        @if (modal() === 'cancel-ticket' && selectedTicket(); as ticket) {
          <app-cancel-ticket-modal
            [ticket]="ticket"
            (close)="modal.set(null)"
            (cancelled)="onWorkerCancelTicket($event)"
          ></app-cancel-ticket-modal>
        }

        @if (modal() === 'notifications') {
          <app-modal
            title="Notification Center"
            description="Interactive stacked updates. Hover, tap, or swipe cards to dismiss."
            (close)="modal.set(null)"
          >
            <div class="py-2">
              <app-notification-stack
                [items]="stackNotificationItems()"
                (dismiss)="onDismissNotification($event)"
                (markAllRead)="markAllNotificationsRead()"
                (selectNotification)="onSelectNotification($event)"
              ></app-notification-stack>
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
  availabilityPending = signal(false);
  workerLocation = signal<{ latitude: number; longitude: number; accuracy: number; heading?: number | null; speed?: number | null } | null>(null);
  private dutyTimer?: number;
  private locationTimer?: number;
  private locationWatch?: number;
  private lastLocationFixAt = 0;
  private locationUploadPending = false;
  private dataRefreshTimer?: number;
  private refreshing = false;
  private destroyed = false;
  private popstateListener?: () => void;
  private themeMedia?: MediaQueryList;
  private themeMediaListener?: (event: MediaQueryListEvent) => void;

  currentUser = computed(() => this.auth.currentUser());
  isLoggedIn = computed(() => this.auth.isLoggedIn());

  unreadNotifCount = computed(() => {
    return this.notifications().filter((n) => !n.read).length;
  });

  stackNotificationItems = computed<StackNotificationItem[]>(() => {
    return this.notifications().map((n) => {
      let icon = 'bell';
      let iconBg = 'bg-primary';

      const title = (n.title || '').toLowerCase();
      if (title.includes('message') || title.includes('chat')) {
        icon = 'message-circle';
        iconBg = 'bg-emerald-500';
      } else if (title.includes('ticket') || title.includes('assigned') || title.includes('route')) {
        icon = 'clipboard-check';
        iconBg = 'bg-sky-500';
      } else if (title.includes('hire') || title.includes('worker')) {
        icon = 'briefcase-business';
        iconBg = 'bg-indigo-500';
      } else if (title.includes('completed') || title.includes('rating') || title.includes('review')) {
        icon = 'check-circle';
        iconBg = 'bg-teal-500';
      } else if (title.includes('alert') || title.includes('urgent') || title.includes('cancelled')) {
        icon = 'alert-triangle';
        iconBg = 'bg-rose-500';
      }

      return {
        id: String(n.id),
        app: 'SmartWaste',
        title: n.title,
        body: n.message,
        time: this.apiService.formatTimeAgo(n.createdAt),
        icon,
        iconBg,
        read: !this.isNotificationUnread(n),
      };
    });
  });

  isDark = computed(() => {
    return this.theme() === 'dark' || (this.theme() === 'system' && this.systemDark());
  });

  currentRoleMeta = computed(() => roleMeta[this.role()]);
  mobileNavItems = computed(() => (navByRole[this.role()] ?? []).slice(0, 4));

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
    if (v === 'users') return 'Users';
    if (v === 'workers') return 'Workers';
    if (v === 'reports') return 'PDF reports';
    if (v === 'live-map') return 'Live worker map';
    if (v === 'broadcast') return 'Broadcast';
    if (v === 'activity') return 'Account activity';
    if (v === 'leaves') return r === 'worker' ? 'My leaves' : 'Leave requests';
    if (v === 'on-leave') return 'Workers on leave';
    if (v === 'faq') return 'Frequently asked questions';
    if (v === 'terms') return 'Terms and conditions';
    return 'Settings';
  });

  activeRouteCount = computed(() => {
    return this.tickets().filter((t) => !isClosedStatus(t.status)).length;
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

      this.view.set(this.getViewFromPath(path));

      this.popstateListener = () => {
        if (typeof window !== 'undefined') {
          this.view.set(this.getViewFromPath(window.location.pathname));
        }
      };
      window.addEventListener('popstate', this.popstateListener);

      await this.auth.initialized;
      const user = this.auth.currentUser();
      if (user) {
        if (user.role === 'admin') {
          if (configuredConsole !== 'worker' && configuredConsole !== 'citizen') {
            this.consoleMode.set('admin');
            this.role.set('admin');
          }
        } else if (user.role === 'worker') {
          if (configuredConsole !== 'admin' && configuredConsole !== 'citizen') {
            this.consoleMode.set('worker');
            this.role.set('worker');
          }
        } else if (user.role === 'user') {
          if (configuredConsole !== 'admin' && configuredConsole !== 'worker') {
            this.consoleMode.set('citizen');
            this.role.set('citizen');
          }
        }
      }

      this.themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
      this.systemDark.set(this.themeMedia.matches);
      this.themeMediaListener = (event) => this.systemDark.set(event.matches);
      this.themeMedia.addEventListener('change', this.themeMediaListener);
    }

    if (this.isLoggedIn()) {
      await this.loadData();
    }
    if (!this.destroyed) this.dataRefreshTimer = window.setInterval(() => {
      if (!document.hidden && this.isLoggedIn()) void this.loadData();
    }, 60_000);
  }

  async loadData() {
    if (!this.isLoggedIn() || this.refreshing || this.destroyed) return;
    this.refreshing = true;
    const accountId = this.currentUser()?.id;
    try {
    const [ticketsResult, hiresResult, notificationsResult] = await Promise.allSettled([
      this.ticketService.getTickets(),
      this.hireService.getHireRequests(),
      this.adminService.getNotifications(),
    ]);
    if (this.destroyed || !this.isLoggedIn() || this.currentUser()?.id !== accountId) return;
    if (ticketsResult.status === 'fulfilled') {
      this.tickets.set(ticketsResult.value.map((ticket) => this.apiService.mapTicketToUi(ticket)));
      const selected = this.selectedTicket();
      if (selected) this.selectedTicket.set(this.tickets().find((ticket) => ticket.numericId === selected.numericId) ?? null);
    }
    if (hiresResult.status === 'fulfilled') {
      this.bookings.set(hiresResult.value.map((hire) => this.apiService.mapHireToUi(hire)));
    }
    if (notificationsResult.status === 'fulfilled') {
      this.notifications.set(notificationsResult.value);
    }
    if ([ticketsResult, hiresResult, notificationsResult].some((result) => result.status === 'rejected')) {
      this.toast.set('Some live data could not be refreshed. Showing the last available view.');
    }

    const user = this.currentUser();
    if (user?.role === 'worker' && !this.availabilityPending()) {
      this.onDuty.set(user.workerOnline ?? false);
      if (this.onDuty() && !this.dutyTimer) {
        this.startDutyHeartbeat();
      }
    }
    } finally { this.refreshing = false; }
  }

  ngOnDestroy() {
    this.destroyed = true;
    if (this.dataRefreshTimer) clearInterval(this.dataRefreshTimer);
    this.stopDutyHeartbeat();
    if (typeof window !== 'undefined' && this.popstateListener) {
      window.removeEventListener('popstate', this.popstateListener);
    }
    if (this.themeMedia && this.themeMediaListener) {
      this.themeMedia.removeEventListener('change', this.themeMediaListener);
    }
  }

  private getViewFromPath(pathname: string): View {
    const raw = pathname.toLowerCase().replace(/^\//, '').split('/')[0];
    if (raw === 'accounts' || raw === 'admin-accounts') return 'accounts';
    if (raw === 'users') return 'users';
    if (raw === 'workers') return 'workers';
    if (raw === 'reports') return 'reports';
    if (raw === 'live-map') return 'live-map';
    if (raw === 'broadcast' || raw === 'admin-broadcast') return 'broadcast';
    if (raw === 'activity' || raw === 'admin-activity') return 'activity';
    if (raw === 'tickets') return 'tickets';
    if (raw === 'hire') return 'hire';
    if (raw === 'profile') return 'profile';
    if (raw === 'settings') return 'settings';
    if (raw === 'faq') return 'faq';
    if (raw === 'terms') return 'terms';
    return 'overview';
  }

  private startDutyHeartbeat() {
    this.stopDutyHeartbeat();
    this.broadcastLocation();
    this.dutyTimer = window.setInterval(() => {
      void this.workerService.sendHeartbeat().catch(() => undefined);
    }, 15000);
    this.locationTimer = window.setInterval(() => this.uploadWorkerLocation(), 3000);
  }

  private stopDutyHeartbeat() {
    if (this.dutyTimer) {
      clearInterval(this.dutyTimer);
      this.dutyTimer = undefined;
    }
    if (this.locationTimer) clearInterval(this.locationTimer);
    this.locationTimer = undefined;
    if (this.locationWatch !== undefined) navigator.geolocation.clearWatch(this.locationWatch);
    this.locationWatch = undefined;
    this.lastLocationFixAt = 0;
  }

  private broadcastLocation() {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    this.locationWatch = navigator.geolocation.watchPosition(
      (position) => {
        if (!this.onDuty() || this.destroyed || !this.isLoggedIn()) return;
        const firstFix = this.lastLocationFixAt === 0;
        this.lastLocationFixAt = position.timestamp;
        this.workerLocation.set({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? 10,
          heading: typeof position.coords.heading === 'number' && Number.isFinite(position.coords.heading) ? position.coords.heading : null,
          speed: typeof position.coords.speed === 'number' && Number.isFinite(position.coords.speed) ? position.coords.speed : null,
        });
        if (firstFix) this.uploadWorkerLocation();
      },
      () => {
        this.lastLocationFixAt = 0;
        this.workerLocation.set(null);
        this.toast.set('Location sharing is unavailable. Allow location access to appear on the live worker map.');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 },
    );
  }

  private uploadWorkerLocation() {
    const location = this.workerLocation();
    if (this.destroyed || !this.isLoggedIn() || this.currentUser()?.role !== 'worker' || !this.onDuty() || this.locationUploadPending || !location || !this.lastLocationFixAt) return;
    if (Date.now() - this.lastLocationFixAt > 120000) { this.workerLocation.set(null); return; }
    this.locationUploadPending = true;
    void this.workerService.updateLocation(
      location.latitude,
      location.longitude,
      location.accuracy,
      this.lastLocationFixAt,
      location.heading,
      location.speed,
    )
      .catch(() => undefined).finally(() => { this.locationUploadPending = false; });
  }

  onNavigate(nextView: View) {
    this.view.set(nextView);
    this.mobileNavOpen.set(false);
    if (typeof window !== 'undefined') {
      const targetPath = nextView === 'overview' ? '/dashboard' : `/${nextView}`;
      if (window.location.pathname.toLowerCase() !== targetPath.toLowerCase()) {
        window.history.pushState({ view: nextView }, '', targetPath);
      }
    }
  }

  async onAuthSuccess(newRole: Role) {
    this.authView.set('login');
    this.role.set(newRole);
    this.consoleMode.set(newRole);
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

  openCancelModal(ticket: Ticket) {
    this.selectedTicket.set(ticket);
    this.modal.set('cancel-ticket');
  }

  async onWorkerCancelTicket(event: { ticket: Ticket; reason: string }) {
    const numId = event.ticket.numericId;
    if (!numId) return;
    try {
      const updated = await this.workerService.cancelTicket(numId, event.reason);
      const mapped = this.apiService.mapTicketToUi(updated);
      this.tickets.update((tickets) =>
        tickets.map((t) => (t.numericId === mapped.numericId ? mapped : t)),
      );
      this.modal.set(null);
      this.toast.set(`${mapped.id} cancelled. Resident and dispatch have been notified.`);
      await this.loadData();
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not cancel ticket.');
    }
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
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not mark notifications as read.');
    }
  }

  async onDismissNotification(id: string) {
    const numId = Number(id);
    if (Number.isFinite(numId)) {
      await this.adminService.markNotificationRead(numId).catch(() => undefined);
      this.notifications.update((list) => list.filter((n) => String(n.id) !== id));
    }
  }

  onSelectNotification(item: StackNotificationItem) {
    const numId = Number(item.id);
    if (Number.isFinite(numId)) {
      void this.adminService.markNotificationRead(numId).catch(() => undefined);
      this.notifications.update((list) =>
        list.map((n) => (n.id === numId ? { ...n, read: true } : n)),
      );
    }
  }

  async createTicket(ticket: TicketDraft) {
    try {
      const created = await this.ticketService.createTicket({
        wasteType: ticket.category,
        description: ticket.description || ticket.title,
        locationAddress: ticket.address,
        locationLatitude: ticket.locationLatitude,
        locationLongitude: ticket.locationLongitude,
        priority: (ticket.priority.toLowerCase() as any) || 'medium',
        mediaData: ticket.mediaData || null,
        scheduledFor: ticket.scheduledFor,
        scheduledSlot: ticket.scheduledSlot,
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
        scheduledFor: booking.scheduledFor,
        scheduledSlot: booking.scheduledSlot,
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

  onTicketTrackingChanged(updated: BackendTicket) {
    const mapped = this.apiService.mapTicketToUi(updated);
    this.tickets.update((tickets) => tickets.map((ticket) => ticket.numericId === mapped.numericId ? mapped : ticket));
    this.selectedTicket.set(mapped);
    void this.loadData();
  }

  onWorkerNearby(ticket: Ticket) {
    const message = `${ticket.worker || 'Your worker'} is near the collection point for ${ticket.id}.`;
    this.toast.set(message);
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('SmartWaste worker nearby', { body: message, icon: '/icon.svg' });
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
    if (this.availabilityPending()) return;
    const accountId = this.currentUser()?.id;
    this.availabilityPending.set(true);
    try {
      const updated = await this.workerService.setAvailability(onDuty);
      if (this.destroyed || this.currentUser()?.id !== accountId) return;
      const online = Boolean(updated.workerOnline);
      this.onDuty.set(online);
      if (online) {
        this.startDutyHeartbeat();
      } else {
        this.stopDutyHeartbeat();
        this.workerLocation.set(null);
      }
      const user = this.currentUser();
      if (user) {
        const updatedUser = { ...user, ...updated };
        this.auth.currentUser.set(updatedUser);
        this.apiService.setStoredUser(updatedUser);
      }
      await this.loadData();
      this.toast.set(online ? 'Dispatch availability enabled.' : 'Shift paused.');
    } catch (err: any) {
      this.toast.set(err?.message || 'Could not update duty status.');
    } finally { this.availabilityPending.set(false); }
  }

  setTheme(t: Theme) {
    this.theme.set(t);
    localStorage.setItem('swms_theme', t);
  }

  onProfileThemeChange(t: AccountTheme) {
    this.setTheme(t as Theme);
  }

  onProfileStatusChange(st: AccountStatus) {
    if (this.role() === 'worker') {
      const shouldBeOnDuty = st === 'online';
      if (this.onDuty() !== shouldBeOnDuty) {
        void this.onDutyChange(shouldBeOnDuty);
      }
    }
  }

  toggleTheme() {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  onSearchEnter() {
    this.onNavigate(this.role() === 'admin' ? 'users' : 'tickets');
  }
}
