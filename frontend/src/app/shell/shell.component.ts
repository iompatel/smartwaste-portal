import { CommonModule } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  ViewChild,
  signal,
  computed,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { APP_TITLE } from '../core/constants';
import { AppNotification, User } from '../models/types';
import { PortalService } from '../services/portal.service';
import { SESSION_SERVICE } from '../services/session';
import { ThemeService } from '../services/theme.service';
import { RolePillComponent } from '../shared/role-pill.component';
import { AvatarComponent } from '../shared/avatar/avatar.component';
import { SHELL_NAVIGATION, ShellNavItem } from './shell-navigation';
import { ToastContainerComponent } from '../shared/toast/toast.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    RolePillComponent,
    AvatarComponent,
    ToastContainerComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit, OnDestroy {
  @ViewChild('notificationMenu') notificationMenu?: ElementRef<HTMLDetailsElement>;

  readonly title = APP_TITLE;
  user = signal<User | null>(null);
  notifications = signal<AppNotification[]>([]);
  markingAllNotifications = false;

  workerLocationStatus = signal<'off' | 'requesting' | 'sharing' | 'blocked'>('off');
  readonly navItems = inject(SHELL_NAVIGATION);

  private readonly authService = inject(SESSION_SERVICE);
  private readonly portalService = inject(PortalService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  readonly themeService = inject(ThemeService);

  mobileMenuOpen = false;
  notificationsOpen = false;
  profileMenuOpen = false;

  private notificationTimer: ReturnType<typeof setInterval> | null = null;
  private workerHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private locationWatchId: number | null = null;
  private lastLocationSentAt = 0;
  private lastWorkerPosition: { latitude: number; longitude: number; accuracy: number } | null = null;

  readonly menuIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`;
  readonly closeIcon = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

  navLabel(item: ShellNavItem) {
    const user = this.user();
    if (user?.role === 'worker' && item.path === '/hire-worker') {
      return 'Hired Task';
    }
    return item.label;
  }

  readonly profileMenuItems = computed(() => {
    const user = this.user();
    return user ? this.navItems.filter((item) => this.canShow(item.roles)) : [];
  });

  readonly unreadCount = computed(() => this.notifications().length);

  constructor() {}

  ngOnInit() {
    this.authService.currentUser$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((user) => {
        this.user.set(user);
        this.syncWorkerLocationTracking();
        if (user) {
          this.loadNotifications();
        } else {
          this.notifications.set([]);
        }
      });

    this.notificationTimer = setInterval(() => {
      if (this.user()) this.loadNotifications();
    }, 30_000);

    this.workerHeartbeatTimer = setInterval(() => {
      if (this.user()?.role !== 'worker' || !this.user()?.workerOnline) return;
      if (this.lastWorkerPosition) {
        this.portalService.updateWorkerLocation(this.lastWorkerPosition).subscribe({ error: () => {} });
      } else {
        this.portalService.sendWorkerHeartbeat().subscribe({ error: () => {} });
      }
    }, 60_000);
  }

  ngOnDestroy() {
    if (this.notificationTimer) clearInterval(this.notificationTimer);
    if (this.workerHeartbeatTimer) clearInterval(this.workerHeartbeatTimer);
    this.stopWorkerLocationTracking();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.notifications-wrapper')) {
      this.notificationsOpen = false;
    }
    if (!target.closest('.profile-menu-wrapper')) {
      this.profileMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.notificationsOpen = false;
    this.profileMenuOpen = false;
    this.mobileMenuOpen = false;
  }

  canShow(roles: string[]) {
    const user = this.user();
    if (!user) return false;
    return roles.includes(user.role);
  }

  loadNotifications() {
    this.portalService.getNotifications().subscribe({
      next: (items) => {
        this.notifications.set(items.filter((item) => !item.read).slice(0, 10));
      },
    });
  }

  toggleNotifications() {
    this.notificationsOpen = !this.notificationsOpen;
    this.profileMenuOpen = false;
  }

  markNotificationRead(notificationId: number) {
    this.portalService.markNotificationRead(notificationId).subscribe({
      next: () => {
        this.notifications.update((items) => items.filter((item) => item.id !== notificationId));
      },
    });
  }

  markAllNotificationsRead() {
    if (!this.notifications().length || this.markingAllNotifications) return;

    this.markingAllNotifications = true;
    this.portalService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications.set([]);
        this.markingAllNotifications = false;
      },
      error: () => {
        this.markingAllNotifications = false;
      },
    });
  }

  logout() {
    const loginPath = this.authService.loginPathForRole(this.user()?.role);
    this.authService.logout();
    this.router.navigate([loginPath]);
    this.mobileMenuOpen = false;
    this.notificationsOpen = false;
    this.profileMenuOpen = false;
  }

  get needsProfileCompletion() {
    return this.authService.needsContactDetails(this.user());
  }

  get currentPageLabel() {
    const path = this.router.url.split(/[?#]/, 1)[0];
    const item = this.navItems.find((navItem) => navItem.path === path);
    return item ? this.navLabel(item) : 'Workspace';
  }

  getLinkIcon(path: string): string {
    const icons: Record<string, string> = {
      '/dashboard': `<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline>`,
      '/tickets': `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline>`,
      '/hire-worker': `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
      '/profile': `<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></path>`,
      '/settings': `<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 1 9 19.4a1.65 1.65 0 0 0-1.82-.33l-.06-.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 1 4.6 9a1.65 1.65 0 0 1 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 1 1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 1 1 1.51 1.65 1.65 0 0 1 1.82.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82.33l.06.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 1-1 1.51V9a1.65 1.65 0 0 1-1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 1-1.51 1z"></path>`,
      '/admin-panel': `<path d="M22 12h-4l-3 9L9 3l-3 9H2"></path>`,
      '/admin-panel/users': `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
      '/admin-panel/workers': `<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path>`,
      '/broadcast-desk': `<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>`,
      '/admin-activity': `<path d="M13 2L3 14h9l-1 8 10-12h9l1-8z"></path>`,
    };
    return icons[path] || `<circle cx="12" cy="12" r="10"></circle>`;
  }

  private syncWorkerLocationTracking() {
    const shouldTrack = this.user()?.role === 'worker' && this.user()?.workerOnline;
    if (!shouldTrack) {
      this.stopWorkerLocationTracking();
      return;
    }
    if (this.locationWatchId !== null) return;
    if (!navigator.geolocation) {
      this.workerLocationStatus.set('blocked');
      return;
    }
    this.workerLocationStatus.set('requesting');
    this.locationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        this.workerLocationStatus.set('sharing');
        this.lastWorkerPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        };
        const now = Date.now();
        if (now - this.lastLocationSentAt < 10_000) return;
        this.lastLocationSentAt = now;
        this.portalService.updateWorkerLocation(this.lastWorkerPosition).subscribe({ error: () => {} });
      },
      () => this.workerLocationStatus.set('blocked'),
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 },
    );
  }

  private stopWorkerLocationTracking() {
    if (this.locationWatchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.locationWatchId);
    }
    this.locationWatchId = null;
    this.lastLocationSentAt = 0;
    this.lastWorkerPosition = null;
    this.workerLocationStatus.set('off');
  }
}