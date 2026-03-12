import { CommonModule } from '@angular/common';
import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { APP_TITLE } from '../core/constants';
import { AppNotification, User } from '../models/types';
import { AuthService } from '../services/auth.service';
import { PortalService } from '../services/portal.service';
import { RolePillComponent } from '../shared/role-pill.component';

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

  readonly navItems = [
    { label: 'Admin Panel', path: '/dashboard', roles: ['admin'] },
    { label: 'Users', path: '/admin-panel/users', roles: ['admin'] },
    { label: 'Workers', path: '/admin-panel/workers', roles: ['admin'] },
    { label: 'Admin Activity', path: '/admin-activity', roles: ['admin'] },
    { label: 'Dashboard', path: '/dashboard', roles: ['worker', 'user'] },
    { label: 'Tickets', path: '/tickets', roles: ['admin', 'worker', 'user'] },
    { label: 'Hire Worker', path: '/hire-worker', roles: ['admin', 'worker', 'user'] },
    { label: 'Broadcast Desk', path: '/broadcast-desk', roles: ['admin'] },
    { label: 'Profile', path: '/profile', roles: ['admin', 'worker', 'user'] },
    { label: 'Settings', path: '/settings', roles: ['admin', 'worker', 'user'] },
  ];

  constructor(
    private readonly authService: AuthService,
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
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  get needsProfileCompletion() {
    return this.authService.needsContactDetails(this.user);
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

  navLabel(item: { label: string; path: string }) {
    if (this.user?.role === 'admin' && item.path === '/hire-worker') {
      return 'Assign Worker';
    }
    if (this.user?.role === 'worker' && item.path === '/hire-worker') {
      return 'Hired Task';
    }
    return item.label;
  }

  get profileMenuItems() {
    if (!this.user) {
      return [];
    }

    const items: Array<{ label: string; path: string }> = [
      {
        label: this.user.role === 'admin' ? 'Admin Panel' : 'Dashboard',
        path: '/dashboard',
      },
      { label: 'Profile', path: '/profile' },
      { label: 'Settings', path: '/settings' },
    ];

    if (this.user.role === 'admin') {
      items.splice(
        1,
        0,
        { label: 'Users', path: '/admin-panel/users' },
        { label: 'Workers', path: '/admin-panel/workers' },
        { label: 'Assign Worker', path: '/hire-worker' },
        { label: 'Admin Activity', path: '/admin-activity' },
        { label: 'Broadcast Desk', path: '/broadcast-desk' },
      );
    } else {
      items.splice(
        1,
        0,
        { label: 'Tickets', path: '/tickets' },
        { label: this.user.role === 'worker' ? 'Hired Task' : 'Hire Worker', path: '/hire-worker' },
      );
    }

    return items;
  }
}
