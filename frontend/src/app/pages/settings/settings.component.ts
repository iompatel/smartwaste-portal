import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../services/auth.service';
import { BrowserNotificationService } from '../../services/browser-notification.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
})
export class SettingsComponent {
  notificationPermission = 'default';

  constructor(
    private readonly themeService: ThemeService,
    private readonly notificationService: BrowserNotificationService,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.notificationPermission =
      typeof Notification !== 'undefined' ? Notification.permission : 'unsupported';
  }

  get currentTheme() {
    return this.themeService.currentMode;
  }

  toggleTheme() {
    this.themeService.toggle();
  }

  async enableNotifications() {
    const result = await this.notificationService.requestPermission();
    this.notificationPermission = result;
    if (result === 'granted') {
      this.notificationService.notify('Smart Waste', 'Browser notifications enabled.');
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
