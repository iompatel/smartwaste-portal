import { CommonModule } from '@angular/common';
import { Component, ElementRef, inject, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { APP_TITLE } from '../core/constants';
import { AppNotification, User } from '../models/types';
import { PortalService } from '../services/portal.service';
import { SESSION_SERVICE } from '../services/session';
import { RolePillComponent } from '../shared/role-pill.component';
import { SHELL_NAVIGATION, ShellNavItem } from './shell-navigation';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    RolePillComponent,
  ],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss',
})
export class ShellComponent implements OnInit {
  @ViewChild('notificationMenu') notificationMenu?: ElementRef<HTMLDetailsElement>;

  readonly title = APP_TITLE;
  user: User | null = null;
  notifications: AppNotification[] = [];
  markingAllNotifications = false;
  readonly navItems = inject(SHELL_NAVIGATION);
  private readonly authService = inject(SESSION_SERVICE);

  constructor(
    private readonly portalService: PortalService,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe((user) => {
      this.user = user;
      if (user) {
        this.loadNotifications();
      } else {
        this.notifications = [];
      }
    });
  }

  canShow(roles: string[]) {
    if (!this.user) {
      return false;
    }
    return roles.includes(this.user.role);
  }

  loadNotifications() {
    this.portalService.getNotifications().subscribe({
      next: (items) => {
        this.notifications = items.filter((item) => !item.read).slice(0, 5);
      },
    });
  }

  markNotificationRead(notificationId: number) {
    this.portalService.markNotificationRead(notificationId).subscribe({
      next: () => {
        this.notifications = this.notifications.filter((item) => item.id !== notificationId);
        this.closeNotificationMenu();
      },
    });
  }

  markAllNotificationsRead() {
    if (!this.notifications.length || this.markingAllNotifications) {
      return;
    }

    this.markingAllNotifications = true;
    this.portalService.markAllNotificationsRead().subscribe({
      next: () => {
        this.notifications = [];
        this.markingAllNotifications = false;
        this.closeNotificationMenu();
      },
      error: () => {
        this.markingAllNotifications = false;
      },
    });
  }

  logout() {
    const loginPath = this.authService.loginPathForRole(this.user?.role);
    this.authService.logout();
    this.router.navigate([loginPath]);
  }

  get needsProfileCompletion() {
    return this.authService.needsContactDetails(this.user);
  }

  get currentPageLabel() {
    const path = this.router.url.split(/[?#]/, 1)[0];
    const item = this.navItems.find((navItem) => navItem.path === path);
    return item ? this.navLabel(item) : 'Workspace';
  }

  get userInitials() {
    const first = this.user?.firstName?.[0] ?? '';
    const last = this.user?.lastName?.[0] ?? '';
    return `${first}${last}`.toUpperCase() || 'SW';
  }

  closeNotificationMenu() {
    if (this.notificationMenu?.nativeElement) {
      this.notificationMenu.nativeElement.open = false;
    }
  }

  navLabel(item: ShellNavItem) {
    if (this.user?.role === 'worker' && item.path === '/hire-worker') {
      return 'Hired Task';
    }
    return item.label;
  }

  get profileMenuItems() {
    return this.user ? this.navItems.filter((item) => this.canShow(item.roles)) : [];
  }
}
