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

  toggleMobileMenu() {
    this.mobileMenuOpen = !this.mobileMenuOpen;
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
    if (!target.closest('.mobile-drawer') && !target.closest('.mobile-menu-btn')) {
      if (this.mobileMenuOpen) {
        this.toggleMobileMenu();
      }
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.notificationsOpen = false;
    this.profileMenuOpen = false;
    if (this.mobileMenuOpen) {
      this.toggleMobileMenu();
    }
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