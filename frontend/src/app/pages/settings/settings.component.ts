import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { Router } from '@angular/router';

import { BrowserNotificationService } from '../../services/browser-notification.service';
import { SESSION_SERVICE, SessionService } from '../../services/session';
import { ThemeService } from '../../services/theme.service';
import { TearButtonComponent } from '../../shared/tear-button/tear-button.component';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule, TearButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  notificationPermission = 'default';

  constructor(
    public readonly themeService: ThemeService,
    private readonly notificationService: BrowserNotificationService,
    @Inject(SESSION_SERVICE) private readonly authService: SessionService,
    private readonly router: Router,
  ) {
    this.notificationPermission =
      typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }

  async enableNotifications() {
    const result = await this.notificationService.requestPermission();
    this.notificationPermission = result;
    if (result === 'granted') {
      this.notificationService.notify('Smart Waste', 'Browser notifications enabled.');
    }
  }

  logout() {
    const loginPath = this.authService.loginPathForRole();
    this.authService.logout();
    this.router.navigate([loginPath]);
  }
}
